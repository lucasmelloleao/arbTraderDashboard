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

    // Se estiver rodando localmente E tiver chave SSH configurada
    if (process.env.SSH_KEY_PATH) {
      const { exec } = require('child_process');
      const util = require('util');
      const execPromise = util.promisify(exec);
      const host = isServer1 ? 'ubuntu@147.15.122.245' : 'ubuntu@163.176.2.243';
      const container = isServer1 ? 'liquidation' : 'bots';
      const cmd = `ssh -i "${process.env.SSH_KEY_PATH}" -o StrictHostKeyChecking=no ${host} "docker logs --tail ${lines} ${container}"`;
      const { stdout, stderr } = await execPromise(cmd, { timeout: 10000 });
      const rawOutput = stdout || stderr || '';
      const logLines = rawOutput.split('\n').map((l: string) => l.trim()).filter(Boolean);
      return NextResponse.json({ process: processName, linesCount: logLines.length, logs: logLines, timestamp: new Date().toISOString() });
    }

    // Modo Vercel / Produção: Comunicação HTTP nativa com a API do servidor Oracle
    const res = await fetch(`${backendUrl}/api/logs?process=${processName}&lines=${lines}`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({
        process: processName,
        linesCount: 1,
        logs: [`⚠️ Falha ao consultar API do Servidor Oracle (${res.status})`],
        timestamp: new Date().toISOString(),
      });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({
      process: processName,
      linesCount: 1,
      logs: [`⚠️ Erro ao consultar logs do servidor Oracle: ${error.message}`],
      timestamp: new Date().toISOString(),
    });
  }
});
