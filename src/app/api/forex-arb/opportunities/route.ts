import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import ForexArbTrade from '@/models/ForexArbTrade';
import { withAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Últimas oportunidades escaneadas (type='opportunity_found')
export const GET = withAuth(async (_req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();
    const opportunities = await ForexArbTrade.find({
      userId,
      type: 'opportunity_found',
      status: 'detected',
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    return NextResponse.json(opportunities);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
