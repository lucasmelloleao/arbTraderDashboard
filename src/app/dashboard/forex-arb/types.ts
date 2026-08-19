export interface ForexLeg {
  symbol: string;
  side: 'buy' | 'sell';
  price: number | null;
  amount?: number | null;
  orderId?: string | null;
}

export interface ForexArbStrategy {
  _id: string;
  userId: string;
  exchangeKeyId?: any;
  name: string;
  exchangeId?: string;
  settingsId?: string;
  type: 'simple' | 'triangular';
  legs: ForexLeg[];
  tradeSize: number;
  expectedProfitPct: number;
  minProfitPct: number;
  maxSlippagePct: number;
  autoExecute: boolean;
  isAutoCreated: boolean;
  active: boolean;
  maxDailyLoss: number;
  dailyLossAccum: number;
  lastLossAt?: string | null;
  cooldownAfterLossMs: number;
  positionOpen: boolean;
  positionOpenedAt?: string | null;
  positionSize: number;
  status: string;
  pnl: number;
  closedAt?: string | null;
  peakProfitPct: number;
  lastLegPrices?: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface ForexArbTrade {
  _id: string;
  userId: string;
  strategyId?: any;
  strategyName?: string;
  exchangeId?: string;
  type: 'opportunity_found' | 'execution' | 'close' | 'error';
  legs: ForexLeg[];
  amount?: number;
  expectedProfitPct?: number;
  realizedPnl?: number;
  status: string;
  reason?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface ForexArbSettings {
  _id?: string;
  userId?: string;
  isScanningEnabled: boolean;
  lastScannedAt?: string | null;
  tradeSize: number;
  minProfitPct: number;
  minVolume24hUSD: number;
  maxStrategiesPerScan: number;
  scanIntervalMs: number;
  maxDailyLoss: number;
  maxSlippagePct: number;
  autoExecute: boolean;
  simpleEnabled: boolean;
  triangularEnabled: boolean;
  allowedExchanges: string[];
}

export interface ConfirmState {
  message: string;
  onConfirm: () => void;
}
