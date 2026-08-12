'use client';

import { useState, useEffect, useRef } from 'react';
import { Terminal, RefreshCw, Pause, Play, Download, Server } from 'lucide-react';

interface LogResponse {
  process: string;
  linesCount: number;
  logs: string[];
  timestamp: string;
  error?: string;
}

const BOTS = [
  { id: 'scanner', name: 'Loop Scanner', server: 'Servidor 2 (163.176.2.243)' },
  { id: 'funding-arb', name: 'Funding Arb', server: 'Servidor 2 (163.176.2.243)' },
  { id: 'liq-arbitrum', name: 'Liquidação Arbitrum', server: 'Servidor 1 (147.15.122.245)' },
  { id: 'liq-polygon', name: 'Liquidação Polygon', server: 'Servidor 1 (147.15.122.245)' },
];

export default function RobotLogsPage() {
  const [selectedBot, setSelectedBot] = useState('scanner');
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lines, setLines] = useState(150);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const logsEndRef = useRef<HTMLDivElement | null>(null);

  const fetchLogs = async () => {
    if (loading) return; // Evita empilhar requisições se a anterior ainda estiver respondendo
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/perp-arb/logs?process=${selectedBot}&lines=${lines}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Erro na API (${res.status})`);
      }

      const data: LogResponse = await res.json();
      setLogs(data.logs || []);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao buscar logs do servidor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedBot, lines]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs();
    }, 7000); // 7 segundos de intervalo seguro para conexões SSH/HTTP da Oracle
    return () => clearInterval(interval);
  }, [autoRefresh, selectedBot, lines, loading]);

  useEffect(() => {
    if (logsEndRef.current && autoRefresh) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleDownload = () => {
    const blob = new Blob([logs.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${selectedBot}-${new Date().toISOString().slice(0, 10)}.log`;
    a.click();
  };

  const activeBot = BOTS.find((b) => b.id === selectedBot);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Terminal className="w-7 h-7 text-indigo-400" />
            Logs do Sistema / Robôs
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Visualização de saída em tempo real dos serviços Docker nas instâncias Oracle Cloud.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
              autoRefresh
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
            }`}
          >
            {autoRefresh ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {autoRefresh ? 'Auto-Update ON' : 'Pausado'}
          </button>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>

          <button
            onClick={handleDownload}
            disabled={logs.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-sm font-semibold transition disabled:opacity-50"
            title="Baixar arquivo de log"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {BOTS.map((bot) => {
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
                <span className="font-semibold text-base">{bot.name}</span>
                <span className={`w-2.5 h-2.5 rounded-full ${isSelected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Server className="w-3.5 h-3.5" />
                <span>{bot.server}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Console Display */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[600px]">
        {/* Console Header */}
        <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span className="font-mono bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20">
              {activeBot?.name} ({activeBot?.id})
            </span>
            <span>Servidor: {activeBot?.server}</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span>Linhas:</span>
              <select
                value={lines}
                onChange={(e) => setLines(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 text-slate-200 rounded px-2 py-0.5 text-xs outline-none"
              >
                <option value={50}>50</option>
                <option value={150}>150</option>
                <option value={300}>300</option>
                <option value={500}>500</option>
              </select>
            </div>
            {lastUpdate && <span>Última atualização: {lastUpdate}</span>}
          </div>
        </div>

        {/* Terminal Body */}
        <div className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-1 bg-black/80 text-emerald-400 selection:bg-indigo-500 selection:text-white">
          {errorMsg ? (
            <div className="text-rose-400 p-4 border border-rose-500/20 bg-rose-500/10 rounded-lg">
              ⚠️ {errorMsg}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-slate-500 italic p-4 text-center">
              {loading ? 'Carregando logs...' : 'Nenhum log encontrado para o processo selecionado.'}
            </div>
          ) : (
            logs.map((line, i) => {
              const isError = line.includes('ERROR') || line.includes('ERR') || line.includes('FATAL');
              const isWarn = line.includes('WARN') || line.includes('⚠️');
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
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}
