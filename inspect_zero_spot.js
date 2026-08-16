const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: './.env.local' });
dotenv.config({ path: '../flash-solana/.env' });

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return;
  await mongoose.connect(uri);
  const PortfolioSnapshot = mongoose.model('PortfolioSnapshot', new mongoose.Schema({}, { strict: false }));

  const snapshots = await PortfolioSnapshot.find({}).sort({ timestamp: 1 }).lean();

  console.log("Visualizando todos os snapshots existentes no banco:");
  
  const toDelete = [];

  snapshots.forEach(s => {
    let spot = 0;
    let futures = 0;
    if (Array.isArray(s.balances) && s.balances.length > 0) {
      s.balances.forEach((b) => {
        const assetStr = String(b.asset || '').toLowerCase();
        if (assetStr.includes('spot')) {
          spot += Number(b.usdValue || b.total || 0);
        } else if (assetStr.includes('perp') || assetStr.includes('futures')) {
          futures += Number(b.usdValue || b.total || 0);
        } else {
          spot += Number(b.usdValue || b.total || 0);
        }
      });
    } else {
      spot = Number(s.spotTotalUsd || 0);
      futures = Number(s.futuresTotalUsd || 0);
    }
    const tot = spot + futures || Number(s.totalUsdValue || 0);
    const dateStr = new Date(s.timestamp).toLocaleString();

    console.log(`ID: ${s._id} | Data: ${dateStr} | Spot: $${spot.toFixed(2)} | Futuros: $${futures.toFixed(2)} | Total: $${tot.toFixed(2)}`);

    // Registros inválidos onde o Spot é zero ou o total é anormalmente baixo (< $100)
    if (spot <= 0 || tot < 100) {
      toDelete.push(s._id);
    }
  });

  console.log(`\nIdentificados ${toDelete.length} registros com Spot zerado ou Total < $100.`);

  if (toDelete.length > 0) {
    const res = await PortfolioSnapshot.deleteMany({ _id: { $in: toDelete } });
    console.log(`Deletados ${res.deletedCount} registros inválidos.`);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
