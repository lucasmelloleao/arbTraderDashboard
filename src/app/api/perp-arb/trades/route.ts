import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import PerpArbTrade from '@/models/PerpArbTrade';
import PerpArbStrategy from '@/models/PerpArbStrategy';
import { withAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET — list recent trades for the authenticated user
export const GET = withAuth(async (_req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();

    // Busca prioritariamente todas as operações de Abertura e Fechamento executadas
    const hedgeTrades = await PerpArbTrade.find({
      userId,
      type: { $in: ['open_hedge', 'close_hedge', 'funding_fee_accumulated'] }
    })
      .sort({ createdAt: -1 })
      .limit(300)
      .populate({ path: 'strategyId', model: PerpArbStrategy, select: 'name perpSymbol spotSymbol' })
      .lean();

    const logTrades = await PerpArbTrade.find({
      userId,
      type: { $nin: ['open_hedge', 'close_hedge', 'funding_fee_accumulated'] }
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate({ path: 'strategyId', model: PerpArbStrategy, select: 'name perpSymbol spotSymbol' })
      .lean();

    const trades = [...hedgeTrades, ...logTrades].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(trades);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});

// DELETE — clear non-active trade history
export const DELETE = withAuth(async (_req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();

    await PerpArbTrade.deleteMany({
      userId,
      status: { $nin: ['executed'] },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
