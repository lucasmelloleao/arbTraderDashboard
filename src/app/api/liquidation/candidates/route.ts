import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import LiquidationCandidate from '@/models/LiquidationCandidate';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/arbTraderDashboard');
    const { searchParams } = new URL(req.url);
    const network = searchParams.get('network');
    
    const query: any = {};
    if (network) {
      query.network = network;
    }

    const candidates = await LiquidationCandidate.find(query).sort({ healthFactor: 1 }).limit(100).lean();
    return NextResponse.json(candidates);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
