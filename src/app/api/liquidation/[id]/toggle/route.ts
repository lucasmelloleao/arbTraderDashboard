import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import LiquidationStrategy from '@/models/LiquidationStrategy';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/arbTraderDashboard');
  const { id } = await params;
  console.log('[LIQ API] toggle id=', id, 'model=', LiquidationStrategy?.modelName, 'db=', mongoose.connection.db?.databaseName);
  try {
    const raw = await mongoose.connection.db.collection('liquidationstrategies').findOne({ _id: new mongoose.Types.ObjectId(id) });
    console.log('[LIQ API] raw found=' + !!raw);
  } catch (e: any) {
    console.log('[LIQ API] raw error', e?.message);
  }
  const body = await req.json().catch(() => ({ executionEnabled: false }));
  const updated = await LiquidationStrategy.findByIdAndUpdate(
    id,
    {
      executionEnabled: !!body.executionEnabled,
      lastStatusMessage: body.executionEnabled ? 'enabled' : 'disabled',
      lastRunAt: body.executionEnabled ? new Date() : undefined
    },
    { new: true, returnDocument: 'after' }
  ).lean();
  if (!updated) {
    console.log('[LIQ API] strategy not found for id=', id);
    return NextResponse.json({ error: 'Strategy not found', id, model: LiquidationStrategy?.modelName }, { status: 404 });
  }
  console.log('[LIQ API] toggled id=', id, 'executionEnabled=', updated.executionEnabled);
  return NextResponse.json(updated);
}
