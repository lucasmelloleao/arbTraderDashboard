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

  const allTrades = await PerpArbTrade.find({
    status: { $in: ['executed', 'simulated'] }
  }).sort({ createdAt: 1 }).lean();

  const openTrades = allTrades.filter(t => t.type === 'open_hedge');
  const closeTrades = allTrades.filter(t => t.type === 'close_hedge');

  const tradesToDeleteIds = [];
  const validReportRows = [];
  const lines = [
    'Data/Hora;Par;Valor Operacao (USD);Spot Entrada;Spot Saida;PnL Spot (USD);Perp Entrada;Perp Saida;PnL Futuros (USD);Spread Mercado (USD);Funding Coletado (USD);PnL Total (USD)'
  ];

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

    // Condição de deleção: Se QUALQUER dos 4 preços for 0 ou inválido
    if (spotEntry <= 0 || spotExit <= 0 || perpEntry <= 0 || perpExit <= 0) {
      tradesToDeleteIds.push(close._id);
      if (matchedOpen?._id) tradesToDeleteIds.push(matchedOpen._id);
      console.log(`[DELETANDO REGISTRO INVÁLIDO] Trade ID: ${close._id} | Par: ${sym} | SpotIn: ${spotEntry} | SpotOut: ${spotExit} | PerpIn: ${perpEntry} | PerpOut: ${perpExit}`);
      return;
    }

    const dateStr = new Date(close.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const symbolClean = sym.replace(':USDT', '').replace('/USDT', '');
    const amount = Number(close.amount || matchedOpen?.amount || 0);

    const spotPnL = ((spotExit - spotEntry) / spotEntry) * amount;
    const perpPnL = ((perpEntry - perpExit) / perpEntry) * amount;
    const marketSpreadPnL = spotPnL + perpPnL;
    const totalPnL = Number(close.pnl || 0);
    const fundingCollected = totalPnL - marketSpreadPnL;

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
      fmtNum(fundingCollected),
      fmtNum(totalPnL)
    ].join(';'));

    validReportRows.push({
      dateStr,
      symbolClean,
      amount: `$${amount.toFixed(2)}`,
      spotEntry: `$${spotEntry.toFixed(4)}`,
      spotExit: `$${spotExit.toFixed(4)}`,
      spotPnL: `${spotPnL >= 0 ? '+' : ''}$${spotPnL.toFixed(4)}`,
      perpEntry: `$${perpEntry.toFixed(4)}`,
      perpExit: `$${perpExit.toFixed(4)}`,
      perpPnL: `${perpPnL >= 0 ? '+' : ''}$${perpPnL.toFixed(4)}`,
      marketSpreadPnL: `${marketSpreadPnL >= 0 ? '+' : ''}$${marketSpreadPnL.toFixed(4)}`,
      fundingCollected: `${fundingCollected >= 0 ? '+' : ''}$${fundingCollected.toFixed(4)}`,
      totalPnL: `${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(4)}`,
    });
  });

  if (tradesToDeleteIds.length > 0) {
    const res = await PerpArbTrade.deleteMany({ _id: { $in: tradesToDeleteIds } });
    console.log(`\nDeletados ${res.deletedCount} registros corrompidos com preços zerados do MongoDB.`);
  } else {
    console.log("\nNenhum registro com preços zerados encontrado para exclusão direta.");
  }

  // Atualiza arquivo CSV sem registros zerados
  fs.writeFileSync('operacoes_perpetual_arb.csv', lines.join('\n'), 'utf8');
  console.log("Arquivo operacoes_perpetual_arb.csv atualizado sem os registros zerados.");

  await mongoose.disconnect();
}

run().catch(console.error);
