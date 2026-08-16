const mongoose = require('mongoose');
const dotenv = require('dotenv');
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

  const report = [];

  closeTrades.forEach(close => {
    // Busca o open correspondente
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

    const dateStr = new Date(close.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
    const symbolClean = sym.replace(':USDT', '').replace('/USDT', '');
    const amount = Number(close.amount || matchedOpen?.amount || 0);

    const spotEntry = Number(matchedOpen?.spotPrice || 0);
    const spotExit = Number(close.spotPrice || 0);

    const perpEntry = Number(matchedOpen?.perpPrice || 0);
    const perpExit = Number(close.perpPrice || 0);

    const pnl = Number(close.pnl || 0);

    report.push({
      dateStr,
      symbolClean,
      amount: amount.toFixed(2),
      spotEntry: spotEntry > 0 ? `$${spotEntry.toFixed(4)}` : '—',
      spotExit: spotExit > 0 ? `$${spotExit.toFixed(4)}` : '—',
      perpEntry: perpEntry > 0 ? `$${perpEntry.toFixed(4)}` : '—',
      perpExit: perpExit > 0 ? `$${perpExit.toFixed(4)}` : '—',
      pnl: `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(4)}`,
    });
  });

  console.log(JSON.stringify(report, null, 2));

  await mongoose.disconnect();
}

run().catch(console.error);
