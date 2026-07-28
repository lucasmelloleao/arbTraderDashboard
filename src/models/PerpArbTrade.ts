import mongoose from 'mongoose';

const PerpArbTradeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  strategyId: { type: mongoose.Schema.Types.ObjectId, ref: 'PerpArbStrategy', required: true, index: true },
  type: { type: String, enum: ['funding_check', 'open_hedge', 'close_hedge'], required: true },
  spotPrice: { type: Number },
  perpPrice: { type: Number },
  fundingRate: { type: Number },
  fundingPct: { type: Number },
  amount: { type: Number, required: true }, // in USDT
  pnl: { type: Number, default: null },     // realized P&L in USDT
  status: {
    type: String,
    enum: ['detected', 'executed', 'skipped', 'failed', 'simulated'],
    default: 'detected'
  },
  errorMessage: { type: String },
}, {
  timestamps: {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }
});

export default mongoose.models.PerpArbTrade || mongoose.model('PerpArbTrade', PerpArbTradeSchema);
