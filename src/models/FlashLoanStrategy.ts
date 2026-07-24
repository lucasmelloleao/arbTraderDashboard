import mongoose from 'mongoose';

const FlashLoanStrategySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  walletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', required: true },
  name: { type: String, required: true },
  network: { type: String, enum: ['solana', 'arbitrum', 'polygon'], default: 'solana' },
  contractAddress: { type: String }, // For EVM smart contract
  tokenAMint: { type: String, required: true, default: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' }, // USDC or ERC20 Address
  tokenBMint: { type: String, required: true },
  tokenBSymbol: { type: String, required: true, default: 'UNKNOWN' },
  borrowAmount: { type: Number, required: true }, // raw amount
  minProfitUsdc: { type: Number, default: 0 },
  provider: { type: String, default: 'jupiter' }, // 'jupiter', 'raptor', 'uniswap', 'curve'
  lendingProvider: { type: String, default: 'solend' }, // 'solend', 'kamino', 'aave', 'balancer', 'none'
  active: { type: Boolean, default: true },
  mevProtection: { type: Boolean, default: true },
  temporary: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.FlashLoanStrategy || mongoose.model('FlashLoanStrategy', FlashLoanStrategySchema);
