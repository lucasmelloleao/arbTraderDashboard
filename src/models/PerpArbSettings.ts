import mongoose from 'mongoose';

const PerpArbSettingsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  isScanningEnabled: { type: Boolean, default: false },
  tradeSize: { type: Number, default: 100 },
  minFundingRatePct: { type: Number, default: 0.002 },
  minVolume24hUSD: { type: Number, default: 50000 },
  maxStrategiesPerScan: { type: Number, default: 5 },
  maxPerpScan: { type: Number, default: 50 },
  scanIntervalMs: { type: Number, default: 120000 },
  targetSpotBuyUSD: { type: Number, default: 1000 },
  maxDailyLoss: { type: Number, default: 10 },
  maxSlippagePct: { type: Number, default: 0.1 },
  allowedExchanges: { type: [String], default: [] }
}, { timestamps: true });

export default mongoose.models.PerpArbSettings || mongoose.model('PerpArbSettings', PerpArbSettingsSchema);
