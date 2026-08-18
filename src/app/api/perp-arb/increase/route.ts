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
    const { strategyId, amount } = await req.json();

    const increaseAmount = Number(amount);
    if (!strategyId || isNaN(increaseAmount) || increaseAmount <= 0) {
      return NextResponse.json({ error: 'strategyId e amount (> 0) são obrigatórios' }, { status: 400 });
    }

    let strat: any = null;
    if (strategyId && strategyId.match(/^[0-9a-fA-F]{24}$/)) {
      strat = await PerpArbStrategy.findOne({ _id: strategyId, userId });
    }

    if (!strat) {
      // Tenta localizar a estratégia ativa pelo par ou pela trade de abertura
      const openTrade: any = await PerpArbTrade.findOne({
        userId,
        type: 'open_hedge',
        status: { $in: ['executed', 'simulated'] }
      }).sort({ createdAt: -1 });

      if (openTrade) {
        if (openTrade.strategyId) {
          strat = await PerpArbStrategy.findOne({ _id: openTrade.strategyId, userId });
        }
        if (!strat && openTrade.perpSymbol) {
          strat = await PerpArbStrategy.findOne({ perpSymbol: openTrade.perpSymbol, userId });
        }
      }
    }

    // Se ainda não houver documento de estratégia, cria/restaura a estratégia para permitir o aumento de aporte
    if (!strat) {
      const lastTrade: any = await PerpArbTrade.findOne({
        userId,
        type: 'open_hedge',
        status: { $in: ['executed', 'simulated'] }
      }).sort({ createdAt: -1 });

      if (lastTrade) {
        strat = await PerpArbStrategy.create({
          userId,
          name: lastTrade.strategyName || lastTrade.perpSymbol,
          perpSymbol: lastTrade.perpSymbol,
          spotSymbol: lastTrade.spotSymbol,
          tradeSize: lastTrade.amount || increaseAmount,
          minFundingRatePct: lastTrade.fundingPct || 0.01,
          positionOpen: true,
          positionSize: lastTrade.amount || increaseAmount,
          positionOpenedAt: lastTrade.createdAt,
          active: true,
        } as any);
      }
    }

    if (!strat) {
      return NextResponse.json({ error: 'Nenhuma posição ou estratégia encontrada' }, { status: 404 });
    }

    // Garante que positionOpen está true para permitir o aumento de aporte
    if (!strat.positionOpen) {
      strat.positionOpen = true;
    }

    const previousSize = Number(strat.positionSize || strat.tradeSize || 0);

    // 1. Notifica o robô executor via Redis
    if (redis) {
      try {
        await redis.publish('perp-arb-control', JSON.stringify({
          action: 'INCREASE_STRATEGY',
          strategyId: String(strat._id),
          amount: increaseAmount,
        }));
      } catch (err) {
        console.error('Erro ao publicar INCREASE no Redis:', err);
      }
    }

    // 2. Registra o trade de aumento de aporte
    const increaseTrade = await PerpArbTrade.create({
      userId,
      strategyId: strat._id,
      strategyName: strat.name,
      perpSymbol: strat.perpSymbol,
      spotSymbol: strat.spotSymbol,
      type: 'open_hedge',
      status: 'executed',
      amount: increaseAmount,
      spotPrice: strat.lastSpotPrice || undefined,
      perpPrice: strat.lastPerpPrice || undefined,
      fundingPct: strat.currentFundingRate ?? strat.minFundingRatePct ?? null,
    });

    // 3. Atualiza o tamanho total da posição na estratégia
    const newPositionSize = previousSize + increaseAmount;
    strat.positionSize = newPositionSize;
    await strat.save();

    return NextResponse.json({
      success: true,
      message: `Aporte aumentado em +$${increaseAmount.toFixed(2)} USDT com sucesso! Novo total: $${newPositionSize.toFixed(2)} USDT.`,
      newPositionSize,
      trade: increaseTrade,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
