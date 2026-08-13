import mongoose from 'mongoose';

const LiquidationCandidateSchema = new mongoose.Schema({
  network: { type: String, required: true, index: true },
  user: { type: String, required: true },
  healthFactor: { type: Number, required: true },
  totalCollateralUSD: { type: Number, required: true },
  totalDebtUSD: { type: Number, required: true },
  updatedAt: { type: Date, default: Date.now }
}, { collection: "liquidationcandidates" });

LiquidationCandidateSchema.index({ network: 1, user: 1 }, { unique: true });

if (mongoose.models.LiquidationCandidate) {
  delete mongoose.models.LiquidationCandidate;
}

export default mongoose.model('LiquidationCandidate', LiquidationCandidateSchema);
