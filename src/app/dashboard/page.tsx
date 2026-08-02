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
  const [totalSpotUsd, setTotalSpotUsd] = useState<number>(0);
  const [totalFuturesUsd, setTotalFuturesUsd] = useState<number>(0);
  const [spotUsdtOnly, setSpotUsdtOnly] = useState<number>(0);
  const [futuresUsdtOnly, setFuturesUsdtOnly] = useState<number>(0);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const fetchOverviewData = async () => {
      setLoading(true);
      const token = localStorage.getItem('token');
      const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

      try {
        // 1. Busca saldos atualizados das CEX
        const balancesRes = await fetch('/api/perp-arb/balances?refresh=true', authHeaders);
        if (balancesRes.ok) {
          const balData = await balancesRes.json();
          if (balData.success && balData.exchanges) {
            setCexBalances(balData.exchanges);
            const spotUsdtVal = Number(balData.spotUsdt || 0);
            const spotUsdcVal = Number(balData.spotUsdc || 0);
            const futUsdtVal = Number(balData.futuresUsdt || 0);
            const futUsdcVal = Number(balData.futuresUsdc || 0);

            const spotTot = Number(balData.spotTotalEquity || (spotUsdtVal + spotUsdcVal));
            const futTot = futUsdtVal + futUsdcVal;

            setSpotUsdtOnly(spotUsdtVal);
            setFuturesUsdtOnly(futUsdtVal);
            setTotalSpotUsd(spotTot);
            setTotalFuturesUsd(futTot);
            setTotalCexUsd(spotTot + futTot);
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
                  spotUsdValue: 0,
                  futuresUsdValue: 0,
                  totalUsdValue: 0,
                };
              }

              let spot = 0;
              let futures = 0;

              if (Array.isArray(snapshot.balances) && snapshot.balances.length > 0) {
                snapshot.balances.forEach((b: any) => {
                  const assetStr = String(b.asset || '').toLowerCase();
                  if (assetStr.includes('spot')) {
                    spot += Number(b.usdValue || b.total || 0);
                  } else if (assetStr.includes('perp') || assetStr.includes('futures')) {
                    futures += Number(b.usdValue || b.total || 0);
                  } else {
                    spot += Number(b.usdValue || b.total || 0);
                  }
                });
              } else {
                spot = Number(snapshot.totalUsdValue || 0);
              }

              chartDataMap[timeKey].spotUsdValue += spot;
              chartDataMap[timeKey].futuresUsdValue += futures;
              chartDataMap[timeKey].totalUsdValue += (spot + futures) || snapshot.totalUsdValue || 0;
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-sm font-medium text-slate-400 mb-1">Corretoras Conectadas</p>
            <p className="text-3xl font-bold text-white">
              {loading ? '...' : cexBalances.length}
            </p>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-2 pt-2 border-t border-slate-800/80">
            Patrimônio Global: <strong className="text-white font-bold">{loading ? '...' : `$${(totalCexUsd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`}</strong>
          </p>
        </div>

        <div className="bg-slate-900 border border-emerald-500/20 p-6 rounded-xl shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent"></div>
          <div>
            <p className="text-sm font-medium text-emerald-400 mb-1">🟢 Saldo Total Spot (CEX)</p>
            <p className="text-3xl font-bold text-emerald-300">
              {loading ? '...' : `$${totalSpotUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
          </div>
          <p className="text-xs text-emerald-400/80 font-mono mt-2 pt-2 border-t border-emerald-500/10 relative z-10">
            Disponível em USDT: <strong className="text-emerald-300 font-bold">{loading ? '...' : `$${spotUsdtOnly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`}</strong>
          </p>
        </div>

        <div className="bg-slate-900 border border-indigo-500/20 p-6 rounded-xl shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent"></div>
          <div>
            <p className="text-sm font-medium text-indigo-400 mb-1">🟣 Saldo Total Futuros (CEX)</p>
            <p className="text-3xl font-bold text-indigo-300">
              {loading ? '...' : `$${totalFuturesUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
          </div>
          <p className="text-xs text-indigo-400/80 font-mono mt-2 pt-2 border-t border-indigo-500/10 relative z-10">
            Disponível em USDT: <strong className="text-indigo-300 font-bold">{loading ? '...' : `$${futuresUsdtOnly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`}</strong>
          </p>
        </div>
      </div>

      {/* Gráfico de Evolução Patrimonial Duplo (Spot vs Futuros) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">📈 Evolução Patrimonial (Spot vs Futuros)</h3>
          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
              <span className="text-slate-300">Saldo Spot</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-indigo-500 inline-block"></span>
              <span className="text-slate-300">Saldo Futuros</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-sm">
          <div style={{ width: '100%', height: '380px' }}>
            {historyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSpot" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorFutures" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
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
                    formatter={(value: any, key: any) => {
                      const label = key === 'spotUsdValue' ? '🟢 Saldo Spot' : key === 'futuresUsdValue' ? '🟣 Saldo Futuros' : '⚪ Total';
                      return [`$${Number(value).toFixed(2)}`, label];
                    }}
                    labelFormatter={(label: any) => new Date(label).toLocaleString()}
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', color: '#f8fafc', borderRadius: '8px' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="spotUsdValue"
                    name="spotUsdValue"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorSpot)"
                  />
                  <Area
                    type="monotone"
                    dataKey="futuresUsdValue"
                    name="futuresUsdValue"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorFutures)"
                  />
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
                      <td className="px-6 py-4 text-right font-mono text-emerald-400 font-semibold">
                        ${spotTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-indigo-400 font-semibold">
                        ${futTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-white text-base">
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
