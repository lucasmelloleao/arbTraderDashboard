import mongoose from 'mongoose';

const HyperliquidTradeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  strategyId: { type: mongoose.Schema.Types.ObjectId, ref: 'HyperliquidStrategy', index: true },
  strategyName: { type: String },
  perpSymbol: { type: String },
  spotSymbol: { type: String },
  type: { type: String, enum: ['open', 'close', 'funding', 'error'], required: true },
  status: { type: String, enum: ['detected', 'executed', 'simulated', 'failed', 'skipped'], default: 'detected' },
  amount: { type: Number, default: 0 },
  spotPrice: { type: Number },
  perpPrice: { type: Number },
  realizedPnl: { type: Number },
  fundingRate: { type: Number },
  spotOrderId: { type: String },
  perpOrderId: { type: String },
  reason: { type: String },
  errorMessage: { type: String },
  createdAt: { type: Date, default: Date.now },
}, { collection: 'hyperliquidtrades' });

HyperliquidTradeSchema.index({ strategyId: 1, createdAt: -1 });

export default mongoose.models.HyperliquidTrade || mongoose.model('HyperliquidTrade', HyperliquidTradeSchema);
