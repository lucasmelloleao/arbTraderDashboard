import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import HyperliquidSettings from '@/models/HyperliquidSettings';
import { withAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET — retorna as settings da Hyperliquid do usuário (ou null)
export const GET = withAuth(async (_req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();
    const settings = await HyperliquidSettings.findOne({ userId }).lean();
    return NextResponse.json(settings || null);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});

// POST — atualiza as settings (isScanningEnabled, tradeSize, etc.)
export const POST = withAuth(async (req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();
    const body = await req.json();

    const allowed = ['isScanningEnabled', 'tradeSize', 'minFundingRatePct', 'minVolume24hUSD', 'maxStrategiesPerScan', 'maxDailyLoss', 'takeProfitPricePct', 'trailingStopPct'];
    const update: any = {};
    for (const k of allowed) {
      if (body[k] !== undefined) {
        update[k] = typeof body[k] === 'number' ? Number(body[k]) : body[k];
      }
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo válido para atualizar' }, { status: 400 });
    }

    const settings = await HyperliquidSettings.findOneAndUpdate(
      { userId },
      { $set: update },
      { new: true, upsert: true }
    );
    return NextResponse.json(settings);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
