import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import ForexArbSettings from '@/models/ForexArbSettings';
import { withAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (_req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();
    const settings = await ForexArbSettings.findOne({ userId }).lean();
    return NextResponse.json(settings || null);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});

export const POST = withAuth(async (req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();
    const body = await req.json();

    const allowed = [
      'isScanningEnabled', 'tradeSize', 'minProfitPct', 'minVolume24hUSD',
      'maxStrategiesPerScan', 'scanIntervalMs', 'maxDailyLoss', 'maxSlippagePct',
      'autoExecute', 'simpleEnabled', 'triangularEnabled', 'allowedExchanges',
    ];

    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) update[key] = body[key];
    }

    const settings = await ForexArbSettings.findOneAndUpdate(
      { userId },
      { $set: update },
      { new: true, upsert: true }
    ).lean();

    return NextResponse.json(settings);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
