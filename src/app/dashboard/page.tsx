'use client';

import { useState, useEffect, useRef } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

export default function DashboardOverview() {
  const [loading, setLoading] = useState(true);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [cexBalances, setCexBalances] = useState<any[]>([]);
  const [totalCexUsd, setTotalCexUsd] = useState<number | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const fetchOverviewData = async () => {
      setLoading(true);
      const token = localStorage.getItem('token');
      const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

      try {
        // 1. Busca saldos instantâneos das CEX
        const balancesRes = await fetch('/api/perp-arb/balances', authHeaders);
        if (balancesRes.ok) {
          const balData = await balancesRes.json();
          if (balData.success && balData.exchanges) {
            setCexBalances(balData.exchanges);
            const total = Number(balData.spotUsdt || 0) + Number(balData.spotUsdc || 0) + Number(balData.futuresUsdt || 0) + Number(balData.futuresUsdc || 0);
            setTotalCexUsd(total);
          }
        }

        // 2. Busca histórico de evolução patrimonial
        const historyRes = await fetch('/api/portfolio/history', authHeaders);
        if (historyRes.ok) {
          const history = await historyRes.json();
          const chartDataMap: Record<string, any> = {};

          if (Array.isArray(history)) {
            history.forEach((snapshot: any) => {
              const dateObj = new Date(snapshot.timestamp);
              dateObj.setSeconds(0, 0);
              const timeKey = dateObj.getTime();

              if (!chartDataMap[timeKey]) {
                chartDataMap[timeKey] = {
                  time: timeKey,
                  formattedTime: dateObj.toLocaleString(),
                  totalUsdValue: 0
                };
              }
              chartDataMap[timeKey].totalUsdValue += snapshot.totalUsdValue;
            });

            const formattedChartData = Object.values(chartDataMap).sort((a: any, b: any) => a.time - b.time);
            setHistoryData(formattedChartData);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar dados do Overview:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOverviewData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-white">Overview — Arbitragem CEX</h3>
          <p className="text-slate-400 text-sm">Resumo patrimonial e saldos das corretoras centralizadas</p>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-sm">
          <p className="text-sm font-medium text-slate-400 mb-1">Corretoras Conectadas</p>
          <p className="text-3xl font-bold text-white">
            {loading ? '...' : cexBalances.length}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-sm relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent"></div>
          <p className="text-sm font-medium text-slate-400 mb-1">Saldo Total CEX (Spot + Futuros)</p>
          <p className="text-3xl font-bold text-emerald-400">
            {loading || totalCexUsd === null
              ? '...'
              : `$${totalCexUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </p>
        </div>
      </div>

      {/* Gráfico de Evolução Patrimonial */}
      <div>
        <h3 className="text-xl font-bold text-white mb-4">📈 Evolução Patrimonial</h3>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-sm">
          <div style={{ width: '100%', height: '380px' }}>
            {historyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorUsdMain" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="time"
                    tick={{ fill: '#64748b' }}
                    tickFormatter={(val) => {
                      const d = new Date(val);
                      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                    }}
                  />
                  <YAxis tick={{ fill: '#64748b' }} tickFormatter={(val) => `$${val}`} domain={['auto', 'auto']} />
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />
                  <Tooltip
                    formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Patrimônio CEX (USD)']}
                    labelFormatter={(label: any) => new Date(label).toLocaleString()}
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', color: '#f8fafc', borderRadius: '8px' }}
                    itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="totalUsdValue" stroke="#10b981" fillOpacity={1} fill="url(#colorUsdMain)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex justify-center items-center h-full">
                <p className="text-slate-500">Nenhum histórico registrado ainda.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabela Connected Exchanges Balances */}
      <div>
        <h3 className="text-xl font-bold text-white mb-4">🏦 Connected Exchanges Balances</h3>
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto shadow-sm">
          <table className="w-full text-left text-sm whitespace-nowrap md:whitespace-normal">
            <thead className="bg-slate-900/50 border-b border-slate-800 text-slate-400">
              <tr>
                <th className="px-6 py-4 font-medium">Exchange</th>
                <th className="px-6 py-4 font-medium text-right">Saldo Spot (USDT / USDC)</th>
                <th className="px-6 py-4 font-medium text-right">Saldo Futuros (USDT / USDC)</th>
                <th className="px-6 py-4 font-medium text-right">Total USD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">Carregando saldos das corretoras...</td>
                </tr>
              ) : cexBalances.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">Nenhuma corretora conectada.</td>
                </tr>
              ) : (
                cexBalances.map((ex, idx) => {
                  const spotTotal = (ex.spotUsdt || 0) + (ex.spotUsdc || 0);
                  const futTotal = (ex.futuresUsdt || 0) + (ex.futuresUsdc || 0);
                  const total = spotTotal + futTotal;

                  return (
                    <tr key={ex.id || idx} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-white capitalize">{ex.name || ex.exchangeId}</td>
                      <td className="px-6 py-4 text-right font-mono text-slate-300">
                        ${spotTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-slate-300">
                        ${futTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-emerald-400 text-base">
                        ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
  );
}
