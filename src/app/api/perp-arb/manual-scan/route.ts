import { NextRequest, NextResponse } from 'next/server';
import ccxt from 'ccxt';
import { withAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const EXCHANGES = ['binance', 'bybit', 'okx', 'mexc', 'gateio', 'kucoin', 'huobi', 'bitget'];

export const GET = withAuth(async (req: NextRequest, userId: string) => {
  try {
    const url = new URL(req.url);
    const symbolParam = url.searchParams.get('symbol'); // e.g. XRP/USDT
    const isGlobalScan = !symbolParam || symbolParam.trim() === '';

    let spotSymbolFilter = '';
    let perpSymbolFilter = '';
    
    if (!isGlobalScan) {
      const base = symbolParam.split('/')[0].toUpperCase();
      const quote = symbolParam.split('/')[1]?.split(':')[0]?.toUpperCase() || 'USDT';
      spotSymbolFilter = `${base}/${quote}`;
      perpSymbolFilter = `${base}/${quote}:USDT`; // default linear format for CCXT
    }

    const spotExchangeParam = url.searchParams.get('spotExchange');
    const perpExchangeParam = url.searchParams.get('perpExchange');

    // ── Modo Cruzado Específico (Spot em uma CEX e Perp em outra CEX) ─────────
    if (spotExchangeParam && perpExchangeParam && spotExchangeParam !== perpExchangeParam) {
      const spotExId = spotExchangeParam.toLowerCase().trim();
      const perpExId = perpExchangeParam.toLowerCase().trim();

      const spotCcxtId = spotExId === 'gateio' ? 'gate' : spotExId;
      const perpCcxtId = perpExId === 'gateio' ? 'gate' : perpExId;

      if (!(ccxt as any)[spotCcxtId] || !(ccxt as any)[perpCcxtId]) {
        throw new Error(`Corretoras ${spotExId} / ${perpExId} não suportadas`);
      }

      const spotExchange = new (ccxt as any)[spotCcxtId]({ enableRateLimit: true, timeout: 10000, options: { fetchCurrencies: false } });
      spotExchange.has = { ...(spotExchange.has || {}), fetchCurrencies: false };
      const perpExchange = new (ccxt as any)[perpCcxtId]({ enableRateLimit: true, timeout: 10000, options: { fetchCurrencies: false } });
      perpExchange.has = { ...(perpExchange.has || {}), fetchCurrencies: false };

      const withTimeout = (promise: Promise<any>, ms: number) => {
        return Promise.race([
          promise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
        ]);
      };

      const [spotMarkets, perpMarkets] = await Promise.all([
        withTimeout(spotExchange.loadMarkets(), 15000),
        withTimeout(perpExchange.loadMarkets(), 15000)
      ]);

      let pSymbolsToFetch = isGlobalScan 
        ? Object.keys(perpMarkets).filter(s => s.endsWith(':USDT')) 
        : [perpSymbolFilter];

      // Filtra pares Perp que também existem no mercado Spot da outra corretora
      let validPairs: { pSym: string; sSym: string }[] = [];
      for (const pSym of pSymbolsToFetch) {
        const base = pSym.split('/')[0];
        const quote = pSym.split('/')[1]?.split(':')[0] || 'USDT';
        const sSym = `${base}/${quote}`;
        if (spotMarkets[sSym] && perpMarkets[pSym]) {
          validPairs.push({ pSym, sSym });
        }
      }

      // Permite buscar todos os pares válidos sem limite artificial de 50 ou 20
      const pSymbols = validPairs.map(v => v.pSym);
      const sSymbols = Array.from(new Set(validPairs.map(v => v.sSym)));

      const [pTickers, sTickers, fundingObj] = await Promise.all([
        withTimeout(perpExchange.fetchTickers(pSymbols).catch(() => ({})), 15000),
        withTimeout(spotExchange.fetchTickers(sSymbols).catch(() => ({})), 15000),
        withTimeout((perpExchange.has['fetchFundingRates'] ? perpExchange.fetchFundingRates(pSymbols) : perpExchange.fetchFundingRate(pSymbols[0] || '').then((r: any) => ({ [(pSymbols[0] || '')]: r }))).catch(() => ({})), 15000)
      ]);

      const opps = [];
      for (const pair of validPairs) {
        const pTicker = pTickers[pair.pSym];
        const sTicker = sTickers[pair.sSym];
        if (!pTicker || !sTicker || !pTicker.last || !sTicker.last) continue;

        let fundingRate = 0;
        if (fundingObj[pair.pSym] && fundingObj[pair.pSym].fundingRate !== undefined) {
          fundingRate = Number(fundingObj[pair.pSym].fundingRate);
        } else if (pTicker.info) {
          const rateStr = pTicker.info.fundingRate || pTicker.info.funding_rate || pTicker.info.lastFundingRate;
          if (rateStr !== undefined) fundingRate = Number(rateStr);
        }
        if (isNaN(fundingRate)) fundingRate = 0;

        const fundingPct = fundingRate * 100;
        const perpBid = pTicker.bid || pTicker.last;
        const spotAsk = sTicker.ask || sTicker.last;
        const spreadPct = spotAsk > 0 ? ((perpBid - spotAsk) / spotAsk) * 100 : 0;

        const perpMarket = perpMarkets[pair.pSym];
        const spotMarket = spotMarkets[pair.sSym];

        const perpFee = perpMarket?.taker !== undefined ? perpMarket.taker : 0.0005; 
        const spotFee = spotMarket?.taker !== undefined ? spotMarket.taker : 0.001; 
        const totalFeePct = (perpFee + spotFee) * 100;
        const netFundingPct = fundingPct + spreadPct - totalFeePct;

        const perpSlippage = pTicker.last && perpBid ? (Math.abs(pTicker.last - perpBid) / perpBid) * 100 : 0;
        const spotSlippage = sTicker.last && spotAsk ? (Math.abs(sTicker.last - spotAsk) / spotAsk) * 100 : 0;
        const estimatedSlippagePct = Math.max(perpSlippage, spotSlippage);

        opps.push({
          exchange: `${spotExId.toUpperCase()} (Spot) ⚡ ${perpExId.toUpperCase()} (Perp)`,
          spotExchange: spotExId,
          perpExchange: perpExId,
          symbol: pair.pSym,
          spotSymbol: pair.sSym,
          perpBid,
          spotAsk,
          spreadPct,
          fundingPct,
          totalFeePct,
          netFundingPct,
          estimatedSlippagePct,
          volume24h: pTicker.quoteVolume || sTicker.quoteVolume || 0,
        });
      }

      opps.sort((a, b) => b.netFundingPct - a.netFundingPct);

      return NextResponse.json({
        symbol: isGlobalScan ? 'CROSS SCAN' : spotSymbolFilter,
        results: opps,
        errors: 0,
      });
    }

    // ── Modo Padrão (Busca na mesma corretora ou lista de corretoras) ─────────
    const exchangesParam = url.searchParams.get('exchanges');
    const targetExchanges = exchangesParam ? exchangesParam.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : EXCHANGES;

    const results = await Promise.allSettled(
      targetExchanges.map(async (exId) => {
        const ccxtId = exId === 'gateio' ? 'gate' : exId;
        if (!(ccxt as any)[ccxtId]) throw new Error(`Exchange ${exId} not supported`);
        
        const exchange = new (ccxt as any)[ccxtId]({ enableRateLimit: true, timeout: 10000, options: { fetchCurrencies: false } });
        exchange.has = { ...(exchange.has || {}), fetchCurrencies: false };
        
        // Timeout wrapper
        const withTimeout = (promise: Promise<any>, ms: number) => {
          return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
          ]);
        };

        const markets = await withTimeout(exchange.loadMarkets(), 15000);
        
        let pSymbolsToFetch = isGlobalScan ? Object.keys(markets).filter(s => s.endsWith(':USDT')) : [perpSymbolFilter];
        let sSymbolsToFetch = isGlobalScan ? Array.from(new Set(pSymbolsToFetch.map(s => {
          const base = s.split('/')[0];
          const quote = s.split('/')[1]?.split(':')[0];
          return `${base}/${quote}`;
        }))).filter(s => markets[s] !== undefined) : [spotSymbolFilter];

        // Fetch All
        const [pTickers, sTickers, fundingObj] = await Promise.all([
          withTimeout(exchange.fetchTickers(pSymbolsToFetch).catch(() => ({})), 15000),
          withTimeout(exchange.fetchTickers(sSymbolsToFetch).catch(() => ({})), 15000),
          withTimeout((exchange.has['fetchFundingRates'] ? exchange.fetchFundingRates(pSymbolsToFetch) : exchange.fetchFundingRate(pSymbolsToFetch[0] || '').then((r: any) => ({ [(pSymbolsToFetch[0] || '')]: r }))).catch(() => ({})), 15000)
        ]);

        const opps = [];

        for (const pSym of pSymbolsToFetch) {
          const sSym = (() => {
             const base = pSym.split('/')[0];
             const quote = pSym.split('/')[1]?.split(':')[0];
             return `${base}/${quote}`;
          })();
          
          const perpMarket = markets[pSym];
          const spotMarket = markets[sSym];
          if (!perpMarket || !spotMarket) continue;

          const pTicker = pTickers[pSym];
          const sTicker = sTickers[sSym];
          if (!pTicker || !sTicker || !pTicker.last || !sTicker.last) continue;

          // Ignore extreme low volume initially to speed up processing
          if (isGlobalScan && (pTicker.quoteVolume || 0) < 50000) continue;

          let fundingRate = 0;
          if (fundingObj[pSym] && fundingObj[pSym].fundingRate !== undefined) {
            fundingRate = Number(fundingObj[pSym].fundingRate);
          } else if (pTicker.info) {
            const rateStr = pTicker.info.fundingRate || pTicker.info.funding_rate || pTicker.info.lastFundingRate;
            if (rateStr !== undefined) fundingRate = Number(rateStr);
          }
          if (!fundingRate || isNaN(fundingRate)) continue;

          const fundingPct = fundingRate * 100;
          
          if (isGlobalScan && fundingPct <= 0) continue;

          const perpBid = pTicker.bid || pTicker.last;
          const spotAsk = sTicker.ask || sTicker.last;
          const spreadPct = spotAsk > 0 ? ((perpBid - spotAsk) / spotAsk) * 100 : 0;

          const perpContractSize = perpMarket.contractSize || 1;
          const perpBidNotional = (pTicker.bidVolume || 0) * perpContractSize * perpBid;
          const spotAskNotional = (sTicker.askVolume || 0) * spotAsk;

          if (isGlobalScan) {
            if ((pTicker.quoteVolume || 0) < 150000) continue;
            if (spreadPct > 3) continue;
            if (pTicker.bidVolume && perpBidNotional < 50) continue;
            if (sTicker.askVolume && spotAskNotional < 50) continue;
          }

          const perpFee = perpMarket.taker !== undefined ? perpMarket.taker : 0.0005; 
          const spotFee = spotMarket.taker !== undefined ? spotMarket.taker : 0.001; 
          const totalFeePct = (perpFee + spotFee) * 100;

          const netFundingPct = fundingPct + spreadPct - totalFeePct;

          const perpSlippage = pTicker.last && perpBid ? (Math.abs(pTicker.last - perpBid) / perpBid) * 100 : 0;
          const spotSlippage = sTicker.last && spotAsk ? (Math.abs(sTicker.last - spotAsk) / spotAsk) * 100 : 0;
          const estimatedSlippagePct = Math.max(perpSlippage, spotSlippage);

          opps.push({
            exchange: exId.toUpperCase(),
            spotExchange: exId,
            perpExchange: exId,
            symbol: pSym,
            spotSymbol: sSym,
            perpBid,
            spotAsk,
            spreadPct,
            fundingPct,
            totalFeePct,
            netFundingPct,
            estimatedSlippagePct,
            volume24h: pTicker.quoteVolume || 0,
          });
        }
        
        return opps;
      })
    );

    let successfulResults = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .flatMap(r => r.value)
      .sort((a, b) => b.netFundingPct - a.netFundingPct);

    const failedResults = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map(r => r.reason.message);

    return NextResponse.json({
      symbol: isGlobalScan ? 'GLOBAL SCAN' : spotSymbolFilter,
      results: successfulResults,
      errors: failedResults.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
