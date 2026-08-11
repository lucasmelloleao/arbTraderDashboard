import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import PerpArbStrategy from '@/models/PerpArbStrategy';
import PerpArbTrade from '@/models/PerpArbTrade';
import { withAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Marca a posição como encerrada pela corretora — sem executar ordens,
// sem calcular PnL. Registra um trade de fechamento com pnl=0 e status='voided'.
export const POST = withAuth(async (req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();
    const { strategyId, perpSymbol } = await req.json();

    if (!strategyId && !perpSymbol) {
      return NextResponse.json({ error: 'strategyId ou perpSymbol é obrigatório' }, { status: 400 });
    }

    let strat: any = strategyId
      ? await PerpArbStrategy.findOne({ _id: strategyId, userId })
      : null;

    if (!strat && perpSymbol) {
      strat = await PerpArbStrategy.findOne({ perpSymbol, userId });
    }

    if (!strat) {
      return NextResponse.json({ error: 'Estratégia não encontrada' }, { status: 404 });
    }

    const positionSize = Number(strat.positionSize || strat.tradeSize || 0);

    await PerpArbTrade.create({
      userId,
      strategyId: strat._id,
      strategyName: strat.name,
      perpSymbol: strat.perpSymbol,
      spotSymbol: strat.spotSymbol,
      type: 'close_hedge',
      status: 'voided',
      amount: positionSize,
      pnl: 0,
    });

    strat.positionOpen = false;
    strat.positionSize = 0;
    strat.positionOpenedAt = null;
    strat.fundingCollected = 0;
    await strat.save();

    return NextResponse.json({
      success: true,
      message: `Posição [${strat.name}] marcada como encerrada pela corretora (sem PnL).`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
