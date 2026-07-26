import { NextRequest, NextResponse } from 'next/server';

const SNAPSHOT_URL = process.env.SNAPSHOT_SERVER_URL || `http://localhost:8081/snapshot`;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const amount = searchParams.get('amount') || '100';
  const forceExecute = searchParams.get('forceExecute') || 'false';

  try {
    const res = await fetch(`${SNAPSHOT_URL}?amount=${amount}&forceExecute=${forceExecute}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000), // 30s timeout
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Snapshot server retornou erro: ${text}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    if (e.name === 'TimeoutError' || e.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Timeout: o servidor de snapshot demorou mais de 30s para responder.' },
        { status: 504 }
      );
    }
    // ECONNREFUSED → servidor não está rodando
    if (e.cause?.code === 'ECONNREFUSED' || e.message?.includes('ECONNREFUSED') || e.message?.includes('fetch failed')) {
      return NextResponse.json(
        {
          error: 'Servidor de snapshot offline. Execute: npx tsx snapshot.ts dentro da pasta flash-solana.',
          offline: true,
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
