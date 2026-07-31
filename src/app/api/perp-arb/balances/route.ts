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
      let futuresUsdtTotal = 0;
      let futuresUsdcTotal = 0;

      const exchanges = keys.map((k: any) => {
        const spotUsdt = Number(k.spotUsdt || 0);
        const spotUsdc = Number(k.spotUsdc || 0);
        const futuresUsdt = Number(k.futuresUsdt || 0);
        const futuresUsdc = Number(k.futuresUsdc || 0);

        spotUsdtTotal += spotUsdt;
        spotUsdcTotal += spotUsdc;
        futuresUsdtTotal += futuresUsdt;
        futuresUsdcTotal += futuresUsdc;

        return {
          id: k._id,
          name: k.name,
          exchangeId: k.exchangeId,
          spotUsdt,
          spotUsdc,
          futuresUsdt,
          futuresUsdc,
          updatedAt: k.balancesUpdatedAt,
        };
      });

      return NextResponse.json({
        success: true,
        spotUsdt: spotUsdtTotal,
        spotUsdc: spotUsdcTotal,
        futuresUsdt: futuresUsdtTotal,
        futuresUsdc: futuresUsdcTotal,
        exchanges,
        cached: true,
      });
    }

    const exchangePromises = keys.map(async (key) => {
      const exId = String(key.exchangeId || '').toLowerCase().trim();
      const ccxtId = exId === 'gateio' ? 'gate' : exId;

      if (!(ccxt as any)[ccxtId]) {
        return { id: key._id, name: key.name, spotUsdt: 0, spotUsdc: 0, futuresUsdt: 0, futuresUsdc: 0 };
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

      // 1. Fetch Spot Balance
      try {
        const spotEx = new (ccxt as any)[ccxtId]({
          apiKey,
          secret: apiSecret,
          enableRateLimit: true,
          timeout: 10000,
          options: { defaultType: 'spot' },
        });

        const spotBal = await spotEx.fetchBalance();

        spotUsdt = Number(spotBal.free?.USDT ?? spotBal.USDT?.free ?? spotBal.total?.USDT ?? spotBal.USDT?.total ?? 0);
        spotUsdc = Number(spotBal.free?.USDC ?? spotBal.USDC?.free ?? spotBal.total?.USDC ?? spotBal.USDC?.total ?? 0);

        if (spotUsdt === 0 && spotBal.info) {
          const balancesArr = Array.isArray(spotBal.info.balances) ? spotBal.info.balances : (Array.isArray(spotBal.info?.data) ? spotBal.info.data : []);
          const itemT = balancesArr.find((b: any) => b.asset === 'USDT' || b.currency === 'USDT');
          if (itemT) spotUsdt = Number(itemT.free || itemT.availableBalance || itemT.equity || 0);
          const itemC = balancesArr.find((b: any) => b.asset === 'USDC' || b.currency === 'USDC');
          if (itemC) spotUsdc = Number(itemC.free || itemC.availableBalance || itemC.equity || 0);
        }
        console.log(`🔍 [BALANCES DEBUG] ${key.name} (${exId}) Spot -> USDT: ${spotUsdt}, USDC: ${spotUsdc}`);
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
          options: { defaultType: ccxtId === 'mexc' ? 'swap' : 'future' },
        });

        const futBal = await futEx.fetchBalance();

        // Debug raw response keys
        console.log(`🔍 [BALANCES DEBUG] ${key.name} (${exId}) FutBal keys:`, Object.keys(futBal));
        if (futBal.info) {
          console.log(`🔍 [BALANCES DEBUG] ${key.name} (${exId}) FutBal info sample:`, JSON.stringify(futBal.info).slice(0, 300));
        }

        const freeT = Number(futBal.free?.USDT || futBal.USDT?.free || 0);
        const totalT = Number(futBal.total?.USDT || futBal.USDT?.total || 0);
        futuresUsdt = Math.max(freeT, totalT);

        const freeC = Number(futBal.free?.USDC || futBal.USDC?.free || 0);
        const totalC = Number(futBal.total?.USDC || futBal.USDC?.total || 0);
        futuresUsdc = Math.max(freeC, totalC);

        function parseFutItem(item: any): number {
          if (!item) return 0;
          const eq = Number(item.equity || item.total || item.cashBalance || 0);
          if (eq > 0) return eq;
          return Number(item.availableBalance || item.free || 0) + Number(item.positionMargin || item.frozenBalance || item.used || 0);
        }

        // Direct MEXC Contract API fallback if available
        if (futuresUsdt === 0 && (futEx as any).contractPrivateGetAccountAssets) {
          try {
            const assetsRes = await (futEx as any).contractPrivateGetAccountAssets();
            const dataArr = assetsRes?.data || assetsRes?.data?.data || assetsRes;
            if (Array.isArray(dataArr)) {
              const usdtItem = dataArr.find((item: any) => item.currency === 'USDT');
              if (usdtItem) futuresUsdt = parseFutItem(usdtItem);
              const usdcItem = dataArr.find((item: any) => item.currency === 'USDC');
              if (usdcItem) futuresUsdc = parseFutItem(usdcItem);
            }
          } catch (contractErr: any) {
            console.warn(`⚠️ Erro contractPrivateGetAccountAssets:`, contractErr?.message);
          }
        }

        // Fallback MEXC Futures (info.data)
        if (futuresUsdt === 0 && futBal.info) {
          const dataArr = Array.isArray(futBal.info)
            ? futBal.info
            : (Array.isArray(futBal.info.data) ? futBal.info.data : (Array.isArray(futBal.info?.balances) ? futBal.info.balances : []));

          const itemT = dataArr.find((b: any) => b.currency === 'USDT' || b.asset === 'USDT');
          if (itemT) futuresUsdt = parseFutItem(itemT);

          const itemC = dataArr.find((b: any) => b.currency === 'USDC' || b.asset === 'USDC');
          if (itemC) futuresUsdc = parseFutItem(itemC);
        }

        console.log(`🔍 [BALANCES DEBUG] ${key.name} (${exId}) Futures -> USDT: ${futuresUsdt}, USDC: ${futuresUsdc}`);
      } catch (futErr: any) {
        console.error(`❌ Erro ao buscar saldo Futuros [${key.name} - ${exId}]:`, futErr?.message);
      }

      try {
        await ExchangeKey.findByIdAndUpdate(key._id, {
          $set: { spotUsdt, spotUsdc, futuresUsdt, futuresUsdc, balancesUpdatedAt: new Date() }
        });
      } catch {}

      return {
        id: key._id,
        name: key.name,
        exchangeId: key.exchangeId,
        spotUsdt,
        spotUsdc,
        futuresUsdt,
        futuresUsdc,
      };
    });

    const validDetails = await Promise.all(exchangePromises);

    let spotUsdtTotal = 0;
    let spotUsdcTotal = 0;
    let futuresUsdtTotal = 0;
    let futuresUsdcTotal = 0;

    for (const d of validDetails) {
      spotUsdtTotal += d.spotUsdt || 0;
      spotUsdcTotal += d.spotUsdc || 0;
      futuresUsdtTotal += d.futuresUsdt || 0;
      futuresUsdcTotal += d.futuresUsdc || 0;
    }

    return NextResponse.json({
      success: true,
      spotUsdt: spotUsdtTotal,
      spotUsdc: spotUsdcTotal,
      futuresUsdt: futuresUsdtTotal,
      futuresUsdc: futuresUsdcTotal,
      exchanges: validDetails,
    });
  } catch (error: any) {
    console.error('Error fetching PerpArb balances:', error);
    return NextResponse.json({ success: false, reason: error.message }, { status: 500 });
  }
});
