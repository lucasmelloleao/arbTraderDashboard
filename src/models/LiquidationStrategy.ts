import mongoose from 'mongoose';

const LiquidationStrategySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  walletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', required: true },
  name: { type: String, required: true },
  network: { type: String, enum: ['solana', 'arbitrum', 'polygon'], default: 'arbitrum' },
  contractAddress: { type: String, required: true },
  executionEnabled: { type: Boolean, default: false },
  // Campos de execução/runtime
  lastScannedBlock: { type: Number, default: 0 },
  userPositionsCount: { type: Number, default: 0 },
  lastStatusMessage: { type: String, default: 'idle' },
  lastRunAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
});

if (mongoose.models.LiquidationStrategy) {
  delete mongoose.models.LiquidationStrategy;
}

export default mongoose.model('LiquidationStrategy', LiquidationStrategySchema);
