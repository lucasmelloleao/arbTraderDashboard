'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw,
  CalendarRange,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Repeat,
  Percent,
  CircleDollarSign,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
} from 'lucide-react';
import clsx from 'clsx';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend,
} from 'recharts';

type ExchangeSummary = { _id: string; exchangeId: string; name: string };

type HistoryItem = {
  timestamp: number;
  date: string | null;
  exchangeId: string;
  category: string;
  kind: string;
  symbol: string;
  side: string;
  amount: number;
  price: number | null;
  fee: number;
  feeCurrency: string | null;
  notionalUsd: number;
  info: any;
  id: string | null;
};

type ExchangeData = { exchangeId: string; name: string; items: HistoryItem[] };

type ApiResponse = {
  success: boolean;
  start: string;
  end: string;
  exchanges: ExchangeData[];
  errors?: { exchangeId: string; step: string; error: string }[];
  error?: string;
};

const categoryMeta: Record<string, { label: string; color: string }> = {
  spot: { label: 'Spot', color: '#38bdf8' },
  futures: { label: 'Futuros (Perp)', color: '#8b5cf6' },
  funding: { label: 'Funding', color: '#22c55e' },
  ledger: { label: 'Ajustes / Bônus', color: '#f59e0b' },
  transferencia: { label: 'Transferência Interna', color: '#94a3b8' },
  deposito: { label: 'Depósito', color: '#34d399' },
  saque: { label: 'Saque', color: '#fb7185' },
};

const CATEGORY_COLORS: Record<string, string> = {
  spot: '#38bdf8',
  futures: '#8b5cf6',
  funding: '#22c55e',
  ledger: '#f59e0b',
  transferencia: '#94a3b8',
  deposito: '#34d399',
  saque: '#fb7185',
};

function fmtUSD(v: number, sign: boolean = false): string {
  const abs = Math.abs(v || 0);
  const s = abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (sign) return `${v >= 0 ? '+' : '-'}$${abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${s}`;
}

function fmtDate(ts: number | string | null): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function ExchangeHistoryPage() {
  const [exchanges, setExchanges] = useState<ExchangeSummary[]>([]);
  const [selectedExchange, setSelectedExchange] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingExchanges, setLoadingExchanges] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortDesc, setSortDesc] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Toggles por categoria: quando desabilitada, os dados da categoria são excluídos de toda a tela.
  const [enabledCategories, setEnabledCategories] = useState<Record<string, boolean>>(
    () => Object.fromEntries(Object.keys(categoryMeta).map(k => [k, true]))
  );

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const res = await fetch('/api/exchanges', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const j = await res.json();
          setExchanges(j.exchanges || []);
          if (j.exchanges && j.exchanges.length > 0) setSelectedExchange(j.exchanges[0]._id);
        }
      } catch { /* silent */ }
      finally { setLoadingExchanges(false); }
    })();
  }, []);

  const fetchHistory = async () => {
    if (!selectedExchange) { setError('Selecione uma exchange'); return; }
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        exchangeId: selectedExchange,
        start: startDate,
        end: endDate,
      });
      const res = await fetch(`/api/exchange-history?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j: ApiResponse = await res.json();
      if (!res.ok || j.success === false) {
        throw new Error(j.error || 'Falha ao buscar histórico');
      }
      setData(j);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const allItems = useMemo<HistoryItem[]>(() => {
    if (!data?.exchanges) return [];
    return data.exchanges.flatMap(x => x.items || []);
  }, [data]);

  // Itens efetivos: exclui categorias desabilitadas pelo usuário.
  const effectiveItems = useMemo<HistoryItem[]>(() => {
    return allItems.filter(i => enabledCategories[i.category] !== false);
  }, [allItems, enabledCategories]);

  const filtered = useMemo(() => {
    if (categoryFilter === 'all') return effectiveItems;
    return effectiveItems.filter(i => i.category === categoryFilter);
  }, [effectiveItems, categoryFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => sortDesc ? (b.timestamp - a.timestamp) : (a.timestamp - b.timestamp));
  }, [filtered, sortDesc]);

  const stats = useMemo(() => {
    let credit = 0, debit = 0, funding = 0, fees = 0;
    const byCat: Record<string, { credit: number; debit: number; count: number }> = {};
    for (const it of effectiveItems) {
      const amt = Number(it.notionalUsd || 0);
      const cat = it.category;
      if (!byCat[cat]) byCat[cat] = { credit: 0, debit: 0, count: 0 };
      byCat[cat].count++;
      byCat[cat].credit += amt >= 0 ? amt : 0;
      byCat[cat].debit += amt < 0 ? amt : 0;
      if (amt > 0) credit += amt; else debit += amt;
      if (it.category === 'funding') funding += amt;
      fees += Number(it.fee || 0);
    }
    // P/L estimado: net de operações de mercado (spot+futures+funding), ignorando transferências de saldo
    const tradingNet = (byCat['spot']?.credit || 0) - (byCat['spot']?.debit || 0)
      + (byCat['futures']?.credit || 0) - (byCat['futures']?.debit || 0)
      + funding;
    const totalNet = credit + debit; // debit já negativo
    return { credit, debit, funding, fees, byCat, tradingNet, totalNet };
  }, [effectiveItems]);

  // Dados para gráfico de evolução (líquido acumulado por dia)
  const chartDaily = useMemo(() => {
    const byDay: Record<string, { net: number; credit: number; debit: number; funding: number }> = {};
    for (const it of effectiveItems) {
      if (!it.date) continue;
      const day = it.date.slice(0, 10);
      if (!byDay[day]) byDay[day] = { net: 0, credit: 0, debit: 0, funding: 0 };
      const amt = Number(it.notionalUsd || 0);
      byDay[day].net += amt;
      byDay[day].credit += amt > 0 ? amt : 0;
      byDay[day].debit += amt < 0 ? amt : 0;
      if (it.category === 'funding') byDay[day].funding += amt;
    }
    // Sorteia e acumula
    return Object.keys(byDay).sort().map(d => {
      const b = byDay[d];
      return { day: d.slice(5), net: Number(b.net.toFixed(2)), credit: Number(b.credit.toFixed(2)), debit: Number(b.debit.toFixed(2)), funding: Number(b.funding.toFixed(2)) };
    });
  }, [effectiveItems]);

  const exportCsv = () => {
    if (sorted.length === 0) return;
    const header = ['Data', 'Exchange', 'Categoria', 'Tipo', 'Par', 'Lado', 'Valor (USDT)', 'Taxa', 'Info'];
    const rows = sorted.map(i => [
      fmtDate(i.timestamp),
      i.exchangeId,
      categoryMeta[i.category]?.label || i.category,
      i.kind,
      i.symbol || '',
      i.side,
      i.notionalUsd,
      i.fee,
      typeof i.info === 'string' ? i.info : '',
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `exchange-history-${selectedExchange}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Soma de crédito/débito por categoria para o gráfico de barras
  const chartByCat = useMemo(() => {
    const cats = Object.keys(stats.byCat);
    return cats.map(c => ({
      name: categoryMeta[c]?.label || c,
      Crédito: Number((stats.byCat[c].credit).toFixed(2)),
      Débito: Number((stats.byCat[c].debit).toFixed(2)),
    }));
  }, [stats]);

  // ── Posições Perpétuas Fechadas ─────────────────────────────────────────────
  // Agrega os trades de futuros em posições (abertura + fechamento) com P&L,
  // fiel ao histórico da MEXC. O P&L é calculado pela variação do valor em USDT
  // (cost/notional) entre fechamento e abertura, ajustado pelo lado da posição.
  type PerpClosedPosition = {
    symbol: string;
    exchangeId: string;
    side: 'long' | 'short';
    openTime: number;
    closeTime: number;
    openPrice: number;
    closePrice: number;
    qty: number;
    openCost: number;
    closeCost: number;
    fees: number;
    pnl: number;
    pnlPct: number;
  };

  const perpClosedPositions = useMemo<PerpClosedPosition[]>(() => {
    const futures = effectiveItems
      .filter(i => i.category === 'futures')
      .sort((a, b) => a.timestamp - b.timestamp);

    // Agrupa por símbolo
    const bySymbol: Record<string, HistoryItem[]> = {};
    for (const it of futures) {
      const key = it.symbol || 'N/A';
      if (!bySymbol[key]) bySymbol[key] = [];
      bySymbol[key].push(it);
    }

    const positions: PerpClosedPosition[] = [];

    for (const sym of Object.keys(bySymbol)) {
      const trades = bySymbol[sym];
      // Fila FIFO de lotes abertos.
      // cost = valor em USDT do trade (o "montante executado" da MEXC).
      const openQueue: { side: 'long' | 'short'; cost: number; price: number; time: number; fee: number }[] = [];

      for (const t of trades) {
        const cost = Number(t.notionalUsd || 0);
        const price = Number(t.price) || 0;
        const fee = Number(t.fee) || 0;
        if (cost <= 0) continue;

        // ATENÇÃO: Na MEXC (e em várias CEX de futuros), o `side` de um trade
        // de perpétuo vem INVERSO ao sentido na abertura de posição:
        //  - "Vender short" (abertura de short) chega como `side: 'buy'`
        //  - "Fechar short / Comprar" chega como `side: 'sell'`
        // Por isso invertemos o mapeamento para refletir o lado REAL da posição.
        const isBuy = t.side === 'buy';
        const direction: 'long' | 'short' = isBuy ? 'short' : 'long';

        // Procura um lote aberto na direção OPOSTA para fechá-lo
        const oppIdx = openQueue.findIndex(o => o.side !== direction);
        if (oppIdx >= 0) {
          const lot = openQueue[oppIdx];
          openQueue.splice(oppIdx, 1);
          // P&L pela variação do valor (cost):
          //  short: abriu vendendo (ganha se o VALOR a fechar for menor)
          //  long : abriu comprando (ganha se o VALOR a fechar for maior)
          const rawPnl = lot.side === 'short'
            ? lot.cost - cost
            : cost - lot.cost;
          positions.push({
            symbol: sym,
            exchangeId: t.exchangeId,
            side: lot.side,
            openTime: lot.time,
            closeTime: t.timestamp,
            openPrice: lot.price,
            closePrice: price,
            qty: lot.cost / (lot.price || 1),
            openCost: lot.cost,
            closeCost: cost,
            fees: lot.fee + fee,
            pnl: rawPnl - lot.fee - fee,
            pnlPct: lot.cost > 0 ? ((rawPnl - lot.fee - fee) / lot.cost) * 100 : 0,
          });
        } else {
          // Sem lote oposto aberto → abre novo lote
          openQueue.push({ side: direction, cost, price, time: t.timestamp, fee });
        }
      }
    }

    // Ordena por data de fechamento mais recente
    return positions.sort((a, b) => b.closeTime - a.closeTime);
  }, [effectiveItems]);

  const perpStats = useMemo(() => {
    let totalPnl = 0, totalFees = 0, wins = 0;
    for (const p of perpClosedPositions) {
      totalPnl += p.pnl;
      totalFees += p.fees;
      if (p.pnl >= 0) wins++;
    }
    return { totalPnl, totalFees, wins, losses: perpClosedPositions.length - wins, closedCount: perpClosedPositions.length };
  }, [perpClosedPositions]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CalendarRange className="w-6 h-6 text-indigo-400" /> Histórico da Exchange
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Busque Spot, Futuros, Bônus, Depósitos, Saques e transferências para identificar exatamente onde está o lucro ou prejuízo.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Exchange</label>
            <select
              value={selectedExchange}
              onChange={e => setSelectedExchange(e.target.value)}
              disabled={loadingExchanges}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-white outline-none focus:border-indigo-500"
            >
              {exchanges.length === 0 && <option value="">Nenhuma exchange ativa</option>}
              {exchanges.map(e => (
                <option key={e._id} value={e._id}>{e.name} ({e.exchangeId})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Data Início</label>
            <input type="date" value={startDate} max={endDate} onChange={e => setStartDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-white outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Data Fim</label>
            <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-white outline-none focus:border-indigo-500" />
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchHistory}
              disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Gerar Relatório
            </button>
            <button
              onClick={fetchHistory}
              disabled={loading}
              className="inline-flex items-center justify-center px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors disabled:opacity-50"
              title="Buscar últimos 7 dias"
            >
              <CalendarRange className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loading && (
          <div className="mt-4 text-sm text-indigo-300 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Buscando movimentações nas exchanges via API (pode levar alguns segundos)...
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-200">{error}</div>
        )}
        {data?.errors && data.errors.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-950/40 p-3 text-xs text-amber-200">
            <strong>Advertências:</strong>
            <ul className="list-disc pl-4 mt-1 space-y-0.5">
              {data.errors.map((er, i) => (
                <li key={i}><b>{er.exchangeId}</b> · {er.step}: {er.error}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {data && (
        <div className="space-y-6">
          {/* Toggles de categorias habilitadas */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-lg font-semibold text-white">Categorias Habilitadas</h3>
                <p className="text-xs text-slate-400">Desabilite uma categoria para ocultá-la de todos os cálculos e gráficos na tela.</p>
              </div>
              <button
                onClick={() => {
                  const allOn = Object.values(enabledCategories).every(v => v);
                  setEnabledCategories(Object.fromEntries(Object.keys(categoryMeta).map(k => [k, !allOn])));
                }}
                className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
              >
                {Object.values(enabledCategories).every(v => v) ? 'Desmarcar todas' : 'Marcar todas'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(categoryMeta).map(([k, v]) => {
                const on = enabledCategories[k] !== false;
                return (
                  <button
                    key={k}
                    onClick={() => setEnabledCategories(prev => ({ ...prev, [k]: !(prev[k] !== false) }))}
                    className={clsx(
                      "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                      on ? "text-white border-transparent" : "text-slate-500 border-slate-700 bg-slate-950"
                    )}
                    style={on ? { background: v.color + '22', borderColor: v.color + '66', color: v.color } : undefined}
                  >
                    <span
                      className={clsx("w-3.5 h-3.5 rounded border flex items-center justify-center text-[9px] leading-none", on ? "border-transparent" : "border-slate-600")}
                      style={on ? { background: v.color } : undefined}
                    >
                      {on && <svg viewBox="0 0 10 10" width="8" height="8"><path d="M1 5l3 3 5-6" fill="none" stroke="#0f172a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </span>
                    {v.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cards de resumo */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Total Crédito" value={fmtUSD(stats.credit)} positive />
            <StatCard icon={<TrendingDown className="w-4 h-4" />} label="Total Débito" value={fmtUSD(Math.abs(stats.debit))} negative />
            <StatCard icon={<Percent className="w-4 h-4" />} label="Funding (colheitas)" value={fmtUSD(stats.funding, true)} positive={stats.funding >= 0} />
            <StatCard icon={<CircleDollarSign className="w-4 h-4" />} label="Taxas Pagas" value={fmtUSD(stats.fees)} negative />
            <StatCard icon={<Wallet className="w-4 h-4" />} label="P/L Trading (spot+fut+funding)" value={fmtUSD(stats.tradingNet, true)} positive={stats.tradingNet >= 0} />
            <StatCard icon={<Repeat className="w-4 h-4" />} label="Líquido Total (c/ transferências)" value={fmtUSD(stats.totalNet, true)} positive={stats.totalNet >= 0} />
          </div>

          {/* Posições Perpétuas Fechadas */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-violet-400" /> Histórico de Posições Perpétuas
                </h3>
                <p className="text-xs text-slate-400">
                  Posições de futuros abertas e fechadas, com P&L realizado por posição.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-300">
                  {perpStats.closedCount} fechadas
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  {perpStats.wins} lucros
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
                  {perpStats.losses} prejuízos
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              <div className="bg-slate-950 rounded-lg p-4 border border-slate-800">
                <p className="text-xs text-slate-500 mb-1">P&L Realizado (Perp fechado)</p>
                <p className={clsx("text-xl font-bold", perpStats.totalPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                  {fmtUSD(perpStats.totalPnl, true)}
                </p>
              </div>
              <div className="bg-slate-950 rounded-lg p-4 border border-slate-800">
                <p className="text-xs text-slate-500 mb-1">Taxas Pagas (Perp)</p>
                <p className="text-xl font-bold text-white">{fmtUSD(perpStats.totalFees)}</p>
              </div>
              <div className="bg-slate-950 rounded-lg p-4 border border-slate-800">
                <p className="text-xs text-slate-500 mb-1">Resultado Líquido (P&L - taxas)</p>
                <p className={clsx("text-xl font-bold", (perpStats.totalPnl - perpStats.totalFees) >= 0 ? "text-emerald-400" : "text-red-400")}>
                  {fmtUSD(perpStats.totalPnl - perpStats.totalFees, true)}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left text-sm whitespace-nowrap md:whitespace-normal">
                <thead className="bg-slate-900/50 border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Par</th>
                    <th className="px-4 py-3 font-medium">Lado</th>
                    <th className="px-4 py-3 font-medium">Abertura</th>
                    <th className="px-4 py-3 font-medium">Fechamento</th>
                    <th className="px-4 py-3 font-medium text-right">Montante (USDT)</th>
                    <th className="px-4 py-3 font-medium text-right">Preço Médio</th>
                    <th className="px-4 py-3 font-medium text-right">Taxas</th>
                    <th className="px-4 py-3 font-medium text-right">P&L</th>
                    <th className="px-4 py-3 font-medium text-right">P&L %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {perpClosedPositions.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                      Nenhuma posição perpétua fechada no período.
                    </td></tr>
                  )}
                  {perpClosedPositions.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-white">
                        {p.symbol}
                        <span className="ml-2 text-[10px] text-slate-500 uppercase">{p.exchangeId}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={clsx("text-xs font-bold px-2 py-0.5 rounded-full", p.side === 'short' ? "bg-red-500/10 text-red-400 border border-red-500/30" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30")}>
                          {p.side === 'short' ? 'Short' : 'Long'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-400">
                        {fmtDate(p.openTime)}
                        <div className="text-slate-500">${p.openPrice.toFixed(6)}</div>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-400">
                        {fmtDate(p.closeTime)}
                        <div className="text-slate-500">${p.closePrice.toFixed(6)}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                        <span className="text-slate-500 text-xs">abr. ${p.openCost.toFixed(4)}</span>
                        <div>fec. ${p.closeCost.toFixed(4)}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                        ${((p.openPrice + p.closePrice) / 2).toFixed(6)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-500">{fmtUSD(p.fees)}</td>
                      <td className={clsx("px-4 py-2.5 text-right font-mono font-bold", p.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                        {fmtUSD(p.pnl, true)}
                      </td>
                      <td className={clsx("px-4 py-2.5 text-right font-mono font-bold", p.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                        {p.pnlPct >= 0 ? '+' : ''}{p.pnlPct.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Gráfico de evolução diária */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-white mb-1">Evolução Diária (Líquido)</h3>
            <p className="text-xs text-slate-400 mb-4">Soma diária de créditos e débitos de todas as categorias.</p>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartDaily} margin={{ left: 0, right: 10, top: 5 }}>
                <defs>
                  <linearGradient id="net" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="net" name="Líquido" stroke="#8b5cf6" fill="url(#net)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Gráfico por categoria */}
          {chartByCat.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-white mb-4">Crédito vs Débito por Categoria</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartByCat} margin={{ left: 0, right: 10, top: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                  <Legend />
                  <Bar dataKey="Crédito" fill="#34d399" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Débito" fill="#fb7185" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Detalhamento por categoria + tabela */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Movimentações Detalhadas</h3>
                <p className="text-xs text-slate-400">{sorted.length} registros encontrados no período.</p>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <button
                  onClick={() => setSortDesc(v => !v)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                >
                  {sortDesc ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                  Data {sortDesc ? 'recente' : 'antiga'}
                </button>
                <button onClick={exportCsv} className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs">
                  <Download className="w-3.5 h-3.5" /> Exportar CSV
                </button>
                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-indigo-500"
                >
                  <option value="all">Todas categorias</option>
                  {Object.entries(categoryMeta).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap md:whitespace-normal">
                <thead className="bg-slate-900/50 border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Data</th>
                    <th className="px-4 py-3 font-medium">Categoria</th>
                    <th className="px-4 py-3 font-medium text-right">Valor (USDT)</th>
                    <th className="px-4 py-3 font-medium text-right">Taxa</th>
                    <th className="px-4 py-3 font-medium">Resultado</th>
                    <th className="px-4 py-3 font-medium">Detalhe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {sorted.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Nenhuma movimentação encontrada no período.</td></tr>
                  )}
                  {sorted.map((it, idx) => {
                    const meta = categoryMeta[it.category] || { label: it.category, color: '#94a3b8' };
                    const isCredit = it.notionalUsd >= 0;
                    const isTransfer = it.category === 'transferencia';
                    return (
                      <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{fmtDate(it.date || it.timestamp)}</td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full border" style={{ color: meta.color, borderColor: meta.color + '44', background: meta.color + '11' }}>
                            {meta.label}
                          </span>
                          {it.symbol && <span className="ml-2 text-xs text-slate-500">{it.symbol}</span>}
                        </td>
                        <td className={clsx("px-4 py-2.5 text-right font-mono font-semibold", isCredit ? "text-emerald-400" : isTransfer ? "text-slate-400" : "text-red-400")}>
                          {isCredit ? '+' : (isTransfer ? '' : '')}{fmtUSD(it.notionalUsd)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-500">{it.fee ? fmtUSD(it.fee) : '—'}</td>
                        <td className="px-4 py-2.5 text-right">
                          {(it.category === 'spot' || it.category === 'futures' || it.category === 'funding') ? (
                            <span className={clsx("text-xs font-bold", isCredit ? "text-emerald-400" : "text-red-400")}>
                              {isCredit ? '▲ Lucro' : '▼ Prejuízo'}
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-500">
                          <span className="capitalize">{it.side}</span>
                          {typeof it.info === 'string' && it.info ? <span className="ml-1 text-slate-500">· {it.info}</span> : null}
                          {it.kind === 'internal' && <span className="ml-1 text-slate-500">· interna</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!data && !loading && (
        <div className="bg-slate-900 border border-dashed border-slate-700 rounded-xl p-12 text-center text-slate-500">
          <CalendarRange className="w-10 h-10 mx-auto mb-3 text-slate-600" />
          <p className="font-medium">Preencha o período e clique em <strong>Gerar Relatório</strong>.</p>
          <p className="text-xs mt-1">Serão buscadas operações Spot, Futuros, Bônus, Depósitos, Saques e transferências via API da exchange.</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, positive, negative }: { icon: React.ReactNode; label: string; value: string; positive?: boolean; negative?: boolean }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 text-slate-400 text-xs font-medium mb-1">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className={clsx("text-xl font-bold", positive ? "text-emerald-400" : negative ? "text-red-400" : "text-white")}>
        {value}
      </div>
    </div>
  );
}
