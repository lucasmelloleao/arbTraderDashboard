export interface PerpArbStrategy {
  _id: string;
  userId: string;
  name: string;
  perpSymbol: string;
  spotSymbol: string;
  active: boolean;
  autoExecute: boolean;
  tradeSize: number;
  minFundingRatePct: number;
  maxSlippagePct: number;
  maxDailyLoss: number;
  cooldownAfterLossMs?: number;
  positionOpen?: boolean;
  positionOpenedAt?: string | Date;
  positionSize?: number;
  fundingAtOpen?: number;
  currentFundingRate?: number;
  lastSpotPrice?: number;
  lastPerpPrice?: number;
  fundingCollected?: number;
  spotExchangeKeyId?: any;
  perpExchangeKeyId?: any;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  isDeletedStrategy?: boolean;
}

export interface PerpArbTrade {
  _id: string;
  userId: string;
  strategyId?: any;
  strategyName?: string;
  perpSymbol?: string;
  spotSymbol?: string;
  type: string;
  spotOrderId?: string;
  perpOrderId?: string;
  spotPrice?: number;
  perpPrice?: number;
  fundingRate?: number;
  fundingPct?: number;
  amount?: number;
  status: string;
  pnl?: number;
  reason?: string;
  errorMessage?: string;
  openedAt?: string | Date;
  createdAt: string | Date;
}

export interface ExchangeKey {
  _id: string;
  name: string;
  exchangeId: string;
  isTestnet?: boolean;
}

export interface StatusLabel {
  label: string;
  cls: string;
}

export interface ConfirmState {
  message: string;
  onConfirm: () => void;
}
