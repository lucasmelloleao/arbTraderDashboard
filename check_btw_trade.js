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

  const strat = await PerpArbStrategy.findOne({ perpSymbol: /BTW/i }).lean();
  console.log("=== ESTRATÉGIA NO BANCO ===");
  console.log("ID:", strat?._id);
  console.log("Nome:", strat?.name);
  console.log("tradeSize (Configurado):", strat?.tradeSize);
  console.log("positionSize (Banco):", strat?.positionSize);
  console.log("positionOpen:", strat?.positionOpen);

  console.log("\n=== TRADES NO BANCO (BTW) ===");
  const trades = await PerpArbTrade.find({
    $or: [{ perpSymbol: /BTW/i }, { strategyId: strat?._id }]
  }).sort({ createdAt: -1 }).lean();

  trades.forEach(t => {
    console.log(`Type: ${t.type} | Status: ${t.status} | Amount: $${t.amount} | SpotPrice: $${t.spotPrice} | PerpPrice: $${t.perpPrice} | Data: ${new Date(t.createdAt).toLocaleString()}`);
  });

  await mongoose.disconnect();
}

run().catch(console.error);
