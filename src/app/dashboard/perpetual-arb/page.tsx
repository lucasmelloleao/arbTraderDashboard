'use client';

import { useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, RefreshCw, Play, Pause } from 'lucide-react';

type PerpArbStrategy = {
  _id: string;
  name: string;
  perpSymbol: string;
  spotSymbol: string;
  tradeSize: number;
  minFundingRatePct: number;
  autoExecute: boolean;
  active: boolean;
};

type PerpArbTrade = {
  _id: string;
  strategyId: string;
  type: string;
  spotPrice?: number;
  perpPrice?: number;
  fundingRate?: number;
  fundingPct?: number;
  amount: number;
  status: string;
  createdAt: string;
};

export default function PerpetualArbPage() {
  const [strategies, setStrategies] = useState<PerpArbStrategy[]>([]);
  const [trades, setTrades] = useState<PerpArbTrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStrategies = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:4001/api/perp-arb/strategies');
      if (!res.ok) throw new Error('Erro ao buscar estratégias');
      setStrategies(await res.json());
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const fetchTrades = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:4001/api/perp-arb/trades');
      if (!res.ok) throw new Error('Erro ao buscar trades');
      setTrades(await res.json());
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const updateStrategy = async (strategy: Partial<PerpArbStrategy> & { _id: string }) => {
    try {
      const res = await fetch('http://localhost:4001/api/perp-arb/strategies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(strategy)
      });
      if (!res.ok) throw new Error('Falha ao atualizar estratégia');
      await fetchStrategies();
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido');
    }
  };

  useEffect(() => {
    fetchStrategies();
    fetchTrades();
    const interval = setInterval(() => {
      fetchStrategies();
      fetchTrades();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Funding Arb</h1>
          <p className="mt-2 text-sm text-gray-400">Monitora funding rate e permite ativar auto-execute.</p>
        </div>
        <button
          onClick={() => {
            fetchStrategies();
            fetchTrades();
          }}
          className="inline-flex items-center gap-2 rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
        >
          <RefreshCw className="h-4 w-4" /> Atualizar
        </button>
      </div>

      {error && <div className="mt-4 rounded border border-red-600 bg-red-950/50 p-3 text-sm text-red-200">{error}</div>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-white/10 bg-slate-950/70 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Estratégias</h2>
              <p className="text-sm text-gray-400">Ative autoexecute e verifique limites mínimos.</p>
            </div>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-gray-300">{strategies.length} estratégias</span>
          </div>
          <div className="space-y-4">
            {loading && <div className="text-sm text-gray-400">Carregando...</div>}
            {strategies.map((strategy) => (
              <div key={strategy._id} className="rounded-xl border border-white/10 bg-slate-900 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-100">{strategy.name}</div>
                    <div className="text-sm text-gray-400">{strategy.perpSymbol} / {strategy.spotSymbol}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={strategy.active ? 'rounded-full bg-emerald-500/15 px-2 py-1 text-[11px] uppercase tracking-[0.2em] text-emerald-200' : 'rounded-full bg-amber-500/15 px-2 py-1 text-[11px] uppercase tracking-[0.2em] text-amber-200'}>{strategy.active ? 'Ativa' : 'Inativa'}</span>
                    <span className={strategy.autoExecute ? 'rounded-full bg-cyan-500/15 px-2 py-1 text-[11px] uppercase tracking-[0.2em] text-cyan-200' : 'rounded-full bg-slate-500/15 px-2 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-200'}>{strategy.autoExecute ? 'Auto' : 'Manual'}</span>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm text-gray-400">
                  <div>Trade size: {strategy.tradeSize}</div>
                  <div>Min funding: {strategy.minFundingRatePct}%</div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => updateStrategy({ _id: strategy._id, autoExecute: !strategy.autoExecute })}
                    className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-500"
                  >
                    <Play className="h-4 w-4" /> {strategy.autoExecute ? 'Desativar auto' : 'Ativar auto'}
                  </button>
                  <button
                    onClick={() => updateStrategy({ _id: strategy._id, active: !strategy.active })}
                    className="inline-flex items-center gap-2 rounded bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-600"
                  >
                    <Pause className="h-4 w-4" /> {strategy.active ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-950/70 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Histórico de Intenções</h2>
              <p className="text-sm text-gray-400">Registros de oportunidades detectadas.</p>
            </div>
          </div>
          <div className="space-y-4">
            {trades.length === 0 && <div className="text-sm text-gray-400">Nenhum trade encontrado.</div>}
            {trades.map((trade) => (
              <div key={trade._id} className="rounded-xl border border-white/10 bg-slate-900 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">{trade.type.toUpperCase()} · {trade.status}</div>
                    <div className="text-sm text-gray-400">{new Date(trade.createdAt).toLocaleString()}</div>
                  </div>
                  <span className={trade.fundingPct! >= 0 ? 'inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-300' : 'inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-1 text-red-300'}>
                    {trade.fundingPct! >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                    {trade.fundingPct?.toFixed(4)}%
                  </span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 text-sm text-gray-400">
                  <div>Spot price: {trade.spotPrice ?? 'n/a'}</div>
                  <div>Perp price: {trade.perpPrice ?? 'n/a'}</div>
                </div>
                <div className="mt-2 text-sm text-gray-400">Amount: {trade.amount}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
