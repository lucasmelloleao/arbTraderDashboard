import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import PerpArbStrategy from '@/models/PerpArbStrategy';
import PerpArbTrade from '@/models/PerpArbTrade';
import { withAuth } from '@/lib/auth';
import redis from '@/lib/redis';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();
    const { strategyId, perpSymbol } = await req.json();

    if (!strategyId && !perpSymbol) {
      return NextResponse.json({ error: 'strategyId ou perpSymbol é obrigatório' }, { status: 400 });
    }

    let strat: any = await PerpArbStrategy.findOne({ _id: strategyId, userId });
    if (!strat && perpSymbol) {
      strat = await PerpArbStrategy.findOne({ perpSymbol, userId });
    }

    // 1. Notifica o serviço do bot via Redis pub/sub se disponível
    let redisPublished = false;
    if (redis) {
      try {
        await redis.publish('perp-arb-control', JSON.stringify({ 
          action: 'CLOSE_STRATEGY', 
          strategyId: strat ? String(strat._id) : (strategyId || ''),
          perpSymbol: perpSymbol || strat?.perpSymbol || ''
        }));
        redisPublished = true;
      } catch (err) {
        console.error('Erro ao publicar CLOSE no Redis:', err);
      }
    }

    if (!strat) {
      return NextResponse.json({ error: 'Estratégia não encontrada' }, { status: 404 });
    }

    // 2. Calcula PnL estimado apenas para a resposta informativa (não cria trade)
    const positionSize = Number(strat.positionSize || strat.tradeSize || 0);
    const fundingCollected = Number(strat.fundingCollected || 0);

    const lastSpot = Number(strat.lastSpotPrice || 0);
    const lastPerp = Number(strat.lastPerpPrice || 0);

    const openTrade: any = await PerpArbTrade.findOne({
      strategyId: strat._id,
      type: 'open_hedge',
      status: { $in: ['executed', 'simulated'] }
    }).sort({ createdAt: -1 });

    let realizedPnL = fundingCollected;
    if (openTrade && lastSpot > 0 && lastPerp > 0) {
      const openSpot = Number(openTrade.spotPrice || lastSpot);
      const openPerp = Number(openTrade.perpPrice || lastPerp);

      const spotPnL = openSpot > 0 ? ((lastSpot - openSpot) / openSpot) * positionSize : 0;
      const perpPnL = openPerp > 0 ? ((openPerp - lastPerp) / openPerp) * positionSize : 0;

      realizedPnL = spotPnL + perpPnL + fundingCollected;
    }

    // NÃO cria o trade aqui. O bot (perp-close-executor, via Redis) é quem cria
    // o close_hedge com status 'detected' e executa as ordens reais, atualizando
    // para 'executed'/'failed'. Se a API criasse o trade, a trava anti-duplicação
    // do bot (hasRecentCloseInFlight) abortava o fechamento real.

    return NextResponse.json({
      success: true,
      message: redisPublished
        ? `Fechamento de [${strat.name}] acionado — o robô está executando as ordens.`
        : `Atenção: Redis indisponível. O fechamento de [${strat.name}] NÃO foi enviado ao robô. Verifique o servidor.`,
      pnl: realizedPnL,
      status: 'detected',
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
