import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import ForexArbStrategy from '@/models/ForexArbStrategy';
import ExchangeKey from '@/models/ExchangeKey';
import { withAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (_req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();
    await ExchangeKey.init();

    const strategies = await ForexArbStrategy.find({ userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate({ path: 'exchangeKeyId', model: ExchangeKey, select: 'name exchangeId' })
      .lean();

    return NextResponse.json(strategies);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });

    const res = await ForexArbStrategy.deleteOne({ _id: id, userId });
    return NextResponse.json({ success: res.deletedCount > 0 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
