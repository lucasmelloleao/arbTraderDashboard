import { NextRequest, NextResponse } from 'next/server';
import ccxt from 'ccxt';
import connectMongo from '@/lib/mongodb';
import ExchangeKey from '@/models/ExchangeKey';
import { decryptSecretKey } from '@/lib/encryption';
import { withAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req: NextRequest, userId: string) => {
  try {
    await connectMongo();

    const keys = await ExchangeKey.find({ userId, active: true }).lean();
    if (!keys || keys.length === 0) {
      return NextResponse.json({
        success: true,
        spotUsdt: 0,
        spotUsdc: 0,
        futuresUsdt: 0,
        futuresUsdc: 0,
        exchanges: [],
      });
    }

    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    const hasAnyBalance = keys.some((k: any) => (k.spotUsdt || 0) + (k.spotUsdc || 0) + (k.futuresUsdt || 0) + (k.futuresUsdc || 0) > 0 || k.balancesUpdatedAt);

    // ⚡ Retorno Instantâneo: Retorna o saldo em cache se houver dados gravados no banco (e forceRefresh não for exigido)
    if (hasAnyBalance && !forceRefresh) {
      let spotUsdtTotal = 0;
      let spotUsdcTotal = 0;
      let spotTotalEquitySum = 0;
      let futuresUsdtTotal = 0;
      let futuresUsdcTotal = 0;
      let futuresTotalEquitySum = 0;

      const exchanges = keys.map((k: any) => {
        const spotUsdt = Number(k.spotUsdt || 0);
        const spotUsdc = Number(k.spotUsdc || 0);
        const spotTotalEquity = Number(k.spotTotalEquity || (spotUsdt + spotUsdc));
        const futuresUsdt = Number(k.futuresUsdt || 0);
        const futuresUsdc = Number(k.futuresUsdc || 0);
        const futuresTotalEquity = Number(k.futuresTotalEquity || (futuresUsdt + futuresUsdc));

        spotUsdtTotal += spotUsdt;
        spotUsdcTotal += spotUsdc;
        spotTotalEquitySum += spotTotalEquity;
        futuresUsdtTotal += futuresUsdt;
        futuresUsdcTotal += futuresUsdc;
        futuresTotalEquitySum += futuresTotalEquity;

        return {
          id: k._id,
          name: k.name,
          exchangeId: k.exchangeId,
          spotUsdt,
          spotUsdc,
          spotTotalEquity,
          futuresUsdt,
          futuresUsdc,
          futuresTotalEquity,
          updatedAt: k.balancesUpdatedAt,
        };
      });

      return NextResponse.json({
        success: true,
        spotUsdt: spotUsdtTotal,
        spotUsdc: spotUsdcTotal,
        spotTotalEquity: spotTotalEquitySum,
        futuresUsdt: futuresUsdtTotal,
        futuresUsdc: futuresUsdcTotal,
        futuresTotalEquity: futuresTotalEquitySum,
        exchanges,
        cached: true,
      });
    }

    const exchangePromises = keys.map(async (key) => {
      const exId = String(key.exchangeId || '').toLowerCase().trim();
      const ccxtId = exId === 'gateio' ? 'gate' : exId;

      if (!(ccxt as any)[ccxtId]) {
        return { id: key._id, name: key.name, spotUsdt: 0, spotUsdc: 0, futuresUsdt: 0, futuresUsdc: 0, futuresTotalEquity: 0 };
      }

      let apiSecret = key.apiSecret;
      try {
        const aad1 = `${userId}-${key.exchangeId}`;
        const aad2 = `${userId}-${exId}`;
        try {
          apiSecret = decryptSecretKey(key.apiSecret, aad1);
        } catch {
          apiSecret = decryptSecretKey(key.apiSecret, aad2);
        }
      } catch (decErr: any) {
        console.warn(`⚠️ Falha ao descriptografar chave de ${key.name}:`, decErr?.message);
      }

      const apiKey = key.apiKey;

      let spotUsdt = 0;
      let spotUsdc = 0;
      let futuresUsdt = 0;
      let futuresUsdc = 0;
      let futuresTotalEquity = 0;

      // 1. Fetch Spot Balance
      try {
        const spotEx = new (ccxt as any)[ccxtId]({
          apiKey,
          secret: apiSecret,
          enableRateLimit: true,
          timeout: 10000,
          options: { defaultType: 'spot', recvWindow: 60000, adjustTimeDifference: true },
        });

        const spotBal = await spotEx.fetchBalance();

        spotUsdt = Number(spotBal.free?.USDT ?? spotBal.USDT?.free ?? 0);
        spotUsdc = Number(spotBal.free?.USDC ?? spotBal.USDC?.free ?? 0);

        if (spotUsdt === 0 && spotBal.info) {
          const balancesArr = Array.isArray(spotBal.info.balances) ? spotBal.info.balances : (Array.isArray(spotBal.info?.data) ? spotBal.info.data : []);
          const itemT = balancesArr.find((b: any) => b.asset === 'USDT' || b.currency === 'USDT');
          if (itemT) spotUsdt = Number(itemT.free || itemT.availableBalance || 0);
          const itemC = balancesArr.find((b: any) => b.asset === 'USDC' || b.currency === 'USDC');
          if (itemC) spotUsdc = Number(itemC.free || itemC.availableBalance || 0);
        }

        // ── Calcula Patrimônio Total Spot (USDT + USDC + todas Altcoins convertidas) ─────────────
        let spotTotalEquity = spotUsdt + spotUsdc;
        const totals = spotBal.total || {};
        const nonStableCodes = Object.keys(totals).filter(code => {
          const amt = Number(totals[code] || 0);
          return amt > 0 && code !== 'USDT' && code !== 'USDC';
        });

        if (nonStableCodes.length > 0) {
          try {
            const tickersToFetch = nonStableCodes.map(code => `${code}/USDT`);
            const tickers = await spotEx.fetchTickers(tickersToFetch).catch(() => ({}));
            for (const code of nonStableCodes) {
              const amt = Number(totals[code] || 0);
              const symbol = `${code}/USDT`;
              let price = Number(tickers[symbol]?.last || tickers[symbol]?.close || tickers[symbol]?.bid || 0);
              if (price === 0) {
                const ticker = await spotEx.fetchTicker(`${code}/USDT`).catch(() => null);
                price = Number(ticker?.last || ticker?.close || 0);
              }
              if (price > 0) {
                spotTotalEquity += amt * price;
              } else {
                // Se a moeda não tiver par USDT (ex: tokens menores), preserva um valor mínimo ou estimativa se fornecida pelo CCXT
                const codeUsd = Number(spotBal[code]?.usdValue || spotBal[code]?.total || 0);
                if (codeUsd > 0) spotTotalEquity += codeUsd;
              }
            }
          } catch (altErr: any) {
            console.warn(`⚠️ Erro ao converter moedas spot de ${key.name}:`, altErr?.message);
          }
        }

        (key as any).spotTotalEquity = spotTotalEquity;
        console.log(`🔍 [BALANCES DEBUG] ${key.name} (${exId}) Spot Livre USDT: ${spotUsdt} | Spot Total Patrimônio: ${spotTotalEquity}`);
      } catch (spotErr: any) {
        console.error(`❌ Erro ao buscar saldo Spot [${key.name} - ${exId}]:`, spotErr?.message);
      }

      // 2. Fetch Futures Balance
      try {
        const futEx = new (ccxt as any)[ccxtId]({
          apiKey,
          secret: apiSecret,
          enableRateLimit: true,
          timeout: 10000,
          options: { defaultType: ccxtId === 'mexc' ? 'swap' : 'future', recvWindow: 60000, adjustTimeDifference: true },
        });

        const futBal = await futEx.fetchBalance();

        const freeT = Number(futBal.free?.USDT ?? futBal.USDT?.free ?? 0);
        const totalT = Number(futBal.total?.USDT ?? futBal.USDT?.total ?? 0);
        futuresUsdt = freeT;

        const freeC = Number(futBal.free?.USDC ?? futBal.USDC?.free ?? 0);
        const totalC = Number(futBal.total?.USDC ?? futBal.USDC?.total ?? 0);
        futuresUsdc = freeC;

        function parseFutEquity(item: any): number {
          if (!item) return 0;
          const eq = Number(item.equity || item.total || item.equityUsd || item.cashBalance || 0);
          if (eq > 0) return eq;
          const avail = Number(item.availableBalance || item.free || 0);
          const frozen = Number(item.positionMargin || item.frozenBalance || item.used || item.margin || 0);
          const unrealizedPnl = Number(item.unrealizedProfit || item.unrealisedPnl || item.unrealizedPnl || 0);
          return avail + frozen + unrealizedPnl;
        }

        function parseFutFree(item: any): number {
          if (!item) return 0;
          return Number(item.availableBalance || item.free || item.availableMargin || 0);
        }

        futuresTotalEquity = totalT > 0 ? totalT : parseFutEquity(futBal.USDT);

        // Direct MEXC Contract API fallback if available
        if ((futEx as any).contractPrivateGetAccountAssets) {
          try {
            const assetsRes = await (futEx as any).contractPrivateGetAccountAssets();
            const dataArr = assetsRes?.data || assetsRes?.data?.data || assetsRes;
            if (Array.isArray(dataArr)) {
              const usdtItem = dataArr.find((item: any) => item.currency === 'USDT');
              if (usdtItem) {
                if (futuresUsdt === 0) futuresUsdt = parseFutFree(usdtItem);
                const eq = parseFutEquity(usdtItem);
                if (eq > futuresTotalEquity) futuresTotalEquity = eq;
              }
              const usdcItem = dataArr.find((item: any) => item.currency === 'USDC');
              if (usdcItem) {
                if (futuresUsdc === 0) futuresUsdc = parseFutFree(usdcItem);
              }
            }
          } catch (contractErr: any) {
            console.warn(`⚠️ Erro contractPrivateGetAccountAssets:`, contractErr?.message);
          }
        }

        // Fallback MEXC / Bitget Futures (info.data)
        if (futBal.info) {
          const dataArr = Array.isArray(futBal.info)
            ? futBal.info
            : (Array.isArray(futBal.info.data) ? futBal.info.data : (Array.isArray(futBal.info?.balances) ? futBal.info.balances : []));

          const itemT = dataArr.find((b: any) => b.currency === 'USDT' || b.asset === 'USDT');
          if (itemT) {
            if (futuresUsdt === 0) futuresUsdt = parseFutFree(itemT);
            const eq = parseFutEquity(itemT);
            if (eq > futuresTotalEquity) futuresTotalEquity = eq;
          }

          const itemC = dataArr.find((b: any) => b.currency === 'USDC' || b.asset === 'USDC');
          if (itemC) {
            if (futuresUsdc === 0) futuresUsdc = parseFutFree(itemC);
          }
        }

        if (futuresTotalEquity === 0) {
          futuresTotalEquity = futuresUsdt + futuresUsdc;
        }

        console.log(`🔍 [BALANCES DEBUG] ${key.name} (${exId}) Futures -> Available USDT: ${futuresUsdt}, Total Equity: ${futuresTotalEquity}`);
      } catch (futErr: any) {
        console.error(`❌ Erro ao buscar saldo Futuros [${key.name} - ${exId}]:`, futErr?.message);
      }

      try {
        const spotTotalEquity = (key as any).spotTotalEquity || (spotUsdt + spotUsdc);
        await ExchangeKey.findByIdAndUpdate(key._id, {
          $set: { spotUsdt, spotUsdc, spotTotalEquity, futuresUsdt, futuresUsdc, futuresTotalEquity, balancesUpdatedAt: new Date() }
        });
      } catch {}

      return {
        id: key._id,
        name: key.name,
        exchangeId: key.exchangeId,
        spotUsdt,
        spotUsdc,
        spotTotalEquity: (key as any).spotTotalEquity || (spotUsdt + spotUsdc),
        futuresUsdt,
        futuresUsdc,
        futuresTotalEquity,
      };
    });

    const validDetails = await Promise.all(exchangePromises);

    let spotUsdtTotal = 0;
    let spotUsdcTotal = 0;
    let spotTotalEquitySum = 0;
    let futuresUsdtTotal = 0;
    let futuresUsdcTotal = 0;
    let futuresTotalEquitySum = 0;

    for (const d of validDetails) {
      spotUsdtTotal += d.spotUsdt || 0;
      spotUsdcTotal += d.spotUsdc || 0;
      spotTotalEquitySum += d.spotTotalEquity || (d.spotUsdt + d.spotUsdc) || 0;
      futuresUsdtTotal += d.futuresUsdt || 0;
      futuresUsdcTotal += d.futuresUsdc || 0;
      futuresTotalEquitySum += d.futuresTotalEquity || (d.futuresUsdt + d.futuresUsdc) || 0;
    }

    return NextResponse.json({
      success: true,
      spotUsdt: spotUsdtTotal,
      spotUsdc: spotUsdcTotal,
      spotTotalEquity: spotTotalEquitySum,
      futuresUsdt: futuresUsdtTotal,
      futuresUsdc: futuresUsdcTotal,
      futuresTotalEquity: futuresTotalEquitySum,
      exchanges: validDetails,
    });
  } catch (error: any) {
    console.error('Error fetching PerpArb balances:', error);
    return NextResponse.json({ success: false, reason: error.message }, { status: 500 });
  }
});
