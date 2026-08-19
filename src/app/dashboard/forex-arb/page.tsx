'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Globe, RefreshCw, Play, Square, TrendingUp, Wallet, X, ShieldAlert } from 'lucide-react';
import clsx from 'clsx';
import { ForexArbStrategy, ForexArbTrade, ForexArbSettings, ConfirmState, ForexLeg } from './types';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') || '';
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

const fmtUsd = (v: number) => `$${v.toFixed(2)}`;
const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(3)}%`;

function LegBadge({ leg }: { leg: ForexLeg }) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold border',
      leg.side === 'buy'
        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
        : 'bg-red-500/15 border-red-500/30 text-red-300'
    )}>
      {leg.side === 'buy' ? 'COMPRA' : 'VENDA'} {leg.symbol}
      {leg.price ? <span className="text-slate-400 font-mono">@{leg.price}</span> : null}
    </span>
  );
}

export default function ForexArbPage() {
  const [strategies, setStrategies] = useState<ForexArbStrategy[]>([]);
  const [trades, setTrades] = useState<ForexArbTrade[]>([]);
  const [opportunities, setOpportunities] = useState<ForexArbTrade[]>([]);
  const [settings, setSettings] = useState<ForexArbSettings | null>(null);
  const [botOnline, setBotOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'open' | 'executed' | 'opportunities'>('opportunities');
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [logProcess, setLogProcess] = useState<'forex-arb' | 'forex-scanner'>('forex-arb');

  const fetchStrategies = async () => {
    try {
      const res = await fetch('/api/forex-arb/strategies', { headers: authHeaders() });
      if (!res.ok) throw new Error('Erro ao buscar estratégias');
      setStrategies(await res.json());
    } catch (err: any) { setError(err.message); }
  };

  const fetchTrades = async () => {
    try {
      const res = await fetch('/api/forex-arb/trades', { headers: authHeaders() });
      if (!res.ok) throw new Error('Erro ao buscar trades');
      setTrades(await res.json());
    } catch (err: any) { setError(err.message); }
  };

  const fetchOpportunities = async () => {
    try {
      const res = await fetch('/api/forex-arb/opportunities', { headers: authHeaders() });
      if (!res.ok) throw new Error('Erro ao buscar oportunidades');
      setOpportunities(await res.json());
    } catch (err: any) { setError(err.message); }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/forex-arb/settings', { headers: authHeaders() });
      if (!res.ok) throw new Error('Erro ao buscar settings');
      setSettings(await res.json());
    } catch (err: any) { setError(err.message); }
  };

  const fetchBotStatus = async () => {
    try {
      const res = await fetch('/api/bot-status?botName=forex-arb', { headers: authHeaders() });
      if (!res.ok) throw new Error('Erro ao buscar status');
      const data = await res.json();
      setBotOnline(Boolean(data.isOnline));
    } catch { setBotOnline(false); }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(`/api/forex-arb/logs?process=${logProcess}&lines=120`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.logs)) setLogLines(data.logs.slice(-120));
    } catch {}
  };

  useEffect(() => {
    let isPolling = false;
    const refresh = async () => {
      if (isPolling) return;
      isPolling = true;
      try {
        await Promise.allSettled([fetchStrategies(), fetchTrades(), fetchOpportunities(), fetchSettings(), fetchBotStatus()]);
      } finally { isPolling = false; }
    };
    refresh().finally(() => setLoading(false));
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const t = setTimeout(fetchLogs, 0);
    const interval = setInterval(fetchLogs, 7000);
    return () => { clearTimeout(t); clearInterval(interval); };
  }, [logProcess]);

  // ── Derived stats ──
  const openPositions = useMemo(() => strategies.filter(s => s.positionOpen), [strategies]);
  const executedCloses = useMemo(() => trades.filter(t => t.type === 'close' && t.status === 'executed'), [trades]);
  const totalPnl = useMemo(() => executedCloses.reduce((acc, t) => acc + Number(t.realizedPnl || 0), 0), [executedCloses]);
  const bestOpportunity = useMemo(() => {
    if (!opportunities.length) return null;
    return opportunities.reduce((a, b) => (Number(a.expectedProfitPct || 0) > Number(b.expectedProfitPct || 0) ? a : b));
  }, [opportunities]);

  // ── Actions ──
  const toggleScanning = async () => {
    if (!settings) return;
    try {
      const res = await fetch('/api/forex-arb/settings', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ isScanningEnabled: !settings.isScanningEnabled }),
      });
      if (!res.ok) throw new Error('Erro ao atualizar settings');
      setSettings(await res.json());
      setSuccessMsg(settings.isScanningEnabled ? 'Scanner Forex pausado.' : 'Scanner Forex iniciado!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) { setError(err.message); }
  };

  const closePosition = async (strat: ForexArbStrategy) => {
    try {
      const res = await fetch('/api/forex-arb/close', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ strategyId: strat._id }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao fechar posição');
      }
      setSuccessMsg('Fechamento solicitado! O robô executará as pernas inversas.');
      setTimeout(() => setSuccessMsg(null), 4000);
      fetchStrategies(); fetchTrades();
    } catch (err: any) { setError(err.message); }
  };

  const handleClosePosition = (strat: ForexArbStrategy) => {
    setConfirmState({
      message: `Encerrar a arbitragem ${strat.name} (${strat.legs.map(l => l.symbol).join(' → ')})? O robô executará as pernas inversas para zerar a posição.`,
      onConfirm: () => { closePosition(strat); setConfirmState(null); },
    });
  };

  const deleteStrategy = async (id: string) => {
    try {
      const res = await fetch(`/api/forex-arb/strategies?id=${id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) throw new Error('Erro ao excluir estratégia');
      setSuccessMsg('Estratégia excluída.');
      setTimeout(() => setSuccessMsg(null), 3000);
      fetchStrategies();
    } catch (err: any) { setError(err.message); }
  };

  const handleDeleteStrategy = (strat: ForexArbStrategy) => {
    setConfirmState({
      message: `Excluir a estratégia ${strat.name}? (sem posição aberta)`,
      onConfirm: () => { deleteStrategy(strat._id); setConfirmState(null); },
    });
  };

  // ── Settings form (inline) ──
  const updateSettingsField = async (field: string, value: unknown) => {
    if (!settings) return;
    try {
      const res = await fetch('/api/forex-arb/settings', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error('Erro ao salvar settings');
      setSettings(await res.json());
      setSuccessMsg('Configuração salva.');
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err: any) { setError(err.message); }
  };

  return (
    <div className="p-6 space-y-6">
      {confirmState && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-3">Confirmar ação</h3>
            <p className="text-sm text-slate-300 mb-6">{confirmState.message}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmState(null)} className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600">
                Cancelar
              </button>
              <button onClick={confirmState.onConfirm} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-indigo-500/20 border border-indigo-500/30 p-2.5">
            <Globe className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Arbitragem Forex</h1>
            <p className="text-sm text-slate-400">Arbitragem simples e triangular dentro da corretora</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={clsx(
            'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold border',
            botOnline ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-red-500/15 border-red-500/30 text-red-300'
          )}>
            <span className={clsx('h-2 w-2 rounded-full', botOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-400')} />
            Robô {botOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
          <button onClick={toggleScanning} disabled={!settings}
            className={clsx(
              'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
              settings?.isScanningEnabled
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white',
              !settings && 'opacity-50 cursor-not-allowed'
            )}>
            {settings?.isScanningEnabled ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {settings?.isScanningEnabled ? 'Parar Scanner' : 'Iniciar Scanner'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <p>{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300"><X className="h-4 w-4" /></button>
        </div>
      )}
      {successMsg && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          {successMsg}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-white/10 bg-slate-950/70 p-5">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Oportunidades</div>
          <div className="mt-1 text-2xl font-black text-white">{opportunities.length}</div>
          {bestOpportunity && (
            <div className="text-[11px] text-emerald-400 font-mono mt-1">
              Melhor: {fmtPct(Number(bestOpportunity.expectedProfitPct || 0))}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/70 p-5">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Posições Abertas</div>
          <div className="mt-1 text-2xl font-black text-white">{openPositions.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Arbitragens em andamento</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/70 p-5">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Operações Fechadas</div>
          <div className="mt-1 text-2xl font-black text-white">{executedCloses.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Ciclos concluídos</div>
        </div>
        <div className={clsx('rounded-xl border p-5', totalPnl >= 0 ? 'border-emerald-500/30 bg-emerald-950/20' : 'border-red-500/30 bg-red-950/20')}>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">PnL Realizado</div>
          <div className={clsx('mt-1 text-2xl font-black font-mono', totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {totalPnl >= 0 ? '+' : ''}{fmtUsd(totalPnl)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Soma dos fechamentos</div>
        </div>
      </div>

      {/* Settings inline */}
      {settings && (
        <div className="rounded-xl border border-indigo-500/20 bg-slate-950/70 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Wallet className="h-4 w-4 text-indigo-400" /> Configurações da Arbitragem Forex
            </h3>
            <div className="flex items-center gap-4 text-xs">
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input type="checkbox" checked={settings.autoExecute} onChange={e => updateSettingsField('autoExecute', e.target.checked)}
                  className="rounded bg-slate-800 border-slate-600" />
                Execução Automática
              </label>
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input type="checkbox" checked={settings.triangularEnabled} onChange={e => updateSettingsField('triangularEnabled', e.target.checked)}
                  className="rounded bg-slate-800 border-slate-600" />
                Triangular
              </label>
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input type="checkbox" checked={settings.simpleEnabled} onChange={e => updateSettingsField('simpleEnabled', e.target.checked)}
                  className="rounded bg-slate-800 border-slate-600" />
                Simples
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Trade Size (USDT)</label>
              <input type="number" value={settings.tradeSize} onChange={e => updateSettingsField('tradeSize', Number(e.target.value))}
                className="w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-white" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Retorno Mínimo (%)</label>
              <input type="number" step="0.01" value={settings.minProfitPct} onChange={e => updateSettingsField('minProfitPct', Number(e.target.value))}
                className="w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-white" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Volume Mínimo 24h (USDT)</label>
              <input type="number" value={settings.minVolume24hUSD} onChange={e => updateSettingsField('minVolume24hUSD', Number(e.target.value))}
                className="w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-white" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Scan Interval (ms)</label>
              <input type="number" value={settings.scanIntervalMs} onChange={e => updateSettingsField('scanIntervalMs', Number(e.target.value))}
                className="w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-white" />
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
        {([
          { key: 'opportunities', label: '🎯 Oportunidades', count: opportunities.length },
          { key: 'open', label: 'Em Aberto', count: openPositions.length },
          { key: 'executed', label: 'Encerradas', count: executedCloses.length },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={clsx(
              'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
              activeTab === tab.key ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            )}>
            {tab.label}
            <span className={clsx('rounded-full px-1.5 text-[10px] font-bold', activeTab === tab.key ? 'bg-white/20' : 'bg-slate-800')}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-20 text-slate-500">Carregando...</div>
      ) : (
        <>
          {activeTab === 'opportunities' && (
            <div className="space-y-3">
              {opportunities.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-slate-500">
                  <TrendingUp className="h-8 w-8 mx-auto mb-3 opacity-40" />
                  Nenhuma oportunidade detectada ainda. Inicie o scanner e aguarde o próximo ciclo.
                </div>
              )}
              {opportunities.map(opp => (
                <div key={opp._id} className="rounded-xl border border-white/10 bg-slate-950/70 p-5">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="rounded-md bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 text-[11px] font-bold text-indigo-300 uppercase">
                        {opp.type}
                      </span>
                      <span className="text-xs text-slate-400">{opp.exchangeId}</span>
                      {opp.legs.map((leg, i) => (
                        <React.Fragment key={i}>
                          <LegBadge leg={leg} />
                          {i < opp.legs.length - 1 && <span className="text-slate-600">→</span>}
                        </React.Fragment>
                      ))}
                    </div>
                    <div className="text-right">
                      <div className={clsx('text-lg font-black font-mono', Number(opp.expectedProfitPct || 0) >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {fmtPct(Number(opp.expectedProfitPct || 0))}
                      </div>
                      <div className="text-[11px] text-slate-500">retorno líquido estimado</div>
                    </div>
                  </div>
                  <div className="mt-3 text-[11px] text-slate-500 font-mono">
                    Volume 24h: {opp.amount ? `$${Math.round(Number(opp.amount)).toLocaleString()}` : '—'} | Detectada em {new Date(opp.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'open' && (
            <div className="grid md:grid-cols-2 gap-4">
              {openPositions.length === 0 && (
                <div className="col-span-2 rounded-xl border border-dashed border-white/10 p-10 text-center text-slate-500">
                  Nenhuma posição aberta. As oportunidades lucrativas serão executadas automaticamente.
                </div>
              )}
              {openPositions.map(strat => (
                <div key={strat._id} className="rounded-xl border border-emerald-500/30 bg-slate-950/70 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-base font-extrabold text-white">{strat.name}</h3>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="rounded-md bg-indigo-500/15 border border-indigo-500/30 px-1.5 py-0.5 text-[10px] font-bold text-indigo-300 uppercase">{strat.type}</span>
                        {strat.exchangeId}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-emerald-400 font-mono">{fmtPct(Number(strat.expectedProfitPct || 0))}</div>
                      <div className="text-[11px] text-slate-500">{fmtUsd(Number(strat.positionSize || strat.tradeSize || 0))}</div>
                    </div>
                  </div>
                  <div className="space-y-1.5 mb-4">
                    {strat.legs.map((leg, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <LegBadge leg={leg} />
                        {leg.amount ? <span className="text-[11px] text-slate-500 font-mono">{leg.amount.toFixed(6)}</span> : null}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between border-t border-white/5 pt-3">
                    <div className="text-[11px] text-slate-500">
                      Aberta em {strat.positionOpenedAt ? new Date(strat.positionOpenedAt).toLocaleString() : '—'}
                    </div>
                    <button onClick={() => handleClosePosition(strat)}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-500">
                      Encerrar Agora
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'executed' && (
            <div className="grid md:grid-cols-2 gap-4">
              {executedCloses.length === 0 && (
                <div className="col-span-2 rounded-xl border border-dashed border-white/10 p-10 text-center text-slate-500">
                  Nenhuma operação encerrada ainda.
                </div>
              )}
              {executedCloses.map(trade => (
                <div key={trade._id} className="rounded-xl border border-white/10 bg-slate-950/70 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-base font-extrabold text-white">{trade.strategyName || 'Arbitragem'}</h3>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {trade.legs?.map(l => l.symbol).join(' → ') || '—'}
                      </div>
                    </div>
                    <div className={clsx('text-lg font-black font-mono', Number(trade.realizedPnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {Number(trade.realizedPnl || 0) >= 0 ? '+' : ''}{fmtUsd(Number(trade.realizedPnl || 0))}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center justify-between border-t border-white/5 pt-2">
                    <span>Fechada em {new Date(trade.createdAt).toLocaleString()}</span>
                    {trade.reason && <span className="text-amber-300/80">{trade.reason}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Strategies (cards pequenos) */}
      {strategies.length > 0 && (
        <div className="pt-4">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-indigo-400" /> Estratégias Monitoradas ({strategies.length})
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {strategies.map(strat => (
              <div key={strat._id} className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white truncate">{strat.name}</span>
                  <span className={clsx(
                    'rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase',
                    strat.positionOpen ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-400'
                  )}>
                    {strat.positionOpen ? 'Aberta' : 'Monitorando'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1 font-mono">
                  {strat.legs.map(l => l.symbol).join(' → ')}
                </div>
                <div className="flex items-center justify-between mt-3 text-xs">
                  <span className={clsx('font-mono font-bold', Number(strat.expectedProfitPct || 0) >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {fmtPct(Number(strat.expectedProfitPct || 0))}
                  </span>
                  {!strat.positionOpen && (
                    <button onClick={() => handleDeleteStrategy(strat)}
                      className="text-slate-500 hover:text-red-400 transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Logs */}
      <div className="pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white">Terminal de Logs</h3>
          <div className="flex items-center gap-2">
            {(['forex-arb', 'forex-scanner'] as const).map(p => (
              <button key={p} onClick={() => setLogProcess(p)}
                className={clsx('rounded-lg px-3 py-1 text-xs font-semibold',
                  logProcess === p ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white')}>
                {p === 'forex-arb' ? 'Robô Principal' : 'Scanner'}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/70 p-4 font-mono text-[11px] text-slate-400 h-64 overflow-y-auto custom-scrollbar">
          {logLines.length === 0 && <div className="text-slate-600">Aguardando logs...</div>}
          {logLines.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap break-all">{line}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
