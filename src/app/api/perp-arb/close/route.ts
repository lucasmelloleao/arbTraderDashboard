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
    const { strategyId } = await req.json();

    if (!strategyId) {
      return NextResponse.json({ error: 'strategyId é obrigatório' }, { status: 400 });
    }

    const strat: any = await PerpArbStrategy.findOne({ _id: strategyId, userId });
    if (!strat) {
      return NextResponse.json({ error: 'Estratégia não encontrada' }, { status: 404 });
    }

    // Notifica o serviço do bot via Redis pub/sub se disponível para fechar na corretora

    // 1. Notifica o serviço do bot via Redis pub/sub se disponível
    if (redis) {
      try {
        await redis.publish('perp-arb-control', JSON.stringify({ action: 'CLOSE_STRATEGY', strategyId: String(strat._id) }));
      } catch (err) {
        console.error('Erro ao publicar CLOSE no Redis:', err);
      }
    }

    // 2. Calcula PnL estimado de fecho com base nas informações mais recentes
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

    // 3. Registra trade de fechamento
    const closeTrade = await PerpArbTrade.create({
      userId,
      strategyId: strat._id,
      type: 'close_hedge',
      status: 'executed',
      amount: positionSize,
      spotPrice: lastSpot || undefined,
      perpPrice: lastPerp || undefined,
      pnl: Number(realizedPnL.toFixed(4)),
    });

    // 4. Reseta os dados de posição aberta na estratégia
    strat.positionOpen = false;
    strat.positionSize = 0;
    strat.positionOpenedAt = null;
    strat.fundingCollected = 0;
    await strat.save();

    return NextResponse.json({
      success: true,
      message: `Posição [${strat.name}] encerrada com sucesso!`,
      pnl: realizedPnL,
      trade: closeTrade
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
