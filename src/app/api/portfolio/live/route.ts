import { NextRequest, NextResponse } from 'next/server';
import ccxt from 'ccxt';
import connectMongo from '@/lib/mongodb';
import ExchangeKey from '@/models/ExchangeKey';
import PerpArbTrade from '@/models/PerpArbTrade';
import { decryptSecretKey } from '@/lib/encryption';
import { withAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Busca o portfolio da Hyperliquid (spot L1 + perp) via API oficial
 * (@nktkas/hyperliquid), pois o ccxt exige parâmetro `user` que não temos.
 * Retorna { exchange, exchangeId, spotCoins, positions } no formato do /live.
 */
async function fetchHyperliquidPortfolio(key: any, userId: string) {
  try {
    const { InfoClient, HttpTransport } = await import('@nktkas/hyperliquid');
    const info = new InfoClient({ transport: new HttpTransport() });
    const user = String(key.apiKey || ''); // MASTER address

    const spotCoins: any[] = [];
    const positions: any[] = [];

    // 1. Spot L1: saldos de tokens
    const spotState = await Promise.race([
      info.spotClearinghouseState({ user }),
      new Promise<null>((r) => setTimeout(() => r(null), 6000))
    ]).catch(() => null);

    const spotBalances = spotState?.balances || [];
    // Preços spot (markPx de todos os pares) para valorar os tokens
    let spotPrices: Record<string, number> = {};
    try {
      const spotMetaRes = await Promise.race([
        info.spotMetaAndAssetCtxs(),
        new Promise<null>((r) => setTimeout(() => r(null), 6000))
      ]);
      if (spotMetaRes) {
        const [smeta, sctxs] = spotMetaRes;
        const tokenNames = new Map<string, string>((smeta.tokens || []).map((t: any) => [String(t.index), String(t.name)]));
        for (let i = 0; i < (smeta.universe || []).length; i++) {
          const base = tokenNames.get(String(smeta.universe[i].tokens[0]));
          const ctx = sctxs[i];
          if (base && ctx?.markPx) spotPrices[base] = Number(ctx.markPx);
        }
      }
    } catch { /* sem preços spot */ }

  for (const b of spotBalances) {
    const total = Number(b.total || 0);
    if (total <= 0) continue;
    const asset = String(b.coin || '');
    const usdValue = asset === 'USDC' ? total : (total * (spotPrices[asset] || 0));
    spotCoins.push({
      asset,
      total,
      free: Number(b.total || 0) - Number(b.hold || 0),
      used: Number(b.hold || 0),
      usdValue: Number(usdValue.toFixed(4)),
      totalCost: 0,
      totalQty: 0,
      investedValue: 0,
      pnl: 0,
      pnlPct: null,
      avgCostPrice: null,
      exchange: 'Hyperliquid',
    });
  }

  // 1.5. Garante que o accountValue (equity total do perp) em USDC da Hyperliquid esteja presente
  const perpStateForBalance = await Promise.race([
    info.clearinghouseState({ user }),
    new Promise<null>((r) => setTimeout(() => r(null), 6000))
  ]).catch(() => null);

  const accountValue = Number(perpStateForBalance?.marginSummary?.accountValue || 0);
  const usdcCoin = spotCoins.find(c => c.asset === 'USDC');
  if (usdcCoin) {
    usdcCoin.total += accountValue;
    usdcCoin.usdValue += Number(accountValue.toFixed(4));
    usdcCoin.free += Number(perpStateForBalance?.withdrawable || accountValue);
  } else if (accountValue > 0) {
    spotCoins.push({
      asset: 'USDC',
      total: accountValue,
      free: Number(perpStateForBalance?.withdrawable || accountValue),
      used: accountValue - Number(perpStateForBalance?.withdrawable || accountValue),
      usdValue: Number(accountValue.toFixed(4)),
      totalCost: 0,
      totalQty: 0,
      investedValue: 0,
      pnl: 0,
      pnlPct: null,
      avgCostPrice: null,
      exchange: 'Hyperliquid',
    });
  }

  // 2. Perp: posições abertas
  const perpState = perpStateForBalance || await Promise.race([
    info.clearinghouseState({ user }),
    new Promise<null>((r) => setTimeout(() => r(null), 6000))
  ]).catch(() => null);

  // Preços mark dos perps (para valorar as posições)
  let perpMarks: Record<string, number> = {};
  try {
    const metaRes = await Promise.race([
      info.metaAndAssetCtxs(),
      new Promise<null>((r) => setTimeout(() => r(null), 6000))
    ]);
    if (metaRes) {
      const [meta, ctxs] = metaRes;
      for (let i = 0; i < (meta.universe || []).length; i++) {
        const name = meta.universe[i]?.name;
        const ctx = ctxs?.[i];
        if (name && ctx?.markPx) perpMarks[name] = Number(ctx.markPx);
      }
    }
  } catch { /* sem marks */ }

  for (const ap of (perpState?.assetPositions || [])) {
    const pos = ap.position || {};
    const szi = Number(pos.szi || 0);
    if (szi === 0) continue;
    const entryPrice = Number(pos.entryPx || 0);
    const coin = String(pos.coin || '');
    const markPrice = perpMarks[coin] || 0;
    const unrealizedPnl = Number(pos.unrealizedPnl || 0);
    const qty = Math.abs(szi);
    const notional = qty * (markPrice || entryPrice);
    positions.push({
      exchange: 'Hyperliquid',
      symbol: coin,
      side: szi > 0 ? 'long' : 'short',
      contracts: qty,
      contractSize: 1,
      qty: Number(qty.toFixed(6)),
      notional: Number(notional.toFixed(4)),
      entryPrice,
      markPrice,
      liquidationPrice: Number(pos.liquidationPx || 0) || null,
      leverage: 1,
      unrealizedPnl: Number(unrealizedPnl.toFixed(4)),
      unrealizedPnlPct: notional > 0 ? Number(((unrealizedPnl / notional) * 100).toFixed(4)) : 0,
      margin: Number(notional.toFixed(4)),
    });
  }

  return { exchange: 'Hyperliquid', exchangeId: 'hyperliquid', spotCoins, positions };
  } catch (err: any) {
    console.warn('⚠️ Erro interno fetchHyperliquidPortfolio:', err?.message);
    return { exchange: 'Hyperliquid', exchangeId: 'hyperliquid', spotCoins: [], positions: [] };
  }
}

/**
 * GET /api/portfolio/live
 * Busca AO VIVO da exchange:
 *  - saldo spot por moeda (quantidade + valor USD via fetchTicker)
 *  - posições futuras abertas (notional, entry/mark, PnL não realizado)
 * Alimenta o Overview entre os snapshots de 3 min gravados pelo robô.
 */
export const GET = withAuth(async (req: NextRequest, userId: string) => {
  try {
    await connectMongo();

    const keys = await ExchangeKey.find({ userId, active: true }).lean();
    if (!keys || keys.length === 0) {
      return NextResponse.json({ success: true, spotCoins: [], positions: [], exchanges: [] });
    }

    // ── Busca posições spot abertas pelo ROBÔ PERPÉTUO (open_hedge sem close_hedge) ────────
    // Permite calcular o cost basis (preço de compra) da moeda spot automaticamente.
    const openHedgeTrades = await PerpArbTrade.find({
      userId,
      type: 'open_hedge',
      status: { $in: ['executed', 'simulated'] },
    }).sort({ createdAt: -1 }).lean();

    // Coleta ids dos open_hedge que JÁ FORAM fechados (para excluí-los)
    const openTradeIds = openHedgeTrades.map((t: any) => t._id);
    const closedTrades = await PerpArbTrade.find({
      userId,
      type: 'close_hedge',
      status: { $in: ['executed', 'simulated'] },
      $or: [
        { openTradeId: { $in: openTradeIds } },
        // Fallback: close_hedge sem openTradeId (versões antigas) deve fechar o open mais recente
        // da mesma perpSymbol/spotSymbol cujo close NÃO exista — tratado abaixo por símbolo.
      ],
    }).select('openTradeId perpSymbol spotSymbol createdAt').lean();
    const closedOpenTradeIds = new Set(closedTrades.map((c: any) => String(c.openTradeId || '')));

    // Para close_hedge SEM openTradeId, marca como fechado o open_hedge (mais antigo) da
    // mesma base de símbolo que ocorreu ANTES do close. Assim não fica cost basis pendurado.
    const closesWithoutOpenId = closedTrades.filter((c: any) => !c.openTradeId);
    if (closesWithoutOpenId.length > 0) {
      for (const c of closesWithoutOpenId) {
        const base = String(c.spotSymbol || c.perpSymbol || '').split('/')[0].trim();
        if (!base) continue;
        const candidates = openHedgeTrades
          .filter((o: any) => {
            const oBase = String(o.spotSymbol || o.perpSymbol || '').split('/')[0].trim();
            return oBase === base && !closedOpenTradeIds.has(String(o._id));
          })
          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        // Fecha o mais recente (ordem LIFO)
        const toClose = candidates.find((o: any) => new Date(o.createdAt).getTime() < new Date(c.createdAt).getTime());
        if (toClose) closedOpenTradeIds.add(String(toClose._id));
      }
    }

    // Constrói mapa: baseSymbol -> { totalCost, totalQty, avgPrice }
    const openSpotCostByBase = new Map<string, { totalCost: number; totalQty: number; avgPrice: number }>();
    for (const t of openHedgeTrades as any[]) {
      // Ignora trades já fechados
      if (closedOpenTradeIds.has(String(t._id))) continue;

      const spotSymbol = String(t.spotSymbol || '');
      const baseSymbol = spotSymbol.split('/')[0].trim() || spotSymbol;
      if (!baseSymbol || !t.spotPrice || t.spotPrice <= 0) continue;

      const amount = Number(t.amount || 0);
      const qty = amount / t.spotPrice;
      if (qty <= 0) continue;

      const existing = openSpotCostByBase.get(baseSymbol) || { totalCost: 0, totalQty: 0, avgPrice: 0 };
      existing.totalCost += amount;
      existing.totalQty += qty;
      existing.avgPrice = existing.totalQty > 0 ? existing.totalCost / existing.totalQty : 0;
      openSpotCostByBase.set(baseSymbol, existing);
    }

    const results = await Promise.allSettled(keys.map(async (key: any) => {
      const exId = String(key.exchangeId || '').toLowerCase().trim();
      const ccxtId = exId === 'gateio' ? 'gate' : exId;
      if (exId === 'hyperliquid') return null;
      if (!(ccxt as any)[ccxtId]) return null;

      let apiSecret = key.apiSecret;
      try {
        const aad1 = `${userId}-${key.exchangeId}`;
        const aad2 = `${userId}-${exId}`;
        try { apiSecret = decryptSecretKey(key.apiSecret, aad1); }
        catch { apiSecret = decryptSecretKey(key.apiSecret, aad2); }
      } catch (decErr: any) {
        console.warn(`⚠️ [live] Falha ao descriptografar chave de ${key.name}:`, decErr?.message);
      }

      const spotEx = new (ccxt as any)[ccxtId]({
        apiKey: key.apiKey,
        secret: apiSecret,
        enableRateLimit: true,
        timeout: 10000,
        options: { defaultType: 'spot', recvWindow: 60000, adjustTimeDifference: true },
      });
      const futEx = new (ccxt as any)[ccxtId]({
        apiKey: key.apiKey,
        secret: apiSecret,
        enableRateLimit: true,
        timeout: 10000,
        options: { defaultType: ccxtId === 'mexc' ? 'swap' : 'future', recvWindow: 60000, adjustTimeDifference: true },
      });

      // ── 1. Spot por moeda ────────────────────────────────────────────────
      const spotCoins: any[] = [];
      try {
        const bal = await spotEx.fetchBalance();
        const totals = bal.total || {};
        const nonStableCodes = Object.keys(totals).filter(code => {
          const amt = Number(totals[code] || 0);
          return amt > 0 && code !== 'USDT' && code !== 'USDC';
        });

        let spotPrices: Record<string, number> = {};
        if (nonStableCodes.length > 0) {
          try {
            const tickersToFetch = nonStableCodes.map(c => `${c}/USDT`);
            const tickers = await spotEx.fetchTickers(tickersToFetch).catch(() => ({}));
            for (const code of nonStableCodes) {
              const symbol = `${code}/USDT`;
              if (tickers[symbol]?.last || tickers[symbol]?.close) {
                spotPrices[code] = Number(tickers[symbol].last || tickers[symbol].close);
              }
            }
          } catch { /* fallback por item se batch falhar */ }
        }

        for (const code of Object.keys(totals)) {
          const amt = Number(totals[code] || 0);
          if (amt <= 0) continue;

          let usdValue = 0;
          let price = 0;
          if (code === 'USDT' || code === 'USDC') {
            usdValue = amt;
          } else {
            price = spotPrices[code] || 0;
            if (price <= 0) {
              const coinUsd = Number(bal[code]?.usdValue || 0);
              if (coinUsd > 0) usdValue = coinUsd;
            } else {
              usdValue = amt * price;
            }
          }
          if (usdValue <= 0 && code !== 'USDT' && code !== 'USDC') continue;

          const free = Number(bal[code]?.free ?? bal.free?.[code] ?? 0);
          const used = Number(bal[code]?.used ?? bal.used?.[code] ?? 0);

          // Cálculo de Posição (cost basis) e Lucro/Prejuízo
          // O cost basis vem dos trades open_hedge do robô perpétuo (preço de compra real)
          const opBench = openSpotCostByBase.get(code) || null;
          const totalCost = opBench ? Number(opBench.totalCost || 0) : 0;
          const totalQty = opBench ? Number(opBench.totalQty || 0) : 0;
          const avgCostPrice = opBench && opBench.avgPrice > 0 ? opBench.avgPrice : null;

          const investedQty = Math.min(totalQty > 0 ? totalQty : amt, amt);
          const investedValue = avgCostPrice ? investedQty * avgCostPrice : (totalCost > 0 ? totalCost : 0);
          const pnl = usdValue - investedValue;
          const pnlPct = investedValue > 0 ? (pnl / investedValue) * 100 : null;

          spotCoins.push({
            exchange: key.name,
            asset: code,
            free,
            used,
            total: amt,
            usdValue: Number(usdValue.toFixed(4)),
            price: price > 0 ? Number(price.toFixed(8)) : null,
            avgCostPrice: avgCostPrice ? Number(avgCostPrice.toFixed(8)) : null,
            totalCost: Number(totalCost.toFixed(2)),
            totalQty,
            investedValue: Number(investedValue.toFixed(2)),
            pnl: Number(pnl.toFixed(4)),
            pnlPct: pnlPct !== null ? Number(pnlPct.toFixed(2)) : null,
          });
        }
      } catch (spotErr: any) {
        console.warn(`⚠️ [live] Erro saldo spot ${key.name}:`, spotErr?.message);
      }

      // ── 2. Posições futuras ─────────────────────────────────────────────
      const positions: any[] = [];
      try {
        if (futEx.has?.fetchPositions) {
          const openPositions = await Promise.race([
            futEx.fetchPositions(),
            new Promise<any[]>((r) => setTimeout(() => r([]), 4000))
          ]).catch(() => []);

          if (Array.isArray(openPositions)) {
            for (const p of openPositions) {
              const contracts = Math.abs(Number(p.contracts ?? p.contractsSigned ?? 0));
              if (contracts <= 0) continue;

              const info = p.info || {};
              const symbol = String(p.symbol || '');
              const side = p.side || (Number(p.contractsSigned) > 0 ? 'long' : 'short');
              const contractSize = Number(p.contractSize ?? 1);
              const entryPrice = Number(p.entryPrice ?? p.entryprice ?? p.openPrice ?? 0) || null;
              const liquidationPrice = Number(p.liquidationPrice ?? p.liquidationprice ?? 0) || null;
              const leverage = Number(p.leverage ?? 1) || 1;
              const unrealizedPnl = Number(
                info.unRealizedPnl ?? info.unrealizedPnl ?? p.unrealizedPnl ?? p.unrealizedProfit ?? 0
              ) || 0;
              const margin = Number(p.initialMargin ?? p.positionMargin ?? 0) || 0;

              // Quantidade real de moedas da posição (contratos × tamanho do contrato).
              // Ex.: BTW = 18 contratos × 100 (contractSize) = 1800 BTW.
              const qty = contracts * contractSize;

              let markPrice: number | null = null;
              if (qty > 0 && entryPrice !== null && entryPrice > 0 && unrealizedPnl !== 0) {
                const delta = unrealizedPnl / qty;
                markPrice = side === 'short' ? entryPrice - delta : entryPrice + delta;
                markPrice = Number(markPrice.toFixed(8));
              }
              if (!markPrice) {
                markPrice = Number(p.markPrice ?? p.markprice ?? 0) || entryPrice;
              }

              const notional = markPrice
                ? qty * markPrice
                : (entryPrice ? contracts * contractSize * entryPrice : 0);

              positions.push({
                exchange: key.name,
                symbol,
                side,
                contracts,
                contractSize,
                qty: Number(qty.toFixed(4)),
                notional: Number(notional.toFixed(4)),
                entryPrice,
                markPrice,
                liquidationPrice,
                leverage,
                unrealizedPnl: Number(unrealizedPnl.toFixed(4)),
                unrealizedPnlPct: notional > 0 ? Number(((unrealizedPnl / notional) * 100).toFixed(4)) : 0,
                margin: Number(margin.toFixed(4)),
              });
            }
          }
        }
      } catch (futErr: any) {
        console.warn(`⚠️ [live] Erro posições futuras ${key.name}:`, futErr?.message);
      }

      return { exchange: key.name, exchangeId: exId, spotCoins, positions };
    }));

    // ── Hyperliquid (DEX): busca saldo spot L1 + posições perp via API própria
    // (o ccxt não suporta HL sem parâmetro user). Compõe o saldo do usuário.
    const hlKey = keys.find((k: any) => String(k.exchangeId || '').toLowerCase() === 'hyperliquid');
    if (hlKey) {
      try {
        const hlResult = await fetchHyperliquidPortfolio(hlKey, userId);
        if (hlResult) results.push({ status: 'fulfilled', value: hlResult } as any);
      } catch (hlErr: any) {
        console.warn('⚠️ [live] Erro Hyperliquid portfolio:', hlErr?.message);
      }
    }

    const valid = results
      .filter(r => r.status === 'fulfilled' && r.value !== null)
      .map(r => (r as any).value);

    // Consolida moedas spot (soma por moeda entre exchanges)
    const coinMap = new Map<string, any>();
    let futuresUnrealizedPnl = 0;
    const allSpotCoins: any[] = [];
    for (const ex of valid) {
      for (const c of ex.spotCoins) {
        allSpotCoins.push({ ...c, exchange: c.exchange || ex.exchange });
        const key2 = c.asset;
        if (coinMap.has(key2)) {
          const prev = coinMap.get(key2);
          const merged = {
            ...prev,
            total: prev.total + c.total,
            free: prev.free + c.free,
            used: prev.used + c.used,
            usdValue: prev.usdValue + c.usdValue,
          };
          // Consolida cost basis e P&L
          const prevTC = Number(prev.totalCost || 0);
          const curTC = Number(c.totalCost || 0);
          const prevQty = Number(prev.totalQty || 0);
          const curQty = Number(c.totalQty || 0);
          merged.totalCost = prevTC + curTC;
          merged.totalQty = prevQty + curQty;
          merged.investedValue = Number((Number(prev.investedValue || 0) + Number(c.investedValue || 0)).toFixed(2));
          const usd = Number(merged.usdValue || 0);
          const invested = Number(merged.investedValue || 0);
          merged.pnl = Number((usd - invested).toFixed(4));
          merged.pnlPct = invested > 0 ? Number(((merged.pnl / invested) * 100).toFixed(2)) : null;
          merged.avgCostPrice = merged.totalQty > 0 ? Number((merged.totalCost / merged.totalQty).toFixed(8)) : null;
          coinMap.set(key2, merged);
        } else {
          coinMap.set(key2, { ...c });
        }
      }
      for (const p of ex.positions) {
        futuresUnrealizedPnl += Number(p.unrealizedPnl || 0);
      }
    }
    const spotCoins = Array.from(coinMap.values()).sort((a, b) => b.usdValue - a.usdValue);
    const allPositions = valid.flatMap(e => e.positions);
    const spotTotalUsd = spotCoins.reduce((s, c) => s + Number(c.usdValue || 0), 0);

    // Grava snapshot com os saldos atualizados de todas as exchanges (incluindo Hyperliquid) no MongoDB
    try {
      const PortfolioSnapshot = (await import('@/models/PortfolioSnapshot')).default;
      const totalUsdValue = Number((spotTotalUsd + futuresUnrealizedPnl).toFixed(2));
      await PortfolioSnapshot.create({
        userId,
        timestamp: new Date(),
        totalUsdValue,
        balances: allSpotCoins,
        positions: allPositions,
        futuresUnrealizedPnl: Number(futuresUnrealizedPnl.toFixed(4)),
      }).catch(() => {});
    } catch { /* ignora erro de gravacao */ }

    return NextResponse.json({
      success: true,
      spotCoins,
      rawSpotCoins: allSpotCoins,
      positions: allPositions,
      spotTotalUsd: Number(spotTotalUsd.toFixed(2)),
      futuresUnrealizedPnl: Number(futuresUnrealizedPnl.toFixed(4)),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error fetching live portfolio:', error);
    return NextResponse.json({ success: false, reason: error.message }, { status: 500 });
  }
});
