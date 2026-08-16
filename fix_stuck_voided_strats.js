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

  const voidedCloseTrades = await PerpArbTrade.find({ type: 'close_hedge', status: 'voided' }).lean();
  console.log(`Encontrados ${voidedCloseTrades.length} trades 'close_hedge' com status 'voided':`);

  for (const t of voidedCloseTrades) {
    console.log(`- Trade ID: ${t._id} | StratId: ${t.strategyId} | Par: ${t.perpSymbol} | Data: ${new Date(t.createdAt).toLocaleString()}`);
    if (t.strategyId) {
      const s = await PerpArbStrategy.findById(t.strategyId);
      if (s && s.positionOpen) {
        console.log(`  -> Atualizando estratégia ${s.name} (${s._id}) no MongoDB para positionOpen = false!`);
        s.positionOpen = false;
        s.positionSize = 0;
        s.positionOpenedAt = null;
        await s.save();
      }
    }
  }

  await mongoose.disconnect();
}

run().catch(console.error);
