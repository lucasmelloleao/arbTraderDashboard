'use client';

import React from 'react';
import { Activity, TrendingUp, DollarSign, Wallet, RefreshCw } from 'lucide-react';

interface StatsHeaderProps {
  openCount: number;
  totalMonitored: number;
  executedCount: number;
  totalPnl: number;
  spotUsdt?: number;
  spotUsdc?: number;
  futuresUsdt?: number;
  futuresUsdc?: number;
  loadingBalances?: boolean;
  globalClosedApr?: number | null;
  totalEntryVolume?: number;
  totalExitVolume?: number;
}

export function StatsHeader({
  openCount,
  totalMonitored,
  executedCount,
  totalPnl,
  spotUsdt = 0,
  spotUsdc = 0,
  futuresUsdt = 0,
  futuresUsdc = 0,
  loadingBalances = false,
  globalClosedApr = null,
  totalEntryVolume = 0,
  totalExitVolume = 0,
}: StatsHeaderProps) {
  return (
    <div className="mt-4 space-y-4">
      {/* Linha 1: Saldos em Corretora (Spot & Futuros) */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Card Saldo Spot */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 shadow-lg flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-300">
              <Wallet className="h-4 w-4 text-emerald-400" /> Saldo Livre Spot (CEX)
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-black text-white flex items-baseline gap-2">
              {loadingBalances ? (
                <span className="text-slate-400 text-sm flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" /> Consultando...
                </span>
              ) : (
                <>
                  ${spotUsdt.toFixed(2)} <span className="text-xs font-semibold text-emerald-400">USDT</span>
                  {spotUsdc > 0 && (
                    <span className="text-sm font-normal text-slate-400">
                      / ${spotUsdc.toFixed(2)} USDC
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">Disponível para ordens de compra Spot</div>
          </div>
          <div className="hidden sm:block text-right">
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-300">
              Spot LONG
            </span>
          </div>
        </div>

        {/* Card Saldo Futuros */}
        <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-4 shadow-lg flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-300">
              <Wallet className="h-4 w-4 text-purple-400" /> Saldo Livre Futuros (Perpétuo)
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-black text-white flex items-baseline gap-2">
              {loadingBalances ? (
                <span className="text-slate-400 text-sm flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-purple-400" /> Consultando...
                </span>
              ) : (
                <>
                  ${futuresUsdt.toFixed(2)} <span className="text-xs font-semibold text-purple-400">USDT</span>
                  {futuresUsdc > 0 && (
                    <span className="text-sm font-normal text-slate-400">
                      / ${futuresUsdc.toFixed(2)} USDC
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">Margem livre para ordens de Short Perpétuo</div>
          </div>
          <div className="hidden sm:block text-right">
            <span className="rounded-full bg-purple-500/10 border border-purple-500/30 px-3 py-1 text-xs font-bold text-purple-300">
              Perp SHORT
            </span>
          </div>
        </div>
      </div>

      {/* Linha 2: Métricas do Robô */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Card 1: Operações em Aberto */}
        <div className="rounded-xl border border-white/10 bg-slate-950/70 p-4 shadow-lg">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-gray-400">
            <Activity className="h-4 w-4 text-indigo-400" /> Operações em Aberto
          </div>
          <div className="mt-2 text-3xl font-bold text-white">{openCount}</div>
          <div className="text-xs text-gray-500">de {totalMonitored} monitoradas</div>
        </div>

        {/* Card 2: Operações Encerradas + APR & Retorno Mensal (a.m.) */}
        <div className="rounded-xl border border-white/10 bg-slate-950/70 p-4 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-gray-400">
              <TrendingUp className="h-4 w-4 text-emerald-400" /> Operações Encerradas
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className="text-3xl font-bold text-white">{executedCount}</div>
              {globalClosedApr !== null && globalClosedApr > 0 && (
                <div className="flex flex-col items-end">
                  <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-xs font-extrabold text-emerald-300">
                    📈 APR: +{globalClosedApr.toFixed(1)}% a.a.
                  </span>
                  <span className="text-[11px] font-extrabold text-emerald-400 mt-1 pr-1">
                    📅 +{(globalClosedApr / 12).toFixed(1)}% a.m.
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {totalEntryVolume > 0 ? (
              <span>Entrada: ${totalEntryVolume.toFixed(2)} → Saída: ${totalExitVolume.toFixed(2)}</span>
            ) : (
              'histórico de encerramentos'
            )}
          </div>
        </div>

        {/* Card 3: P&L Total Realizado */}
        <div className="rounded-xl border border-white/10 bg-slate-950/70 p-4 shadow-lg">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-gray-400">
            <DollarSign className="h-4 w-4 text-cyan-400" /> P&amp;L Total
          </div>
          <div className={`mt-2 text-3xl font-bold ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)} USDT
          </div>
          <div className="text-xs text-gray-500">realizado</div>
        </div>
      </div>
    </div>
  );
}
