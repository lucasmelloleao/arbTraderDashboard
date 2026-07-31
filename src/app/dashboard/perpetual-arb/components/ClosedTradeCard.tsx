'use client';

import React from 'react';
import { PerpArbTrade } from '../types';

interface ClosedTradeCardProps {
  trade: PerpArbTrade;
  allTrades?: PerpArbTrade[];
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '< 1s';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function ClosedTradeCard({ trade, allTrades = [] }: ClosedTradeCardProps) {
  const stratObj = typeof trade.strategyId === 'object' && trade.strategyId !== null ? trade.strategyId : {};
  const strategyName = trade.strategyName || stratObj.name || (trade.perpSymbol ? `[EXECUTADA] ${trade.perpSymbol}` : 'Operação Casada');
  const perpSym = trade.perpSymbol || stratObj.perpSymbol || 'N/A';
  const spotSym = trade.spotSymbol || stratObj.spotSymbol || 'N/A';
  const isClose = trade.type === 'close_hedge';
  const hasPnl = trade.pnl !== null && trade.pnl !== undefined;
  const pnlVal = Number(trade.pnl || 0);
  const isProfit = hasPnl && pnlVal >= 0;
  const amount = trade.amount || 0;
  const pnlPct = amount > 0 ? (pnlVal / amount) * 100 : 0;

  // Localiza o trade de abertura correspondente (open_hedge)
  const closeStratId = typeof trade.strategyId === 'object' && trade.strategyId !== null ? String((trade.strategyId as any)._id) : String(trade.strategyId || '');
  const matchingOpenTrade = allTrades.find((t) => {
    if (t.type !== 'open_hedge' || (t.status !== 'executed' && t.status !== 'simulated')) return false;
    const sId = typeof t.strategyId === 'object' && t.strategyId !== null ? String((t.strategyId as any)._id) : String(t.strategyId || '');
    const matchStrat = closeStratId && sId && closeStratId === sId;
    const matchSymbol = t.perpSymbol && trade.perpSymbol && t.perpSymbol === trade.perpSymbol;
    return (matchStrat || matchSymbol) && new Date(t.createdAt).getTime() <= new Date(trade.createdAt).getTime();
  });

  // Localiza pagamentos de funding acumulados durante a operação
  const matchingFundingTrades = allTrades.filter((t) => {
    if (t.type !== 'funding_fee_accumulated') return false;
    const sId = typeof t.strategyId === 'object' && t.strategyId !== null ? String((t.strategyId as any)._id) : String(t.strategyId || '');
    const matchStrat = closeStratId && sId && closeStratId === sId;
    const matchSymbol = t.perpSymbol && trade.perpSymbol && t.perpSymbol === trade.perpSymbol;
    return matchStrat || matchSymbol;
  });

  const fundingCollectedVal = matchingFundingTrades.reduce((acc, t) => acc + Number(t.pnl || 0), 0);
  const fundingCountVal = matchingFundingTrades.reduce((acc, t) => acc + (t.fundingCount || (t.fundingHistory?.length ? t.fundingHistory.length : (t.pnl ? 1 : 0))), 0);
  const fundingHistoryList = matchingFundingTrades.flatMap((t) => t.fundingHistory && t.fundingHistory.length > 0 ? t.fundingHistory : (t.pnl ? [{ amount: t.pnl, timestamp: t.createdAt }] : []));

  const openSpotPrice = matchingOpenTrade?.spotPrice;
  const openPerpPrice = matchingOpenTrade?.perpPrice;
  const closeSpotPrice = trade.spotPrice;
  const closePerpPrice = trade.perpPrice;

  // Cálculo per-leg
  const spotUnits = openSpotPrice && openSpotPrice > 0 ? amount / openSpotPrice : 0;
  const perpUnits = openPerpPrice && openPerpPrice > 0 ? amount / openPerpPrice : 0;

  const spotPnL = spotUnits > 0 && closeSpotPrice ? (closeSpotPrice - openSpotPrice) * spotUnits : null;
  const perpPnL = perpUnits > 0 && closePerpPrice ? (openPerpPrice - closePerpPrice) * perpUnits : null;

  const spreadAtOpen = openSpotPrice && openPerpPrice && openSpotPrice > 0 ? ((openPerpPrice - openSpotPrice) / openSpotPrice) * 100 : null;
  const spreadAtClose = closeSpotPrice && closePerpPrice && closeSpotPrice > 0 ? ((closeSpotPrice - closePerpPrice) / closeSpotPrice) * 100 : null;

  const openedAtRaw = trade.openedAt || matchingOpenTrade?.createdAt;
  const hasOpenDate = Boolean(openedAtRaw);

  const openTime = hasOpenDate ? new Date(openedAtRaw!).getTime() : 0;
  const closeTime = new Date(trade.createdAt).getTime();
  const durationMs = hasOpenDate ? Math.max(0, closeTime - openTime) : 0;

  // Cálculo da Taxa Anualizada de Retorno Realizada (APR %)
  const durationHours = durationMs > 0 ? durationMs / (1000 * 60 * 60) : 0;
  const realizedApr = (amount > 0 && durationHours >= 0.01 && hasPnl)
    ? (pnlVal / amount) * (8760 / durationHours) * 100
    : null;

  const fmtUSDT = (val: number) => {
    return val >= 0 ? `+$${val.toFixed(4)}` : `-$${Math.abs(val).toFixed(4)}`;
  };

  const fmtP = (val?: number) => {
    if (val === undefined || val === null) return '—';
    if (val < 0.1) return val.toFixed(6);
    return val.toFixed(4);
  };

  return (
    <div className={`rounded-xl border p-5 flex flex-col justify-between shadow-lg ${isClose ? (isProfit ? 'border-emerald-500/40 bg-emerald-950/20' : 'border-red-500/40 bg-red-950/20') : 'border-indigo-500/30 bg-slate-900'}`}>
      <div>
        {/* Header com Nome e Duração */}
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div>
            <h3 className="text-base font-extrabold text-white">
              {strategyName ? strategyName.replace(/^\[SCAN.*?\]\s*/i, '').replace(':USDT', '').replace(':USDC', '') : perpSym.replace(':USDT', '')}
            </h3>
            <div className="text-xs text-indigo-300 font-medium font-mono">
              {perpSym.replace(':USDT', '')} / {spotSym}
            </div>
          </div>
          <div className="text-right">
            {hasOpenDate && durationMs > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-1 text-xs font-bold text-indigo-300">
                ⏱️ {formatDuration(durationMs)}
              </span>
            )}
          </div>
        </div>

        {/* Destaque Side-by-Side: Entrada vs Encerramento */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {/* 1. Valor de Entrada */}
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-3.5 flex flex-col justify-between">
            <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">
              💵 Valor de Entrada
            </span>
            <div className="mt-1 text-xl sm:text-2xl font-black text-white">
              ${amount.toFixed(2)} <span className="text-xs font-normal text-slate-400">USDT</span>
            </div>
            {openSpotPrice ? (
              <span className="text-[11px] text-slate-400 font-mono mt-1">
                ~{(amount / openSpotPrice).toFixed(2)} base
              </span>
            ) : null}
          </div>

          {/* 2. Valor Final de Encerramento */}
          <div className={`rounded-xl border p-3.5 flex flex-col justify-between ${isProfit ? 'border-emerald-500/40 bg-emerald-950/25' : 'border-red-500/40 bg-red-950/25'}`}>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              🏁 Valor Final
            </span>
            <div className="mt-1 text-xl sm:text-2xl font-black text-white">
              ${(amount + (hasPnl ? pnlVal : 0)).toFixed(2)} <span className="text-xs font-normal text-slate-400">USDT</span>
            </div>
            {hasPnl ? (
              <div className={`text-xs font-extrabold mt-1 ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                {isProfit ? '+' : ''}${pnlVal.toFixed(4)} ({isProfit ? '+' : ''}{pnlPct.toFixed(2)}%)
              </div>
            ) : (
              <span className="text-xs text-slate-400 font-mono mt-1">Concluído</span>
            )}
          </div>
        </div>

        {/* Decomposição Completa Entrada X Saída por Perna */}
        <div className="mt-3 space-y-2 rounded-lg bg-slate-950/90 border border-white/10 p-3 text-xs">
          <div className="font-semibold text-slate-300 border-b border-white/5 pb-1 flex justify-between">
            <span>Preços (Entrada → Saída) &amp; Resultados:</span>
            <span className="text-[10px] text-gray-400 font-normal">Hedge 1X</span>
          </div>

          {/* Perna 1: Spot LONG */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-gray-300">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Spot (LONG)
              </span>
              <span className="text-slate-400 font-mono text-[11px]">
                ${fmtP(openSpotPrice)} → ${fmtP(closeSpotPrice)}
              </span>
            </div>
            <div className={`font-mono font-bold ${spotPnL !== null && spotPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {spotPnL !== null ? fmtUSDT(spotPnL) : '—'}
            </div>
          </div>

          {/* Perna 2: Perp SHORT */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-gray-300">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Perpétuo (SHORT)
              </span>
              <span className="text-slate-400 font-mono text-[11px]">
                ${fmtP(openPerpPrice)} → ${fmtP(closePerpPrice)}
              </span>
            </div>
            <div className={`font-mono font-bold ${perpPnL !== null && perpPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {perpPnL !== null ? fmtUSDT(perpPnL) : '—'}
            </div>
          </div>

          {/* Funding Coletado no Período com Tooltip de Extrato */}
          <div className="group relative flex items-center justify-between border-t border-white/5 pt-1.5 cursor-pointer">
            <div className="flex items-center gap-1.5 text-gray-300">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                🌾 Funding Coletado ({fundingCountVal > 0 ? `${fundingCountVal} ${fundingCountVal === 1 ? 'colheita' : 'colheitas'}` : 'Acumulado'})
              </span>
              <span className="text-slate-400 text-[11px]">Acumulado Corretora</span>
            </div>
            <div className="font-mono font-bold text-cyan-300">
              +{fmtUSDT(fundingCollectedVal).replace('+', '')}
            </div>

            {/* Hover Tooltip Extrato */}
            {fundingHistoryList.length > 0 && (
              <div className="pointer-events-none absolute bottom-full right-0 mb-2 hidden group-hover:block w-72 rounded-lg bg-slate-950 border border-cyan-500/40 p-3 shadow-2xl z-50 text-[11px] backdrop-blur-md">
                <div className="font-semibold text-cyan-300 mb-1.5 border-b border-white/10 pb-1 flex justify-between">
                  <span>🌾 Extrato de Colheitas ({fundingHistoryList.length})</span>
                  <span>Valor</span>
                </div>
                <div className="max-h-44 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {fundingHistoryList.map((item: any, idx: number) => {
                    const dateStr = item.timestamp
                      ? new Date(item.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
                      : `Colheita #${idx + 1}`;
                    return (
                      <div key={idx} className="flex justify-between items-center text-slate-300 font-mono text-[10px]">
                        <span className="text-slate-400">{dateStr}</span>
                        <span className="text-emerald-400 font-bold">
                          +${Number(item.amount || item.pnl || 0).toFixed(4)} USDT
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Detalhes do Alvo vs Spread Atingido */}
        <div className="mt-3 rounded-lg bg-slate-900/60 border border-indigo-500/20 p-2.5 space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">🎯 Alvo de Spread Configurado:</span>
            <span className="font-mono font-bold text-indigo-300">+0.30%</span>
          </div>
          {spreadAtClose !== null && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">📊 Spread Atingido no Encerramento:</span>
              <span className={`font-mono font-extrabold ${spreadAtClose >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {spreadAtClose >= 0 ? '+' : ''}{spreadAtClose.toFixed(3)}%
              </span>
            </div>
          )}
        </div>

        {/* Rodapé com Datas de Abertura, Encerramento e Motivo */}
        <div className="mt-3 space-y-1.5 text-xs text-gray-400 border-t border-white/5 pt-2.5">
          {hasOpenDate && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1">
                🚀 <strong className="text-slate-300 font-semibold">Abertura:</strong>
              </span>
              <span className="font-mono font-medium text-slate-200">
                {new Date(openedAtRaw!).toLocaleString()}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1">
              🏁 <strong className="text-slate-300 font-semibold">Encerramento:</strong>
            </span>
            <span className="font-mono font-medium text-slate-200">
              {new Date(trade.createdAt).toLocaleString()}
            </span>
          </div>
          {hasOpenDate && durationMs > 0 && (
            <div className="flex items-center justify-between border-t border-white/5 pt-1 text-[11px]">
              <span className="text-indigo-300 font-semibold flex items-center gap-1">
                ⏱️ Tempo em Aberto:
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-indigo-300">
                  {formatDuration(durationMs)}
                </span>
                {realizedApr !== null && realizedApr > 0 && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black border bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                    📈 APR Realizado: +{realizedApr.toFixed(1)}% a.a.
                  </span>
                )}
              </div>
            </div>
          )}
          {trade.reason && (
            <div className="flex items-center justify-between border-t border-white/5 pt-1 text-[11px]">
              <span className="text-amber-300 font-semibold flex items-center gap-1">
                📌 Motivo do Encerramento:
              </span>
              <span className="font-mono font-bold text-amber-200">
                {trade.reason}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
