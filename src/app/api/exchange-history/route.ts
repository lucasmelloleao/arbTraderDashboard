import { NextRequest, NextResponse } from 'next/server';
import ccxt from 'ccxt';
import connectMongo from '@/lib/mongodb';
import ExchangeKey from '@/models/ExchangeKey';
import PerpArbTrade from '@/models/PerpArbTrade';
import PerpArbStrategy from '@/models/PerpArbStrategy';
import { withAuth } from '@/lib/auth';
import { decryptSecretKey } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

const DEFAULT_DAYS = 7;

// Resolve instância ccxt e credenciais descriptografadas
function buildExchange(doc: any, userId: string): { exchange: any; secret: string; exchangeId: string; id: string } {
  const exchangeId = String(doc.exchangeId || '').toLowerCase();
  const id = exchangeId === 'gateio' ? 'gate' : exchangeId;
  const cls: any = (ccxt as any)[id] ?? (ccxt as any).pro?.[id] ?? (ccxt as any)[exchangeId];
  if (!cls) throw new Error(`Exchange "${exchangeId}" não suportada pelo ccxt`);

  let secret = '';
  try {
    const authContext = `${userId}-${doc.exchangeId}`;
    secret = decryptSecretKey(String(doc.apiSecret || ''), authContext);
  } catch {
    secret = String(doc.apiSecret || '');
  }

  const exchange = new cls({
    apiKey: doc.apiKey,
    secret,
    enableRateLimit: true,
    timeout: 15000,
    options: { fetchCurrencies: false },
  });
  exchange.has = { ...(exchange.has || {}), fetchCurrencies: false };

  return { exchange, secret, exchangeId, id };
}

function toNumber(v: any): number {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

function ccxtTimestamp(item: any): number {
  if (!item) return 0;
  return Number(item.timestamp || item.datetime || 0) || 0;
}

function normalizeTrade(t: any, exchangeId: string, category: string): any {
  const symbol = t.symbol || '';
  const isPerp = symbol.toLowerCase().includes(':') || t.info?.contractType || t.info?.isolated || t.info?.openType || (category === 'futures');
  const kind = isPerp ? 'futures' : 'spot';
  const timestamp = ccxtTimestamp(t);
  const amount = toNumber(t.amount);
  const price = toNumber(t.price);
  const cost = toNumber(t.cost || 0);
  const fee = toNumber(t.fee?.cost || 0);
  const side = t.side === 'sell' ? 'sell' : 'buy';

  // Valor da operação em USDT (cost quando disponível, senão amount*price)
  const notionalUsd = cost || amount * price;

  return {
    timestamp,
    date: timestamp ? new Date(timestamp).toISOString() : null,
    exchangeId,
    category,           // 'spot' | 'futures' | 'bonus' | 'deposito' | 'saque' | 'transferencia' | 'funding'
    kind,
    symbol,
    side,
    amount,
    price,
    fee,
    feeCurrency: t.fee?.currency || null,
    notionalUsd,
    id: t.id || t.order || null,
  };
}

function normalizeLedger(l: any, exchangeId: string): any {
  const timestamp = ccxtTimestamp(l);
  const amount = toNumber(l.amount);
  const code = l.currency || l.code || '';
  return {
    timestamp,
    date: timestamp ? new Date(timestamp).toISOString() : null,
    exchangeId,
    category: 'ledger',
    kind: 'general',
    symbol: `${code}/${'USDT'}`,
    side: amount >= 0 ? 'credit' : 'debit',
    amount,
    price: null,
    fee: 0,
    feeCurrency: null,
    notionalUsd: amount,
    info: l.type || l.status || '',
    id: l.id || null,
  };
}

function normalizeTransfer(t: any, exchangeId: string): any {
  const timestamp = ccxtTimestamp(t);
  const amount = toNumber(t.amount);
  const currency = t.currency || 'USDT';
  let side = 'transfer';
  let fromTo = t.fromAccount && t.toAccount ? `${t.fromAccount}->${t.toAccount}` : 'interna';
  let delta = 0;
  // CCXT transfer retorna {amount, currency, fromAccount, toAccount, status}
  // Para análise agregada, consideramos delta neutro exceto se houver direction clara.
  const dir = t.direction || t.type || '';
  if (dir === 'in' || (t.fromAccount && String(t.fromAccount).toLowerCase() === 'funding')) {
    delta = amount;
    side = 'transfer-in';
  } else if (dir === 'out' || (t.toAccount && String(t.toAccount).toLowerCase() === 'funding')) {
    delta = -amount;
    side = 'transfer-out';
  }
  return {
    timestamp,
    date: timestamp ? new Date(timestamp).toISOString() : null,
    exchangeId,
    category: 'transferencia',
    kind: 'internal',
    symbol: `${currency}/USDT`,
    side,
    amount,
    price: null,
    fee: 0,
    feeCurrency: null,
    notionalUsd: amount,
    info: fromTo,
    id: t.id || null,
  };
}

function normalizeDepWith(d: any, exchangeId: string, type: string): any {
  const timestamp = ccxtTimestamp(d);
  const amount = toNumber(d.amount);
  const currency = d.currency || '';
  // Taxas registradas (d.fee) — para depósito o valor pode incluir
  const fee = toNumber(d.fee || 0);
  const status = d.status || d.info?.status || '';
  return {
    timestamp,
    date: timestamp ? new Date(timestamp).toISOString() : null,
    exchangeId,
    category: type, // 'deposito' | 'saque'
    kind: 'wallet',
    symbol: `${currency}/USDT`,
    side: type === 'deposito' ? 'credit' : 'debit',
    amount,
    price: null,
    fee,
    feeCurrency: currency || null,
    notionalUsd: amount,
    info: status,
    id: d.id || d.txid || null,
  };
}

function normalizeFunding(f: any, exchangeId: string): any {
  const timestamp = ccxtTimestamp(f);
  const fundingRate = toNumber(f.fundingRate);
  const amount = toNumber(f.amount || f.fundingRate || 0);
  const symbol = f.symbol || '';
  return {
    timestamp,
    date: timestamp ? new Date(timestamp).toISOString() : null,
    exchangeId,
    category: 'funding',
    kind: 'funding',
    symbol,
    side: amount >= 0 ? 'credit' : 'debit',
    amount,
    price: null,
    fee: 0,
    feeCurrency: null,
    notionalUsd: amount,
    info: symbol,
    id: f.id || null,
  };
}

export const GET = withAuth(async (req: NextRequest, userId: string) => {
  try {
    const url = new URL(req.url);
    const exchangeKeyId = url.searchParams.get('exchangeId') || '';
    const startParam = url.searchParams.get('start');
    const endParam = url.searchParams.get('end');

    // Período: usa data fim (ou agora) e início (ou há 7 dias atrás)
    const endMs = endParam ? Date.parse(endParam) : Date.now();
    const startMs = startParam
      ? Date.parse(startParam)
      : endMs - DEFAULT_DAYS * 24 * 3600 * 1000;
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
      return NextResponse.json({ success: false, error: 'Datas inválidas' }, { status: 400 });
    }

    await connectMongo();

    const query: any = { userId, active: true };
    const keys = await ExchangeKey.find(query).lean();
    if (!keys || keys.length === 0) {
      return NextResponse.json({ success: false, error: 'Nenhuma exchange ativa registrada' }, { status: 404 });
    }

    // Filtra por exchange quando especificada
    const targetKeys = exchangeKeyId
      ? keys.filter(k => String(k._id) === exchangeKeyId)
      : keys;

    // ── Coleta os símbolos efetivamente negociados pelo usuário (perp e spot) ──
    // Baseado na movimentação real, vinda dos trades e estratégias do robô,
    // em vez de amostrar uma lista arbitrária de mercados da exchange.
    let negotiatedPerpSymbols: string[] = [];
    let negotiatedSpotSymbols: string[] = [];
    try {
      const arTradeSymbols = await PerpArbTrade.distinct('perpSymbol', { userId }).lean();
      const stratPerpSymbols = await PerpArbStrategy.distinct('perpSymbol', { userId }).lean();
      const stratSpotSymbols = await PerpArbStrategy.distinct('spotSymbol', { userId }).lean();
      const arTradeArr = (arTradeSymbols as unknown as string[]) || [];
      const stratPerpArr = (stratPerpSymbols as unknown as string[]) || [];
      const stratSpotArr = (stratSpotSymbols as unknown as string[]) || [];
      negotiatedPerpSymbols = Array.from(new Set([...arTradeArr, ...stratPerpArr].filter(Boolean)));
      negotiatedSpotSymbols = Array.from(new Set(stratSpotArr.filter(Boolean)));
    } catch { /* sem movimentações registradas */ }

    const results: any[] = [];
    const errors: any[] = [];

    for (const doc of targetKeys) {
      try {
        const { exchange, exchangeId } = buildExchange(doc, userId);
        const marketItems: any[] = [];

        const since = startMs;
        const to = endMs;

        // 1) Operações spot + futuros — busca apenas os símbolos efetivamente
        //    negociados pelo usuário (vindos do banco de trades/estratégias).
        try {
          if (!exchange.markets || Object.keys(exchange.markets).length === 0) {
            await exchange.loadMarkets();
          }

          // Converte os símbolos de perp negociados para o formato ccxt (BASE/QUOTE:USDT).
          const swapSymbols: string[] = [];
          for (const raw of negotiatedPerpSymbols) {
            const pt = String(raw || '').trim();
            if (!pt) continue;
            if (pt.includes(':')) {
              swapSymbols.push(pt);
            } else {
              // aceita "BASE/QUOTE" ou "BASE-PERP" -> BASE/QUOTE:USDT
              let base = pt.split('/')[0] || '';
              let quote = (pt.split('/')[1] || '').replace(/:.*/, '') || 'USDT';
              if (!base && /-PERP$/i.test(pt)) base = pt.replace(/-PERP$/i, '');
              if (base && exchange.markets[`${base}/${quote}:${quote === 'USDT' ? 'USDT' : quote === 'USDC' ? 'USDC' : 'USDT'}`]) swapSymbols.push(`${base}/${quote}:${quote === 'USDT' ? 'USDT' : quote === 'USDC' ? 'USDC' : 'USDT'}`);
              else if (base && exchange.markets[`${base}/USDT:USDT`]) swapSymbols.push(`${base}/USDT:USDT`);
            }
          }
          // Valida que os símbolos existem nos mercados carregados
          const validSwaps = Array.from(new Set(swapSymbols)).filter(s => exchange.markets[s]);

          // Símbolos spot negociados (validados contra os mercados)
          const validSpots = Array.from(new Set(negotiatedSpotSymbols)).filter(s => exchange.markets[s]);

          // Fallback: se não houver movimentações registradas, amostra um subconjunto
          // pequeno (spot e swap USDT/USDC) para não deixar o relatório vazio.
          let symbolList: string[] = [];
          if (validSwaps.length > 0 || validSpots.length > 0) {
            symbolList = [...validSpots, ...validSwaps];
          } else {
            const spotAll: string[] = [];
            const swapAll: string[] = [];
            for (const mKey of Object.keys(exchange.markets || {})) {
              const m = exchange.markets[mKey];
              const isSwap = !!m?.swap || m?.type === 'swap' || mKey.includes(':');
              if ((mKey.includes('USDT') || mKey.includes('USDC')) && !isSwap) spotAll.push(mKey);
              else if ((mKey.includes('USDT') || mKey.includes('USDC')) && isSwap) swapAll.push(mKey);
            }
            symbolList = [...spotAll.slice(0, 20), ...swapAll.slice(0, 20)];
          }

          const limit = 200;
          for (const symbol of symbolList) {
            const isSwap = symbol.includes(':');
            try {
              const trades = await exchange.fetchMyTrades(symbol, since, limit, { to: undefined });
              if (Array.isArray(trades)) {
                for (const t of trades) {
                  const ts = ccxtTimestamp(t);
                  if (ts >= since && ts <= to) {
                    const category = isSwap ? 'futures' : 'spot';
                    marketItems.push(normalizeTrade(t, exchangeId, category));
                  }
                }
              }
            } catch { /* ignora símbolo específico */ }
          }
        } catch (e: any) {
          errors.push({ exchangeId, step: 'trades', error: e?.message || String(e) });
        }

        // 2) History contemporâneo de funding (perp) — para marcarmos colheitas
        try {
          const fundHistory = await exchange.fetchFundingHistory(undefined, since, 200, { to });
          if (Array.isArray(fundHistory)) {
            for (const f of fundHistory) {
              const ts = ccxtTimestamp(f);
              if (ts >= since && ts <= to) marketItems.push(normalizeFunding(f, exchangeId));
            }
          }
        } catch {
          try {
            const fundAll = await exchange.fetchFundingRateHistory(undefined, since, 200, { to });
            if (Array.isArray(fundAll)) {
              for (const f of fundAll) {
                const ts = ccxtTimestamp(f);
                if (ts >= since && ts <= to) marketItems.push(normalizeFunding(f, exchangeId));
              }
            }
          } catch { /* não suportado */ }
        }

        // 3) Ledger (taxas, bonus, ajustes)
        try {
          if (exchange.has['fetchLedger']) {
            const ledger = await exchange.fetchLedger('USDT', since, 500, { to });
            if (Array.isArray(ledger)) {
              for (const l of ledger) {
                const ts = ccxtTimestamp(l);
                if (ts >= since && ts <= to) marketItems.push(normalizeLedger(l, exchangeId));
              }
            }
          }
        } catch (e: any) {
          errors.push({ exchangeId, step: 'ledger', error: e?.message || String(e) });
        }

        // 4) Transferências internas
        try {
          if (exchange.has['fetchTransfers']) {
            // MEXC exige fromAccountType/toAccountType (SPOT/FUTURES) e endpoints separados
            // por tipo de mercado (spot e swap). Outras exchanges ignoram params extras.
            const transferDirections = [
              { fromAccountType: 'SPOT', toAccountType: 'FUTURES' },
              { fromAccountType: 'FUTURES', toAccountType: 'SPOT' },
            ];
            const marketTypes = ['spot', 'swap'];
            for (const marketType of marketTypes) {
              for (const dir of transferDirections) {
                let transfers;
                try {
                  transfers = await exchange.fetchTransfers('USDT', since, 200, { to, type: marketType, ...dir });
                } catch (e: any) {
                  // Sem fromAccountType/toAccountType: alguma exchange não exige (fallback);
                  // erro de mercado não suportado segue (ex.: spot->swap inexistente).
                  if (e && (e.constructor?.name === 'ArgumentsRequired' || /requires a (from|to)AccountType parameter/.test(String(e?.message || '')))) {
                    try {
                      transfers = await exchange.fetchTransfers('USDT', since, 200, { to, type: marketType });
                    } catch {
                      transfers = undefined;
                    }
                  } else {
                    transfers = undefined;
                  }
                }
                if (Array.isArray(transfers)) {
                  for (const t of transfers) {
                    const ts = ccxtTimestamp(t);
                    if (ts >= since && ts <= to) marketItems.push(normalizeTransfer(t, exchangeId));
                  }
                }
              }
            }
          }
        } catch (e: any) {
          errors.push({ exchangeId, step: 'transfers', error: e?.message || String(e) });
        }

        // 5) Depósitos e Saques
        try {
          if (exchange.has['fetchDeposits']) {
            const deps = await exchange.fetchDeposits('USDT', since, 200, { to });
            if (Array.isArray(deps)) {
              for (const d of deps) {
                const ts = ccxtTimestamp(d);
                if (ts >= since && ts <= to) marketItems.push(normalizeDepWith(d, exchangeId, 'deposito'));
              }
            }
          }
        } catch (e: any) {
          errors.push({ exchangeId, step: 'deposits', error: e?.message || String(e) });
        }

        try {
          if (exchange.has['fetchWithdrawals']) {
            const wds = await exchange.fetchWithdrawals('USDT', since, 200, { to });
            if (Array.isArray(wds)) {
              for (const w of wds) {
                const ts = ccxtTimestamp(w);
                if (ts >= since && ts <= to) marketItems.push(normalizeDepWith(w, exchangeId, 'saque'));
              }
            }
          }
        } catch (e: any) {
          errors.push({ exchangeId, step: 'withdrawals', error: e?.message || String(e) });
        }

        results.push({ exchangeId, name: doc.name, items: marketItems });
      } catch (e: any) {
        errors.push({ exchangeId: doc.exchangeId, step: 'init', error: e?.message || String(e) });
      }
    }

    return NextResponse.json({
      success: true,
      start: new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString(),
      exchanges: results,
      errors,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
});
