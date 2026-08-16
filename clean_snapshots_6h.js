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
  console.log("Conectado ao MongoDB...");

  const PortfolioSnapshot = mongoose.model('PortfolioSnapshot', new mongoose.Schema({}, { strict: false }));
  const totalBefore = await PortfolioSnapshot.countDocuments();
  console.log(`Total de snapshots antes da limpeza: ${totalBefore}`);

  const snapshots = await PortfolioSnapshot.find({}).sort({ timestamp: 1 }).lean();

  const windowMap = new Map(); // key -> Array de IDs

  snapshots.forEach(snap => {
    const d = new Date(snap.timestamp);
    // Trunca para a janela de 6 horas (00:00, 06:00, 12:00, 18:00 UTC/Local)
    const hour = d.getHours();
    const windowHour = Math.floor(hour / 6) * 6;
    d.setHours(windowHour, 0, 0, 0);
    
    const timeKey = d.getTime();
    const exchangeKey = snap.exchange || 'default';
    const userKey = String(snap.userId || 'default');
    const groupKey = `${userKey}_${exchangeKey}_${timeKey}`;

    if (!windowMap.has(groupKey)) {
      windowMap.set(groupKey, []);
    }
    windowMap.get(groupKey).push(snap);
  });

  const idsToDelete = [];
  let keptCount = 0;

  windowMap.forEach((snapsInWindow) => {
    // Ordena por timestamp crescente
    snapsInWindow.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    // Mantém apenas o último snapshot da janela de 6 horas
    const keep = snapsInWindow.pop();
    keptCount++;
    // Adiciona todos os anteriores da mesma janela de 6h para remoção
    snapsInWindow.forEach(s => idsToDelete.push(s._id));
  });

  console.log(`Manter: ${keptCount} snapshots | Remover: ${idsToDelete.length} snapshots duplicados na mesma janela de 6h.`);

  if (idsToDelete.length > 0) {
    const res = await PortfolioSnapshot.deleteMany({ _id: { $in: idsToDelete } });
    console.log(`Removidos ${res.deletedCount} snapshots antigos.`);
  }

  const totalAfter = await PortfolioSnapshot.countDocuments();
  console.log(`Total de snapshots após a limpeza: ${totalAfter}`);

  await mongoose.disconnect();
}

run().catch(console.error);
