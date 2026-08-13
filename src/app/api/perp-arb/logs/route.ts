import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req: NextRequest) => {
  let processName = 'scanner';
  try {
    const { searchParams } = new URL(req.url);
    processName = searchParams.get('process') || 'scanner';
    const lines = searchParams.get('lines') || '150';

    const hostIp = '178.104.51.125';
    const container = 'bots';

    // Obtem o conteudo da chave SSH via variavel de ambiente ou arquivo local
    let privateKey = process.env.SSH_PRIVATE_KEY;
    if (!privateKey && process.env.SSH_KEY_PATH) {
      const fs = require('fs');
      if (fs.existsSync(process.env.SSH_KEY_PATH)) {
        privateKey = fs.readFileSync(process.env.SSH_KEY_PATH, 'utf8');
      }
    }
    if (!privateKey) {
      // Tenta o caminho padrao local
      const fs = require('fs');
      const defaultPath = 'C:\\Users\\lleao\\Downloads\\ssh.key';
      if (fs.existsSync(defaultPath)) {
        privateKey = fs.readFileSync(defaultPath, 'utf8');
      }
    }

    if (!privateKey) {
      return NextResponse.json({
        process: processName,
        linesCount: 1,
        logs: ['⚠️ Variavel SSH_PRIVATE_KEY nao configurada no ambiente.'],
        timestamp: new Date().toISOString(),
      });
    }

    // Formata quebras de linha e remove aspas excedentes se a chave veio do .env
    const formattedPrivateKey = privateKey
      .trim()
      .replace(/^"|"$/g, '')
      .replace(/\\n/g, '\n');

    // Instancia a conexao SSH JS nativa via dynamic import em runtime (compativel com Vercel/Turbopack)
    const { NodeSSH } = await import('node-ssh');
    const ssh = new NodeSSH();

    const sshConfig: any = {
      host: hostIp,
      username: 'root',
      readyTimeout: 15000,
    };

    if (process.env.SSH_PASSWORD) {
      sshConfig.password = process.env.SSH_PASSWORD;
    } else {
      sshConfig.privateKey = formattedPrivateKey;
    }

    await ssh.connect(sshConfig);

    // Captura os logs filtrando pelo processo especifico do PM2 dentro do container
    const result = await ssh.execCommand(`docker exec ${container} pm2 logs ${processName} --lines ${lines} --nostream --raw`);
    ssh.dispose();

    const rawOutput = result.stdout || result.stderr || '';
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
      logs: [`⚠️ Erro na conexao SSH JS (${processName}): ${error.message}`],
      timestamp: new Date().toISOString(),
    });
  }
});
