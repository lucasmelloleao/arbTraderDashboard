import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import ExchangeKey from '@/models/ExchangeKey';
import { withAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET — retorna o saldo real da conta Hyperliquid (master) via endpoint público.
export const GET = withAuth(async (_req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();
    const key = await ExchangeKey.findOne({ userId, exchangeId: 'hyperliquid', active: true }).lean();
    if (!key) {
      return NextResponse.json({ success: true, hasKey: false, account: null });
    }

    // Consulta pública do estado da conta master
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'clearinghouseState', user: key.apiKey }),
      cache: 'no-store',
    });
    const data = await res.json();
    const ms = data?.marginSummary || {};
    const account = {
      master: key.apiKey,
      equity: Number(ms.accountValue || 0),
      withdrawable: Number(data?.withdrawable || 0),
      totalMarginUsed: Number(ms.totalMarginUsed || 0),
      totalNtlPos: Number(ms.totalNtlPos || 0),
    };
    return NextResponse.json({ success: true, hasKey: true, account });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
