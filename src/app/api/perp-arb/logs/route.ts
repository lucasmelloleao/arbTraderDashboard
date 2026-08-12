import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req: NextRequest) => {
  let processName = 'scanner';
  try {
    const { searchParams } = new URL(req.url);
    processName = searchParams.get('process') || 'scanner';
    const lines = searchParams.get('lines') || '150';

    const isServer1 = processName.startsWith('liq-');
    const defaultHost = isServer1 ? 'http://147.15.122.245:4001' : 'http://163.176.2.243:4001';
    const backendUrl = process.env.API_SERVER_URL || defaultHost;

    // Conexao HTTP direta para o servidor Oracle (funciona 100% na Vercel sem precisar de SSH ou Linux binarios)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${backendUrl}/api/logs?process=${processName}&lines=${lines}`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!res.ok) {
      return NextResponse.json({
        process: processName,
        linesCount: 1,
        logs: [`⚠️ Servidor Oracle retornou status ${res.status}. Verifique se o docker container está rodando.`],
        timestamp: new Date().toISOString(),
      });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    const isTimeout = error.name === 'AbortError';
    return NextResponse.json({
      process: processName,
      linesCount: 1,
      logs: [
        isTimeout
          ? `⏱️ Timeout na conexao com a Oracle (${processName}). O servidor demorou mais de 6s para responder.`
          : `⚠️ Erro de conexao com o servidor Oracle (${backendUrl}): ${error.message}`
      ],
      timestamp: new Date().toISOString(),
    });
  }
});
