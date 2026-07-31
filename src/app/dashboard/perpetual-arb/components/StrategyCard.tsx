'use client';

import React, { useState } from 'react';
import { AlertTriangle, Shield, ChevronDown, ChevronUp, Building2, Link2, Pause, Play, TimerReset, Pencil, Trash2 } from 'lucide-react';
import { PerpArbStrategy } from '../types';

function msToDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function cooldownStatus(strategy: any) {
  if (!strategy.cooldownAfterLossMs || !strategy.lastLossAt) return { active: false, remainingMs: 0 };
  const elapsed = Date.now() - new Date(strategy.lastLossAt).getTime();
  const remaining = strategy.cooldownAfterLossMs - elapsed;
  return { active: remaining > 0, remainingMs: Math.max(0, remaining) };
}

interface StrategyCardProps {
  strategy: PerpArbStrategy;
  onUpdate: (s: Partial<PerpArbStrategy> & { _id: string }) => void;
  onDelete: (s: PerpArbStrategy) => void;
  onEdit: (s: PerpArbStrategy) => void;
}

export function StrategyCard({ strategy, onUpdate, onDelete, onEdit }: StrategyCardProps) {
  const [expanded, setExpanded] = useState(false);
  const fundingNow = strategy.currentFundingRate;
  const fundingAboveMin = fundingNow !== null && fundingNow !== undefined && fundingNow >= strategy.minFundingRatePct;
  const cdStatus = cooldownStatus(strategy);
  const dailyLossPct = strategy.maxDailyLoss > 0 ? (((strategy as any).dailyLossAccum ?? 0) / strategy.maxDailyLoss) * 100 : 0;

  return (
    <div className={`rounded-xl border bg-slate-900 p-4 transition-colors ${cdStatus.active ? 'border-amber-500/40' : 'border-white/10'}`}>
      {/* Cooldown banner */}
      {cdStatus.active && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Em cooldown — retoma em {msToDuration(cdStatus.remainingMs)}
        </div>
      )}

      {/* Title row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-100">{strategy.name}</div>
          <div className="text-sm text-gray-400">{strategy.perpSymbol} / {strategy.spotSymbol}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={strategy.active ? 'rounded-full bg-emerald-500/15 px-2 py-1 text-[11px] uppercase tracking-[0.2em] text-emerald-200' : 'rounded-full bg-amber-500/15 px-2 py-1 text-[11px] uppercase tracking-[0.2em] text-amber-200'}>
            {strategy.active ? 'Ativa' : 'Inativa'}
          </span>
          <span className={strategy.autoExecute ? 'rounded-full bg-cyan-500/15 px-2 py-1 text-[11px] uppercase tracking-[0.2em] text-cyan-200' : 'rounded-full bg-slate-500/15 px-2 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-200'}>
            {strategy.autoExecute ? 'Auto' : 'Manual'}
          </span>
        </div>
      </div>

      {/* Core stats */}
      <div className="mt-3 grid gap-2 sm:grid-cols-3 text-sm text-gray-400">
        <div>Trade size: <span className="text-slate-200">{strategy.tradeSize} USDT</span></div>
        <div>Min funding: <span className="text-slate-200">{strategy.minFundingRatePct}%</span></div>
        <div>
          Funding atual:{' '}
          {fundingNow !== null && fundingNow !== undefined ? (
            <span className={fundingAboveMin ? 'font-semibold text-emerald-400' : 'text-slate-200'}>
              {fundingNow.toFixed(4)}%{fundingAboveMin && ' ✓'}
            </span>
          ) : <span className="text-gray-600">—</span>}
        </div>
      </div>

      {/* Daily loss progress bar */}
      {strategy.maxDailyLoss > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
            <span>Perda diária</span>
            <span className={dailyLossPct >= 80 ? 'text-red-400 font-semibold' : 'text-gray-400'}>
              {((strategy as any).dailyLossAccum ?? 0).toFixed(2)} / {strategy.maxDailyLoss} USDT ({dailyLossPct.toFixed(0)}%)
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${dailyLossPct >= 80 ? 'bg-red-500' : dailyLossPct >= 50 ? 'bg-amber-400' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, dailyLossPct)}%` }}
            />
          </div>
        </div>
      )}

      {/* Expandable protection details */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-3 flex w-full items-center gap-1.5 rounded-lg border border-white/5 bg-slate-800/50 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 transition-colors"
      >
        <Shield className="h-3.5 w-3.5 text-amber-400" />
        Proteção
        {expanded ? <ChevronUp className="ml-auto h-3.5 w-3.5" /> : <ChevronDown className="ml-auto h-3.5 w-3.5" />}
      </button>
      {expanded && (
        <div className="mt-2 space-y-2 rounded-lg border border-amber-500/15 bg-amber-500/5 p-3 text-xs text-gray-400">
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              Max slippage
              <div className="mt-0.5 font-semibold text-amber-300">{strategy.maxSlippagePct ?? 0.05}%</div>
            </div>
            <div>
              Max perda/dia
              <div className="mt-0.5 font-semibold text-amber-300">{strategy.maxDailyLoss ?? 10} USDT</div>
            </div>
            <div>
              Cooldown após perda
              <div className="mt-0.5 font-semibold text-amber-300">{msToDuration(strategy.cooldownAfterLossMs ?? 3600000)}</div>
            </div>
          </div>
          {/* Exchange info */}
          <div className="grid gap-2 sm:grid-cols-2 border-t border-white/5 pt-2">
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3 w-3 text-indigo-400 shrink-0" />
              <span className="text-slate-500">Perp:</span>{' '}
              <span className="text-indigo-300 font-medium">
                {strategy.perpExchangeKeyId ? `${strategy.perpExchangeKeyId.name} (${strategy.perpExchangeKeyId.exchangeId})` : <span className="text-slate-600 italic">não definida</span>}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Link2 className="h-3 w-3 text-indigo-400 shrink-0" />
              <span className="text-slate-500">Spot:</span>{' '}
              <span className="text-indigo-300 font-medium">
                {strategy.spotExchangeKeyId ? `${strategy.spotExchangeKeyId.name} (${strategy.spotExchangeKeyId.exchangeId})` : <span className="text-slate-600 italic">não definida</span>}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => onUpdate({ _id: strategy._id, autoExecute: !strategy.autoExecute })}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${strategy.autoExecute ? 'bg-cyan-700 text-white hover:bg-cyan-600' : 'bg-blue-600 text-white hover:bg-blue-500'}`}
        >
          {strategy.autoExecute ? <><Pause className="h-4 w-4" /> Desativar auto</> : <><Play className="h-4 w-4" /> Ativar auto</>}
        </button>

        {cdStatus.active && (
          <button
            onClick={() => onUpdate({ _id: strategy._id, resetCooldown: true } as any)}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600/80 px-3 py-2 text-sm text-white hover:bg-amber-500 transition-colors"
            title="Resetar Cooldown"
          >
            <TimerReset className="h-4 w-4" /> Resetar Cooldown
          </button>
        )}
        {strategy.positionOpen && (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-3 py-2 text-sm font-semibold text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Posição Aberta
          </span>
        )}
        <button
          onClick={() => onEdit(strategy)}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={() => onDelete(strategy)}
          className="inline-flex items-center gap-2 rounded-lg bg-red-900/50 px-3 py-2 text-sm text-red-300 hover:bg-red-900 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
