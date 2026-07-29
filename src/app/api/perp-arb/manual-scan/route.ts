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

    const exchangesParam = url.searchParams.get('exchanges');
    const targetExchanges = exchangesParam ? exchangesParam.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : EXCHANGES;

    const results = await Promise.allSettled(
      targetExchanges.map(async (exId) => {
        const ccxtId = exId === 'gateio' ? 'gate' : exId;
        if (!(ccxt as any)[ccxtId]) throw new Error(`Exchange ${exId} not supported`);
        
        const exchange = new (ccxt as any)[ccxtId]({ enableRateLimit: true });
        
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
          
          // O robô real ignora sumariamente moedas com funding negativo ou zero
          // Para não causar distorções na busca global, nós também ignoramos.
          if (isGlobalScan && fundingPct <= 0) continue;

          const perpBid = pTicker.bid || pTicker.last;
          const spotAsk = sTicker.ask || sTicker.last;
          const spreadPct = spotAsk > 0 ? ((perpBid - spotAsk) / spotAsk) * 100 : 0;

          // Filtros Anti-Armadilha (Anti-Trap) para a Busca Global:
          // 1. Exige pelo menos $150k de volume 24h para filtrar moedas zumbis.
          // 2. Ignora spreads absurdos (> 3%) que são garantias de falta de liquidez no book.
          // 3. Verifica liquidez notional imediata (no primeiro nível do book) para cortar moedas ilíquidas.
          const perpContractSize = perpMarket.contractSize || 1;
          const perpBidNotional = (pTicker.bidVolume || 0) * perpContractSize * perpBid;
          const spotAskNotional = (sTicker.askVolume || 0) * spotAsk;

          if (isGlobalScan) {
            if ((pTicker.quoteVolume || 0) < 150000) continue;
            if (spreadPct > 3) continue;
            // Se a exchange fornece o bidVolume, ignora se tiver menos de $50 disponíveis no melhor preço
            if (pTicker.bidVolume && perpBidNotional < 50) continue;
            if (sTicker.askVolume && spotAskNotional < 50) continue;
          }

          const perpFee = perpMarket.taker !== undefined ? perpMarket.taker : 0.0005; 
          const spotFee = spotMarket.taker !== undefined ? spotMarket.taker : 0.001; 
          const totalFeePct = (perpFee + spotFee) * 100;

          const netFundingPct = fundingPct + spreadPct - totalFeePct;

          opps.push({
            exchange: exId.toUpperCase(),
            symbol: pSym,
            spotSymbol: sSym,
            perpBid,
            spotAsk,
            spreadPct,
            fundingPct,
            totalFeePct,
            netFundingPct,
            volume24h: pTicker.quoteVolume || 0,
          });
        }
        
        return opps;
      })
    );

    let successfulResults = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .flatMap(r => r.value)
      // O usuário solicitou que o critério principal continue sendo o lucro líquido (Funding + Spread - Taxas)
      .sort((a, b) => b.netFundingPct - a.netFundingPct);
      
    if (isGlobalScan) {
      successfulResults = successfulResults.slice(0, 20); // Retorna as 20 melhores se for global
    }

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
