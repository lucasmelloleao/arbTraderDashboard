'use client';

import React, { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { ExchangeKey } from '../../types';

const AVAILABLE_EXCHANGES = ['binance', 'bybit', 'okx', 'mexc', 'gateio', 'kucoin', 'huobi', 'bitget'];

interface ManualScanModalProps {
  exchangeKeys: ExchangeKey[];
  authHeaders: () => Record<string, string>;
  onClose: () => void;
  onCreateStrategy: (data: any) => void;
}

export function ManualScanModal({
  exchangeKeys,
  authHeaders,
  onClose,
  onCreateStrategy,
}: ManualScanModalProps) {
  const [scanMode, setScanMode] = useState<'same' | 'cross'>('same');
  const [symbol, setSymbol] = useState('');
  const [selectedExchanges, setSelectedExchanges] = useState<string[]>(['mexc']);
  const [spotExchange, setSpotExchange] = useState<string>('mexc');
  const [perpExchange, setPerpExchange] = useState<string>('binance');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [errorCount, setErrorCount] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [minVolBound, setMinVolBound] = useState<number>(0);
  const [maxVolBound, setMaxVolBound] = useState<number>(0);
  const [minVolFilter, setMinVolFilter] = useState<number>(0);
  const [maxVolFilter, setMaxVolFilter] = useState<number>(0);

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'netFundingPct',
    direction: 'desc',
  });

  const fmtVol = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
    return `$${v.toFixed(0)}`;
  };

  const handleSort = (key: string) => {
    if (sortConfig.key === key) {
      setSortConfig({
        key,
        direction: sortConfig.direction === 'asc' ? 'desc' : 'asc',
      });
    } else {
      setSortConfig({ key, direction: 'desc' });
    }
  };

  const filteredAndSortedResults = useMemo(() => {
    return results
      .filter((r) => {
        const vol = Number(r.volume24h || 0);
        if (maxVolBound > minVolBound) {
          return vol >= minVolFilter && vol <= maxVolFilter;
        }
        return true;
      })
      .sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        if (sortConfig.key === 'symbol') {
          aVal = a.symbol || a.spotSymbol || '';
          bVal = b.symbol || b.spotSymbol || '';
        }

        if (typeof aVal === 'string') {
          const cmp = String(aVal).localeCompare(String(bVal || ''));
          return sortConfig.direction === 'asc' ? cmp : -cmp;
        }

        const numA = Number(aVal || 0);
        const numB = Number(bVal || 0);
        if (numA < numB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (numA > numB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
  }, [results, sortConfig, minVolFilter, maxVolFilter, minVolBound, maxVolBound]);

  const renderSortHeader = (label: string, key: string, alignRight = false) => {
    const isSorted = sortConfig.key === key;
    return (
      <th
        onClick={() => handleSort(key)}
        className={`px-4 py-3 cursor-pointer select-none hover:text-white transition-colors ${alignRight ? 'text-right' : ''}`}
        title={`Clique para ordenar por ${label}`}
      >
        <div className={`flex items-center gap-1.5 ${alignRight ? 'justify-end' : ''}`}>
          <span>{label}</span>
          <span className={`text-[11px] ${isSorted ? 'text-indigo-400 font-bold' : 'text-slate-600'}`}>
            {isSorted ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
          </span>
        </div>
      </th>
    );
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFetchError(null);
    setResults([]);
    try {
      let url = '';
      if (scanMode === 'cross') {
        url = `/api/perp-arb/manual-scan?symbol=${encodeURIComponent(symbol)}&spotExchange=${spotExchange}&perpExchange=${perpExchange}`;
      } else {
        const queryExchanges = selectedExchanges.length > 0 ? selectedExchanges.join(',') : AVAILABLE_EXCHANGES.join(',');
        url = `/api/perp-arb/manual-scan?symbol=${encodeURIComponent(symbol)}&exchanges=${queryExchanges}`;
      }

      const res = await fetch(url, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro na busca');
      
      const resList = data.results || [];
      setResults(resList);
      setErrorCount(data.errors || 0);

      if (resList.length > 0) {
        const vols = resList.map((r: any) => Number(r.volume24h || 0));
        const minV = Math.min(...vols);
        const maxV = Math.max(...vols);
        setMinVolBound(minV);
        setMaxVolBound(maxV);
        setMinVolFilter(minV);
        setMaxVolFilter(maxV);
      }
    } catch (err: any) {
      setFetchError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-6xl rounded-2xl border border-white/10 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-white/10 bg-slate-900 px-6 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">Busca Manual Cross-Exchange</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {/* Seletor de Modo de Busca */}
          <div className="mb-5 flex gap-2 border-b border-white/10 pb-3">
            <button
              type="button"
              onClick={() => setScanMode('same')}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
                scanMode === 'same'
                  ? 'bg-indigo-600 text-white shadow-[0_0_10px_rgba(79,70,229,0.4)]'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              Mesma Corretora (Single Exchange)
            </button>
            <button
              type="button"
              onClick={() => setScanMode('cross')}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
                scanMode === 'cross'
                  ? 'bg-cyan-600 text-white shadow-[0_0_10px_rgba(8,145,178,0.4)]'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              ⚡ Cruzamento de 2 Corretoras Diferentes (Cross-Exchange)
            </button>
          </div>

          {/* Configuração Modo Mesma Corretora */}
          {scanMode === 'same' && (
            <div className="mb-4">
              <label className="mb-2 block text-xs font-medium text-slate-400">Corretoras (Selecione onde buscar)</label>
              <div className="flex flex-wrap gap-4">
                {AVAILABLE_EXCHANGES.map(ex => (
                  <label key={ex} className="flex items-center gap-1.5 text-sm font-semibold text-slate-300 cursor-pointer hover:text-white transition-colors">
                    <input
                      type="checkbox"
                      className="accent-indigo-500 w-4 h-4"
                      checked={selectedExchanges.includes(ex)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedExchanges([...selectedExchanges, ex]);
                        else setSelectedExchanges(selectedExchanges.filter(x => x !== ex));
                      }}
                    />
                    {ex.toUpperCase()}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Configuração Modo Cruzado */}
          {scanMode === 'cross' && (
            <div className="mb-4 rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4">
              <p className="text-xs text-cyan-300 font-semibold mb-3 uppercase tracking-wider">Selecione o par de corretoras para cruzamento:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    🟢 Corretora Spot (Compra LONG)
                  </label>
                  <select
                    value={spotExchange}
                    onChange={(e) => setSpotExchange(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                  >
                    {AVAILABLE_EXCHANGES.map(ex => (
                      <option key={ex} value={ex}>{ex.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    🟣 Corretora Perpétuo (Venda SHORT)
                  </label>
                  <select
                    value={perpExchange}
                    onChange={(e) => setPerpExchange(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                  >
                    {AVAILABLE_EXCHANGES.map(ex => (
                      <option key={ex} value={ex}>{ex.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleScan} className="flex gap-3 mb-6">
            <input
              type="text"
              placeholder="Digite o símbolo (ex: BTC, ETH, SOL ou deixe vazio p/ escanear topo de mercado)"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="flex-1 rounded-lg border border-white/10 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {loading ? 'Consultando...' : 'Escanear Oportunidades'}
            </button>
          </form>

          {fetchError && (
            <div className="mb-4 rounded-lg border border-red-600 bg-red-950/50 p-3 text-sm text-red-200">
              {fetchError}
            </div>
          )}

          {/* Meter Único de Filtro por Volume 24h (Dual-Thumb Slider) */}
          {results.length > 0 && maxVolBound > minVolBound && (
            <div className="mb-4 rounded-xl border border-indigo-500/30 bg-slate-950/90 p-3 shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold uppercase tracking-wider text-indigo-300">
                    📊 Meter de Volume 24h
                  </span>
                  <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-200 border border-indigo-500/30">
                    {filteredAndSortedResults.length} de {results.length} moedas
                  </span>
                </div>
                <div className="font-mono font-semibold text-cyan-300 text-[11px]">
                  Faixa: <span className="text-emerald-400 font-bold">{fmtVol(minVolFilter)}</span> — <span className="text-emerald-400 font-bold">{fmtVol(maxVolFilter)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => { setMinVolFilter(minVolBound); setMaxVolFilter(maxVolBound); }}
                    className="rounded bg-slate-800 px-2 py-0.5 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    🔄 Todas
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMinVolFilter(500000); setMaxVolFilter(maxVolBound); }}
                    className="rounded bg-slate-800 px-2 py-0.5 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    &gt; $500k
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMinVolFilter(1000000); setMaxVolFilter(maxVolBound); }}
                    className="rounded bg-slate-800 px-2 py-0.5 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    &gt; $1M
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMinVolFilter(5000000); setMaxVolFilter(maxVolBound); }}
                    className="rounded bg-slate-800 px-2 py-0.5 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    &gt; $5M
                  </button>
                </div>
              </div>

              {/* Dual-Thumb Range Slider Bar Único */}
              <div className="relative w-full h-6 flex items-center my-1">
                {/* Dynamic Background Track */}
                <div className="absolute left-0 right-0 h-2 rounded-full bg-slate-800 border border-white/10" />
                
                {/* Active Range Fill */}
                <div
                  className="absolute h-2 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 shadow-[0_0_8px_rgba(99,102,241,0.6)]"
                  style={{
                    left: `${((minVolFilter - minVolBound) / (maxVolBound - minVolBound || 1)) * 100}%`,
                    right: `${100 - ((maxVolFilter - minVolBound) / (maxVolBound - minVolBound || 1)) * 100}%`,
                  }}
                />

                {/* Min Thumb Input */}
                <input
                  type="range"
                  min={minVolBound}
                  max={maxVolBound}
                  step={(maxVolBound - minVolBound) / 200 || 1000}
                  value={minVolFilter}
                  onChange={(e) => {
                    const val = Math.min(Number(e.target.value), maxVolFilter - 100);
                    setMinVolFilter(val);
                  }}
                  className="absolute w-full h-2 appearance-none bg-transparent pointer-events-none z-30 cursor-pointer [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-400 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:appearance-none"
                />

                {/* Max Thumb Input */}
                <input
                  type="range"
                  min={minVolBound}
                  max={maxVolBound}
                  step={(maxVolBound - minVolBound) / 200 || 1000}
                  value={maxVolFilter}
                  onChange={(e) => {
                    const val = Math.max(Number(e.target.value), minVolFilter + 100);
                    setMaxVolFilter(val);
                  }}
                  className="absolute w-full h-2 appearance-none bg-transparent pointer-events-none z-40 cursor-pointer [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:appearance-none"
                />
              </div>

              {/* Min & Max Labels Below Slider */}
              <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-0.5">
                <span>Min: {fmtVol(minVolBound)}</span>
                <span>Max: {fmtVol(maxVolBound)}</span>
              </div>
            </div>
          )}

          {results.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-slate-950 overflow-x-auto shadow-xl custom-scrollbar">
              <div className="bg-slate-900/80 px-4 py-2.5 border-b border-white/10 text-xs font-semibold text-indigo-300 flex justify-between items-center min-w-[900px]">
                <span>Exibindo {filteredAndSortedResults.length} de {results.length} pares de moedas</span>
                <span className="text-slate-400 font-normal">Clique no cabeçalho de qualquer coluna para ordenar (▲/▼)</span>
              </div>
              <table className="w-full text-left text-sm whitespace-nowrap min-w-[900px]">
                <thead className="border-b border-white/10 bg-slate-900/50 text-xs font-medium uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3 text-left">Ação</th>
                    {renderSortHeader('Moeda', 'symbol')}
                    {renderSortHeader('Corretora(s)', 'exchange')}
                    {renderSortHeader('Vol 24h', 'volume24h')}
                    {renderSortHeader('Spot Ask', 'spotAsk')}
                    {renderSortHeader('Perp Bid', 'perpBid')}
                    {renderSortHeader('Spread (Backwd)', 'spreadPct')}
                    {renderSortHeader('Funding Rate', 'fundingPct')}
                    {renderSortHeader('Slippage Est.', 'estimatedSlippagePct')}
                    {renderSortHeader('Taxas Taker', 'totalFeePct')}
                    {renderSortHeader('Lucro Líquido', 'netFundingPct')}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredAndSortedResults.map((r, i) => (
                    <tr key={i} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-left">
                        <button
                          onClick={() => {
                            const spotExName = r.spotExchange || r.exchange;
                            const perpExName = r.perpExchange || r.exchange;
                            const spotExKey = exchangeKeys.find(k => k.exchangeId.toLowerCase() === spotExName.toLowerCase());
                            const perpExKey = exchangeKeys.find(k => k.exchangeId.toLowerCase() === perpExName.toLowerCase());

                            onCreateStrategy({
                              name: `${r.symbol}`,
                              perpSymbol: r.symbol,
                              spotSymbol: r.spotSymbol,
                              minFundingRatePct: Math.max(0.001, Number(r.fundingPct.toFixed(4))),
                              maxSlippagePct: Number((r.estimatedSlippagePct ? Math.max(0.1, r.estimatedSlippagePct * 1.2) : 0.1).toFixed(4)),
                              spotExchangeKeyId: { _id: spotExKey?._id || '' },
                              perpExchangeKeyId: { _id: perpExKey?._id || '' },
                            });
                          }}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 transition-all shadow-md hover:scale-105"
                        >
                          + Criar
                        </button>
                      </td>
                      <td className="px-4 py-3 font-bold text-indigo-400">{r.symbol || r.spotSymbol || symbol}</td>
                      <td className="px-4 py-3 font-bold text-white">{r.exchange}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {r.volume24h > 1000000 
                          ? `$${(r.volume24h / 1000000).toFixed(2)}M` 
                          : `$${(r.volume24h / 1000).toFixed(1)}k`}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{r.spotAsk}</td>
                      <td className="px-4 py-3 text-slate-300">{r.perpBid}</td>
                      <td className={`px-4 py-3 font-semibold ${r.spreadPct < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {r.spreadPct > 0 ? '+' : ''}{r.spreadPct.toFixed(4)}%
                      </td>
                      <td className="px-4 py-3 font-semibold text-emerald-400">
                        {r.fundingPct.toFixed(4)}%
                      </td>
                      <td className={`px-4 py-3 font-semibold ${Number(r.estimatedSlippagePct || 0) > 0.1 ? 'text-amber-400 font-bold' : 'text-slate-300'}`}>
                        {Number(r.estimatedSlippagePct || 0).toFixed(4)}%
                      </td>
                      <td className="px-4 py-3 text-red-400 font-medium">
                        -{r.totalFeePct.toFixed(4)}%
                      </td>
                      <td className={`px-4 py-3 font-bold ${r.netFundingPct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {r.netFundingPct > 0 ? '+' : ''}{r.netFundingPct.toFixed(4)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {errorCount > 0 && (
                <div className="px-4 py-2 bg-slate-900/50 border-t border-white/10 text-xs text-slate-500 text-right">
                  * {errorCount} corretora(s) falharam ao retornar dados (timeout ou não suportado). As taxas (fees) exibidas são estimativas padrões públicas (Taker).
                </div>
              )}
            </div>
          )}
          
          {!loading && results.length === 0 && !fetchError && (
             <div className="text-center py-10 text-slate-500 text-sm">
                Nenhum resultado ainda. Digite a moeda acima e clique em Escanear.
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
