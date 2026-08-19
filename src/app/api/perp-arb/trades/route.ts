import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import PerpArbTrade from '@/models/PerpArbTrade';
import PerpArbStrategy from '@/models/PerpArbStrategy';
import { withAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Janela (ms) em que dois close_hedge da mesma estratégia/símbolo são
// considerados duplicados (disparo duplo: REDIS + trailing/API).
const CLOSE_DUP_WINDOW_MS = 2 * 60 * 1000;

interface TradeDoc {
  type: string;
  status?: string;
  createdAt: Date | string;
  strategyId?: unknown;
  perpSymbol?: string;
  spotOrderId?: string | null;
  perpOrderId?: string | null;
}

function tradeStratId(t: TradeDoc): string {
  if (typeof t.strategyId === 'object' && t.strategyId !== null) {
    return String((t.strategyId as { _id?: unknown })._id || '');
  }
  return String(t.strategyId || '');
}

/**
 * Remove close_hedge duplicados da MESMA posição.
 * Quando o robô é disparado duas vezes no mesmo intervalo (ex: comando REDIS
 * + trailing), são gravados 2 registros de fechamento — um com orderIds reais
 * (o que executou) e outro "fantasma" (sem ordens, criado no primeiro disparo).
 * Mantém o que tem orderIds; se ambos tiverem, mantém o mais recente.
 */
function dedupeCloseHedges(trades: TradeDoc[]): TradeDoc[] {
  const closes = trades.filter((t) => t.type === 'close_hedge');
  if (closes.length <= 1) return trades;

  const others = trades.filter((t) => t.type !== 'close_hedge');

  const groups = new Map<string, TradeDoc[]>();
  for (const c of closes) {
    const key = `${tradeStratId(c)}::${String(c.perpSymbol || '')}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  const kept: TradeDoc[] = [];
  for (const group of groups.values()) {
    if (group.length <= 1) {
      kept.push(...group);
      continue;
    }

    // Ordena por createdAt (mais recente primeiro)
    group.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Se os closes estão distantes no tempo (> janela), são operações distintas
    const newest = new Date(group[0].createdAt).getTime();
    const farAway = group.filter((c) => newest - new Date(c.createdAt).getTime() > CLOSE_DUP_WINDOW_MS);
    const near = group.filter((c) => newest - new Date(c.createdAt).getTime() <= CLOSE_DUP_WINDOW_MS);

    kept.push(...farAway);

    if (near.length <= 1) {
      kept.push(...near);
      continue;
    }

    // Dentro da janela: prioriza o que tem orderIds (executou ordens de verdade)
    const withOrders = near.filter((c) => c.spotOrderId || c.perpOrderId);
    const best = withOrders.length > 0 ? withOrders[0] : near[0];
    kept.push(best);
  }

  return [...others, ...kept];
}

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

    const deduped = dedupeCloseHedges(hedgeTrades);
    const trades = [...deduped, ...logTrades].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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
