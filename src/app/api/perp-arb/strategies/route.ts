import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import PerpArbStrategy from '@/models/PerpArbStrategy';
import ExchangeKey from '@/models/ExchangeKey';
import { withAuth } from '@/lib/auth';
import redis from '@/lib/redis';

export const dynamic = 'force-dynamic';

// GET — list all strategies for the authenticated user
export const GET = withAuth(async (_req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();
    ExchangeKey.init(); // ensure model is registered for populate
    const strategies = await PerpArbStrategy.find({ userId })
      .populate('perpExchangeKeyId', 'name exchangeId')
      .populate('spotExchangeKeyId', 'name exchangeId')
      .populate('settingsId', 'tradeSize minFundingRatePct isScanningEnabled lastScannedAt')
      .sort({ createdAt: -1 });
    return NextResponse.json(strategies);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});

// POST — create a new strategy
export const POST = withAuth(async (req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();
    const { name, perpSymbol, spotSymbol, tradeSize, minFundingRatePct, maxSlippagePct, closeThresholdPct, maxDailyLoss, cooldownAfterLossMs, perpExchangeKeyId, spotExchangeKeyId } = await req.json();

    if (!name || !perpSymbol || !spotSymbol || tradeSize === undefined || minFundingRatePct === undefined) {
      return NextResponse.json({ error: 'Campos obrigatórios: name, perpSymbol, spotSymbol, tradeSize, minFundingRatePct' }, { status: 400 });
    }

    const strategy = await PerpArbStrategy.create({
      userId,
      name,
      perpSymbol,
      spotSymbol,
      tradeSize: Number(tradeSize),
      minFundingRatePct: Number(minFundingRatePct),
      maxSlippagePct: maxSlippagePct !== undefined ? Number(maxSlippagePct) : 0.05,
      closeThresholdPct: closeThresholdPct !== undefined ? Number(closeThresholdPct) : 0.3,
      maxDailyLoss: maxDailyLoss !== undefined ? Number(maxDailyLoss) : 10,
      cooldownAfterLossMs: cooldownAfterLossMs !== undefined ? Number(cooldownAfterLossMs) : 3600000,
      perpExchangeKeyId: perpExchangeKeyId || null,
      spotExchangeKeyId: spotExchangeKeyId || null,
      autoExecute: false,
      active: true,
    } as any);

    if (redis) {
      redis.publish('perp-arb-control', JSON.stringify({ action: 'STRATEGY_CREATED', strategyId: String(strategy._id) }));
    }

    return NextResponse.json(strategy, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});

// PUT — update a strategy (toggle active, autoExecute, or edit fields)
export const PUT = withAuth(async (req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();
    const body = await req.json();
    const { _id, active, autoExecute, tradeSize, minFundingRatePct, name, maxSlippagePct, closeThresholdPct, maxDailyLoss, cooldownAfterLossMs, perpExchangeKeyId, spotExchangeKeyId, resetCooldown } = body;

    if (!_id) {
      return NextResponse.json({ error: 'Missing _id' }, { status: 400 });
    }

    const updateData: any = {};
    if (active !== undefined) updateData.active = active;
    if (autoExecute !== undefined) updateData.autoExecute = autoExecute;
    if (tradeSize !== undefined) updateData.tradeSize = Number(tradeSize);
    if (minFundingRatePct !== undefined) updateData.minFundingRatePct = Number(minFundingRatePct);
    if (name !== undefined) updateData.name = name;
    if (maxSlippagePct !== undefined) updateData.maxSlippagePct = Number(maxSlippagePct);
    if (closeThresholdPct !== undefined) updateData.closeThresholdPct = Number(closeThresholdPct);
    if (maxDailyLoss !== undefined) updateData.maxDailyLoss = Number(maxDailyLoss);
    if (cooldownAfterLossMs !== undefined) updateData.cooldownAfterLossMs = Number(cooldownAfterLossMs);
    if (perpExchangeKeyId !== undefined) updateData.perpExchangeKeyId = perpExchangeKeyId || null;
    if (spotExchangeKeyId !== undefined) updateData.spotExchangeKeyId = spotExchangeKeyId || null;

    if (resetCooldown) {
      // In Mongoose, to completely remove the field or set it to null:
      updateData.lastLossAt = null;
      updateData.dailyLossAccum = 0;
    }

    const strategy = await PerpArbStrategy.findOneAndUpdate(
      { _id, userId },
      updateData,
      { new: true }
    );

    if (!strategy) return NextResponse.json({ error: 'Estratégia não encontrada' }, { status: 404 });

    if (redis) {
      redis.publish('perp-arb-control', JSON.stringify({ action: 'STRATEGY_UPDATED', strategyId: strategy._id }));
    }

    return NextResponse.json(strategy);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});

// DELETE — remove a strategy
export const DELETE = withAuth(async (req: NextRequest, userId: string) => {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 });

    await connectToDatabase();
    const strategy = await PerpArbStrategy.findOneAndDelete({ _id: id, userId });

    if (!strategy) return NextResponse.json({ error: 'Não encontrada ou sem permissão' }, { status: 404 });

    if (redis) {
      redis.publish('perp-arb-control', JSON.stringify({ action: 'STRATEGY_DELETED', strategyId: id }));
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
