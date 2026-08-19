import mongoose from 'mongoose';

const ForexLegSchema = new mongoose.Schema({
  symbol: { type: String, required: true },
  side: { type: String, required: true },   // 'buy' | 'sell'
  price: { type: Number, default: null },
  amount: { type: Number, default: null },
  orderId: { type: String, default: null },
}, { _id: false });

const ForexArbStrategySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  exchangeKeyId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExchangeKey' },
  name: { type: String, required: true },
  exchangeId: { type: String, default: null },
  settingsId: { type: mongoose.Schema.Types.ObjectId, ref: 'ForexArbSettings', default: null },
  type: { type: String, default: 'simple' },
  legs: { type: [ForexLegSchema], default: [] },
  tradeSize: { type: Number, required: true },
  expectedProfitPct: { type: Number, default: 0 },
  minProfitPct: { type: Number, default: 0.05 },
  maxSlippagePct: { type: Number, default: 0.1 },
  autoExecute: { type: Boolean, default: true },
  isAutoCreated: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  maxDailyLoss: { type: Number, default: 0 },
  dailyLossAccum: { type: Number, default: 0 },
  lastLossAt: { type: Date, default: null },
  cooldownAfterLossMs: { type: Number, default: 3600000 },
  positionOpen: { type: Boolean, default: false },
  positionOpenedAt: { type: Date, default: null },
  positionSize: { type: Number, default: 0 },
  status: { type: String, default: 'open' },
  pnl: { type: Number, default: 0 },
  closedAt: { type: Date, default: null },
  peakProfitPct: { type: Number, default: 0 },
  lastLegPrices: { type: Map, of: Number, default: {} },
}, { timestamps: true, collection: 'forexarbstrategies' });

export default mongoose.models.ForexArbStrategy || mongoose.model('ForexArbStrategy', ForexArbStrategySchema);
