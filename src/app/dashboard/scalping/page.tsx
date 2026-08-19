'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Settings, Play, Pause, Pencil } from 'lucide-react';
import clsx from 'clsx';

import { Clock, TrendingUp, TrendingDown, Activity } from 'lucide-react';

type ExchangeKey = {
  _id: string;
  name: string;
  exchangeId: string;
};

type ScalpingTrade = {
  _id: string;
  strategyId: { _id: string, name: string, symbol: string };
  type: 'buy' | 'sell';
  symbol: string;
  entryPrice?: number;
  exitPrice?: number;
  entryTime?: string;
  exitTime?: string;
  amount: number;
  pnl: number;
  status: string;
  errorMessage?: string;
  createdAt: string;
  realPnL?: number;
  currentExitPrice?: number;
};

type ScalpingStrategy = {
  _id: string;
  name: string;
  symbol: string;
  tradeSize: number;
  takeProfitPercentage: number;
  stopLossPercentage: number;
  maxSpreadPercentage: number;
  maxPositionTimeMs: number;
  bufferPercentage: number;
  dailyLossLimit: number;
  postLossCooldownMs: number;
  active: boolean;
  exchangeKeyId?: { _id: string, exchangeId: string, name: string };
  currentTrend?: {
    isUptrend: boolean;
    rsi: number;
    spreadPct: number;
    ema9: number;
    ema21: number;
    vwap?: number;
    atr?: number;
    statusMessage: string;
    lastUpdate: string;
    priceAction?: {
      recentResistance: number;
      distanceToResistancePct: number;
    };
  };
};

export default function ScalpingPage() {
  const [strategies, setStrategies] = useState<ScalpingStrategy[]>([]);
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('SOL/USDT');
  const [tradeSize, setTradeSize] = useState('100');
  const [takeProfitPercentage, setTakeProfitPercentage] = useState('0.08');
  const [stopLossPercentage, setStopLossPercentage] = useState('0.05');
  const [maxSpreadPercentage, setMaxSpreadPercentage] = useState('0.1');
  const [maxPositionTimeMs, setMaxPositionTimeMs] = useState('30000');
  const [bufferPercentage, setBufferPercentage] = useState('0.01');
  const [dailyLossLimit, setDailyLossLimit] = useState('0');
  const [postLossCooldownMs, setPostLossCooldownMs] = useState('300000');

  const [exchangeKeys, setExchangeKeys] = useState<ExchangeKey[]>([]);
  const [selectedExchangeKeyId, setSelectedExchangeKeyId] = useState('');
  const [editingStrategy, setEditingStrategy] = useState<ScalpingStrategy | null>(null);
  
  const [botOnline, setBotOnline] = useState<boolean>(false);
  const [trades, setTrades] = useState<ScalpingTrade[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const fetchTrades = async () => {
    const res = await fetch('/api/scalping/trades', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (res.ok) {
      const data = await res.json();
      setTrades(data);
    }
  };

  const fetchStats = async () => {
    const res = await fetch('/api/scalping/stats', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (res.ok) {
      const data = await res.json();
      setStats(data);
    }
  };

  const fetchStrategies = async () => {
    const res = await fetch('/api/scalping/strategy', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (res.ok) {
      const data = await res.json();
      setStrategies(data);
    }
  };

  const fetchExchanges = async () => {
    const res = await fetch('/api/exchanges', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (res.ok) {
      const data = await res.json();
      setExchangeKeys(data.exchanges || []);
      if (data.exchanges?.length > 0) setSelectedExchangeKeyId(data.exchanges[0]._id);
    }
  };

  useEffect(() => { 
    fetchStrategies(); 
    fetchExchanges();

    const fetchBotStatus = async () => {
      try {
        const res = await fetch('/api/bot-status?botName=scalping-cex', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) {
          const data = await res.json();
          setBotOnline(data.isOnline);
        }
      } catch (e) {
        setBotOnline(false);
      }
    };
    
        fetchBotStatus();
    fetchTrades();
    fetchStats();
    let isPolling = false;

    const refresh = async () => {
      if (isPolling) return; // guard anti-reentrância
      isPolling = true;
      try {
        await Promise.allSettled([
          fetchBotStatus(),
          fetchTrades(),
          fetchStats(),
          fetchStrategies(),
        ]);
      } finally {
        isPolling = false;
      }
    };

    const statusInterval = setInterval(refresh, 20000);
    
    return () => clearInterval(statusInterval);
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExchangeKeyId) {
      alert('Please register and select an Exchange API Key first.');
      return;
    }
    const res = await fetch('/api/scalping/strategy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ 
        name, 
        exchangeKeyId: selectedExchangeKeyId, 
        symbol: symbol.toUpperCase(), 
        tradeSize: Number(tradeSize), 
        takeProfitPercentage: Number(takeProfitPercentage), 
        stopLossPercentage: Number(stopLossPercentage),
        maxSpreadPercentage: Number(maxSpreadPercentage),
        maxPositionTimeMs: Number(maxPositionTimeMs),
        bufferPercentage: Number(bufferPercentage),
        dailyLossLimit: Number(dailyLossLimit),
        postLossCooldownMs: Number(postLossCooldownMs)
      })
    });
    if (res.ok) {
      setName(''); setSymbol('SOL/USDT'); setTradeSize('100'); setTakeProfitPercentage('0.08'); setStopLossPercentage('0.05'); setMaxSpreadPercentage('0.1'); setMaxPositionTimeMs('30000'); setBufferPercentage('0.01'); setDailyLossLimit('0'); setPostLossCooldownMs('300000');
      fetchStrategies();
      setIsFormOpen(false);
    }
  };

  const handleEditSubmit = async () => {
    if (!editingStrategy) return;
    const res = await fetch('/api/scalping/strategy', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ 
        id: editingStrategy._id, 
        name: editingStrategy.name, 
        tradeSize: editingStrategy.tradeSize, 
        takeProfitPercentage: editingStrategy.takeProfitPercentage,
        stopLossPercentage: editingStrategy.stopLossPercentage,
        maxSpreadPercentage: editingStrategy.maxSpreadPercentage,
        maxPositionTimeMs: editingStrategy.maxPositionTimeMs,
        bufferPercentage: editingStrategy.bufferPercentage,
        dailyLossLimit: editingStrategy.dailyLossLimit,
        postLossCooldownMs: editingStrategy.postLossCooldownMs,
        symbol: editingStrategy.symbol.toUpperCase()
      })
    });
    if (res.ok) {
      setEditingStrategy(null);
      fetchStrategies();
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/scalping/strategy?id=${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (res.ok) fetchStrategies();
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    const res = await fetch('/api/scalping/strategy', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ id, active: !currentActive })
    });
    if (res.ok) fetchStrategies();
  };

  const handleDeleteAllTrades = async () => {
    if (!confirm('Are you sure you want to delete all operation logs?')) return;
    const res = await fetch(`/api/scalping/trades`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (res.ok) {
        fetchTrades();
        fetchStats(); // Update stats as well
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-white flex items-center gap-3">
          CEX Scalping Strategies
          {botOnline ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Online
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-red-400"></span>
              Offline
            </span>
          )}
        </h3>
        <button 
          onClick={() => setIsFormOpen(!isFormOpen)} 
          className={clsx(
            "px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2",
            isFormOpen ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-sky-600 text-white hover:bg-sky-700"
          )}
        >
          {isFormOpen ? 'Cancel' : <><Plus className="w-4 h-4" /> New Strategy</>}
        </button>
      </div>

      {/* DASHBOARD DE ESTATÍSTICAS */}
      {stats && (
        <div className="mb-8">
          <h4 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" /> Visão Geral de Performance
          </h4>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
              <p className="text-sm text-slate-400 mb-1">Total de Operações</p>
              <p className="text-2xl font-bold text-white">{stats.totalOperations}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
              <p className="text-sm text-slate-400 mb-1">Sucesso / Falhas</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-emerald-400">{stats.successfulOperations}</p>
                <span className="text-slate-600">/</span>
                <p className="text-xl font-semibold text-red-400">{stats.failedOperations}</p>
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
              <p className="text-sm text-slate-400 mb-1">PnL Líquido Acumulado</p>
              <div className="flex flex-col">
                <p className={clsx("text-2xl font-bold", stats.totalPnlPercentage >= 0 ? "text-emerald-400" : "text-red-400")}>
                  {stats.totalPnlPercentage > 0 ? '+' : ''}{stats.totalPnlPercentage.toFixed(4)}%
                </p>
                {stats.totalUsdPnl !== undefined && (
                  <p className={clsx("text-sm font-semibold", stats.totalUsdPnl >= 0 ? "text-emerald-500/80" : "text-red-500/80")}>
                    {stats.totalUsdPnl > 0 ? '+' : ''}${stats.totalUsdPnl.toFixed(4)}
                  </p>
                )}
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm overflow-y-auto max-h-[88px] custom-scrollbar">
              <p className="text-sm text-slate-400 mb-2">PnL por Símbolo</p>
              <div className="space-y-1">
                {Object.keys(stats.profitBySymbol || {}).length === 0 ? (
                  <p className="text-xs text-slate-500">Sem dados</p>
                ) : (
                  Object.entries(stats.statsBySymbol || {}).map(([sym, data]: [string, any]) => {
                    const winRate = data.totalTrades > 0 ? (data.successfulTrades / data.totalTrades) * 100 : 0;
                    return (
                      <div key={sym} className="flex justify-between items-center text-sm">
                        <div className="flex flex-col">
                          <span className="text-slate-300 font-mono text-xs">{sym}</span>
                          <span className="text-[10px] text-slate-500">Win Rate: {winRate.toFixed(1)}%</span>
                        </div>
                        <span className={clsx("font-semibold text-xs", data.profit >= 0 ? "text-emerald-400" : "text-red-400")}>
                          {data.profit > 0 ? '+' : ''}{data.profit.toFixed(4)}%
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {strategies.length === 0 ? (
          <div className="col-span-full p-8 border border-dashed border-slate-700 rounded-xl text-center text-slate-500">
            Nenhuma estratégia de scalping configurada. Adicione uma abaixo para começar a operar.
          </div>
        ) : strategies.map(strat => {
          const isTrading = trades.some(t => t.strategyId?._id === strat._id && t.status === 'in_position');
          return (
          <div 
            key={strat._id} 
            className={clsx(
              "bg-slate-900 border rounded-xl p-5 shadow-sm transition-all duration-500", 
              strat.active ? (
                isTrading 
                  ? "border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.2)] animate-pulse" 
                  : "border-sky-500/50 shadow-sky-500/10"
              ) : "border-slate-800 hover:border-slate-700"
            )}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="text-lg font-bold text-white flex items-center gap-3">
                  {strat.name}
                  <button 
                    onClick={() => handleToggleActive(strat._id, strat.active)}
                    className={clsx(
                      "flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-colors hover:brightness-125", 
                      strat.active ? "bg-sky-500/20 text-sky-400 border border-sky-500/30" : "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                    )}
                    title={strat.active ? "Pause Strategy" : "Start Strategy"}
                  >
                    {strat.active ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    {strat.active ? 'Running' : 'Paused'}
                  </button>
                </h4>
                <p className="text-xs text-slate-400 font-mono mt-1 flex items-center gap-2">
                  <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[10px] font-bold">PAIR</span>
                  {strat.symbol}
                </p>
                {strat.currentTrend && (
                  <div className="mt-3 flex flex-col md:flex-row w-full gap-3 md:h-[250px]">
                    <div className="w-full md:w-[180px] shrink-0 bg-slate-950 rounded-lg p-2.5 border border-slate-800/60 shadow-inner flex flex-col justify-between h-[200px] md:h-auto">
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-slate-500">EMA9/21</span>
                        <span className={clsx("font-bold", strat.currentTrend.isUptrend ? "text-emerald-400" : "text-red-400")}>
                          {strat.currentTrend.ema9?.toFixed(2)} / {strat.currentTrend.ema21?.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-slate-500">RSI (14)</span>
                        <span className={clsx(
                          "font-bold",
                          strat.currentTrend.rsi >= 70 ? "text-red-400" : "text-emerald-400"
                        )}>
                          {strat.currentTrend.rsi?.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-slate-500">Spread</span>
                        <span className={clsx(
                          "font-bold",
                          (strat.currentTrend.spreadPct >= strat.takeProfitPercentage || strat.currentTrend.spreadPct >= strat.stopLossPercentage || (strat.maxSpreadPercentage !== undefined && strat.currentTrend.spreadPct >= strat.maxSpreadPercentage)) ? "text-red-400" : "text-emerald-400"
                        )}>
                          {strat.currentTrend.spreadPct?.toFixed(3)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-slate-500">VWAP</span>
                        <span className="font-bold text-indigo-400">
                          {strat.currentTrend.vwap ? strat.currentTrend.vwap.toFixed(2) : '--'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-slate-500">ATR</span>
                        <span className="font-bold text-orange-400">
                          {strat.currentTrend.atr ? strat.currentTrend.atr.toFixed(4) : '--'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-slate-500">Price Act.</span>
                        <span className={clsx(
                          "font-bold",
                          strat.currentTrend.priceAction
                            ? (strat.currentTrend.priceAction.distanceToResistancePct > 0 && strat.currentTrend.priceAction.distanceToResistancePct < 0.05
                                ? "text-red-400"
                                : "text-emerald-400")
                            : "text-slate-500"
                        )}>
                          {strat.currentTrend.priceAction ? strat.currentTrend.priceAction.distanceToResistancePct.toFixed(3) + '%' : '--'}
                        </span>
                      </div>
                      <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-center gap-1.5">
                        {strat.currentTrend.isUptrend ? (
                          <TrendingUp className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-red-500" />
                        )}
                        <span className={clsx(
                          "text-[10px] font-bold uppercase tracking-wider",
                          strat.currentTrend.isUptrend && strat.currentTrend.rsi < 70 ? "text-emerald-500" : "text-red-500"
                        )}>
                          {strat.currentTrend.statusMessage}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0 bg-slate-950 rounded-lg border border-slate-800/60 shadow-inner overflow-hidden h-[300px] md:h-full">
                      <iframe 
                        src={`https://s.tradingview.com/widgetembed/?symbol=${strat.exchangeKeyId ? strat.exchangeKeyId.exchangeId.toUpperCase() : 'BINANCE'}%3A${encodeURIComponent(strat.symbol.replace('/', '').replace('USDC', 'USDT'))}&interval=1&theme=dark&style=1&timezone=Etc%2FUTC&hide_top_toolbar=1&hide_legend=1&save_image=0`}
                        className="w-full h-full border-0"
                        scrolling="no" 
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!strat.active && (
                  <button onClick={() => setEditingStrategy(strat)} className="text-slate-600 hover:text-indigo-400 transition-colors p-1 bg-slate-800/50 rounded-md" title="Edit Strategy">
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => handleDelete(strat._id)} className="text-slate-600 hover:text-red-400 transition-colors p-1 bg-slate-800/50 rounded-md">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-4 mt-4">
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                <p className="text-xs text-slate-500 mb-1">Tamanho da Ordem</p>
                <p className="text-sm font-semibold text-emerald-400">${strat.tradeSize.toLocaleString()}</p>
              </div>
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                <p className="text-xs text-slate-500 mb-1">Take Profit</p>
                <p className="text-sm font-semibold text-sky-400">+{strat.takeProfitPercentage}%</p>
              </div>
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                <p className="text-xs text-slate-500 mb-1">Stop Loss</p>
                <p className="text-sm font-semibold text-red-400">-{strat.stopLossPercentage}%</p>
              </div>
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                <p className="text-xs text-slate-500 mb-1">Tempo Máx.</p>
                <p className="text-sm font-semibold text-orange-400">{(strat.maxPositionTimeMs / 1000).toFixed(0)}s</p>
              </div>
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                <p className="text-xs text-slate-500 mb-1">Spread Máx.</p>
                <p className="text-sm font-semibold text-purple-400">{strat.maxSpreadPercentage ?? 0.1}%</p>
              </div>
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                <p className="text-xs text-slate-500 mb-1">Buffer</p>
                <p className="text-sm font-semibold text-indigo-400">{strat.bufferPercentage}%</p>
              </div>
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                <p className="text-xs text-slate-500 mb-1">Limite de Perda Diária</p>
                <p className="text-sm font-semibold text-red-400">{strat.dailyLossLimit > 0 ? `$${strat.dailyLossLimit}` : 'Desativado'}</p>
              </div>
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                <p className="text-xs text-slate-500 mb-1">Cooldown de Perda</p>
                <p className="text-sm font-semibold text-cyan-400">{((strat.postLossCooldownMs || 300000) / 60000).toFixed(0)}min</p>
              </div>
            </div>
          </div>
          )
        })}
      </div>

      {isFormOpen && (
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-sm max-w-2xl">
        <h4 className="text-lg font-medium text-white mb-6 flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-500" /> Configurar Nova Estratégia de Scalping CEX
        </h4>
        <form onSubmit={handleAdd} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Nome da Estratégia</label>
              <input required value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500" placeholder="e.g. MEXC SOL Scalp" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Conexão da Corretora</label>
              <select required value={selectedExchangeKeyId} onChange={e => setSelectedExchangeKeyId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 appearance-none">
                {exchangeKeys.length === 0 ? <option value="">Nenhuma chave de corretora registrada</option> : null}
                {exchangeKeys.map(w => (
                  <option key={w._id} value={w._id}>{w.name} ({w.exchangeId.toUpperCase()})</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Símbolo do Par de Negociação</label>
            <input required type="text" value={symbol} onChange={e => setSymbol(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 font-mono" placeholder="e.g. SOL/USDT" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Tamanho da Ordem</label>
              <input required type="number" value={tradeSize} onChange={e => setTradeSize(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 font-mono" placeholder="100" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Take Profit (%)</label>
              <input required type="number" step="0.01" value={takeProfitPercentage} onChange={e => setTakeProfitPercentage(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 font-mono" placeholder="0.08" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Spread Máx. (%)</label>
              <input required type="number" step="0.01" value={maxSpreadPercentage} onChange={e => setMaxSpreadPercentage(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 font-mono" placeholder="0.1" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Stop Loss (%)</label>
              <input required type="number" step="0.01" value={stopLossPercentage} onChange={e => setStopLossPercentage(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 font-mono" placeholder="0.05" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Tempo Máx. de Posição (ms)</label>
              <input required type="number" step="100" value={maxPositionTimeMs} onChange={e => setMaxPositionTimeMs(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 font-mono" placeholder="30000" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Buffer de Slippage (%)</label>
              <input required type="number" step="0.01" value={bufferPercentage} onChange={e => setBufferPercentage(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 font-mono" placeholder="0.01" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Limite de Perda Diária ($) <span className="text-slate-600">(0 = desativado)</span></label>
              <input type="number" step="1" value={dailyLossLimit} onChange={e => setDailyLossLimit(e.target.value)} className="w-full bg-slate-950 border border-red-900/50 rounded-lg px-4 py-2 text-white outline-none focus:border-red-500 font-mono" placeholder="0" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Cooldown Pós-Perda (ms)</label>
              <input type="number" step="1000" value={postLossCooldownMs} onChange={e => setPostLossCooldownMs(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 font-mono" placeholder="300000" />
            </div>
          </div>

          <button type="submit" className="w-full bg-sky-600 hover:bg-sky-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 mt-4">
            <Plus className="w-5 h-5" /> Implantar Estratégia de Scalping CEX
          </button>
        </form>
      </div>
      )}


      <div className="mt-8 bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-lg font-medium text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-500" /> Operações de Scalping Recentes
          </h4>
          {trades.length > 0 && (
            <button 
              onClick={handleDeleteAllTrades}
              className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors"
              title="Apagar todos os logs de trades"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Limpar Logs
            </button>
          )}
        </div>
        
        {trades.length === 0 ? (
          <div className="p-8 border border-dashed border-slate-700 rounded-xl text-center text-slate-500">
            Nenhuma operação encontrada. Inicie uma estratégia para ver os trades aqui.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-400 uppercase bg-slate-950 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Horário</th>
                  <th className="px-4 py-3">Estratégia</th>
                  <th className="px-4 py-3">Símbolo</th>
                  <th className="px-4 py-3">Tamanho</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Entrada</th>
                  <th className="px-4 py-3 text-right">Saída</th>
                  <th className="px-4 py-3 text-right">PnL</th>
                </tr>
              </thead>
              <tbody>
                {trades.map(trade => {
                  const usdPnl = (trade.exitPrice && trade.entryPrice && trade.amount) ? ((trade.exitPrice - trade.entryPrice) * trade.amount) : 0;
                  return (
                  <tr key={trade._id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1 text-slate-400" title="Intent Created">
                          <Clock className="w-3 h-3 opacity-50" />
                          {new Date(trade.createdAt).toLocaleTimeString()}
                        </div>
                        {trade.entryTime && (
                          <div className="flex items-center gap-1 text-sky-400" title="Entry Executed">
                            <Clock className="w-3 h-3" />
                            {new Date(trade.entryTime).toLocaleTimeString()}
                          </div>
                        )}
                        {trade.exitTime && (
                          <div className="flex items-center gap-1 text-emerald-400" title="Exit Executed">
                            <Clock className="w-3 h-3" />
                            {new Date(trade.exitTime).toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white font-medium">
                      {trade.strategyId?.name || 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">
                      {trade.symbol}
                    </td>
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">
                      {trade.amount}
                    </td>
                    <td className="px-4 py-3">
                      {trade.status === 'success' && <span className="text-emerald-400 text-xs font-bold uppercase bg-emerald-500/10 px-2 py-0.5 rounded">Sucesso</span>}
                      {trade.status === 'failed' && <span className="text-red-400 text-xs font-bold uppercase bg-red-500/10 px-2 py-0.5 rounded" title={trade.errorMessage}>Falhou</span>}
                      {trade.status === 'in_position' && <span className="text-sky-400 text-xs font-bold uppercase bg-sky-500/10 px-2 py-0.5 rounded animate-pulse">Em Posição</span>}
                      {trade.status === 'pending' && <span className="text-slate-400 text-xs font-bold uppercase bg-slate-500/10 px-2 py-0.5 rounded">Pendente</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300 font-mono">
                      {trade.entryPrice ? `$${trade.entryPrice.toFixed(4)}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300 font-mono">
                      {trade.status === 'in_position' && trade.currentExitPrice ? (
                        <span className="text-orange-400">${trade.currentExitPrice.toFixed(4)}</span>
                      ) : trade.exitPrice ? `$${trade.exitPrice.toFixed(4)}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold flex items-center justify-end gap-1">
                      {trade.status === 'in_position' && trade.realPnL !== undefined ? (
                        <>
                          {trade.realPnL >= 0 ? <TrendingUp className="w-3 h-3 text-orange-400" /> : <TrendingDown className="w-3 h-3 text-orange-400" />}
                          <div className="flex flex-col items-end leading-none">
                            <span className="text-orange-400">{trade.realPnL > 0 ? '+' : ''}{trade.realPnL.toFixed(4)}%</span>
                            {trade.currentExitPrice && trade.entryPrice && trade.amount && (
                              <span className="text-[10px] text-orange-500/80 mt-1">
                                {trade.realPnL >= 0 ? '+' : '-'}${Math.abs((trade.currentExitPrice - trade.entryPrice) * trade.amount).toFixed(4)}
                              </span>
                            )}
                          </div>
                        </>
                      ) : trade.pnl > 0 ? (
                        <>
                          <TrendingUp className="w-3 h-3 text-emerald-400" />
                          <div className="flex flex-col items-end leading-none">
                            <span className="text-emerald-400">+{trade.pnl.toFixed(4)}%</span>
                            {usdPnl !== 0 && <span className="text-[10px] text-emerald-500/70 mt-1">+${usdPnl.toFixed(4)}</span>}
                          </div>
                        </>
                      ) : trade.pnl < 0 ? (
                        <>
                          <TrendingDown className="w-3 h-3 text-red-400" />
                          <div className="flex flex-col items-end leading-none">
                            <span className="text-red-400">{trade.pnl.toFixed(4)}%</span>
                            {usdPnl !== 0 && <span className="text-[10px] text-red-500/70 mt-1">-${Math.abs(usdPnl).toFixed(4)}</span>}
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-500">0.00%</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingStrategy && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg w-full max-w-md my-8">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Pencil className="w-5 h-5 text-sky-500" /> Edit Scalping Strategy
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Strategy Name</label>
                <input value={editingStrategy.name} onChange={e => setEditingStrategy({...editingStrategy, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500" />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Trading Pair Symbol</label>
                <input value={editingStrategy.symbol} onChange={e => setEditingStrategy({...editingStrategy, symbol: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Trade Size</label>
                  <input type="number" value={editingStrategy.tradeSize} onChange={e => setEditingStrategy({...editingStrategy, tradeSize: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 font-mono" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Max Position Time (ms)</label>
                  <input type="number" step="100" value={editingStrategy.maxPositionTimeMs} onChange={e => setEditingStrategy({...editingStrategy, maxPositionTimeMs: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 font-mono" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Take Profit (%)</label>
                  <input type="number" step="0.01" value={editingStrategy.takeProfitPercentage} onChange={e => setEditingStrategy({...editingStrategy, takeProfitPercentage: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 font-mono" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Max Spread (%)</label>
                  <input type="number" step="0.01" value={editingStrategy.maxSpreadPercentage ?? 0.1} onChange={e => setEditingStrategy({...editingStrategy, maxSpreadPercentage: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 font-mono" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Stop Loss (%)</label>
                  <input type="number" step="0.01" value={editingStrategy.stopLossPercentage} onChange={e => setEditingStrategy({...editingStrategy, stopLossPercentage: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 font-mono" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-slate-400 mb-1">Slippage Buffer (%)</label>
                  <input type="number" step="0.01" value={editingStrategy.bufferPercentage} onChange={e => setEditingStrategy({...editingStrategy, bufferPercentage: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 font-mono" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Daily Loss Limit ($) <span className="text-slate-600">(0 = off)</span></label>
                  <input type="number" step="1" value={editingStrategy.dailyLossLimit ?? 0} onChange={e => setEditingStrategy({...editingStrategy, dailyLossLimit: Number(e.target.value)})} className="w-full bg-slate-950 border border-red-900/50 rounded-lg px-4 py-2 text-white outline-none focus:border-red-500 font-mono" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Post-Loss Cooldown (ms)</label>
                  <input type="number" step="1000" value={editingStrategy.postLossCooldownMs ?? 300000} onChange={e => setEditingStrategy({...editingStrategy, postLossCooldownMs: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 font-mono" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setEditingStrategy(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg transition-colors">Cancel</button>
                <button onClick={handleEditSubmit} className="flex-1 bg-sky-600 hover:bg-sky-700 text-white py-2 rounded-lg transition-colors font-medium">Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
