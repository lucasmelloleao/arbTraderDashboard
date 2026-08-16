const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: './.env.local' });
dotenv.config({ path: '../flash-solana/.env' });

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI não encontrada.");
    return;
  }
  await mongoose.connect(uri);
  const PortfolioSnapshot = mongoose.model('PortfolioSnapshot', new mongoose.Schema({}, { strict: false }));

  // Busca todos os snapshots entre dia 10 11:00 e dia 10 13:00 (ou em torno de 12:00)
  const allSnaps = await PortfolioSnapshot.find({}).lean();
  
  const targetSnaps = allSnaps.filter(s => {
    const d = new Date(s.timestamp);
    const isDay10 = d.getDate() === 10 || d.getUTCDate() === 10;
    const hour = d.getHours();
    const utcHour = d.getUTCHours();
    return isDay10 && (hour === 12 || utcHour === 12 || (hour >= 11 && hour <= 13));
  });

  console.log(`Encontrados ${targetSnaps.length} snapshots para o dia 10 por volta de 12:00:`);
  targetSnaps.forEach(s => {
    console.log(`ID: ${s._id} | Timestamp: ${s.timestamp} (Local: ${new Date(s.timestamp).toLocaleString()}) | USD: $${s.totalUsdValue}`);
  });

  if (targetSnaps.length > 0) {
    const ids = targetSnaps.map(s => s._id);
    const res = await PortfolioSnapshot.deleteMany({ _id: { $in: ids } });
    console.log(`Removidos ${res.deletedCount} registro(s) do dia 10 às 12:00.`);
  } else {
    // Tenta uma busca mais ampla no dia 10
    const day10Snaps = allSnaps.filter(s => new Date(s.timestamp).getDate() === 10);
    console.log("Todos os snapshots do dia 10:");
    day10Snaps.forEach(s => {
      console.log(`ID: ${s._id} | Timestamp: ${s.timestamp} (Local: ${new Date(s.timestamp).toLocaleString()}) | USD: $${s.totalUsdValue}`);
    });
  }

  await mongoose.disconnect();
}

run().catch(console.error);
