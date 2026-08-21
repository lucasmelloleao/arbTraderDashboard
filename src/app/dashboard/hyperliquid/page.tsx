'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Terminal, Wallet as WalletIcon, TrendingUp, XCircle } from 'lucide-react';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') || '';
}
function authHeaders(): Record<string, string> {
  const token = getToken();
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

type HLStrategy = {
  _id: string;
  name: string;
  perpSymbol: string;
  spotSymbol: string;
  fundingRate: number;
  expectedFundingPct: number;
  tradeSize: number;
  positionOpen: boolean;
  positionSize: number;
  active: boolean;
  status: string;
  pnl: number;
  fundingCollected: number;
  markPx: number;
  createdAt: string;
  closedAt?: string;
};

type HLTrade = {
  _id: string;
  strategyName?: string;
  perpSymbol?: string;
  spotSymbol?: string;
  type: string;
  status: string;
  amount: number;
  realizedPnl?: number;
  fundingRate?: number;
  spotPrice?: number;
  perpPrice?: number;
  perpOrderId?: string;
  spotOrderId?: string;
  reason?: string;
  errorMessage?: string;
  createdAt: string;
};

const TRADE_FILTERS = [
  { key: 'all', label: 'Todas' },
  { key: 'open', label: 'Entradas' },
  { key: 'close', label: 'Fechamentos' },
  { key: 'error', label: 'Erros' },
  { key: 'funding', label: 'Funding' },
] as const;
type TradeFilterKey = (typeof TRADE_FILTERS)[number]['key'];

function formatPnl(value?: number | null): string {
  if (value === undefined || value === null) return '—';
  const sign = value >= 0 ? '+' : '−';
  const abs = Math.abs(value);
  const digits = abs >= 1 ? 2 : 4;
  return `${sign}$${abs.toFixed(digits)}`;
}

function formatDayLabel(d: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Hoje';
  if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
}

const STATUS_STYLES: Record<string, string> = {
  executed: 'text-emerald-400',
  simulated: 'text-indigo-400',
  detected: 'text-amber-400',
  failed: 'text-red-400',
  skipped: 'text-slate-500',
};

const TYPE_STYLES: Record<string, string> = {
  open: 'bg-indigo-500/20 text-indigo-400',
  close: 'bg-amber-500/20 text-amber-400',
  funding: 'bg-sky-500/20 text-sky-400',
  error: 'bg-red-500/20 text-red-400',
};

export default function HyperliquidPage() {
  const [strategies, setStrategies] = useState<HLStrategy[]>([]);
  const [trades, setTrades] = useState<HLTrade[]>([]);
  const [account, setAccount] = useState<any>(null);
  const [hasKey, setHasKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Logs
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logLines, setLogLines] = useState(150);
  const [lastUpdateLogs, setLastUpdateLogs] = useState<string | null>(null);
  const terminalContainerRef = React.useRef<HTMLDivElement | null>(null);

  // Trades recentes — filtros
  const [tradeFilter, setTradeFilter] = useState<TradeFilterKey>('all');
  const [tradeSearch, setTradeSearch] = useState('');
  const [visibleTrades, setVisibleTrades] = useState(20);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [stratRes, tradeRes, accRes, setRes] = await Promise.all([
        fetch('/api/hyperliquid/strategies', { headers: authHeaders() }),
        fetch('/api/hyperliquid/trades', { headers: authHeaders() }),
        fetch('/api/hyperliquid/account', { headers: authHeaders() }),
        fetch('/api/hyperliquid/settings', { headers: authHeaders() }),
      ]);
      const [strats, trds, acc, sets] = await Promise.all([stratRes.json(), tradeRes.json(), accRes.json(), setRes.json()]);
      if (Array.isArray(strats)) setStrategies(strats);
      if (Array.isArray(trds)) setTrades(trds);
      setHasKey(acc?.hasKey ?? false);
      setAccount(acc?.account ?? null);
      setSettings(sets || null);
    } catch (e: any) {
      setError(e?.message || 'Falha ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  // Alterna a colheita automática (isScanningEnabled)
  const toggleHarvest = async () => {
    const newStatus = !settings?.isScanningEnabled;
    try {
      const res = await fetch('/api/hyperliquid/settings', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ isScanningEnabled: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Falha ao atualizar');
      setSettings(data);
      setSuccessMsg(newStatus
        ? '🌾 Colheita INICIADA! O robô agora escaneia e opera na Hyperliquid.'
        : '🛑 Colheita PAUSADA.');
      setTimeout(() => setSuccessMsg(null), 5000);
      setTimeout(fetchAll, 2000);
    } catch (e: any) {
      alert(`Erro: ${e.message}`);
    }
  };

  // Edição das configurações globais
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState<any>({});
  const startEditingSettings = () => {
    setSettingsForm({
      tradeSize: settings?.tradeSize ?? 100,
      minFundingRatePct: settings?.minFundingRatePct ?? 0.01,
      minVolume24hUSD: settings?.minVolume24hUSD ?? 500000,
      maxStrategiesPerScan: settings?.maxStrategiesPerScan ?? 5,
      maxDailyLoss: settings?.maxDailyLoss ?? 10,
      takeProfitPricePct: settings?.takeProfitPricePct ?? 3,
      trailingStopPct: settings?.trailingStopPct ?? 1.5,
    });
    setIsEditingSettings(true);
  };
  const saveSettings = async (form: any) => {
    try {
      const res = await fetch('/api/hyperliquid/settings', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          tradeSize: Number(form.tradeSize),
          minFundingRatePct: Number(form.minFundingRatePct),
          minVolume24hUSD: Number(form.minVolume24hUSD),
          maxStrategiesPerScan: Number(form.maxStrategiesPerScan),
          maxDailyLoss: Number(form.maxDailyLoss),
          takeProfitPricePct: Number(form.takeProfitPricePct),
          trailingStopPct: Number(form.trailingStopPct),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Falha ao salvar');
      setSettings(data);
      setIsEditingSettings(false);
      setSuccessMsg('⚙️ Configurações salvas.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e: any) {
      alert(`Erro: ${e.message}`);
    }
  };

  const fetchLogs = async () => {
    if (loadingLogs) return;
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/hyperliquid/logs?lines=${logLines}`, { headers: authHeaders() });
      const data = await res.json();
      setTerminalLogs((data.logs || []).map((l: string) => l.replace(/\x1B\[[0-9;]*[mK]/g, '')));
      setLastUpdateLogs(new Date().toLocaleTimeString());
    } catch { /* ignora */ } finally {
      setLoadingLogs(false);
    }
  };

  const closeStrategy = async (id: string) => {
    if (!confirm('Fechar esta posição agora?')) return;
    try {
      const res = await fetch('/api/hyperliquid/close', {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ strategyId: id }),
      });
      const data = await res.json();
      alert(data.message || data.error || 'Comando enviado');
      setTimeout(fetchAll, 3000);
    } catch (e: any) {
      alert(`Erro: ${e.message}`);
    }
  };

  useEffect(() => {
    fetchAll();
    fetchLogs();
    const i1 = setInterval(fetchAll, 15000);
    const i2 = setInterval(fetchLogs, 8000);
    return () => { clearInterval(i1); clearInterval(i2); };
  }, []);

  useEffect(() => {
    if (terminalContainerRef.current) {
      terminalContainerRef.current.scrollTop = terminalContainerRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  const totalPnl = trades.reduce((acc, t) => acc + (t.realizedPnl ?? 0), 0);
  const openPositions = strategies.filter((s) => s.positionOpen);
  const executedCloses = trades.filter((t) => t.type === 'close' && t.status === 'executed');

  const filteredTrades = useMemo(() => {
    const q = tradeSearch.trim().toLowerCase();
    return trades.filter((t) => {
      if (tradeFilter !== 'all' && t.type !== tradeFilter) return false;
      if (!q) return true;
      return [t.strategyName, t.perpSymbol, t.spotSymbol, t.reason, t.status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [trades, tradeFilter, tradeSearch]);

  const groupedTrades = useMemo(() => {
    const groups: { date: string; label: string; trades: HLTrade[] }[] = [];
    for (const t of filteredTrades) {
      const d = new Date(t.createdAt);
      const key = d.toDateString();
      let group = groups.find((g) => g.date === key);
      if (!group) {
        group = { date: key, label: formatDayLabel(d), trades: [] };
        groups.push(group);
      }
      group.trades.push(t);
    }
    return groups;
  }, [filteredTrades]);

  const shownGroups = groupedTrades.slice(0, visibleTrades);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-fuchsia-500" /> Hyperliquid (Lyquid)
          </h1>
          <p className="text-sm text-slate-400 mt-1">Funding arbitrage v1 — DEX de perpétuos com Agent Wallet</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${hasKey ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
            {hasKey ? 'Chave conectada' : 'Sem chave cadastrada'}
          </span>
          {/* Botão de Colheita Automática */}
          <button
            onClick={toggleHarvest}
            disabled={!hasKey}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-all shadow-lg hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed ${
              settings?.isScanningEnabled
                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 border border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
            }`}
          >
            {settings?.isScanningEnabled ? (
              <>
                <span className="h-2 w-2 rounded-full bg-slate-950 animate-ping" />
                🛑 Parar Colheita (Ativa)
              </>
            ) : (
              <>🌾 Iniciar Colheita</>
            )}
          </button>
          <button onClick={fetchAll} className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors">
            <RefreshCw className="w-4 h-4" /> Atualizar
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3 rounded-lg text-sm">{successMsg}</div>
      )}

      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-3 rounded-lg text-sm">{error}</div>}

      {!hasKey && (
        <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl text-amber-200 text-sm">
          Nenhuma chave Hyperliquid cadastrada. Adicione em <b>Integrações de Trading</b> (opção Hyperliquid DEX) com o endereço MASTER + private key do AGENT.
        </div>
      )}

      {/* Quadro de Configurações Globais */}
      <div className="rounded-xl border border-indigo-500/20 bg-slate-900/80 p-4 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-indigo-400 flex items-center gap-2">
            <span className="text-indigo-400">⚙️</span> Configurações Globais do Robô
          </h2>
          {!isEditingSettings ? (
            <button onClick={startEditingSettings} className="text-xs font-semibold text-indigo-300 hover:text-white underline">Editar</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setIsEditingSettings(false)} className="text-xs font-semibold text-slate-400 hover:text-white underline">Cancelar</button>
              <button onClick={() => saveSettings(settingsForm)} className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 underline">Salvar</button>
            </div>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-5 text-sm">
          <div>
            <span className="block text-xs text-slate-500 mb-1">Colheita Automática</span>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold ${settings?.isScanningEnabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'}`}>
              <span className={`h-2 w-2 rounded-full ${settings?.isScanningEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              {settings?.isScanningEnabled ? 'Ativa' : 'Pausada'}
            </span>
          </div>
          <div>
            <span className="block text-xs text-slate-500 mb-1">Aporte p/ Posição (USDC)</span>
            {!isEditingSettings ? (
              <span className="font-bold text-white">${settings?.tradeSize ?? 100}</span>
            ) : (
              <input type="number" value={settingsForm.tradeSize} onChange={(e) => setSettingsForm({ ...settingsForm, tradeSize: Number(e.target.value) })} className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-white" />
            )}
          </div>
          <div>
            <span className="block text-xs text-slate-500 mb-1">Funding Mínimo (%)</span>
            {!isEditingSettings ? (
              <span className="font-bold text-white">{settings?.minFundingRatePct ?? 0.01}%</span>
            ) : (
              <input type="number" step="0.001" value={settingsForm.minFundingRatePct} onChange={(e) => setSettingsForm({ ...settingsForm, minFundingRatePct: Number(e.target.value) })} className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-white" />
            )}
          </div>
          <div>
            <span className="block text-xs text-slate-500 mb-1">Vol 24h Mínimo (USDC)</span>
            {!isEditingSettings ? (
              <span className="font-bold text-white">${(settings?.minVolume24hUSD ?? 500000).toLocaleString()}</span>
            ) : (
              <input type="number" value={settingsForm.minVolume24hUSD} onChange={(e) => setSettingsForm({ ...settingsForm, minVolume24hUSD: Number(e.target.value) })} className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-white" />
            )}
          </div>
          <div>
            <span className="block text-xs text-slate-500 mb-1">Max Estratégias / Scan</span>
            {!isEditingSettings ? (
              <span className="font-bold text-white">{settings?.maxStrategiesPerScan ?? 5}</span>
            ) : (
              <input type="number" min="1" value={settingsForm.maxStrategiesPerScan} onChange={(e) => setSettingsForm({ ...settingsForm, maxStrategiesPerScan: Number(e.target.value) })} className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-white" />
            )}
          </div>
          <div className="sm:col-span-5 border-t border-white/10 pt-3">
            <span className="block text-xs text-slate-500 mb-1">Max Perda Diária (USDC)</span>
            {!isEditingSettings ? (
              <span className="font-bold text-white">${settings?.maxDailyLoss ?? 10}</span>
            ) : (
              <input type="number" value={settingsForm.maxDailyLoss} onChange={(e) => setSettingsForm({ ...settingsForm, maxDailyLoss: Number(e.target.value) })} className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-white" />
            )}
          </div>
          <div>
            <span className="block text-xs text-slate-500 mb-1">Take-Profit Valorização (%)</span>
            {!isEditingSettings ? (
              <span className="font-bold text-white">{settings?.takeProfitPricePct ?? 3}%</span>
            ) : (
              <input type="number" step="0.5" value={settingsForm.takeProfitPricePct} onChange={(e) => setSettingsForm({ ...settingsForm, takeProfitPricePct: Number(e.target.value) })} className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-white" />
            )}
          </div>
          <div>
            <span className="block text-xs text-slate-500 mb-1">Trailing Stop (%)</span>
            {!isEditingSettings ? (
              <span className="font-bold text-white">{settings?.trailingStopPct ?? 1.5}%</span>
            ) : (
              <input type="number" step="0.1" value={settingsForm.trailingStopPct} onChange={(e) => setSettingsForm({ ...settingsForm, trailingStopPct: Number(e.target.value) })} className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-white" />
            )}
          </div>
        </div>
      </div>

      {/* Account + Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-2"><WalletIcon className="w-4 h-4 text-fuchsia-500" /> Equity</div>
          <div className="text-2xl font-bold text-white">${(account?.equity ?? 0).toFixed(2)}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="text-slate-400 text-sm mb-2">Disponível (withdrawable)</div>
          <div className="text-2xl font-bold text-emerald-400">${(account?.withdrawable ?? 0).toFixed(2)}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="text-slate-400 text-sm mb-2">Posições abertas</div>
          <div className="text-2xl font-bold text-white">{openPositions.length}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="text-slate-400 text-sm mb-2">PnL realizado</div>
          <div className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>${totalPnl.toFixed(2)}</div>
        </div>
      </div>

      {/* Estratégias */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-bold text-white">Estratégias</h2>
          <span className="text-xs text-slate-500">{strategies.length} registros</span>
        </div>
        <div className="divide-y divide-slate-800/50">
          {strategies.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">Nenhuma estratégia ainda — o robô cria automaticamente ao detectar funding favorável.</div>
          ) : strategies.map((s) => (
            <div key={s._id} className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium text-white truncate">{s.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {s.perpSymbol} · funding {(s.fundingRate * 100).toFixed(4)}%/ciclo · mark ${s.markPx}
                </div>
                <div className="flex gap-2 mt-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${s.positionOpen ? 'bg-emerald-500/20 text-emerald-400' : s.active ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-700 text-slate-400'}`}>
                    {s.positionOpen ? 'ABERTA' : s.active ? 'ATIVA' : 'FECHADA'}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">${s.tradeSize}</span>
                  {s.positionOpen && <span className="px-2 py-0.5 rounded text-[10px] bg-fuchsia-500/20 text-fuchsia-400">posição ${s.positionSize}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {s.positionOpen && (
                  <button onClick={() => closeStrategy(s._id)} className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> Encerrar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trades recentes */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl">
        <div className="p-5 border-b border-slate-800 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-bold text-white">Trades recentes</h2>
            <span className="text-xs text-slate-500">
              {executedCloses.length} fechamentos executados · {filteredTrades.length} trades listados
            </span>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1 flex-wrap">
              {TRADE_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => { setTradeFilter(f.key); setVisibleTrades(20); }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${tradeFilter === f.key ? 'bg-fuchsia-500/25 text-fuchsia-300 border border-fuchsia-500/40' : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={tradeSearch}
              onChange={(e) => { setTradeSearch(e.target.value); setVisibleTrades(20); }}
              placeholder="Buscar estratégia, par, motivo..."
              className="w-full sm:w-64 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-fuchsia-500/50"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/50 text-slate-400 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Estratégia</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">PnL</th>
                <th className="px-4 py-3 font-medium">Funding</th>
                <th className="px-4 py-3 font-medium">Ordens</th>
                <th className="px-4 py-3 font-medium">Motivo / Erro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredTrades.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">Nenhum trade encontrado.</td></tr>
              ) : shownGroups.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">Você já viu todos os trades — ajuste os filtros para refinar.</td></tr>
              ) : shownGroups.map((group) => (
                <React.Fragment key={group.date}>
                  <tr className="bg-slate-800/40">
                    <td colSpan={9} className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-fuchsia-400">
                      {group.label} · {group.trades.length} trade{group.trades.length === 1 ? '' : 's'}
                    </td>
                  </tr>
                  {group.trades.map((t) => (
                    <tr key={t._id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{new Date(t.createdAt).toLocaleString('pt-BR')}</td>
                      <td className="px-4 py-3 text-white">
                        <span className="font-medium">{t.strategyName || '—'}</span>
                        {t.perpSymbol && <span className="block text-[10px] text-slate-500">{t.perpSymbol}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${TYPE_STYLES[t.type] || 'bg-slate-700 text-slate-400'}`}>{t.type}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs ${STATUS_STYLES[t.status] || 'text-amber-400'}`}>{t.status}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap">${Number(t.amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className={`px-4 py-3 whitespace-nowrap ${(t.realizedPnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatPnl(t.realizedPnl)}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                        {t.fundingRate !== undefined && t.fundingRate !== null ? `${(t.fundingRate * 100).toFixed(4)}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-[10px] font-mono text-slate-500">
                        {t.perpOrderId || t.spotOrderId ? (
                          <span className="block max-w-[140px] truncate" title={`PERP: ${t.perpOrderId || '—'}\nSPOT: ${t.spotOrderId || '—'}`}>
                            P:{t.perpOrderId ? t.perpOrderId.slice(0, 8) : '—'} · S:{t.spotOrderId ? t.spotOrderId.slice(0, 8) : '—'}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {t.errorMessage ? (
                          <span className="text-red-400" title={t.errorMessage}>{t.errorMessage.length > 60 ? t.errorMessage.slice(0, 60) + '…' : t.errorMessage}</span>
                        ) : t.reason ? (
                          <span className="text-slate-400" title={t.reason}>{t.reason.length > 60 ? t.reason.slice(0, 60) + '…' : t.reason}</span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {filteredTrades.length > shownGroups.reduce((acc, g) => acc + g.trades.length, 0) && (
          <div className="p-4 border-t border-slate-800 text-center">
            <button onClick={() => setVisibleTrades((v) => v + 20)} className="text-xs font-semibold text-fuchsia-400 hover:text-fuchsia-300 underline">
              Ver mais trades
            </button>
          </div>
        )}
      </div>

      {/* Terminal Logs */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-bold text-white flex items-center gap-2"><Terminal className="w-4 h-4 text-fuchsia-500" /> Logs do robô</h2>
          <div className="flex items-center gap-2">
            {lastUpdateLogs && <span className="text-xs text-slate-500">atualizado {lastUpdateLogs}</span>}
            <select value={logLines} onChange={(e) => setLogLines(Number(e.target.value))} className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white">
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={400}>400</option>
            </select>
            <button onClick={fetchLogs} className="bg-slate-800 hover:bg-slate-700 text-white px-2 py-1 rounded text-xs"><RefreshCw className="w-3.5 h-3.5" /></button>
          </div>
        </div>
        <div ref={terminalContainerRef} className="p-4 h-72 overflow-y-auto font-mono text-xs text-slate-300 bg-slate-950/50">
          {terminalLogs.length === 0 ? <span className="text-slate-600">Aguardando logs...</span> : terminalLogs.map((l, i) => <div key={i} className="whitespace-pre-wrap">{l}</div>)}
        </div>
      </div>
    </div>
  );
}
