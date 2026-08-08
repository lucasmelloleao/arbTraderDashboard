import { NextRequest, NextResponse } from 'next/server';
import ccxt from 'ccxt';
import connectMongo from '@/lib/mongodb';
import ExchangeKey from '@/models/ExchangeKey';
import { decryptSecretKey } from '@/lib/encryption';
import { withAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

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

    const results = await Promise.allSettled(keys.map(async (key: any) => {
      const exId = String(key.exchangeId || '').toLowerCase().trim();
      const ccxtId = exId === 'gateio' ? 'gate' : exId;
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
        for (const code of Object.keys(totals)) {
          const amt = Number(totals[code] || 0);
          if (amt <= 0) continue;

          let usdValue = 0;
          let price = 0;
          if (code === 'USDT' || code === 'USDC') {
            usdValue = amt;
          } else {
            try {
              const t = await spotEx.fetchTicker(`${code}/USDT`);
              price = Number(t?.last || t?.close || 0);
            } catch { price = 0; }
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
          spotCoins.push({
            exchange: key.name,
            asset: code,
            free,
            used,
            total: amt,
            usdValue: Number(usdValue.toFixed(4)),
            price: price > 0 ? Number(price.toFixed(8)) : null,
          });
        }
      } catch (spotErr: any) {
        console.warn(`⚠️ [live] Erro saldo spot ${key.name}:`, spotErr?.message);
      }

      // ── 2. Posições futuras ─────────────────────────────────────────────
      const positions: any[] = [];
      try {
        if (futEx.has?.fetchPositions) {
          const openPositions = await futEx.fetchPositions();
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

              // Mark price via ticker (fallback: entry)
              let markPrice = Number(p.markPrice ?? p.markprice ?? 0) || null;
              if (!markPrice) {
                try {
                  const t = await futEx.fetchTicker(symbol);
                  markPrice = Number(t?.last || t?.close || 0) || null;
                } catch { markPrice = null; }
              }
              const notional = markPrice
                ? contracts * contractSize * markPrice
                : (entryPrice ? contracts * contractSize * entryPrice : 0);

              positions.push({
                exchange: key.name,
                symbol,
                side,
                contracts,
                contractSize,
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

    const valid = results
      .filter(r => r.status === 'fulfilled' && r.value !== null)
      .map(r => (r as any).value);

    // Consolida moedas spot (soma por moeda entre exchanges)
    const coinMap = new Map<string, any>();
    let futuresUnrealizedPnl = 0;
    for (const ex of valid) {
      for (const c of ex.spotCoins) {
        const key2 = c.asset;
        if (coinMap.has(key2)) {
          const prev = coinMap.get(key2);
          coinMap.set(key2, {
            ...prev,
            total: prev.total + c.total,
            free: prev.free + c.free,
            used: prev.used + c.used,
            usdValue: prev.usdValue + c.usdValue,
          });
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

    return NextResponse.json({
      success: true,
      spotCoins,
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
