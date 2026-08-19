'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, ShieldCheck, RefreshCw, Copy, ExternalLink, Play, Pause, Settings, Layers, Terminal, Download, Server } from 'lucide-react';

interface Candidate {
  _id: string;
  network: string;
  user: string;
  healthFactor: number;
  totalCollateralUSD: number;
  totalDebtUSD: number;
  updatedAt: string;
}

interface LiquidationStrategy {
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
}

const NETWORKS = [
  { id: 'all', name: 'Todas as Redes' },
  { id: 'arbitrum', name: 'Arbitrum', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  { id: 'polygon', name: 'Polygon', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  { id: 'base', name: 'Base', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  { id: 'optimism', name: 'Optimism', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  { id: 'avalanche', name: 'Avalanche', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
];

const LOG_BOTS = [
  { id: 'liq-arbitrum', name: 'Liquidação Arbitrum', server: 'Hetzner (178.104.51.125)' },
  { id: 'liq-polygon', name: 'Liquidação Polygon', server: 'Hetzner (178.104.51.125)' },
  { id: 'liq-base', name: 'Liquidação Base', server: 'Hetzner (178.104.51.125)' },
  { id: 'liq-optimism', name: 'Liquidação Optimism', server: 'Hetzner (178.104.51.125)' },
  { id: 'liq-avalanche', name: 'Liquidação Avalanche', server: 'Hetzner (178.104.51.125)' },
];

export default function LiquidationPage() {
  const [activeTab, setActiveTab] = useState<'monitor' | 'logs' | 'strategies'>('monitor');
  
  // Candidates State
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Strategies State
  const [strategies, setStrategies] = useState<LiquidationStrategy[]>([]);
  const [loadingStrategies, setLoadingStrategies] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Terminal Logs State
  const [selectedBot, setSelectedBot] = useState('liq-arbitrum');
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [changingBot, setChangingBot] = useState(false);
  const [autoRefreshLogs, setAutoRefreshLogs] = useState(true);
  const [logLines, setLogLines] = useState(150);
  const [lastUpdateLogs, setLastUpdateLogs] = useState<string | null>(null);
  const [errorLogs, setErrorLogs] = useState<string | null>(null);

  const terminalContainerRef = useRef<HTMLDivElement | null>(null);

  const fetchCandidates = async () => {
    setLoadingCandidates(true);
    try {
      const token = localStorage.getItem('token');
      const networkParam = selectedNetwork !== 'all' ? `?network=${selectedNetwork}` : '';
      const res = await fetch(`/api/liquidation/candidates${networkParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setCandidates(await res.json());
      }
    } catch (err) {
      console.error('Erro ao buscar candidatos:', err);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const fetchStrategies = async () => {
    setLoadingStrategies(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/liquidation', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setStrategies(await res.json());
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'Falha ao buscar estratégias');
    } finally {
      setLoadingStrategies(false);
    }
  };

  const fetchLogs = async (isBotChange = false) => {
    if (loadingLogs) return;
    setLoadingLogs(true);
    if (isBotChange) {
      setChangingBot(true);
    }
    setErrorLogs(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/perp-arb/logs?process=${selectedBot}&lines=${logLines}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(`Erro na API de Logs (${res.status})`);
      }

      const data = await res.json();
      const cleanLogs = (data.logs || []).map((line: string) => 
        line.replace(/\x1B\[[0-9;]*[mK]/g, '')
      );
      setTerminalLogs(cleanLogs);
      setLastUpdateLogs(new Date().toLocaleTimeString());
    } catch (err: any) {
      setErrorLogs(err.message || 'Falha ao buscar logs do servidor');
    } finally {
      setLoadingLogs(false);
      setChangingBot(false);
    }
  };

  const toggleExecution = async (id: string, current: boolean) => {
    setToggling(id);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/liquidation/${id}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ executionEnabled: !current })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data?.error || `Falha ao atualizar (status ${res.status})`);
      } else {
        setStrategies(prev => prev.map(s => s._id === id ? { ...s, executionEnabled: !current, lastStatusMessage: !current ? 'enabled' : 'disabled' } : s));
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message || 'Erro de conexão');
    } finally {
      setToggling(null);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, [selectedNetwork]);

  useEffect(() => {
    fetchStrategies();
  }, []);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs(true);
    }
  }, [selectedBot, logLines, activeTab]);

  useEffect(() => {
    if (!autoRefreshLogs || activeTab !== 'logs') return;
    const interval = setInterval(() => {
      fetchLogs(false);
    }, 7000);
    return () => clearInterval(interval);
  }, [autoRefreshLogs, selectedBot, logLines, loadingLogs, activeTab]);

  useEffect(() => {
    if (terminalContainerRef.current && autoRefreshLogs) {
      terminalContainerRef.current.scrollTop = terminalContainerRef.current.scrollHeight;
    }
  }, [terminalLogs, autoRefreshLogs]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadLogs = () => {
    const blob = new Blob([terminalLogs.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${selectedBot}-${new Date().toISOString().slice(0, 10)}.log`;
    a.click();
  };

  const stats = React.useMemo(() => {
    const total = candidates.length;
    const underOne = candidates.filter(c => c.healthFactor < 1.0).length;
    const totalCollateral = candidates.reduce((acc, c) => acc + c.totalCollateralUSD, 0);
    const totalDebt = candidates.reduce((acc, c) => acc + c.totalDebtUSD, 0);
    const lowestHF = total > 0 ? Math.min(...candidates.map(c => c.healthFactor)) : 0;

    return { total, underOne, totalCollateral, totalDebt, lowestHF };
  }, [candidates]);

  const getExplorerLink = (network: string, address: string) => {
    switch (network) {
      case 'arbitrum': return `https://arbiscan.io/address/${address}`;
      case 'polygon': return `https://polygonscan.com/address/${address}`;
      case 'base': return `https://basescan.org/address/${address}`;
      case 'optimism': return `https://optimistic.etherscan.io/address/${address}`;
      case 'avalanche': return `https://snowtrace.io/address/${address}`;
      default: return '#';
    }
  };

  const activeStrategiesCount = strategies.filter(s => s.executionEnabled).length;
  const activeBot = LOG_BOTS.find((b) => b.id === selectedBot);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto text-slate-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <ShieldAlert className="w-7 h-7 text-amber-500 animate-pulse" />
            Liquidações Aave V3 (Multi-chain) - (EM DESENVOLVIMENTO)
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Gerencie robôs de liquidação, monitore posições devedoras críticas e acompanhe os logs em tempo real.
          </p>
        </div>

        <button
          onClick={activeTab === 'monitor' ? fetchCandidates : activeTab === 'strategies' ? fetchStrategies : () => fetchLogs(false)}
          disabled={loadingCandidates || loadingStrategies || loadingLogs}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${(loadingCandidates || loadingStrategies || loadingLogs) ? 'animate-spin' : ''}`} />
          Atualizar Dados
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Devedores em Cache</div>
          <div className="text-2xl font-bold text-white mt-2 flex items-baseline gap-2">
            {stats.total}
            <span className="text-xs font-normal text-slate-500">varrendo</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Liquidáveis (HF &lt; 1.0)</div>
          <div className="text-2xl font-bold text-rose-500 mt-2 flex items-baseline gap-2">
            {stats.underOne}
            {stats.underOne > 0 && <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping inline-block" />}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Menor Health Factor</div>
          <div className={`text-2xl font-bold mt-2 ${stats.lowestHF < 1.0 ? 'text-rose-500' : 'text-amber-400'}`}>
            {stats.lowestHF > 0 ? stats.lowestHF.toFixed(4) : 'N/A'}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Robôs em Execução</div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">
            {activeStrategiesCount} / {strategies.length}
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveTab('monitor')}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'monitor'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          Monitor de Devedores
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'logs'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Terminal className="w-4 h-4" />
          Logs em Tempo Real
        </button>
        <button
          onClick={() => setActiveTab('strategies')}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'strategies'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Settings className="w-4 h-4" />
          Configurações de Robôs
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'monitor' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {NETWORKS.map((net) => {
              const isSelected = selectedNetwork === net.id;
              return (
                <button
                  key={net.id}
                  onClick={() => setSelectedNetwork(net.id)}
                  className={`px-4 py-1.5 rounded-xl border text-sm font-semibold transition ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/10'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {net.name}
                </button>
              );
            })}
          </div>

          {/* Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-xs font-semibold uppercase text-slate-400">
                    <th className="px-6 py-4">Rede</th>
                    <th className="px-6 py-4">Devedor</th>
                    <th className="px-6 py-4">Health Factor</th>
                    <th className="px-6 py-4 text-right">Colateral USD</th>
                    <th className="px-6 py-4 text-right">Dívida USD</th>
                    <th className="px-6 py-4 text-center">Última Variação</th>
                    <th className="px-6 py-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm text-slate-300">
                  {loadingCandidates ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500 italic">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                        Buscando candidatos ativos no banco de dados...
                      </td>
                    </tr>
                  ) : candidates.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500 italic">
                        Nenhuma posição devedora (HF &lt; 1.5) monitorada atualmente nesta rede.
                      </td>
                    </tr>
                  ) : (
                    candidates.map((c) => {
                      const netObj = NETWORKS.find(n => n.id === c.network);
                      const isRisky = c.healthFactor < 1.0;
                      const isClose = c.healthFactor >= 1.0 && c.healthFactor < 1.1;

                      return (
                        <tr key={c._id} className="hover:bg-slate-800/20 transition">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-full border text-xs font-semibold ${netObj?.color || 'bg-slate-800 text-slate-400'}`}>
                              {c.network.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-200">{c.user.slice(0, 8)}...{c.user.slice(-6)}</span>
                              <button
                                onClick={() => copyToClipboard(c.user, c._id)}
                                className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-slate-300 transition"
                                title="Copiar endereço completo"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              {copiedId === c._id && <span className="text-xs text-emerald-400 font-sans">Copiado!</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {isRisky ? (
                                <ShieldAlert className="w-4 h-4 text-rose-500 animate-pulse" />
                              ) : isClose ? (
                                <ShieldAlert className="w-4 h-4 text-amber-500" />
                              ) : (
                                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                              )}
                              <span className={`font-bold ${isRisky ? 'text-rose-500' : isClose ? 'text-amber-400' : 'text-slate-300'}`}>
                                {c.healthFactor.toFixed(6)}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right whitespace-nowrap font-semibold text-slate-200">
                            ${c.totalCollateralUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4 text-right whitespace-nowrap font-semibold text-indigo-400">
                            ${c.totalDebtUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4 text-center whitespace-nowrap text-xs text-slate-500">
                            {new Date(c.updatedAt).toLocaleTimeString()}
                          </td>
                          <td className="px-6 py-4 text-center whitespace-nowrap">
                            <a
                              href={getExplorerLink(c.network, c.user)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                            >
                              Explorer
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="space-y-6">
          {/* Selectors */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {LOG_BOTS.map((bot) => {
              const isSelected = selectedBot === bot.id;
              return (
                <button
                  key={bot.id}
                  onClick={() => setSelectedBot(bot.id)}
                  className={`p-4 rounded-xl border text-left transition flex flex-col justify-between ${
                    isSelected
                      ? 'bg-indigo-600/10 border-indigo-500 text-white shadow-lg shadow-indigo-500/10'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm">{bot.name}</span>
                    <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Server className="w-3 h-3" />
                    <span>{bot.server.split(' ')[0]}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Console Header & Body */}
          <div className="relative bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[550px]">
            {changingBot && (
              <div className="absolute inset-0 z-20 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center gap-3 text-white">
                <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                <div className="text-center">
                  <p className="font-semibold text-sm">Carregando logs...</p>
                  <p className="text-xs text-slate-400 mt-1">Conectando ao container {activeBot?.name}...</p>
                </div>
              </div>
            )}

            <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-3">
                <span className="font-mono bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20">
                  {activeBot?.name}
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
                  onClick={handleDownloadLogs}
                  disabled={terminalLogs.length === 0}
                  className="p-1 bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-750 rounded transition disabled:opacity-50"
                  title="Baixar arquivo de log"
                >
                  <Download className="w-3.5 h-3.5" />
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
      )}

      {activeTab === 'strategies' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            {errorMsg && (
              <div className="p-4 bg-rose-500/10 border-b border-slate-850 text-rose-400 text-sm">
                ⚠️ Erro: {errorMsg}
              </div>
            )}

            <div className="divide-y divide-slate-800">
              {loadingStrategies ? (
                <div className="p-8 text-center text-slate-500 italic">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                  Buscando estratégias de liquidação no banco de dados...
                </div>
              ) : strategies.length === 0 ? (
                <div className="p-8 text-center text-slate-500 italic">
                  Nenhuma estratégia de liquidação cadastrada no banco de dados.
                </div>
              ) : (
                strategies.map((s) => {
                  const netObj = NETWORKS.find(n => n.id === s.network);
                  return (
                    <div key={s._id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-800/10 transition">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-white text-base">{s.name}</span>
                          <span className={`px-2.5 py-0.5 rounded-full border text-xs font-semibold ${netObj?.color || 'bg-slate-800 text-slate-400'}`}>
                            {s.network.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-xs font-mono text-slate-500 break-all">
                          Contrato Executor: {s.contractAddress || '—'}
                        </div>
                        <div className="text-xs text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                          <span>Bloco Sincronizado: <strong className="text-slate-300">{s.lastScannedBlock || 0}</strong></span>
                          <span>Cache de Devedores: <strong className="text-slate-300">{s.userPositionsCount || 0}</strong></span>
                          {s.lastRunAt && <span>Atualizado: <strong className="text-slate-300">{new Date(s.lastRunAt).toLocaleString()}</strong></span>}
                          <span>Status do Robô: <strong className="text-slate-300">{s.lastStatusMessage || 'idle'}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-start md:self-auto">
                        <a
                          href={getExplorerLink(s.network, s.contractAddress)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition"
                          title="Ver contrato no explorador de blocos"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        
                        <button
                          onClick={() => toggleExecution(s._id, s.executionEnabled)}
                          disabled={toggling === s._id}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50 ${
                            s.executionEnabled 
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25' 
                              : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {toggling === s._id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : s.executionEnabled ? (
                            <><Pause className="w-4 h-4" /> Pausar Robô</>
                          ) : (
                            <><Play className="w-4 h-4" /> Ativar Robô</>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
