'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Play, Pause, RefreshCw } from 'lucide-react';

type LiquidationStrategy = {
  _id: string;
  name: string;
  network: string;
  contractAddress: string;
  executionEnabled: boolean;
  lastScannedBlock: number;
  userPositionsCount: number;
  lastStatusMessage: string;
  lastRunAt: string | null;
  createdAt: string;
};

export default function LiquidationPage() {
  const [strategies, setStrategies] = useState<LiquidationStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStrategies = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/liquidation', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setStrategies(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleExecution = async (id: string, current: boolean) => {
    setToggling(id);
    setError(null);
    try {
      const url = `/api/liquidation/${id}/toggle`;
      console.log('[LIQ UI] toggle', url, 'current=', current);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ executionEnabled: !current })
      });
      console.log('[LIQ UI] status', res.status);
      const data = await res.json().catch(() => ({}));
      console.log('[LIQ UI] body', data);
      if (!res.ok) {
        setError(data?.error || `Falha ao atualizar (status ${res.status})`);
      } else {
        setStrategies(prev => prev.map(s => s._id === id ? { ...s, executionEnabled: !current, lastStatusMessage: !current ? 'enabled' : 'disabled' } : s));
      }
    } catch (e: any) {
      console.error('[LIQ UI] toggle error', e);
      setError(e?.message || 'Erro de conexão');
    } finally {
      setToggling(null);
    }
  };

  useEffect(() => { fetchStrategies(); }, []);

  const contractArbitrum = process.env.NEXT_PUBLIC_LIQUIDATION_CONTRACT_ARBITRUM;
  const activeCount = strategies.filter((s) => s.executionEnabled).length;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Liquidações Aave V3 — Arbitrum</h1>
            <p className="text-gray-400 text-sm">
              Contrato:{' '}
              {contractArbitrum ? (
                <a href={`https://arbiscan.io/address/${contractArbitrum}`} target="_blank" className="underline">
                  {contractArbitrum}
                </a>
              ) : (
                '—'
              )}
            </p>
            <p className="text-gray-500 text-xs mt-1">O robô roda em background 24/7. Aqui você liga/desliga apenas a execução real.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchStrategies} className="px-3 py-2 rounded bg-gray-800 hover:bg-gray-700 flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Atualizar
            </button>
            <Link href="/dashboard" className="px-3 py-2 rounded bg-gray-800 hover:bg-gray-700">Voltar</Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded p-4">
            <div className="text-gray-400 text-sm">Estratégias</div>
            <div className="text-2xl font-bold">{strategies.length}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded p-4">
            <div className="text-gray-400 text-sm">Executando</div>
            <div className={`text-2xl font-bold ${activeCount ? 'text-emerald-400' : ''}`}>{activeCount}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded p-4">
            <div className="text-gray-400 text-sm">Status</div>
            <div className="text-2xl font-bold">{strategies[0]?.lastStatusMessage || 'idle'}</div>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded divide-y divide-gray-800">
          {loading && <div className="p-4 text-gray-400">Carregando...</div>}
          {!loading && strategies.length === 0 && <div className="p-4 text-gray-400">Nenhuma estratégia.</div>}
          {error && (
            <div className="p-3 text-red-400 text-sm border-b border-gray-800">
              Erro: {error}
            </div>
          )}
          {strategies.map(s => (
            <div key={s._id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="font-semibold">{s.name}</div>
                <div className="text-sm text-gray-400">Rede: {s.network}</div>
                <div className="text-xs text-gray-500 break-all">Contrato: {s.contractAddress}</div>
                <div className="text-xs text-gray-500">Atualizado: {s.lastRunAt ? new Date(s.lastRunAt).toLocaleString() : '—'} • Status: {s.lastStatusMessage || '—'}</div>
              </div>
              <div className="flex items-center gap-3">
                <a href={`https://arbiscan.io/address/${s.contractAddress}`} target="_blank" className="text-gray-300 hover:text-white">
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => toggleExecution(s._id, s.executionEnabled)}
                  disabled={toggling === s._id}
                  className={`px-3 py-2 rounded flex items-center gap-2 ${s.executionEnabled ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-gray-800 hover:bg-gray-700'}`}
                >
                  {toggling === s._id ? (
                    <span className="animate-pulse">...</span>
                  ) : s.executionEnabled ? (
                    <><Pause className="w-4 h-4" /> Pausar</>
                  ) : (
                    <><Play className="w-4 h-4" /> Ativar</>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
