import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import SystemStatus from '@/models/SystemStatus';
import { withAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();
    const status = await SystemStatus.findOne({ botId: 'flash-sniper' });
    
    let botOnline = false;
    if (status && status.botLastHeartbeat) {
      const now = new Date().getTime();
      const lastHeartbeat = new Date(status.botLastHeartbeat).getTime();
      
      // Se o último pulso foi há menos de 30 segundos, está online
      if (now - lastHeartbeat < 30000) {
        botOnline = true;
      }
    }

    return NextResponse.json({ 
      botOnline, 
      lastHeartbeat: status?.botLastHeartbeat,
      botMode: status?.botMode || 'simulated',
      connectionMode: status?.connectionMode || 'rpc',
      enabledNetworks: status?.enabledNetworks || ['solana', 'arbitrum', 'polygon']
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});

export const PUT = withAuth(async (req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();
    const { botMode, connectionMode, enabledNetworks } = await req.json();

    const updateData: any = {};
    if (botMode !== undefined) {
      if (botMode !== 'simulated' && botMode !== 'live') {
        return NextResponse.json({ error: 'Invalid botMode' }, { status: 400 });
      }
      updateData.botMode = botMode;
    }

    if (connectionMode !== undefined) {
      if (connectionMode !== 'rpc' && connectionMode !== 'wss') {
        return NextResponse.json({ error: 'Invalid connectionMode' }, { status: 400 });
      }
      updateData.connectionMode = connectionMode;
    }

    if (enabledNetworks !== undefined) {
      if (!Array.isArray(enabledNetworks) || enabledNetworks.some((n: string) => !['solana', 'arbitrum', 'polygon'].includes(n))) {
        return NextResponse.json({ error: 'Invalid enabledNetworks' }, { status: 400 });
      }
      updateData.enabledNetworks = enabledNetworks;
    }

    const status = await SystemStatus.findOneAndUpdate(
      { botId: 'flash-sniper' },
      updateData,
      { upsert: true, new: true }
    );
    
    return NextResponse.json({ 
      botMode: status.botMode,
      connectionMode: status.connectionMode,
      enabledNetworks: status.enabledNetworks
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
