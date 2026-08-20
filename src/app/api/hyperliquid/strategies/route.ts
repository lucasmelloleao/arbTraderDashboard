import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import HyperliquidStrategy from '@/models/HyperliquidStrategy';
import ExchangeKey from '@/models/ExchangeKey';
import { withAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET — lista estratégias Hyperliquid do usuário
export const GET = withAuth(async (_req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();
    ExchangeKey.init();
    const strategies = await HyperliquidStrategy.find({ userId })
      .populate('exchangeKeyId', 'name apiKey')
      .sort({ createdAt: -1 })
      .limit(100);
    return NextResponse.json(strategies);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});

// DELETE — remove uma estratégia
export const DELETE = withAuth(async (req: NextRequest, userId: string) => {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });

    await connectToDatabase();
    const strategy = await HyperliquidStrategy.findOneAndDelete({ _id: id, userId });
    if (!strategy) return NextResponse.json({ error: 'Não encontrada ou sem permissão' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
