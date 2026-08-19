'use client';

import { useEffect, useRef, useState } from 'react';

// Captura o código de autorização que a cTrader Open API devolve na URL
// (redirect_uri = https://arb-trader-dashboard.vercel.app/) e o troca por
// tokens via API route, salvando no ExchangeKey da corretora cTrader.
export default function CtraderOAuthCapture() {
  const [status, setStatus] = useState<'idle' | 'working' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;
    handled.current = true;

    setStatus('working');
    setMessage('Recebemos o código da cTrader. Salvando tokens...');

    (async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setStatus('error');
          setMessage('Você precisa estar logado para salvar a conexão. Faça login e repita a autorização.');
          return;
        }
        const res = await fetch('/api/ctrader/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ code, redirectUri: window.location.origin + '/' }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setStatus('success');
          setMessage('cTrader conectado com sucesso! Tokens salvos com segurança.');
          // Limpa o ?code= da URL sem recarregar
          window.history.replaceState({}, document.title, window.location.pathname);
        } else {
          setStatus('error');
          setMessage(`Falha ao salvar: ${data.reason || 'erro desconhecido'}`);
        }
      } catch (e: any) {
        setStatus('error');
        setMessage(`Erro de rede: ${e.message}`);
      }
    })();
  }, []);

  if (status === 'idle') return null;

  return (
    <div className={`fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border px-4 py-3 shadow-2xl text-sm ${
      status === 'success' ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-200'
      : status === 'error' ? 'bg-red-950/95 border-red-500/50 text-red-200'
      : 'bg-slate-900/95 border-indigo-500/50 text-slate-200'
    }`}>
      <div className="flex items-center gap-2">
        {status === 'working' && <span className="animate-spin inline-block w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full" />}
        <span>{message}</span>
        {(status === 'success' || status === 'error') && (
          <button onClick={() => setStatus('idle')} className="ml-2 text-slate-400 hover:text-white text-xs">✕</button>
        )}
      </div>
    </div>
  );
}
