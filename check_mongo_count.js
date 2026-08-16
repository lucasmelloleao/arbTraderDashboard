const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: './.env.local' });
dotenv.config({ path: '../flash-solana/.env' });

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return;
  await mongoose.connect(uri);

  const PerpArbTrade = mongoose.model('PerpArbTrade', new mongoose.Schema({}, { strict: false }));

  const closeTrades = await PerpArbTrade.find({ type: 'close_hedge', status: { $in: ['executed', 'simulated'] } }).lean();

  console.log(`Total de operações encerradas restantes no MongoDB: ${closeTrades.length}`);

  let hasZero = false;
  closeTrades.forEach(t => {
    if (t.spotPrice <= 0 || t.perpPrice <= 0) {
      hasZero = true;
      console.log(`[ALERTA] Preço zerado ainda encontrado: ID ${t._id}`);
    }
  });

  if (!hasZero) {
    console.log("CONFIRMADO: 100% dos registros corrompidos/zerados foram DELETADOS PERMANENTEMENTE do banco de dados!");
  }

  await mongoose.disconnect();
}

run().catch(console.error);
