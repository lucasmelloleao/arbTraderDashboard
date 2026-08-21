'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw,
  Terminal,
  Download,
  Server,
} from 'lucide-react';
import { PerpArbStrategy, PerpArbTrade, ExchangeKey, ConfirmState } from './types';
import { StatsHeader } from './components/StatsHeader';
import { OpenPositionCard } from './components/OpenPositionCard';
import { ClosedTradeCard } from './components/ClosedTradeCard';
import { StrategyCard } from './components/StrategyCard';
import { ConfirmModal } from './components/modals/ConfirmModal';
import { StrategyFormModal } from './components/modals/StrategyFormModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { ManualScanModal } from './components/modals/ManualScanModal';
import { IncreasePositionModal } from './components/modals/IncreasePositionModal';
import { AiAdvisorCard } from './components/AiAdvisorCard';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') || '';
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export default function PerpetualArbPage() {
  const [strategies, setStrategies] = useState<PerpArbStrategy[]>([]);
  const [trades, setTrades] = useState<PerpArbTrade[]>([]);
  const [loadingStrategies, setLoadingStrategies] = useState(false);
  const [loadingTrades, setLoadingTrades] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [opTab, setOpTab] = useState<'open' | 'executed'>('open');

  const [showForm, setShowForm] = useState<{ mode: 'create' | 'edit'; strategy?: PerpArbStrategy } | null>(null);
  const [showManualScan, setShowManualScan] = useState(false);
  const [showIncreaseModal, setShowIncreaseModal] = useState<PerpArbStrategy | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [exchangeKeys, setExchangeKeys] = useState<ExchangeKey[]>([]);

  const [settings, setSettings] = useState<any>(null);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState<any>({});
  const [botOnline, setBotOnline] = useState<boolean>(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closingSet, setClosingSet] = useState<Set<string>>(new Set());
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [balances, setBalances] = useState({ spotUsdt: 0, spotUsdc: 0, futuresUsdt: 0, futuresUsdc: 0 });
  const [exchangeBalances, setExchangeBalances] = useState<any[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(false);
  // Posições futuras REAIS da corretora (entry/mark/PnL) vindas do /api/portfolio/live,
  // usadas no card de posição aberta para refletir a MEXC (em vez dos preços gravados do trade).
  const [livePositions, setLivePositions] = useState<any[]>([]);
  const [liveSpotCoins, setLiveSpotCoins] = useState<any[]>([]);

  // ── Terminal Logs State ──
  const [selectedBot, setSelectedBot] = useState<'scanner' | 'funding-arb'>('funding-arb');
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [autoRefreshLogs, setAutoRefreshLogs] = useState(true);
  const [logLines, setLogLines] = useState(150);
  const [lastUpdateLogs, setLastUpdateLogs] = useState<string | null>(null);
  const [errorLogs, setErrorLogs] = useState<string | null>(null);
  const terminalContainerRef = React.useRef<HTMLDivElement | null>(null);

  const [changingBot, setChangingBot] = useState(false);

  const fetchLogs = async (isBotChange = false) => {
    if (loadingLogs) return;
    setLoadingLogs(true);
    if (isBotChange) {
      setChangingBot(true);
    }
    setErrorLogs(null);
    try {
      const res = await fetch(`/api/perp-arb/logs?process=${selectedBot}&lines=${logLines}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`Erro na API de Logs (${res.status})`);
      const data = await res.json();
      const cleanLogs = (data.logs || []).map((line: string) => line.replace(/\x1B\[[0-9;]*[mK]/g, ''));
      setTerminalLogs(cleanLogs);
      setLastUpdateLogs(new Date().toLocaleTimeString());
    } catch (err: any) {
      setErrorLogs(err.message || 'Falha ao buscar logs');
    } finally {
      setLoadingLogs(false);
      setChangingBot(false);
    }
  };

  useEffect(() => {
    fetchLogs(true);
  }, [selectedBot, logLines]);

  useEffect(() => {
    if (!autoRefreshLogs) return;
    const interval = setInterval(fetchLogs, 7000);
    return () => clearInterval(interval);
  }, [autoRefreshLogs, selectedBot, logLines]);

  useEffect(() => {
    if (terminalContainerRef.current && autoRefreshLogs) {
      terminalContainerRef.current.scrollTop = terminalContainerRef.current.scrollHeight;
    }
  }, [terminalLogs, autoRefreshLogs]);

  // ── Derived stats ──
  const totalPnl = trades.reduce((acc, t) => acc + (t.pnl ?? 0), 0);
  const executedCount = trades.filter((t) => t.type === 'close_hedge' && (t.status === 'executed' || t.status === 'simulated' || t.status === 'voided')).length;

  const openPositions = useMemo(() => {
    const map = new Map<string, any>();

    for (const s of strategies) {
      if (s.positionOpen) {
        map.set(String(s._id), { ...s, isDeletedStrategy: false });
      }
    }

    const openHedgeTrades = trades.filter((t) =>
      t.type === 'open_hedge' && (t.status === 'executed' || t.status === 'simulated')
    );

    for (const openTrade of openHedgeTrades) {
      const sId = typeof openTrade.strategyId === 'object' && openTrade.strategyId !== null
        ? String((openTrade.strategyId as any)._id)
        : String(openTrade.strategyId || '');

      const symbolKey = openTrade.perpSymbol || (openTrade.strategyId as any)?.perpSymbol || '';

      const hasCloseTrade = trades.some((t) => {
        if (t.type !== 'close_hedge' || (t.status !== 'executed' && t.status !== 'simulated' && t.status !== 'voided')) return false;
        const closeStratId = typeof t.strategyId === 'object' && t.strategyId !== null
          ? String((t.strategyId as any)._id)
          : String(t.strategyId || '');
        const closeSymbol = t.perpSymbol || (t.strategyId as any)?.perpSymbol || '';

        const sameStrategy = sId && closeStratId && sId === closeStratId;
        const sameSymbol = symbolKey && closeSymbol && symbolKey === closeSymbol;

        return (sameStrategy || sameSymbol) && new Date(t.createdAt).getTime() >= new Date(openTrade.createdAt).getTime();
      });

      if (!hasCloseTrade) {
        const key = (sId && map.has(sId)) ? sId : (symbolKey || String(openTrade._id));
        if (!map.has(key)) {
          const stratObj = typeof openTrade.strategyId === 'object' && openTrade.strategyId !== null ? openTrade.strategyId : {};
          const pSym = openTrade.perpSymbol || (stratObj as any)?.perpSymbol || 'N/A';
          const sSym = openTrade.spotSymbol || (stratObj as any)?.spotSymbol || 'N/A';
          const name = openTrade.strategyName || (stratObj as any)?.name || `${pSym}`;
          const matchingStrat = strategies.find(st => String(st._id) === sId || st.perpSymbol === pSym);

          map.set(key, {
            _id: sId || String(openTrade._id),
            name,
            perpSymbol: pSym,
            spotSymbol: sSym,
            positionOpen: true,
            positionSize: matchingStrat?.positionSize || openTrade.amount,
            positionOpenedAt: openTrade.createdAt,
            lastSpotPrice: openTrade.spotPrice,
            lastPerpPrice: openTrade.perpPrice,
            fundingAtOpen: openTrade.fundingPct,
            currentFundingRate: matchingStrat?.currentFundingRate ?? openTrade.fundingPct,
            isDeletedStrategy: !strategies.some(s => String(s._id) === sId),
            openTradeObj: openTrade,
          });
        }
      }
    }

    return Array.from(map.values());
  }, [strategies, trades]);

  const marriedTrades = useMemo(() => trades.filter((t) => t.type === 'close_hedge' && (t.status === 'executed' || t.status === 'simulated')), [trades]);

  const closedStats = useMemo(() => {
    if (!marriedTrades.length) {
      return { totalEntryVolume: 0, totalExitVolume: 0, globalClosedApr: null };
    }

    let totalEntry = 0;
    let totalPnlSum = 0;
    let earliestTime = Date.now();

    for (const trade of marriedTrades) {
      const amt = Number(trade.amount || 0);
      const pnl = Number(trade.pnl || 0);
      totalEntry += amt;
      totalPnlSum += pnl;

      const closeStratId = typeof trade.strategyId === 'object' && trade.strategyId !== null ? String((trade.strategyId as any)._id) : String(trade.strategyId || '');
      const openTrade = trades.find((t) => {
        if (t.type !== 'open_hedge' || (t.status !== 'executed' && t.status !== 'simulated')) return false;
        const sId = typeof t.strategyId === 'object' && t.strategyId !== null ? String((t.strategyId as any)._id) : String(t.strategyId || '');
        const matchStrat = closeStratId && sId && closeStratId === sId;
        const matchSymbol = t.perpSymbol && trade.perpSymbol && t.perpSymbol === trade.perpSymbol;
        return (matchStrat || matchSymbol) && new Date(t.createdAt).getTime() <= new Date(trade.createdAt).getTime();
      });

      const openDate = trade.openedAt || openTrade?.createdAt || trade.createdAt;
      const tTime = new Date(openDate).getTime();
      if (tTime > 0 && tTime < earliestTime) {
        earliestTime = tTime;
      }
    }

    const totalExit = totalEntry + totalPnlSum;
    const elapsedMs = Date.now() - earliestTime;
    const elapsedHours = elapsedMs > 0 ? elapsedMs / (1000 * 60 * 60) : 0;

    let apr: number | null = null;
    if (totalEntry > 0 && elapsedHours >= 0.01) {
      apr = (totalPnlSum / totalEntry) * (8760 / elapsedHours) * 100;
    }

    return {
      totalEntryVolume: totalEntry,
      totalExitVolume: totalExit,
      globalClosedApr: apr,
    };
  }, [marriedTrades, trades]);

  // ── Fetchers ───────────────────────────────────────────────────────────────
  const fetchStrategies = async () => {
    setLoadingStrategies(true);
    try {
      const res = await fetch('/api/perp-arb/strategies', { headers: authHeaders() });
      if (!res.ok) throw new Error('Erro ao buscar estratégias');
      setStrategies(await res.json());
      setError(null);
    } catch (err: any) { setError(err.message); }
    finally { setLoadingStrategies(false); }
  };

  const fetchTrades = async () => {
    setLoadingTrades(true);
    try {
      const res = await fetch('/api/perp-arb/trades', { headers: authHeaders() });
      if (!res.ok) throw new Error('Erro ao buscar trades');
      setTrades(await res.json());
      setError(null);
    } catch (err: any) { setError(err.message); }
    finally { setLoadingTrades(false); }
  };

  const fetchExchanges = async () => {
    try {
      const res = await fetch('/api/exchanges', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setExchangeKeys(data.exchanges || []);
      }
    } catch { /* silent */ }
  };

  const fetchBotStatus = async () => {
    try {
      const res = await fetch('/api/bot-status?botName=funding-arb', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setBotOnline(data.isOnline);
        return data.isOnline;
      }
    } catch {}
    setBotOnline(false);
  };

  const fetchBalances = async () => {
    setLoadingBalances(true);
    try {
      const res = await fetch('/api/perp-arb/balances', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setBalances({
          spotUsdt: Number(data.spotUsdt || 0),
          spotUsdc: Number(data.spotUsdc || 0),
          futuresUsdt: Number(data.futuresUsdt || 0),
          futuresUsdc: Number(data.futuresUsdc || 0),
        });
        setExchangeBalances(Array.isArray(data.exchanges) ? data.exchanges : []);
      }
    } catch { /* silent */ }
    finally { setLoadingBalances(false); }
  };

  const fetchLivePositions = async () => {
    try {
      const res = await fetch('/api/portfolio/live', { headers: authHeaders(), cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.positions) && data.positions.length > 0) setLivePositions(data.positions);
        if (Array.isArray(data.spotCoins) && data.spotCoins.length > 0) setLiveSpotCoins(data.spotCoins);
      }
    } catch { /* silent */ }
  };

  const fetchSettings = async () => {
    setLoadingSettings(true);
    try {
      const res = await fetch('/api/perp-arb-settings', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        await fetchBotStatus();
        setSettings(data);
      }
    } catch { /* silent */ }
    finally { setLoadingSettings(false); }
  };

  const updateSettings = async (updates: any) => {
    try {
      const res = await fetch('/api/perp-arb-settings', {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(updates),
      });
      if (res.ok) {
        setSettings(await res.json());
      }
    } catch (err: any) { setError(err.message); }
  };

  const updateStrategy = async (strategy: Partial<PerpArbStrategy> & { _id: string }) => {
    try {
      const res = await fetch('/api/perp-arb/strategies', {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify(strategy),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Falha ao atualizar'); }
      await fetchStrategies();
    } catch (err: any) { setError(err.message); }
  };

  const deleteStrategy = async (id: string) => {
    try {
      const res = await fetch(`/api/perp-arb/strategies?id=${id}`, {
        method: 'DELETE', headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Falha ao excluir');
      await fetchStrategies();
    } catch (err: any) { setError(err.message); }
  };

  const closePosition = async (strategyId: string, perpSymbol?: string, name?: string) => {
    const idKey = String(strategyId || '');
    const symKey = String(perpSymbol || '');

    setClosingSet((prev) => {
      const next = new Set(prev);
      if (idKey) next.add(idKey);
      if (symKey) next.add(symKey);
      return next;
    });

    setError(null);
    setSuccessMsg(`🚀 Encerrando posição de ${name || perpSymbol || 'mercado'}... O robô está enviando as ordens de venda Spot e recompra Perpétuo na MEXC.`);
    try {
      const res = await fetch('/api/perp-arb/close', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ strategyId, perpSymbol }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao encerrar posição');
      setSuccessMsg(`✅ Encerramento enviado com sucesso para ${name || perpSymbol || 'mercado'}! Acompanhe nos logs do terminal.`);
      setTimeout(() => setSuccessMsg(null), 6000);
      await fetchStrategies();
      await fetchTrades();
    } catch (err: any) {
      setSuccessMsg(null);
      setError(err.message);
      setClosingSet((prev) => {
        const next = new Set(prev);
        if (idKey) next.delete(idKey);
        if (symKey) next.delete(symKey);
        return next;
      });
    }

    // Trava de segurança: remove da lista em no máximo 20 segundos
    setTimeout(() => {
      setClosingSet((prev) => {
        const next = new Set(prev);
        if (idKey) next.delete(idKey);
        if (symKey) next.delete(symKey);
        return next;
      });
    }, 20000);
  };

  const handleConfirmIncreasePosition = async (s: any, amount: number) => {
    try {
      const res = await fetch('/api/perp-arb/increase', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ strategyId: s._id, amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao aumentar aporte');
      setSuccessMsg(`✅ Aporte para "${s.name}" aumentado em +$${amount.toFixed(2)} USDT (Novo total: $${data.newPositionSize?.toFixed(2)} USDT).`);
      setTimeout(() => setSuccessMsg(null), 6000);
      await fetchStrategies();
      await fetchTrades();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const handleClosePosition = (s: any) => {
    setConfirmState({
      message: `Encerrar a posição de "${s.name}" agora? O robô irá fechar o Spot (Venda) e Perpétuo (Recompra Short) a mercado na MEXC.`,
      onConfirm: () => { closePosition(s._id, s.perpSymbol, s.name); setConfirmState(null); },
    });
  };

  const handleVoidClose = (s: any) => {
    setConfirmState({
      message: `Marcar "${s.name}" como encerrada pela corretora? Nenhuma ordem será enviada e o PnL será registrado como zero. Use apenas quando a corretora já liquidou/encerrou a posição.`,
      onConfirm: async () => {
        setConfirmState(null);
        const idKey = String(s._id || '');
        setClosingSet((prev) => { const n = new Set(prev); n.add(idKey); return n; });
        try {
          const res = await fetch('/api/perp-arb/void-close', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ strategyId: s._id, perpSymbol: s.perpSymbol }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Falha ao marcar posição');
          setSuccessMsg(`✅ Posição "${s.name}" marcada como encerrada pela corretora (PnL = $0.00).`);
          setTimeout(() => setSuccessMsg(null), 6000);
          await fetchStrategies();
          await fetchTrades();
        } catch (err: any) {
          setError(err.message);
        } finally {
          setClosingSet((prev) => { const n = new Set(prev); n.delete(idKey); return n; });
        }
      },
    });
  };

        const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    let isPolling = false;

    const refresh = async () => {
      if (isPolling) return; // guard anti-reentrância
      isPolling = true;
      try {
        await Promise.allSettled([
          fetchStrategies(),
          fetchTrades(),
          fetchSettings(),
          fetchLivePositions(),
        ]);
      } finally {
        isPolling = false;
        setInitialLoading(false);
      }
    };

    fetchExchanges();
    fetchBalances();
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateWithConfirm = (strategy: Partial<PerpArbStrategy> & { _id: string }, original: PerpArbStrategy) => {
    if (strategy.autoExecute === true && !original.autoExecute) {
      setConfirmState({
        message: `Ativar execução automática para "${original.name}"? Ordens reais serão enviadas quando o funding rate superar ${original.minFundingRatePct}%.`,
        onConfirm: () => { updateStrategy(strategy); setConfirmState(null); },
      });
    } else {
      updateStrategy(strategy);
    }
  };

  const handleDelete = (s: PerpArbStrategy) => {
    setConfirmState({
      message: `Deletar a estratégia "${s.name}"? Esta ação não pode ser desfeita.`,
      onConfirm: () => { deleteStrategy(s._id); setConfirmState(null); },
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Modals */}
      {confirmState && <ConfirmModal message={confirmState.message} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(null)} />}
      {showForm && (
        <StrategyFormModal
          mode={showForm.mode}
          initial={showForm.strategy}
          exchangeKeys={exchangeKeys}
          authHeaders={authHeaders}
          onClose={() => setShowForm(null)}
          onSaved={() => { fetchStrategies(); fetchTrades(); }}
        />
      )}
      {showManualScan && (
        <ManualScanModal
          exchangeKeys={exchangeKeys}
          authHeaders={authHeaders}
          onClose={() => setShowManualScan(false)}
          onCreateStrategy={(data) => {
            setShowManualScan(false);
            setShowForm({ mode: 'create', strategy: data });
          }}
        />
      )}
      {showIncreaseModal && (
        <IncreasePositionModal
          strategy={showIncreaseModal}
          onClose={() => setShowIncreaseModal(null)}
          onConfirmIncrease={handleConfirmIncreasePosition}
        />
      )}

      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-white">Arbitragem de Taxa de Funding</h1>
            {initialLoading ? (
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700 animate-pulse">
                <span className="h-2 w-2 rounded-full bg-slate-400 animate-ping" />
                VERIFICANDO...
              </span>
            ) : (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                botOnline 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.3)]' 
                  : 'bg-red-500/20 text-red-300 border border-red-500/40'
              }`}>
                <span className={`h-2 w-2 rounded-full ${botOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                {botOnline ? 'BOT OPERANTE' : 'BOT OFFLINE'}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Estratégia delta-neutra: Long no Spot + Short no Perpétuo para receber taxas de funding com risco zero de mercado.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Botão de Colheita Automática */}
          <button
            disabled={initialLoading || loadingSettings}
            onClick={() => {
              const newStatus = !settings?.isScanningEnabled;
              updateSettings({ isScanningEnabled: newStatus });
              setSuccessMsg(newStatus ? '🌾 Colheita Automática INICIADA! O robô agora está escaneando o mercado em busca de oportunidades de funding.' : '🛑 Colheita Automática PAUSADA.');
              setTimeout(() => setSuccessMsg(null), 5000);
            }}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-all shadow-lg ${
              initialLoading || loadingSettings
                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                : settings?.isScanningEnabled
                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 border border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.4)] hover:scale-105'
                : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)] hover:scale-105'
            }`}
          >
            {initialLoading || loadingSettings ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Carregando...
              </>
            ) : settings?.isScanningEnabled ? (
              <>
                <span className="h-2 w-2 rounded-full bg-slate-950 animate-ping" />
                🛑 Parar Colheita (Ativa)
              </>
            ) : (
              <>
                🌾 Iniciar Colheita
              </>
            )}
          </button>
          {/* TODO: reativar quando implementado
          <button
            onClick={() => setShowManualScan(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-950/40 px-4 py-2 text-xs font-bold text-indigo-300 hover:bg-indigo-900/60 hover:text-white transition-all shadow-lg"
          >
            <Search className="h-4 w-4" /> Busca Manual Cross-Exchange
          </button>
          */}
          {/* TODO: reativar quando implementado
          <button
            onClick={() => { fetchStrategies(); fetchTrades(); fetchSettings(); fetchBalances(); fetchLivePositions(); }}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors shadow-lg"
          >
            <RefreshCw className="h-4 w-4" /> Atualizar
          </button>
          */}
          {/* TODO: reativar quando implementado
          <button
            onClick={() => setShowForm({ mode: 'create' })}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition-colors shadow-lg"
          >
            <Plus className="h-4 w-4" /> Nova Estratégia
          </button>
          */}
        </div>
      </div>

      {/* Global Notifications */}
      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-950/40 p-4 text-sm text-red-200 shadow-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-300 underline font-semibold text-xs">Fechar</button>
        </div>
      )}
      {successMsg && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-4 text-sm text-emerald-200 shadow-lg flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-300 underline font-semibold text-xs">Fechar</button>
        </div>
      )}

      {/* Card da IA Copilot */}
      <AiAdvisorCard />

      {/* Stats Cards */}
      <StatsHeader
        openCount={openPositions.length}
        totalMonitored={strategies.length}
        executedCount={executedCount}
        totalPnl={totalPnl}
        spotUsdt={balances.spotUsdt}
        spotUsdc={balances.spotUsdc}
        futuresUsdt={balances.futuresUsdt}
        futuresUsdc={balances.futuresUsdc}
        exchanges={exchangeBalances}
        loadingBalances={loadingBalances}
        globalClosedApr={closedStats.globalClosedApr}
        totalEntryVolume={closedStats.totalEntryVolume}
        totalExitVolume={closedStats.totalExitVolume}
      />

      {/* Global Robot Settings Bar */}
      <SettingsModal
        settings={settings}
        isEditingSettings={isEditingSettings}
        settingsForm={settingsForm}
        exchangeKeys={exchangeKeys}
        onStartEditing={() => { setSettingsForm({ ...settings }); setIsEditingSettings(true); }}
        onCancelEditing={() => setIsEditingSettings(false)}
        onSaveSettings={(form) => { updateSettings(form); setIsEditingSettings(false); }}
        onUpdateSettingsForm={setSettingsForm}
      />

      {/* Main Container: Operations in Open vs Executed History */}
      <div className="rounded-xl border border-white/10 bg-slate-950/70 p-5">
        <div className="mb-4 flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-white">Operações Realizadas e em Aberto</h2>
          <p className="text-sm text-gray-400">Operações casadas (Spot LONG + Perp SHORT) ativas e histórico de execuções.</p>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-4 flex gap-2 border-b border-white/10 pb-3">
          <button
            onClick={() => setOpTab('open')}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
              opTab === 'open'
                ? 'bg-emerald-600 text-white shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Em Aberto ({openPositions.length})
          </button>
          <button
            onClick={() => setOpTab('executed')}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
              opTab === 'executed'
                ? 'bg-indigo-600 text-white shadow-[0_0_10px_rgba(79,70,229,0.4)]'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Histórico Encerradas ({marriedTrades.length})
          </button>
        </div>

        {/* Tab 1: Open Positions */}
        {opTab === 'open' && (
          <div className="grid gap-4 md:grid-cols-2">
            {openPositions.length === 0 ? (
              <div className="col-span-full rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-500">
                Nenhuma operação casada em aberto no momento. O robô irá abrir ordens automaticamente quando o funding for favorável.
              </div>
            ) : (
                            openPositions.map((s) => (
                <OpenPositionCard
                  key={s._id}
                  strategy={s}
                  trades={trades}
                  livePositions={livePositions}
                  liveSpotCoins={liveSpotCoins}
                  isClosingThis={closingSet.has(String(s._id)) || (s.perpSymbol ? closingSet.has(String(s.perpSymbol)) : false)}
                  onClosePosition={handleClosePosition}
                  onVoidClose={handleVoidClose}
                  onIncreasePosition={(strat) => setShowIncreaseModal(strat)}
                />
              ))
            )}
          </div>
        )}

        {/* Tab 2: Closed History */}
        {opTab === 'executed' && (
          <div className="grid gap-4 md:grid-cols-2">
            {marriedTrades.length === 0 ? (
              <div className="col-span-full rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-500">
                Nenhuma operação encerrada no histórico ainda.
              </div>
            ) : (
              marriedTrades.map((trade) => (
                <ClosedTradeCard key={trade._id} trade={trade} allTrades={trades} />
              ))
            )}
          </div>
        )}
      </div>

      {/* Terminal Logs Component */}
      <div className="rounded-xl border border-white/10 bg-slate-950/70 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Terminal className="h-5 w-5 text-indigo-400" /> Logs do Robô de Arbitragem (Terminal)
            </h2>
            <p className="text-sm text-gray-400">Acompanhe os logs dos processos Loop Scanner e Funding Arb em tempo real.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedBot('funding-arb')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                selectedBot === 'funding-arb'
                  ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 shadow-[0_0_10px_rgba(99,102,241,0.2)]'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              Funding Arb
            </button>
            <button
              onClick={() => setSelectedBot('scanner')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                selectedBot === 'scanner'
                  ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 shadow-[0_0_10px_rgba(99,102,241,0.2)]'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              Loop Scanner
            </button>
          </div>
        </div>

        {/* Console Container */}
        <div className="relative bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col h-[450px]">
          {changingBot && (
            <div className="absolute inset-0 z-20 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center gap-3 text-white">
              <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
              <div className="text-center">
                <p className="font-semibold text-sm">Carregando logs...</p>
                <p className="text-xs text-slate-400 mt-1">Conectando ao container do {selectedBot === 'funding-arb' ? 'Funding Arb' : 'Loop Scanner'}...</p>
              </div>
            </div>
          )}
          <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-3">
              <span className="font-mono bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20">
                {selectedBot === 'funding-arb' ? 'Funding Arb' : 'Loop Scanner'}
              </span>
              <button
                onClick={() => setAutoRefreshLogs(!autoRefreshLogs)}
                className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                  autoRefreshLogs
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {autoRefreshLogs ? 'AUTO-REFRESH ON' : 'PAUSADO'}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span>Linhas:</span>
                <select
                  value={logLines}
                  onChange={(e) => setLogLines(Number(e.target.value))}
                  className="bg-slate-850 border border-slate-700 text-slate-300 rounded px-1.5 py-0.5 outline-none"
                >
                  <option value={50}>50</option>
                  <option value={150}>150</option>
                  <option value={300}>300</option>
                  <option value={500}>500</option>
                </select>
              </div>

              <button
                onClick={() => {
                  const blob = new Blob([terminalLogs.join('\n')], { type: 'text/plain;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `logs-${selectedBot}-${new Date().toISOString().slice(0, 10)}.log`;
                  a.click();
                }}
                disabled={terminalLogs.length === 0}
                className="p-1 bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-750 rounded transition disabled:opacity-50"
                title="Baixar arquivo de log"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              {lastUpdateLogs && <span>Atualizado: {lastUpdateLogs}</span>}
            </div>
          </div>

          <div ref={terminalContainerRef} className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-1 bg-black/85 text-slate-300 selection:bg-indigo-500 selection:text-white">
            {errorLogs ? (
              <div className="text-rose-400 p-4 border border-rose-500/20 bg-rose-500/10 rounded-lg">
                ⚠️ {errorLogs}
              </div>
            ) : terminalLogs.length === 0 ? (
              <div className="text-slate-500 italic p-4 text-center">
                {loadingLogs ? 'Buscando logs...' : 'Nenhum log encontrado para este robô.'}
              </div>
            ) : (
              terminalLogs.map((line, i) => {
                const isError = line.includes('ERROR') || line.includes('ERR') || line.includes('FATAL') || line.includes('🚨');
                const isWarn = line.includes('WARN') || line.includes('⚠️') || line.includes('⛔');
                const isSuccess = line.includes('SUCCESS') || line.includes('✅') || line.includes('🟢');

                let textColor = 'text-slate-300';
                if (isError) textColor = 'text-rose-400 font-semibold';
                else if (isWarn) textColor = 'text-amber-300';
                else if (isSuccess) textColor = 'text-emerald-400';

                return (
                  <div key={i} className={`whitespace-pre-wrap break-all hover:bg-slate-900/50 px-1 py-0.5 rounded ${textColor}`}>
                    <span className="text-slate-600 select-none mr-3">{String(i + 1).padStart(3, ' ')}</span>
                    {line}
                  </div>
                );
              })
            )}
            {/* end log anchor */}
          </div>
        </div>
      </div>

      {/* Strategies Grid */}
      <div className="rounded-xl border border-white/10 bg-slate-950/70 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Estratégias</h2>
            <p className="text-sm text-gray-400">Gerencie limites, parâmetros e proteções por par.</p>
          </div>
          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-gray-300">
            {strategies.length} estratégias
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {loadingStrategies && strategies.length === 0 && <div className="text-sm text-gray-400 col-span-full">Carregando...</div>}
          {!loadingStrategies && strategies.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-500">
              Nenhuma estratégia.{/* TODO: reativar quando implementado
              <button onClick={() => setShowForm({ mode: 'create' })} className="text-indigo-400 underline hover:text-indigo-300">Criar agora</button>
              */}
            </div>
          )}
          {strategies.map((s) => (
            <StrategyCard
              key={s._id}
              strategy={s}
              onUpdate={(upd) => handleUpdateWithConfirm(upd, s)}
              onDelete={handleDelete}
              onEdit={(strat) => setShowForm({ mode: 'edit', strategy: strat })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
