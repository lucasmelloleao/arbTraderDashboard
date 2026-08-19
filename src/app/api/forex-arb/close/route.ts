import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import ForexArbStrategy from '@/models/ForexArbStrategy';
import ForexArbTrade from '@/models/ForexArbTrade';
import redis from '@/lib/redis';
import { withAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();
    const { strategyId } = await req.json();
    if (!strategyId) return NextResponse.json({ error: 'strategyId é obrigatório' }, { status: 400 });

    const strat = await ForexArbStrategy.findOne({ _id: strategyId, userId }).lean();
    if (!strat) return NextResponse.json({ error: 'Estratégia não encontrada' }, { status: 404 });

    // Publica comando de fechamento para o robô (via Redis)
    if (redis) {
      await redis.publish('forex-arb-control', JSON.stringify({
        action: 'CLOSE_STRATEGY',
        strategyId,
      }));
    }

    // Cria trade de fechamento pendente (o robô atualiza o status após executar)
    await ForexArbTrade.create({
      userId,
      strategyId: strat._id,
      strategyName: strat.name,
      exchangeId: strat.exchangeId,
      type: 'close',
      status: 'detected',
      legs: strat.legs,
      amount: strat.positionSize || strat.tradeSize,
      reason: 'Fechamento manual (Dashboard)',
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
