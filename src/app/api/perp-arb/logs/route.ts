import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req: NextRequest) => {
  let processName = 'scanner';
  try {
    const { searchParams } = new URL(req.url);
    processName = searchParams.get('process') || 'scanner';
    const lines = searchParams.get('lines') || '150';

    // Roteia para o servidor Oracle correspondente ao processo
    const isServer1 = processName.startsWith('liq-');
    const defaultHost = isServer1 ? 'http://147.15.122.245:4001' : 'http://163.176.2.243:4001';
    
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    const sshKey = process.env.SSH_KEY_PATH || 'C:\\Users\\lleao\\Downloads\\ssh.key';
    const host = isServer1 ? 'ubuntu@147.15.122.245' : 'ubuntu@163.176.2.243';
    const container = isServer1 ? 'liquidation' : 'bots';

    const cmd = `ssh -i "${sshKey}" -o StrictHostKeyChecking=no ${host} "docker logs --tail ${lines} ${container}"`;
    const { stdout, stderr } = await execPromise(cmd, { timeout: 10000 });

    const rawOutput = stdout || stderr || '';
    const logLines = rawOutput
      .split('\n')
      .map((l: string) => l.trim())
      .filter(Boolean);

    return NextResponse.json({
      process: processName,
      linesCount: logLines.length,
      logs: logLines,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({
      process: processName,
      linesCount: 1,
      logs: [`⚠️ Falha ao obter logs via SSH/Docker: ${error.message}`],
      timestamp: new Date().toISOString(),
    });
  }
});
