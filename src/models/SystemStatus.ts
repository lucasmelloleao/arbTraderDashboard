import mongoose from 'mongoose';

const SystemStatusSchema = new mongoose.Schema({
  botId: { type: String, required: true, unique: true, default: 'flash-sniper' },
  botLastHeartbeat: { type: Date, default: null },
  botMode: { type: String, enum: ['simulated', 'live'], default: 'simulated' },
  connectionMode: { type: String, enum: ['rpc', 'wss'], default: 'rpc' },
  status: { type: String, default: 'offline' }
});

export default mongoose.models.SystemStatus || mongoose.model('SystemStatus', SystemStatusSchema);
