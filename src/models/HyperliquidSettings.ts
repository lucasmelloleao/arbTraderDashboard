import mongoose from 'mongoose';

const HyperliquidSettingsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true, unique: true },
  isScanningEnabled: { type: Boolean, default: false },
  tradeSize: { type: Number, default: 100 },
  minFundingRatePct: { type: Number, default: 0.01 },
  minVolume24hUSD: { type: Number, default: 500000 },
  maxStrategiesPerScan: { type: Number, default: 5 },
  maxDailyLoss: { type: Number, default: 10 },
  maxPortfolioCapUSD: { type: Number, default: 500 }, // Limite máximo de exposição da carteira (USD)
  takeProfitPricePct: { type: Number, default: 3 },
  trailingStopPct: { type: Number, default: 1.5 },
  lastScannedAt: { type: Date },
}, { collection: 'hyperliquidsettings' });

export default mongoose.models.HyperliquidSettings || mongoose.model('HyperliquidSettings', HyperliquidSettingsSchema);
