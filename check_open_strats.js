const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: './.env.local' });
dotenv.config({ path: '../flash-solana/.env' });

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return;
  await mongoose.connect(uri);

  const PerpArbStrategy = mongoose.model('PerpArbStrategy', new mongoose.Schema({}, { strict: false }));

  const openStrats = await PerpArbStrategy.find({ positionOpen: true }).lean();

  console.log(`Estratégias atualmente abertas no banco (${openStrats.length}):`);
  openStrats.forEach(s => {
    console.log(`- ID: ${s._id} | Nome: ${s.name} | perpSymbol: ${s.perpSymbol} | userId: ${s.userId} | positionOpen: ${s.positionOpen}`);
  });

  await mongoose.disconnect();
}

run().catch(console.error);
