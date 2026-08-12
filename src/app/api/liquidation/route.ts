import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import LiquidationStrategy from '@/models/LiquidationStrategy';

export async function GET(req: NextRequest) {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/arbTraderDashboard');
  const strategies = await LiquidationStrategy.find({}).sort({ createdAt: -1 }).lean();
  // compat: garante defaults mesmo para documentos antigos
  return NextResponse.json(strategies.map((s: any) => ({
    ...s,
    executionEnabled: s.executionEnabled ?? false,
    lastScannedBlock: s.lastScannedBlock ?? 0,
    userPositionsCount: s.userPositionsCount ?? 0,
    lastStatusMessage: s.lastStatusMessage ?? 'idle',
    lastRunAt: s.lastRunAt ?? null
  })));
}

export async function POST(req: NextRequest) {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/arbTraderDashboard');
  const body = await req.json();
  const strategy = await LiquidationStrategy.create({
    ...body,
    network: body.network || 'arbitrum',
    executionEnabled: false,
    lastScannedBlock: 0,
    userPositionsCount: 0,
    lastStatusMessage: 'idle'
  });
  return NextResponse.json(strategy, { status: 201 });
}
