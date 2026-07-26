/**
 * Next.js Instrumentation Hook
 * Roda UMA VEZ antes de qualquer request, no processo Node.js.
 *
 * Problema: A rede bloqueia porta 53 (DNS) para servidores externos,
 * impedindo a resolução do registro SRV do MongoDB Atlas.
 *
 * Solução: DNS over HTTPS (DoH) via Cloudflare.
 * Resolve os registros SRV e TXT do Atlas via HTTPS (porta 443)
 * e converte o mongodb+srv:// em uma URL direta sem SRV.
 */

async function resolveAtlasSRVviaDoH(srvUri: string): Promise<string> {
  // Parse: mongodb+srv://user:pass@cluster0.bb82u.mongodb.net/database
  const withoutScheme = srvUri.replace('mongodb+srv://', 'https://');
  const url = new URL(withoutScheme);

  const hostname = url.hostname;                              // cluster0.bb82u.mongodb.net
  const userInfo = `${url.username}:${url.password}`;       // user:pass
  const database = url.pathname || '/';                       // /TraderProd
  const searchParams = url.search || '';                      // ?retryWrites=true&...

  const DOH = 'https://cloudflare-dns.com/dns-query';

  // 1. Resolve registros SRV: _mongodb._tcp.cluster0.bb82u.mongodb.net
  const srvResp = await fetch(`${DOH}?name=_mongodb._tcp.${hostname}&type=SRV`, {
    headers: { Accept: 'application/dns-json' },
  });
  const srvData = await srvResp.json() as { Answer?: Array<{ type: number; data: string }> };

  const hosts = (srvData.Answer || [])
    .filter((r) => r.type === 33) // tipo SRV = 33
    .map((r) => {
      // formato: "priority weight port target."
      const parts = r.data.trim().split(/\s+/);
      const port = parts[2];
      const target = parts[3].replace(/\.$/, ''); // remove trailing dot
      return `${target}:${port}`;
    });

  if (hosts.length === 0) {
    throw new Error('DoH: nenhum registro SRV encontrado para ' + hostname);
  }

  // 2. Resolve registro TXT para opções extras (authSource, replicaSet, etc.)
  const txtResp = await fetch(`${DOH}?name=${hostname}&type=TXT`, {
    headers: { Accept: 'application/dns-json' },
  });
  const txtData = await txtResp.json() as { Answer?: Array<{ type: number; data: string }> };

  const txtOptions = (txtData.Answer || [])
    .filter((r) => r.type === 16) // tipo TXT = 16
    .map((r) => r.data.replace(/"/g, '').trim())
    .join('&');

  // 3. Monta URI direta (sem mongodb+srv://)
  const queryParts = [txtOptions, 'tls=true', 'ssl=true'].filter(Boolean);

  // Preserva parâmetros originais da URI (ex: retryWrites, w, appName)
  if (searchParams) {
    queryParts.push(searchParams.replace(/^\?/, ''));
  }

  const directUri = `mongodb://${userInfo}@${hosts.join(',')}${database}?${queryParts.join('&')}`;
  return directUri;
}

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const uri = process.env.MONGODB_URI || '';

    if (uri.startsWith('mongodb+srv://')) {
      try {
        const directUri = await resolveAtlasSRVviaDoH(uri);
        process.env.MONGODB_URI = directUri;
        // Não loga a URI completa por segurança (contém credenciais)
        console.log('✅ [Instrumentation] SRV do Atlas resolvido via DoH (HTTPS). Conexão direta configurada.');
      } catch (err: any) {
        console.error('❌ [Instrumentation] Falha ao resolver SRV via DoH:', err.message);
        console.error('   → Verifique se o MongoDB Atlas tem o IP desta máquina na whitelist.');
      }
    } else {
      console.log('✅ [Instrumentation] MONGODB_URI não usa SRV, nenhuma resolução necessária.');
    }
  }
}
