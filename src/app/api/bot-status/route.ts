import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import BotStatus from '@/models/BotStatus';
import { withAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req: NextRequest, userId: string) => {
  try {
    const url = new URL(req.url);
    const botName = url.searchParams.get('botName');
    
    if (!botName) {
      return NextResponse.json({ error: 'botName is required' }, { status: 400 });
    }

    await connectToDatabase();
    const status = await BotStatus.findOne({ botName }).sort({ lastHeartbeat: -1 });
    
    if (!status) {
      return NextResponse.json({ isOnline: false });
    }

    // Consider online if heartbeat was within the last 90 seconds (to account for exchange API latencies)
    const diffMs = Date.now() - new Date(status.lastHeartbeat).getTime();
    const isOnline = diffMs < 90000;

    return NextResponse.json({ 
      isOnline,
      lastHeartbeat: status.lastHeartbeat
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
