'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, Power, XCircle } from 'lucide-react';
import { FundingCountdown } from './FundingCountdown';
import { PerpArbTrade } from '../types';

interface OpenPositionCardProps {
  strategy: any;
  trades: PerpArbTrade[];
  livePositions?: any[];
  liveSpotCoins?: any[];
  isClosingThis: boolean;
  onClosePosition: (strategy: any) => void;
  onVoidClose: (strategy: any) => void;
  onIncreasePosition: (strategy: any) => void;
}

function formatElapsed(openedAt: string | Date | undefined): string {
  if (!openedAt) return 'Recentemente';
  const start = new Date(openedAt).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - start);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function OpenPositionCard({
  strategy: s,
  trades,
  livePositions = [],
  liveSpotCoins = [],
  isClosingThis,
  onClosePosition,
  onVoidClose,
  onIncreasePosition,
}: OpenPositionCardProps) {
  // Posição FUTURA REAL da corretora (entry/mark/PnL) correspondente a este par, vinda
  // do /api/portfolio/live. Reflete a MEXC com fidelidade (em vez de preços gravados).
  const livePos = (livePositions || []).find((lp: any) => {
    const lpSym = String(lp.symbol || '').toLowerCase();
    const perpSym = (s.perpSymbol || '').toLowerCase();
    return lpSym === perpSym || lpSym.replace('/usdt:usdt', '/usdt') === perpSym;
  });

  // Moeda SPOT real correspondente à base deste par (ex.: "BTW" de "BTW/USDT").
  // Usa o cost basis médio real (avgCostPrice) e o P&L real da posição spot da
  // corretora, em vez do preço gravado no trade de abertura (que não bate com a MEXC).
  const spotBase = String(s.spotSymbol || s.perpSymbol || '').split('/')[0].trim();
  const spotCoin = (liveSpotCoins || []).find((c: any) => String(c.asset || '').toUpperCase() === spotBase.toUpperCase());

  const stratTrades = trades.filter((t) => {
    const sId = typeof t.strategyId === 'object' && t.strategyId !== null ? (t.strategyId as any)._id : t.strategyId;
    return String(sId) === String(s._id) || t.perpSymbol === s.perpSymbol;
  });

  const openHedgeTrades = stratTrades.filter((t) => t.type === 'open_hedge' && (t.status === 'executed' || t.status === 'simulated'));
  const openTrade = openHedgeTrades.length > 0
    ? openHedgeTrades.reduce((latest, current) => new Date(current.createdAt).getTime() > new Date(latest.createdAt).getTime() ? current : latest)
    : undefined;
  const openedAt = s.positionOpenedAt || openTrade?.createdAt;

  const [elapsedStr, setElapsedStr] = useState(() => formatElapsed(openedAt));

  useEffect(() => {
    setElapsedStr(formatElapsed(openedAt));
    const interval = setInterval(() => {
      setElapsedStr(formatElapsed(openedAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [openedAt]);

  // Entrada FIXA da posição: prioriza o registro real de execução do trade de abertura (openTrade)
  const initialEntryRef = React.useRef<{ entrySpot: number; entryPerp: number; entryContracts: number; positionSize: number } | null>(null);

  const currentEntrySpot = openTrade?.spotPrice && Number(openTrade.spotPrice) > 0
    ? Number(openTrade.spotPrice)
    : (livePos && Number(livePos.entryPrice) > 0 ? Number(livePos.entryPrice) : Number(s.lastSpotPrice || 0));

  const currentEntryPerp = openTrade?.perpPrice && Number(openTrade.perpPrice) > 0
    ? Number(openTrade.perpPrice)
    : (livePos && Number(livePos.entryPrice) > 0 ? Number(livePos.entryPrice) : Number(s.lastPerpPrice || 0));

  const currentPositionSize = Number(s.positionSize) > 0
    ? Number(s.positionSize)
    : (openTrade?.amount && Number(openTrade.amount) > 0 ? Number(openTrade.amount) : Number(s.tradeSize || 0));

  const currentEntryContracts = currentEntrySpot > 0 ? currentPositionSize / currentEntrySpot : 0;

  const entrySpot = currentEntrySpot;
  const entryPerp = currentEntryPerp;
  const entryContracts = currentEntryContracts;
  const positionSize = currentPositionSize;

  // Preço real de marca da corretora (usado para P&L) e tickers para a saída estimada.
  const liveMarkPrice = livePos ? Number(livePos.markPrice) || 0 : 0;

    // Preço REAL de Execução a Mercado se fosse fechar AGORA:
  // - Vende SPOT no BID (preço de comprador no livro Spot). Prioriza o preço spot
  //   ATUAL vindo do /api/portfolio/live (fetchTicker na hora), pois o s.lastSpotPrice
  //   pode estar congelado no valor gravado no trade de abertura.
  // - Compra PERP no ASK (preço de vendedor no livro Futuros)
  const exitSpotPrice = spotCoin && Number(spotCoin.price) > 0
    ? Number(spotCoin.price)
    : (s.lastSpotBid || s.lastSpotPrice || entrySpot);
  const exitPerpPrice = liveMarkPrice || s.lastPerpAsk || s.lastPerpPrice || entryPerp;

  const spotUnits = entrySpot > 0 ? positionSize / entrySpot : 0;
  const perpUnits = entryPerp > 0 ? positionSize / entryPerp : 0;

  // PnL REAL de saída instantânea a mercado calculated de forma simétrica em ambas as pernas
  const spotPnL = spotUnits > 0 && exitSpotPrice > 0 ? (exitSpotPrice - entrySpot) * spotUnits : 0;
  const perpPnL = perpUnits > 0 && exitPerpPrice > 0 ? (entryPerp - exitPerpPrice) * perpUnits : 0;
  const marketPnL = spotPnL + perpPnL;

  const openedTime = openedAt ? new Date(openedAt).getTime() : 0;

  const accumulatedFundingTrades = stratTrades.filter((t) => {
    if (t.type !== 'funding_fee_accumulated') return false;
    if (openedTime) {
      const tTime = new Date(t.createdAt).getTime();
      return tTime >= openedTime;
    }
    return true;
  });
  const sumAccumulatedFunding = accumulatedFundingTrades.reduce((acc, trade) => acc + Number(trade.pnl || 0), 0);

  const rawFundingHistory = s.fundingHistory && s.fundingHistory.length > 0 ? s.fundingHistory : [];
  const filteredStrategyFundingHistory = rawFundingHistory.filter((h: any) => {
    if (!openedTime || !h.timestamp) return true;
    return new Date(h.timestamp).getTime() >= openedTime;
  });
  const sumStrategyFundingHistory = filteredStrategyFundingHistory.reduce((acc: number, h: any) => acc + Number(h.amount || 0), 0);

  const fundingCollected = filteredStrategyFundingHistory.length > 0 ? sumStrategyFundingHistory : sumAccumulatedFunding;
  const fundingHistoryList = filteredStrategyFundingHistory.length > 0
    ? filteredStrategyFundingHistory
    : accumulatedFundingTrades.flatMap((t: any) => t.fundingHistory || [{ amount: t.pnl, timestamp: t.createdAt }]);
  const fundingCount = fundingHistoryList.length;

  const estimatedTradingFees = positionSize * 0.0012;
  const totalUnrealizedPnL = marketPnL + fundingCollected;
  const netProfitPostFees = totalUnrealizedPnL - estimatedTradingFees;

  const estimatedExitValue = positionSize + totalUnrealizedPnL;
  const unrealizedPct = positionSize > 0 ? (totalUnrealizedPnL / positionSize) * 100 : 0;

  const latestFundingTrade = stratTrades.find((t) => (t.fundingPct !== undefined && t.fundingPct !== null));
  const currentFundingVal = (s.currentFundingRate !== undefined && s.currentFundingRate !== null)
    ? s.currentFundingRate
    : (latestFundingTrade?.fundingPct ?? openTrade?.fundingPct ?? null);
  const fundingAtOpenVal = s.fundingAtOpen !== undefined && s.fundingAtOpen !== null ? s.fundingAtOpen : openTrade?.fundingPct;

  // Spread REAL de Saída a Mercado: (Bid Spot vs Ask Perp)
  const currentSpread = exitPerpPrice > 0 ? ((exitSpotPrice - exitPerpPrice) / exitPerpPrice) * 100 : 0;
  const spreadUsd = positionSize * (currentSpread / 100);
  const currentApr = (currentFundingVal !== null ? Number(currentFundingVal) : 0) * 3 * 365;
  const estLiqPrice = livePos && Number(livePos.liquidationPrice) > 0
    ? Number(livePos.liquidationPrice)
    : (entryPerp > 0 ? entryPerp * 1.95 : null);

  const fmtUSDT = (val: number) => {
    const s = val >= 0 ? `+$${val.toFixed(4)}` : `-$${Math.abs(val).toFixed(4)}`;
    return s;
  };

  const fmtP = (val: number) => {
    if (!val) return '0.00';
    if (val < 0.1) return val.toFixed(6);
    if (val < 1) return val.toFixed(4);
    return val.toFixed(4);
  };

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-slate-950 p-5 flex flex-col justify-between shadow-xl">
      <div>
        {/* Header com símbolo e ações rápidas */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3">
          <div>
            <div className="text-base font-bold text-white flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
              {s.name ? s.name.replace(/^\[SCAN.*?\]\s*/i, '').replace(':USDT', '').replace(':USDC', '') : `${s.perpSymbol} / ${s.spotSymbol}`}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{s.perpSymbol ? s.perpSymbol.replace(':USDT', '') : ''} / {s.spotSymbol}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-indigo-500/20 px-2.5 py-1 text-xs font-bold text-indigo-300 border border-indigo-500/30">
              ⏱️ Aberto há {elapsedStr}
            </span>
            <button
              disabled={isClosingThis}
              onClick={() => onIncreasePosition(s)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 text-xs font-bold shadow-[0_0_12px_rgba(79,70,229,0.4)] transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Aumentar aporte da posição comprando Spot e Short Perpétuo"
            >
              <RefreshCw className="h-3.5 w-3.5" /> + Aumentar Aporte
            </button>
            <button
              disabled={isClosingThis}
              onClick={() => onClosePosition(s)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600/90 hover:bg-red-500 text-white px-3 py-1.5 text-xs font-bold shadow-[0_0_12px_rgba(220,38,38,0.4)] transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Encerrar posição a mercado imediatamente"
            >
              {isClosingThis ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Encerrando...
                </>
              ) : (
                <>
                  <Power className="h-3.5 w-3.5" /> Encerrar Agora
                </>
              )}
            </button>
            <button
              disabled={isClosingThis}
              onClick={() => onVoidClose(s)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-700/80 hover:bg-slate-600 text-slate-300 hover:text-white px-3 py-1.5 text-xs font-bold border border-slate-600/50 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Marcar como encerrada pela corretora (sem executar ordens, PnL = zero)"
            >
              <XCircle className="h-3.5 w-3.5" /> Encerrada pela Corretora
            </button>
          </div>
        </div>

        {/* BLOCAÇO DE DESTAQUE: Valor de Entrada vs Valor Atual de Encerramento */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {/* 1. Valor de Entrada */}
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-3.5 flex flex-col justify-between">
            <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">
              💵 Valor de Entrada
            </span>
            <div className="mt-1 text-xl sm:text-2xl font-black text-white">
              ${positionSize.toFixed(2)} <span className="text-xs font-normal text-slate-400">USDT</span>
            </div>
            {entrySpot ? (
              <span className="text-[11px] text-slate-400 font-mono mt-1">
                ~{(positionSize / entrySpot).toFixed(2)} base
              </span>
            ) : null}
          </div>

          {/* 2. Valor Atual de Encerramento (Retorno Líquido no Bolso) */}
          <div className={`rounded-xl border p-3.5 flex flex-col justify-between ${netProfitPostFees >= 0 ? 'border-emerald-500/40 bg-emerald-950/25' : 'border-red-500/40 bg-red-950/25'}`}>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              🏁 Retorno Líquido Estimado
            </span>
            <div className="mt-1 text-xl sm:text-2xl font-black text-white">
              ${(positionSize + netProfitPostFees).toFixed(2)} <span className="text-xs font-normal text-slate-400">USDT</span>
            </div>
            <div className="mt-1 flex flex-col">
              <span className={`text-xs font-extrabold ${netProfitPostFees >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {netProfitPostFees >= 0 ? '+' : ''}${netProfitPostFees.toFixed(4)} ({netProfitPostFees >= 0 ? '+' : ''}{positionSize > 0 ? ((netProfitPostFees / positionSize) * 100).toFixed(2) : 0}%)
              </span>
              <span className="text-[10px] text-slate-400">
                Já descontado: spread (Bid/Ask) + taxas de ordem
              </span>
            </div>
          </div>
        </div>

        {/* Status de Break-even / Cobertura de Taxas */}
        {netProfitPostFees < 0 ? (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2 text-[11px] text-amber-300 flex items-center justify-between font-medium">
            <span>⏳ Faltam +${Math.abs(netProfitPostFees).toFixed(4)} USDT p/ cobrir taxas de ordem</span>
            <span className="font-bold text-amber-400">Aguardando Funding</span>
          </div>
        ) : (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2 text-[11px] text-emerald-300 flex items-center justify-between font-medium">
            <span>✅ Lucro Real Garantido! Taxas de ordem já cobertas</span>
            <span className="font-bold text-emerald-400">Pronto p/ Lucrar</span>
          </div>
        )}

        {/* Decomposição Explícita por Perna */}
        <div className="mt-3 space-y-2.5 rounded-lg bg-slate-900/90 border border-white/10 p-3.5 text-xs">
          <div className="font-semibold text-slate-200 border-b border-white/10 pb-1.5 flex justify-between items-center">
            <span className="text-sm">📊 PnL por Perna &amp; Diferença Liquida</span>
            <span className="text-[10px] text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-500/30">Hedge 1X (Delta Neutro)</span>
          </div>

          {/* Perna 1: Spot LONG */}
          <div className="p-2 rounded bg-slate-950/60 border border-emerald-500/20 flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Spot (LONG)
                </span>
                <span className="text-slate-300 font-semibold">{s.spotSymbol || 'Spot'}</span>
              </div>
              {entrySpot > 0 && (
                <span className="text-slate-400 font-mono text-[11px]">
                  Entrada: ${fmtP(entrySpot)} → Atual (Bid): ${fmtP(exitSpotPrice)}
                </span>
              )}
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase">PnL Spot</div>
              <div className={`font-mono font-bold text-sm ${spotPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmtUSDT(spotPnL)} USDT
              </div>
            </div>
          </div>

          {/* Perna 2: Perp SHORT */}
          <div className="p-2 rounded bg-slate-950/60 border border-purple-500/20 flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Perpétuo (SHORT)
                </span>
                <span className="text-slate-300 font-semibold">{s.perpSymbol || 'Perp'}</span>
              </div>
              {entryPerp > 0 && (
                <span className="text-slate-400 font-mono text-[11px]">
                  Entrada: ${fmtP(entryPerp)} → Atual (Ask/Mark): ${fmtP(exitPerpPrice)}
                </span>
              )}
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase">PnL Futuro (Não Realizado)</div>
              <div className={`font-mono font-bold text-sm ${perpPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmtUSDT(perpPnL)} USDT
              </div>
            </div>
          </div>

          {/* Resumo Diferença/Soma dos PnLs das Pernas */}
          <div className="p-2 rounded bg-indigo-950/30 border border-indigo-500/30 flex items-center justify-between font-mono">
            <span className="text-indigo-200 text-[11px] font-sans font-medium">
              ⚖️ Soma/Diferença das Pernas (Spot + Futuro):
            </span>
            <span className={`font-bold ${marketPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmtUSDT(marketPnL)} USDT
            </span>
          </div>

          {/* Perna 3: Funding Coletado com Hover Tooltip */}
          <div className="group relative flex items-center justify-between border-t border-white/5 pt-1.5 cursor-pointer">
            <div className="flex items-center gap-1.5 text-gray-300">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                🌾 Funding Coletado ({fundingCount > 0 ? `${fundingCount} ${fundingCount === 1 ? 'colheita' : 'colheitas'}` : 'Acumulado'})
              </span>
              <span className="text-slate-400 text-[11px]">Pagamento Corretora</span>
            </div>
            <div className="font-mono font-bold text-cyan-300">
              +${fundingCollected.toFixed(4)} USDT
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

        {/* Métricas Avançadas p/ Tomada de Decisão */}
        <div className="mt-3 rounded-lg bg-slate-900/60 border border-indigo-500/20 p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between text-[11px] border-b border-white/5 pb-1 text-slate-400">
            <span>⏱️ Próximo Funding:</span>
            <FundingCountdown />
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-slate-400">Spread Real de Saída: </span>
              <span className={`font-mono font-semibold ${currentSpread >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {currentSpread >= 0 ? '+' : ''}{currentSpread.toFixed(3)}% ({currentSpread >= 0 ? '+' : ''}${spreadUsd.toFixed(4)} USDT)
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-400">Retorno Anualizado (APR): </span>
              <span className="font-mono font-bold text-emerald-400">
                +{currentApr.toFixed(1)}% a.a.
              </span>
            </div>
          </div>
          {estLiqPrice && (
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/5">
              <span className="text-slate-400">🛡️ Preço Liq. Est. (Short 1X):</span>
              <span className="font-mono text-amber-300 font-medium">${fmtP(estLiqPrice)} (~95% margem seg.)</span>
            </div>
          )}
        </div>

        {/* Footer com Tempo em Aberto e Datas */}
        <div className="mt-3 grid gap-2 sm:grid-cols-4 text-xs text-gray-300 border-t border-white/5 pt-2 font-sans">
          <div>🚀 Aberto em: <span className="text-slate-300 font-medium block sm:inline">{openedAt ? new Date(openedAt).toLocaleString() : 'Recentemente'}</span></div>
          <div>⏱️ Aberto em: <span className="text-indigo-300 font-bold block sm:inline">{elapsedStr}</span></div>
          <div>
            🌾 Funding Abertura:{' '}
            <span className="font-semibold text-indigo-300 block sm:inline">
              {fundingAtOpenVal !== undefined && fundingAtOpenVal !== null ? `${Number(fundingAtOpenVal).toFixed(4)}%` : '—'}
            </span>
          </div>
          <div>
            📊 Funding Rate Atual:{' '}
            <span className="font-semibold text-emerald-400 block sm:inline">
              {currentFundingVal !== undefined && currentFundingVal !== null ? `${Number(currentFundingVal).toFixed(4)}%` : '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
