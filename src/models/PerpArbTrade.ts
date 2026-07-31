import mongoose from 'mongoose';

const PerpArbTradeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  strategyId: { type: mongoose.Schema.Types.ObjectId, ref: 'PerpArbStrategy', index: true },
  strategyName: { type: String },
  perpSymbol: { type: String },
  spotSymbol: { type: String },
  type: { type: String, required: true },
  spotPrice: { type: Number },
  perpPrice: { type: Number },
  fundingRate: { type: Number },
  fundingPct: { type: Number },
  amount: { type: Number, required: true }, // in USDT
  pnl: { type: Number, default: null },     // realized P&L in USDT
  fundingCount: { type: Number, default: 0 },
  fundingHistory: [{
    amount: { type: Number },
    timestamp: { type: Date },
    fundingRate: { type: Number }
  }],
  status: {
    type: String,
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
