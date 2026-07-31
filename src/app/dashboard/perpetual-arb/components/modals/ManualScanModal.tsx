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

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'netFundingPct',
    direction: 'desc',
  });

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

  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => {
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
  }, [results, sortConfig]);

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
      setResults(data.results || []);
      setErrorCount(data.errors || 0);
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

          {results.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-slate-950 overflow-hidden shadow-xl">
              <div className="bg-slate-900/80 px-4 py-2.5 border-b border-white/10 text-xs font-semibold text-indigo-300 flex justify-between items-center">
                <span>Exibindo {sortedResults.length} pares de moedas consultados</span>
                <span className="text-slate-400 font-normal">Clique no cabeçalho de qualquer coluna para ordenar (▲/▼)</span>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/10 bg-slate-900/50 text-xs font-medium uppercase tracking-wider text-slate-400">
                  <tr>
                    {renderSortHeader('Moeda', 'symbol')}
                    {renderSortHeader('Corretora(s)', 'exchange')}
                    {renderSortHeader('Vol 24h', 'volume24h')}
                    {renderSortHeader('Spot Ask', 'spotAsk')}
                    {renderSortHeader('Perp Bid', 'perpBid')}
                    {renderSortHeader('Spread (Backwd)', 'spreadPct')}
                    {renderSortHeader('Funding Rate', 'fundingPct')}
                    {renderSortHeader('Taxas Taker', 'totalFeePct')}
                    {renderSortHeader('Lucro Líquido', 'netFundingPct')}
                    <th className="px-4 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sortedResults.map((r, i) => (
                    <tr key={i} className="hover:bg-white/[0.02]">
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
                      <td className="px-4 py-3 text-red-400 font-medium">
                        -{r.totalFeePct.toFixed(4)}%
                      </td>
                      <td className={`px-4 py-3 font-bold ${r.netFundingPct > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {r.netFundingPct > 0 ? '+' : ''}{r.netFundingPct.toFixed(4)}%
                      </td>
                      <td className="px-4 py-3 text-right">
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
                              spotExchangeKeyId: { _id: spotExKey?._id || '' },
                              perpExchangeKeyId: { _id: perpExKey?._id || '' },
                            });
                          }}
                          className="rounded-lg bg-indigo-600/20 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-600/40 hover:text-white transition-colors"
                        >
                          Criar
                        </button>
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
