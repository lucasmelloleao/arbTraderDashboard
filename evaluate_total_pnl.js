const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: './.env.local' });
dotenv.config({ path: '../flash-solana/.env' });

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return;
  await mongoose.connect(uri);

  const PerpArbTrade = mongoose.model('PerpArbTrade', new mongoose.Schema({}, { strict: false }));

  const allTrades = await PerpArbTrade.find({}).sort({ createdAt: 1 }).lean();

  console.log(`Total de trades no banco: ${allTrades.length}`);

  let closeHedgePnl = 0;
  let closeHedgeCount = 0;
  let fundingPnl = 0;
  let fundingCount = 0;
  let openHedgeCount = 0;
  let totalEntryVolume = 0;
  let totalExitVolume = 0;

  allTrades.forEach(t => {
    if (t.type === 'close_hedge' && (t.status === 'executed' || t.status === 'simulated')) {
      closeHedgeCount++;
      const p = Number(t.pnl || 0);
      const amt = Number(t.amount || 0);
      closeHedgePnl += p;
      totalEntryVolume += amt;
      totalExitVolume += (amt + p);
      console.log(`[CLOSE] Trade ${t._id} | Par: ${t.perpSymbol} | Entry: $${amt} | PnL: $${p.toFixed(4)} | Status: ${t.status} | Data: ${new Date(t.createdAt).toLocaleString()}`);
    } else if (t.type === 'funding_fee_accumulated' && (t.status === 'executed' || t.status === 'simulated')) {
      fundingCount++;
      const p = Number(t.pnl || 0);
      fundingPnl += p;
    } else if (t.type === 'open_hedge' && (t.status === 'executed' || t.status === 'simulated')) {
      openHedgeCount++;
    }
  });

  const totalRealizedPnl = closeHedgePnl + fundingPnl;

  console.log("\n================ REASSUMO P&L ================");
  console.log(`Operações Open Hedge Executadas: ${openHedgeCount}`);
  console.log(`Operações Close Hedge Executadas: ${closeHedgeCount}`);
  console.log(`Soma PnL Operações Encerradas (Close): $${closeHedgePnl.toFixed(4)} USDT`);
  console.log(`Soma PnL Funding Acumulado: $${fundingPnl.toFixed(4)} USDT`);
  console.log(`P&L Total Realizado (Close + Funding): $${totalRealizedPnl.toFixed(4)} USDT`);
  console.log(`Volume de Entrada Acumulado: $${totalEntryVolume.toFixed(2)} USDT`);
  console.log(`Volume de Saída Acumulado: $${totalExitVolume.toFixed(2)} USDT`);

  await mongoose.disconnect();
}

run().catch(console.error);
