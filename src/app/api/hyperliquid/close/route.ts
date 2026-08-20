import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import HyperliquidStrategy from '@/models/HyperliquidStrategy';
import { withAuth } from '@/lib/auth';
import redis from '@/lib/redis';

export const dynamic = 'force-dynamic';

// POST — aciona o fechamento de uma estratégia Hyperliquid via Redis
export const POST = withAuth(async (req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();
    const { strategyId } = await req.json();
    if (!strategyId) {
      return NextResponse.json({ error: 'strategyId é obrigatório' }, { status: 400 });
    }

    const strat = await HyperliquidStrategy.findOne({ _id: strategyId, userId });
    if (!strat) return NextResponse.json({ error: 'Estratégia não encontrada' }, { status: 404 });

    let redisPublished = false;
    if (redis) {
      try {
        await redis.publish('hyperliquid-control', JSON.stringify({ action: 'CLOSE_STRATEGY', strategyId: String(strat._id) }));
        redisPublished = true;
      } catch (err) {
        console.error('Erro ao publicar CLOSE no Redis:', err);
      }
    }

    return NextResponse.json({
      success: true,
      message: redisPublished
        ? `Fechamento de [${strat.name}] acionado — o robô está executando.`
        : `Atenção: Redis indisponível. O fechamento de [${strat.name}] NÃO foi enviado ao robô.`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
