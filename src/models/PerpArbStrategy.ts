import mongoose from 'mongoose';

const PerpArbStrategySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true },
  perpSymbol: { type: String, required: true },  // e.g. 'BTC-PERP'
  spotSymbol: { type: String, required: true },   // e.g. 'BTC/USDT'
  tradeSize: { type: Number, required: true },    // in USDT

  // ── Exchange keys ─────────────────────────────────────────────────────────
  perpExchangeKeyId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExchangeKey', default: null }, // exchange for the perp leg
  spotExchangeKeyId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExchangeKey', default: null }, // exchange for the spot hedge

  // ── Trigger ──────────────────────────────────────────────────────────────
  minFundingRatePct: { type: Number, required: true }, // min funding rate % to execute

  // ── Protection fields ─────────────────────────────────────────────────────
  maxSlippagePct:    { type: Number, default: 0.05 },    // abort if slippage > X% (0.05%)
  closeThresholdPct: { type: Number, default: 0.3 },     // min profit % (spread) to close position
  maxDailyLoss:      { type: Number, default: 10 },      // stop bot if daily loss > X USDT
  cooldownAfterLossMs: { type: Number, default: 3600000 }, // pause X ms after a loss (1h default)

  // ── State ─────────────────────────────────────────────────────────────────
  autoExecute: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  currentFundingRate: { type: Number, default: null }, // latest observed funding rate
  lastSpotPrice: { type: Number, default: null },      // latest observed spot market price
  lastPerpPrice: { type: Number, default: null },      // latest observed perp market price
  dailyLossAccum: { type: Number, default: 0 },        // accumulated loss today (USDT)
  lastLossAt: { type: Date, default: null },            // timestamp of last loss — for cooldown
}, {
  timestamps: {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }
});

// Clear the cached model during hot-reloads in Next.js
if (mongoose.models.PerpArbStrategy) {
  delete mongoose.models.PerpArbStrategy;
}

export default mongoose.model('PerpArbStrategy', PerpArbStrategySchema);
