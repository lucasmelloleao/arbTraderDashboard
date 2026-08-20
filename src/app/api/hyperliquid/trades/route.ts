import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import HyperliquidTrade from '@/models/HyperliquidTrade';
import HyperliquidStrategy from '@/models/HyperliquidStrategy';
import { withAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET — lista trades Hyperliquid do usuário
export const GET = withAuth(async (_req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();
    HyperliquidStrategy.init();
    const trades = await HyperliquidTrade.find({ userId })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate({ path: 'strategyId', model: HyperliquidStrategy, select: 'name perpSymbol spotSymbol' })
      .lean();
    return NextResponse.json(trades);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
