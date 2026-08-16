const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: './.env.local' });
dotenv.config({ path: '../flash-solana/.env' });

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return;
  await mongoose.connect(uri);

  const PerpArbTrade = mongoose.model('PerpArbTrade', new mongoose.Schema({}, { strict: false }));
  const PerpArbStrategy = mongoose.model('PerpArbStrategy', new mongoose.Schema({}, { strict: false }));

  const closeTrade = await PerpArbTrade.findById('6a7de44f8788b932fc609c1d').lean();
  console.log("=== CLOSE TRADE BLUAI ===");
  console.log(closeTrade);

  const matchedOpen = await PerpArbTrade.findById(closeTrade.openTradeId).lean() ||
    await PerpArbTrade.findOne({ perpSymbol: /BLUAI/i, type: 'open_hedge', createdAt: { $lte: closeTrade.createdAt } }).sort({ createdAt: -1 }).lean();

  console.log("\n=== MATCHED OPEN TRADE ===");
  console.log(matchedOpen);

  const strat = await PerpArbStrategy.findById(matchedOpen?.strategyId || closeTrade?.strategyId).lean();
  console.log("\n=== ESTRATÉGIA DA OPERAÇÃO ===");
  console.log("ID:", strat?._id);
  console.log("fundingCollected no strat:", strat?.fundingCollected);
  console.log("fundingHistory no strat (total de itens):", strat?.fundingHistory?.length);

  // Busca todos os trades de funding para BLUAI
  const fundingTrades = await PerpArbTrade.find({
    $or: [
      { perpSymbol: /BLUAI/i },
      { strategyId: strat?._id },
      { strategyId: String(strat?._id) }
    ],
    type: 'funding_fee_accumulated'
  }).lean();

  console.log(`\nTotal de trades 'funding_fee_accumulated' encontrados para BLUAI: ${fundingTrades.length}`);
  let sumFunding = 0;
  fundingTrades.forEach(f => {
    sumFunding += Number(f.pnl || 0);
    console.log(`[FUNDING ITEM] ${new Date(f.createdAt).toLocaleString()} | PnL: $${f.pnl} | StratId: ${f.strategyId}`);
  });
  console.log(`Soma dos trades de funding: $${sumFunding.toFixed(4)} USDT`);

  await mongoose.disconnect();
}

run().catch(console.error);
