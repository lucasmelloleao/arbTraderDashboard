import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import ForexArbTrade from '@/models/ForexArbTrade';
import ForexArbStrategy from '@/models/ForexArbStrategy';
import { withAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (_req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();
    await ForexArbStrategy.init();

    const trades = await ForexArbTrade.find({ userId })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate({ path: 'strategyId', model: ForexArbStrategy, select: 'name type legs' })
      .lean();

    return NextResponse.json(trades);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
