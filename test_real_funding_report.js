const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
dotenv.config({ path: './.env.local' });
dotenv.config({ path: '../flash-solana/.env' });

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return;
  await mongoose.connect(uri);

  const PerpArbTrade = mongoose.model('PerpArbTrade', new mongoose.Schema({}, { strict: false }));
  const PerpArbStrategy = mongoose.model('PerpArbStrategy', new mongoose.Schema({}, { strict: false }));

  const allTrades = await PerpArbTrade.find({
    status: { $in: ['executed', 'simulated'] }
  }).sort({ createdAt: 1 }).lean();

  const openTrades = allTrades.filter(t => t.type === 'open_hedge');
  const closeTrades = allTrades.filter(t => t.type === 'close_hedge');
  const fundingTrades = allTrades.filter(t => t.type === 'funding_fee_accumulated');
  const allStrategies = await PerpArbStrategy.find({}).lean();

  const lines = [
    'Data/Hora;Par;Valor Operacao (USD);Spot Entrada;Spot Saida;PnL Spot (USD);Perp Entrada;Perp Saida;PnL Futuros (USD);Spread Mercado (USD);Funding Coletado (USD);PnL Total Realizado (USD)'
  ];

  let totalAccFunding = 0;
  let totalAccMarket = 0;
  let totalAccNet = 0;

  closeTrades.forEach(close => {
    const closeTime = new Date(close.createdAt).getTime();
    const sym = close.perpSymbol || '';

    let matchedOpen = openTrades.find(o => String(o._id) === String(close.openTradeId));
    if (!matchedOpen && sym) {
      const opensForSym = openTrades.filter(o =>
        String(o.perpSymbol || '').toLowerCase() === sym.toLowerCase() &&
        new Date(o.createdAt).getTime() <= closeTime
      ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      matchedOpen = opensForSym[0];
    }

    const spotEntry = Number(matchedOpen?.spotPrice || 0);
    const spotExit = Number(close.spotPrice || 0);
    const perpEntry = Number(matchedOpen?.perpPrice || 0);
    const perpExit = Number(close.perpPrice || 0);

    if (spotEntry <= 0.0001 || spotExit <= 0.0001 || perpEntry <= 0.0001 || perpExit <= 0.0001) {
      return;
    }

    const openTime = matchedOpen ? new Date(matchedOpen.createdAt).getTime() : 0;
    const stratIdStr = String(close.strategyId || matchedOpen?.strategyId || '');

    // Busca o funding real acumulado durante esta janela da operação
    const matchedFundingTrades = fundingTrades.filter(f => {
      const fTime = new Date(f.createdAt).getTime();
      const fStratId = String(f.strategyId || '');
      const fSym = String(f.perpSymbol || '');
      const isTimeValid = (!openTime || fTime >= (openTime - 1800000)) && fTime <= (closeTime + 1800000);
      const isStratValid = fStratId === stratIdStr || (sym && fSym.toLowerCase() === sym.toLowerCase());
      return isTimeValid && isStratValid;
    });

    const accumFundingFromTrades = matchedFundingTrades.reduce((acc, f) => acc + Number(f.pnl || 0), 0);

    // Também verifica histórico gravado na estratégia
    const stratDoc = allStrategies.find(s => String(s._id) === stratIdStr);
    const accumFundingFromStrat = Array.isArray(stratDoc?.fundingHistory)
      ? stratDoc.fundingHistory
          .filter(h => {
            const hTime = new Date(h.timestamp || h.createdAt).getTime();
            return (!openTime || hTime >= openTime) && hTime <= closeTime;
          })
          .reduce((acc, h) => acc + Number(h.amount || 0), 0)
      : 0;

    const realFundingCollected = Math.max(accumFundingFromTrades, accumFundingFromStrat, Number(close.fundingCollected || 0));

    const dateStr = new Date(close.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const symbolClean = sym.replace(':USDT', '').replace('/USDT', '');
    const amount = Number(close.amount || matchedOpen?.amount || 0);

    const spotPnL = ((spotExit - spotEntry) / spotEntry) * amount;
    const perpPnL = ((perpEntry - perpExit) / perpEntry) * amount;
    const marketSpreadPnL = spotPnL + perpPnL;
    const netTotalPnL = marketSpreadPnL + realFundingCollected;

    totalAccMarket += marketSpreadPnL;
    totalAccFunding += realFundingCollected;
    totalAccNet += netTotalPnL;

    const fmtNum = (val) => val.toFixed(4).replace('.', ',');

    lines.push([
      dateStr,
      symbolClean,
      fmtNum(amount),
      fmtNum(spotEntry),
      fmtNum(spotExit),
      fmtNum(spotPnL),
      fmtNum(perpEntry),
      fmtNum(perpExit),
      fmtNum(perpPnL),
      fmtNum(marketSpreadPnL),
      fmtNum(realFundingCollected),
      fmtNum(netTotalPnL)
    ].join(';'));
  });

  console.log(`\n================ RESUMO AUDITADO ================`);
  console.log(`Total Spread Mercado: $${totalAccMarket.toFixed(4)} USDT`);
  console.log(`Total Funding Coletado Real: $${totalAccFunding.toFixed(4)} USDT`);
  console.log(`Total PnL Líquido Realizado: $${totalAccNet.toFixed(4)} USDT`);

  fs.writeFileSync('operacoes_perpetual_arb.csv', lines.join('\n'), 'utf8');
  console.log("Arquivo operacoes_perpetual_arb.csv recriado com funding REAL coletado!");

  await mongoose.disconnect();
}

run().catch(console.error);
