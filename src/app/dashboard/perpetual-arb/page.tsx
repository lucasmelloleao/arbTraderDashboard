'use client';

import { useEffect, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  Play,
  Pause,
  Plus,
  X,
  Trash2,
  TrendingUp,
  DollarSign,
  Activity,
  AlertTriangle,
  Shield,
  ChevronDown,
  ChevronUp,
  Pencil,
  Building2,
  Link2,
  TimerReset,
  Search
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ExchangeKey = {
  _id: string;
  name: string;
  exchangeId: string;
};

type PerpArbStrategy = {
  _id: string;
  name: string;
  perpSymbol: string;
  spotSymbol: string;
  tradeSize: number;
  minFundingRatePct: number;
  maxSlippagePct: number;
  closeThresholdPct?: number;
  maxDailyLoss: number;
  cooldownAfterLossMs: number;
  autoExecute: boolean;
  active: boolean;
  currentFundingRate?: number | null;
  dailyLossAccum?: number;
  lastLossAt?: string | null;
  perpExchangeKeyId?: { _id: string; name: string; exchangeId: string } | null;
  spotExchangeKeyId?: { _id: string; name: string; exchangeId: string } | null;
  positionOpen?: boolean;
  positionSize?: number;
  positionOpenedAt?: string | null;
  fundingCollected?: number;
  lastSpotPrice?: number | null;
  lastPerpPrice?: number | null;
};

type PerpArbTrade = {
  _id: string;
  strategyId: string | { _id: string; name: string; perpSymbol: string; spotSymbol: string };
  type: string;
  spotPrice?: number;
  perpPrice?: number;
  fundingRate?: number;
  fundingPct?: number;
  amount: number;
  pnl?: number | null;
  status: string;
  createdAt: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToken(): string {
  return typeof window !== 'undefined' ? (localStorage.getItem('token') ?? '') : '';
}
function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` };
}

function msToDuration(ms: number): string {
  if (ms < 60000) return `${ms / 1000}s`;
  if (ms < 3600000) return `${ms / 60000}min`;
  return `${ms / 3600000}h`;
}

function cooldownStatus(strategy: PerpArbStrategy): { active: boolean; remainingMs: number } {
  if (!strategy.lastLossAt) return { active: false, remainingMs: 0 };
  const elapsed = Date.now() - new Date(strategy.lastLossAt).getTime();
  const remaining = strategy.cooldownAfterLossMs - elapsed;
  return { active: remaining > 0, remainingMs: Math.max(0, remaining) };
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  detected:  { label: 'Detectado',  cls: 'bg-blue-500/15 text-blue-300' },
  executed:  { label: 'Executado',  cls: 'bg-emerald-500/15 text-emerald-300' },
  skipped:   { label: 'Ignorado',   cls: 'bg-slate-500/15 text-slate-300' },
  failed:    { label: 'Falhou',     cls: 'bg-red-500/15 text-red-300' },
  simulated: { label: 'Simulado',   cls: 'bg-amber-500/15 text-amber-300' },
};

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmModal({ message, onConfirm, onCancel }: {
  message: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
          <p className="text-sm text-slate-200">{message}</p>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors">Cancelar</button>
          <button onClick={onConfirm} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-400 transition-colors">Confirmar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Strategy Form (create / edit) ───────────────────────────────────────────

type StrategyFormData = {
  name: string;
  perpSymbol: string;
  spotSymbol: string;
  tradeSize: string;
  minFundingRatePct: string;
  maxSlippagePct: string;
  closeThresholdPct: string;
  maxDailyLoss: string;
  cooldownAfterLossMs: string;
  perpExchangeKeyId: string;
  spotExchangeKeyId: string;
};

const IDEAL_DEFAULTS: StrategyFormData = {
  name: '',
  perpSymbol: '',
  spotSymbol: '',
  tradeSize: '100',
  minFundingRatePct: '0.18',
  maxSlippagePct: '0.05',
  closeThresholdPct: '0.3',
  maxDailyLoss: '10',
  cooldownAfterLossMs: '3600000',
  perpExchangeKeyId: '',
  spotExchangeKeyId: '',
};

function StrategyFormModal({ initial, onClose, onSaved, mode, exchangeKeys }: {
  initial?: PerpArbStrategy;
  onClose: () => void;
  onSaved: () => void;
  mode: 'create' | 'edit';
  exchangeKeys: ExchangeKey[];
}) {
  const [form, setForm] = useState<StrategyFormData>(
    initial
      ? {
          name: initial.name,
          perpSymbol: initial.perpSymbol,
          spotSymbol: initial.spotSymbol,
          tradeSize: String(initial.tradeSize),
          minFundingRatePct: String(initial.minFundingRatePct),
          maxSlippagePct: String(initial.maxSlippagePct ?? 0.05),
          closeThresholdPct: String(initial.closeThresholdPct ?? 0.3),
          maxDailyLoss: String(initial.maxDailyLoss ?? 10),
          cooldownAfterLossMs: String(initial.cooldownAfterLossMs ?? 3600000),
          perpExchangeKeyId: initial.perpExchangeKeyId?._id ?? '',
          spotExchangeKeyId: initial.spotExchangeKeyId?._id ?? '',
        }
      : IDEAL_DEFAULTS
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const f = (key: keyof StrategyFormData, val: string) => setForm((p) => ({ ...p, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...(mode === 'edit' && initial ? { _id: initial._id } : {}),
        name: form.name,
        perpSymbol: form.perpSymbol,
        spotSymbol: form.spotSymbol,
        tradeSize: Number(form.tradeSize),
        minFundingRatePct: Number(form.minFundingRatePct),
        maxSlippagePct: Number(form.maxSlippagePct),
        closeThresholdPct: Number(form.closeThresholdPct),
        maxDailyLoss: Number(form.maxDailyLoss),
        cooldownAfterLossMs: Number(form.cooldownAfterLossMs),
        perpExchangeKeyId: form.perpExchangeKeyId || null,
        spotExchangeKeyId: form.spotExchangeKeyId || null,
      };
      const res = await fetch('/api/perp-arb/strategies', {
        method: mode === 'create' ? 'POST' : 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Erro'); }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-slate-900 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">
            {mode === 'create' ? 'Nova Estratégia' : `Editar — ${initial?.name}`}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"><X className="h-5 w-5" /></button>
        </div>

        {error && (
          <div className="mx-6 mt-4 rounded-lg border border-red-600 bg-red-950/50 p-3 text-sm text-red-200">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          {/* ── Basic ── */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Configuração básica</p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Nome</label>
                <input required value={form.name} onChange={(e) => f('name', e.target.value)}
                  placeholder="BTC Funding Arb"
                  className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Símbolo Perp</label>
                  <input required value={form.perpSymbol} onChange={(e) => f('perpSymbol', e.target.value)}
                    placeholder="BTC-PERP"
                    className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Símbolo Spot</label>
                  <input required value={form.spotSymbol} onChange={(e) => f('spotSymbol', e.target.value)}
                    placeholder="BTC/USDT"
                    className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Trade Size (USDT)</label>
                  <input required type="number" min="1" step="any" value={form.tradeSize} onChange={(e) => f('tradeSize', e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">
                    Min Funding Rate (%)
                    <span className="ml-1 text-emerald-400">ideal: 0.18</span>
                  </label>
                  <input required type="number" step="0.001" value={form.minFundingRatePct} onChange={(e) => f('minFundingRatePct', e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none" />
                </div>
              </div>

              {/* Exchange selectors */}
              <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-3.5 w-3.5 text-indigo-400" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Corretoras</span>
                </div>
                {exchangeKeys.length === 0 ? (
                  <p className="text-xs text-amber-400">
                    Nenhuma corretora cadastrada.{' '}
                    <a href="/dashboard/exchanges" className="underline hover:text-amber-300">Cadastrar agora →</a>
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-400">
                        Perp Exchange
                        <span className="ml-1 text-slate-600">(SHORT)</span>
                      </label>
                      <select
                        value={form.perpExchangeKeyId}
                        onChange={(e) => f('perpExchangeKeyId', e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="">— Selecionar —</option>
                        {exchangeKeys.map((ek) => (
                          <option key={ek._id} value={ek._id}>{ek.name} ({ek.exchangeId})</option>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px] text-slate-500">Exchange onde o SHORT perpétuo será aberto.</p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-400">
                        Spot Exchange
                        <span className="ml-1 text-slate-600">(LONG hedge)</span>
                      </label>
                      <select
                        value={form.spotExchangeKeyId}
                        onChange={(e) => f('spotExchangeKeyId', e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="">— Selecionar —</option>
                        {exchangeKeys.map((ek) => (
                          <option key={ek._id} value={ek._id}>{ek.name} ({ek.exchangeId})</option>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px] text-slate-500">Exchange onde o LONG spot de hedge será aberto.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── Protection ── */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-amber-400" />
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Campos de proteção</p>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">
                  Alvo de Spread (Fechamento) (%)
                  <span className="ml-1 text-emerald-400">ideal: 0.3</span>
                </label>
                <input required type="number" step="0.001" value={form.closeThresholdPct} onChange={(e) => f('closeThresholdPct', e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none" />
                <p className="mt-1 text-[11px] text-slate-500">Lucro mínimo (diferença entre Spot e Perp) para o robô fechar a operação automaticamente.</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">
                  Max Slippage (%)
                  <span className="ml-1 text-emerald-400">ideal: 0.05</span>
                </label>
                <input required type="number" step="0.001" min="0" value={form.maxSlippagePct} onChange={(e) => f('maxSlippagePct', e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none" />
                <p className="mt-1 text-[11px] text-slate-500">Aborta a ordem se o slippage estimado exceder este valor. Evita execuções ruins em mercados ilíquidos.</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">
                  Max Perda Diária (USDT)
                  <span className="ml-1 text-emerald-400">ideal: 10</span>
                </label>
                <input required type="number" step="0.1" min="0" value={form.maxDailyLoss} onChange={(e) => f('maxDailyLoss', e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none" />
                <p className="mt-1 text-[11px] text-slate-500">Para automaticamente ao atingir este prejuízo acumulado no dia. Recomendado: 10% do trade size.</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">
                  Cooldown após perda (ms)
                  <span className="ml-1 text-emerald-400">ideal: 3600000 (1h)</span>
                </label>
                <input required type="number" step="60000" min="0" value={form.cooldownAfterLossMs} onChange={(e) => f('cooldownAfterLossMs', e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none" />
                <p className="mt-1 text-[11px] text-slate-500">Pausa o bot por este período após um trade com prejuízo. Evita operar em condições adversas repetidamente.</p>
              </div>
            </div>
          </section>

          <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors">Cancelar</button>
            <button type="submit" disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60 transition-colors">
              {saving ? 'Salvando...' : mode === 'create' ? 'Criar Estratégia' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Strategy Card ────────────────────────────────────────────────────────────

function StrategyCard({ strategy, onUpdate, onDelete, onEdit }: {
  strategy: PerpArbStrategy;
  onUpdate: (s: Partial<PerpArbStrategy> & { _id: string }) => void;
  onDelete: (s: PerpArbStrategy) => void;
  onEdit: (s: PerpArbStrategy) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const fundingNow = strategy.currentFundingRate;
  const fundingAboveMin = fundingNow !== null && fundingNow !== undefined && fundingNow >= strategy.minFundingRatePct;
  const cdStatus = cooldownStatus(strategy);
  const dailyLossPct = strategy.maxDailyLoss > 0 ? ((strategy.dailyLossAccum ?? 0) / strategy.maxDailyLoss) * 100 : 0;

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
              {(strategy.dailyLossAccum ?? 0).toFixed(2)} / {strategy.maxDailyLoss} USDT ({dailyLossPct.toFixed(0)}%)
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
        <button
          onClick={() => onUpdate({ _id: strategy._id, active: !strategy.active })}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-600 transition-colors"
        >
          {strategy.active ? <><Pause className="h-4 w-4" /> Pausar</> : <><Play className="h-4 w-4" /> Retomar</>}
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

const AVAILABLE_EXCHANGES = ['binance', 'bybit', 'okx', 'mexc', 'gateio', 'kucoin', 'huobi', 'bitget'];

// ─── Manual Scan Modal ────────────────────────────────────────────────────────
function ManualScanModal({ onClose, onCreateStrategy, exchangeKeys }: { onClose: () => void, onCreateStrategy: (data: any) => void, exchangeKeys: any[] }) {
  const [symbol, setSymbol] = useState('');
  const [selectedExchanges, setSelectedExchanges] = useState<string[]>(['mexc']);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [errorCount, setErrorCount] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFetchError(null);
    setResults([]);
    try {
      const queryExchanges = selectedExchanges.length > 0 ? selectedExchanges.join(',') : AVAILABLE_EXCHANGES.join(',');
      const res = await fetch(`/api/perp-arb/manual-scan?symbol=${encodeURIComponent(symbol)}&exchanges=${queryExchanges}`, {
        headers: authHeaders()
      });
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
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-6 overflow-y-auto">
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

          <form onSubmit={handleScan} className="flex items-end gap-4 mb-6">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-400">Moeda (Paridade Spot, ex: XRP/USDT). Deixe em branco para escanear TODO O MERCADO (Top 20).</label>
              <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="Deixe em branco para Busca Global"
                className="w-full rounded-lg border border-white/10 bg-slate-800 px-4 py-2.5 text-sm font-bold text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none" />
            </div>
            <button disabled={loading} type="submit" className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors flex items-center gap-2 shrink-0">
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {loading ? 'Buscando...' : 'Escanear Mercado'}
            </button>
          </form>

          {fetchError && (
            <div className="mb-4 rounded-lg border border-red-600 bg-red-950/50 p-3 text-sm text-red-200">
              {fetchError}
            </div>
          )}

          {results.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-slate-950/50 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/10 bg-slate-900/50 text-xs font-medium uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Moeda</th>
                    <th className="px-4 py-3">Corretora</th>
                    <th className="px-4 py-3">Vol 24h</th>
                    <th className="px-4 py-3">Spot Ask</th>
                    <th className="px-4 py-3">Perp Bid</th>
                    <th className="px-4 py-3">Spread (Backwd)</th>
                    <th className="px-4 py-3">Funding Rate</th>
                    <th className="px-4 py-3">Taxas Taker</th>
                    <th className="px-4 py-3">Lucro Líquido</th>
                    <th className="px-4 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {results.map((r, i) => (
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
                            const exKey = exchangeKeys.find(k => k.exchangeId.toLowerCase() === r.exchange.toLowerCase());
                            onCreateStrategy({
                              name: `[SCAN ${r.exchange}] ${r.symbol}`,
                              perpSymbol: r.symbol,
                              spotSymbol: r.spotSymbol,
                              minFundingRatePct: Math.max(0.001, Number(r.fundingPct.toFixed(4))),
                              perpExchangeKeyId: { _id: exKey?._id || '' },
                              spotExchangeKeyId: { _id: exKey?._id || '' },
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

// ─── Main Page ────────────────────────────────────────────────────────────────

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PerpetualArbPage() {
  const [strategies, setStrategies] = useState<PerpArbStrategy[]>([]);
  const [trades, setTrades] = useState<PerpArbTrade[]>([]);
  const [loadingStrategies, setLoadingStrategies] = useState(false);
  const [loadingTrades, setLoadingTrades] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [opTab, setOpTab] = useState<'open' | 'executed'>('open');

  const [showForm, setShowForm] = useState<{ mode: 'create' | 'edit'; strategy?: PerpArbStrategy } | null>(null);
  const [showManualScan, setShowManualScan] = useState(false);
  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [exchangeKeys, setExchangeKeys] = useState<ExchangeKey[]>([]);

  const [settings, setSettings] = useState<any>(null);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState<any>({});
  const [botOnline, setBotOnline] = useState<boolean>(false);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalPnl = trades.reduce((acc, t) => acc + (t.pnl ?? 0), 0);
  const executedCount = trades.filter((t) => t.status === 'executed').length;
  const activeCount = strategies.filter((s) => s.active).length;

  const openPositions = strategies.filter((s) => s.positionOpen);
  const marriedTrades = trades.filter((t) => t.type === 'open_hedge' || t.type === 'close_hedge' || t.status === 'executed' || t.status === 'simulated');
  const intentionTrades = trades.filter((t) => t.type === 'funding_check' || t.status === 'detected' || t.status === 'skipped' || t.status === 'failed');

  // ── Fetchers ───────────────────────────────────────────────────────────────
  const fetchStrategies = async () => {
    setLoadingStrategies(true);
    try {
      const res = await fetch('/api/perp-arb/strategies', { headers: authHeaders() });
      if (!res.ok) throw new Error('Erro ao buscar estratégias');
      setStrategies(await res.json());
      setError(null);
    } catch (err: any) { setError(err.message); }
    finally { setLoadingStrategies(false); }
  };

  const fetchTrades = async () => {
    setLoadingTrades(true);
    try {
      const res = await fetch('/api/perp-arb/trades', { headers: authHeaders() });
      if (!res.ok) throw new Error('Erro ao buscar trades');
      setTrades(await res.json());
      setError(null);
    } catch (err: any) { setError(err.message); }
    finally { setLoadingTrades(false); }
  };

  const fetchExchanges = async () => {
    try {
      const res = await fetch('/api/exchanges', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setExchangeKeys(data.exchanges || []);
      }
    } catch { /* silent */ }
  };

  const fetchBotStatus = async () => {
    try {
      const res = await fetch('/api/bot-status?botName=funding-arb', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setBotOnline(data.isOnline);
        return data.isOnline;
      }
    } catch {}
    setBotOnline(false);
    return false;
  };

  const fetchSettings = async () => {
    setLoadingSettings(true);
    try {
      const res = await fetch('/api/perp-arb-settings', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        const isOnline = await fetchBotStatus();
        setSettings(data);
      }
    } catch { /* silent */ }
    finally { setLoadingSettings(false); }
  };

  const updateSettings = async (updates: any) => {
    try {
      const res = await fetch('/api/perp-arb-settings', {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(updates),
      });
      if (res.ok) {
        setSettings(await res.json());
      }
    } catch (err: any) { setError(err.message); }
  };

  const updateStrategy = async (strategy: Partial<PerpArbStrategy> & { _id: string }) => {
    try {
      const res = await fetch('/api/perp-arb/strategies', {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify(strategy),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Falha ao atualizar'); }
      await fetchStrategies();
    } catch (err: any) { setError(err.message); }
  };

  const deleteStrategy = async (id: string) => {
    try {
      const res = await fetch(`/api/perp-arb/strategies?id=${id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Falha ao deletar'); }
      await fetchStrategies();
    } catch (err: any) { setError(err.message); }
  };

  const clearTrades = async () => {
    try {
      const res = await fetch('/api/perp-arb/trades', { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) throw new Error('Falha ao limpar histórico');
      await fetchTrades();
    } catch (err: any) { setError(err.message); }
  };

  useEffect(() => {
    fetchStrategies(); fetchTrades(); fetchExchanges(); fetchSettings();
    const interval = setInterval(() => { fetchStrategies(); fetchTrades(); fetchSettings(); }, 5000);
    return () => clearInterval(interval);
  }, []);

  // ── Confirm helpers ────────────────────────────────────────────────────────
  const handleUpdateWithConfirm = (strategy: Partial<PerpArbStrategy> & { _id: string }, original: PerpArbStrategy) => {
    if (strategy.autoExecute === true && !original.autoExecute) {
      setConfirmState({
        message: `Ativar execução automática para "${original.name}"? Ordens reais serão enviadas quando o funding rate superar ${original.minFundingRatePct}%.`,
        onConfirm: () => { updateStrategy(strategy); setConfirmState(null); },
      });
    } else {
      updateStrategy(strategy);
    }
  };

  const handleDelete = (s: PerpArbStrategy) => {
    setConfirmState({
      message: `Deletar a estratégia "${s.name}"? Esta ação não pode ser desfeita.`,
      onConfirm: () => { deleteStrategy(s._id); setConfirmState(null); },
    });
  };

  const handleClearTrades = () => {
    setConfirmState({
      message: 'Limpar todo o histórico de intenções não executadas?',
      onConfirm: () => { clearTrades(); setConfirmState(null); },
    });
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6">
      {/* Modals */}
      {confirmState && <ConfirmModal message={confirmState.message} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(null)} />}
      {showForm && (
        <StrategyFormModal
          mode={showForm.mode}
          initial={showForm.strategy}
          onClose={() => setShowForm(null)}
          onSaved={fetchStrategies}
          exchangeKeys={exchangeKeys}
        />
      )}
      {showManualScan && (
        <ManualScanModal
          onClose={() => setShowManualScan(false)}
          exchangeKeys={exchangeKeys}
          onCreateStrategy={(prefilled) => {
            setShowManualScan(false);
            setShowForm({ mode: 'create', strategy: prefilled as any });
          }}
        />
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Funding Arb</h1>
          <p className="mt-1 text-sm text-gray-400">Arbitragem de funding rate entre mercados perpétuos e spot.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowForm({ mode: 'create' })}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-bold text-white transition-colors"
          >
            <Plus className="h-4 w-4" /> Nova Estratégia
          </button>
          <button
            onClick={() => setShowManualScan(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-bold text-white transition-colors"
          >
            <Search className="h-4 w-4" /> Busca Manual
          </button>
          {settings && (
            <button
              disabled={!botOnline}
              title={!botOnline ? 'O robô está offline' : ''}
              onClick={() => updateSettings({ isScanningEnabled: !settings.isScanningEnabled })}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                settings.isScanningEnabled ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {settings.isScanningEnabled ? <><Pause className="h-4 w-4" /> Desligar Pescaria</> : <><Play className="h-4 w-4" /> Ligar Pescaria</>}
            </button>
          )}
          <button
            onClick={() => { fetchStrategies(); fetchTrades(); fetchSettings(); }}
            disabled={loadingStrategies || loadingTrades || loadingSettings}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${(loadingStrategies || loadingTrades || loadingSettings) ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-600 bg-red-950/50 p-3 text-sm text-red-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {/* Global Settings Panel */}
      {settings && (
        <div className="mt-5 rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-indigo-400" />
              <h2 className="text-sm font-semibold uppercase tracking-widest text-indigo-400">Configurações Globais do Robô</h2>
            </div>
            {!isEditingSettings ? (
              <button onClick={() => { setSettingsForm({ ...settings }); setIsEditingSettings(true); }} className="text-xs font-semibold text-indigo-300 hover:text-white underline">Editar</button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setIsEditingSettings(false)} className="text-xs font-semibold text-slate-400 hover:text-white underline">Cancelar</button>
                <button onClick={() => { updateSettings(settingsForm); setIsEditingSettings(false); }} className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 underline">Salvar</button>
              </div>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-6 text-sm">
            <div>
              <span className="block text-xs text-slate-500 mb-1">Aporte p/ Moeda (USDT)</span>
              {!isEditingSettings ? <span className="font-bold text-white">${settings.tradeSize}</span> : <input type="number" value={settingsForm.tradeSize} onChange={e => setSettingsForm({ ...settingsForm, tradeSize: Number(e.target.value) })} className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-white" />}
            </div>
            <div>
              <span className="block text-xs text-slate-500 mb-1">Funding Mínimo (%)</span>
              {!isEditingSettings ? <span className="font-bold text-white">{settings.minFundingRatePct}%</span> : <input type="number" step="0.001" value={settingsForm.minFundingRatePct} onChange={e => setSettingsForm({ ...settingsForm, minFundingRatePct: Number(e.target.value) })} className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-white" />}
            </div>
            <div>
              <span className="block text-xs text-slate-500 mb-1">Vol 24h Mínimo (USDT)</span>
              {!isEditingSettings ? <span className="font-bold text-white">${settings.minVolume24hUSD.toLocaleString()}</span> : <input type="number" value={settingsForm.minVolume24hUSD} onChange={e => setSettingsForm({ ...settingsForm, minVolume24hUSD: Number(e.target.value) })} className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-white" />}
            </div>
            <div>
              <span className="block text-xs text-slate-500 mb-1">Max Slippage (%)</span>
              {!isEditingSettings ? <span className="font-bold text-white">{settings.maxSlippagePct}%</span> : <input type="number" step="0.01" value={settingsForm.maxSlippagePct} onChange={e => setSettingsForm({ ...settingsForm, maxSlippagePct: Number(e.target.value) })} className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-white" />}
            </div>
            <div>
              <span className="block text-xs text-slate-500 mb-1">Max Perda Diária (USDT)</span>
              {!isEditingSettings ? <span className="font-bold text-white">${settings.maxDailyLoss}</span> : <input type="number" value={settingsForm.maxDailyLoss} onChange={e => setSettingsForm({ ...settingsForm, maxDailyLoss: Number(e.target.value) })} className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-white" />}
            </div>
            <div>
              <span className="block text-xs text-slate-500 mb-1">Ciclo de Scan (Minutos)</span>
              {!isEditingSettings ? <span className="font-bold text-white">{(settings.scanIntervalMs || 120000) / 60000}</span> : <input type="number" min="1" step="1" value={(settingsForm.scanIntervalMs || 120000) / 60000} onChange={e => setSettingsForm({ ...settingsForm, scanIntervalMs: Number(e.target.value) * 60000 })} className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-white" />}
            </div>
            
            <div className="sm:col-span-6 border-t border-white/10 pt-4 mt-2">
              <span className="block text-xs text-slate-500 mb-2">Corretoras Pescadas</span>
              {!isEditingSettings ? (
                <div className="flex gap-2">
                  {settings.allowedExchanges?.length > 0 ? settings.allowedExchanges.map((ex: string) => (
                    <span key={ex} className="px-2 py-1 bg-indigo-500/20 text-indigo-300 font-semibold rounded text-xs">{ex.toUpperCase()}</span>
                  )) : <span className="text-gray-500 text-xs italic">Todas as cadastradas</span>}
                </div>
              ) : (
                <div className="flex flex-wrap gap-4">
                  {exchangeKeys.length === 0 ? <span className="text-gray-500 text-xs italic">Nenhuma corretora cadastrada</span> : Array.from(new Set(exchangeKeys.map(ek => ek.exchangeId))).map(ex => {
                    const isChecked = settingsForm.allowedExchanges ? settingsForm.allowedExchanges.includes(ex) : false;
                    return (
                      <label key={ex} className="flex items-center gap-2 text-slate-200 text-sm cursor-pointer hover:text-white transition-colors">
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={(e) => {
                            let curr = settingsForm.allowedExchanges || [];
                            if (e.target.checked && !curr.includes(ex)) curr = [...curr, ex];
                            else if (!e.target.checked) curr = curr.filter((a: string) => a !== ex);
                            setSettingsForm({ ...settingsForm, allowedExchanges: curr });
                          }}
                          className="h-4 w-4 rounded border-white/20 bg-slate-900 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900"
                        />
                        {ex.toUpperCase()}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats cards */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-gray-400"><Activity className="h-4 w-4" /> Estratégias Ativas</div>
          <div className="mt-2 text-3xl font-bold text-white">{activeCount}</div>
          <div className="text-xs text-gray-500">de {strategies.length} total</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-gray-400"><TrendingUp className="h-4 w-4" /> Trades Executados</div>
          <div className="mt-2 text-3xl font-bold text-white">{executedCount}</div>
          <div className="text-xs text-gray-500">dos últimos {trades.length} registros</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-gray-400"><DollarSign className="h-4 w-4" /> P&amp;L Total</div>
          <div className={`mt-2 text-3xl font-bold ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)} USDT
          </div>
          <div className="text-xs text-gray-500">realizado</div>
        </div>
      </div>

      {/* Quadro 1 (ACIMA DAS ESTRATÉGIAS, OCUPANDO A TELA TODA): Operações Realizadas e em Aberto */}
      <div className="mt-6 rounded-xl border border-white/10 bg-slate-950/70 p-5">
        <div className="mb-4 flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-white">Operações Realizadas e em Aberto</h2>
          <p className="text-sm text-gray-400">Operações casadas (Spot LONG + Perp SHORT) ativas e histórico de execuções.</p>
        </div>

        {/* Sub-Abas */}
        <div className="mb-4 flex gap-2 border-b border-white/10 pb-3">
          <button
            onClick={() => setOpTab('open')}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
              opTab === 'open'
                ? 'bg-emerald-600 text-white shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Em Aberto ({openPositions.length})
          </button>
          <button
            onClick={() => setOpTab('executed')}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
              opTab === 'executed'
                ? 'bg-indigo-600 text-white shadow-[0_0_10px_rgba(79,70,229,0.4)]'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Histórico Casadas ({marriedTrades.length})
          </button>
        </div>

        {/* Conteúdo da Aba Em Aberto */}
        {opTab === 'open' && (
          <div className="grid gap-4 md:grid-cols-2">
            {openPositions.length === 0 ? (
              <div className="col-span-full rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-500">
                Nenhuma posição casada aberta no momento.
              </div>
            ) : (
              openPositions.map((s) => {
                const openTrade = trades.find(t => 
                  (typeof t.strategyId === 'object' ? t.strategyId._id : t.strategyId) === s._id && 
                  t.type === 'open_hedge' && 
                  (t.status === 'executed' || t.status === 'simulated')
                );

                const latestCheck = trades.find(t => 
                  (typeof t.strategyId === 'object' ? t.strategyId._id : t.strategyId) === s._id && 
                  t.type === 'funding_check' &&
                  t.spotPrice !== undefined && t.perpPrice !== undefined
                );

                const entrySpot = openTrade?.spotPrice;
                const entryPerp = openTrade?.perpPrice;
                const currentSpot = s.lastSpotPrice || latestCheck?.spotPrice || entrySpot;
                const currentPerp = s.lastPerpPrice || latestCheck?.perpPrice || entryPerp;

                const positionSize = s.positionSize || s.tradeSize;
                const fundingCollected = s.fundingCollected || 0;

                let spotPnL = 0;
                let perpPnL = 0;
                if (entrySpot && currentSpot) {
                  spotPnL = ((currentSpot - entrySpot) / entrySpot) * positionSize;
                }
                if (entryPerp && currentPerp) {
                  perpPnL = ((entryPerp - currentPerp) / entryPerp) * positionSize;
                }

                const marketPnL = spotPnL + perpPnL;
                const totalUnrealizedPnL = marketPnL + fundingCollected;
                const estimatedExitValue = positionSize + totalUnrealizedPnL;
                const unrealizedPct = positionSize > 0 ? (totalUnrealizedPnL / positionSize) * 100 : 0;

                return (
                  <div key={s._id} className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-5 flex flex-col justify-between shadow-lg">
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-base font-bold text-white flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                            {s.name}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">{s.perpSymbol} / {s.spotSymbol}</div>
                        </div>
                        <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-[10px] font-bold text-emerald-300 uppercase tracking-wider border border-emerald-500/30">
                          Spot LONG + Perp SHORT
                        </span>
                      </div>

                      {/* Valor Atual da Operação (Resultado ao Encerrar Agora) */}
                      <div className="mt-4 rounded-lg bg-slate-900/90 border border-emerald-500/20 p-3.5">
                        <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                          <span>Valor Atual de Encerramento:</span>
                          <span className="font-semibold text-slate-300">Aporte: ${positionSize.toFixed(2)} USDT</span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <div className="text-2xl font-extrabold text-white">
                            ${estimatedExitValue.toFixed(2)} <span className="text-xs font-normal text-slate-400">USDT</span>
                          </div>
                          <div className={`text-sm font-bold flex items-center gap-1 ${totalUnrealizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {totalUnrealizedPnL >= 0 ? '+' : ''}${totalUnrealizedPnL.toFixed(2)} ({totalUnrealizedPnL >= 0 ? '+' : ''}{unrealizedPct.toFixed(2)}%)
                          </div>
                        </div>
                        
                        {/* Detalhamento Sintético */}
                        <div className="mt-2.5 pt-2 border-t border-white/5 grid grid-cols-2 gap-2 text-[11px]">
                          <div className="text-gray-400">
                            Variação Mercado (Spot+Perp):{' '}
                            <span className={marketPnL >= 0 ? 'text-emerald-300 font-medium' : 'text-red-300 font-medium'}>
                              {marketPnL >= 0 ? '+' : ''}${marketPnL.toFixed(4)}
                            </span>
                          </div>
                          <div className="text-gray-400 text-right">
                            Funding Coletado:{' '}
                            <span className="text-cyan-300 font-medium">
                              +${fundingCollected.toFixed(4)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Decomposição Explícita por Perna (Onde está o Lucro e o Prejuízo) */}
                      <div className="mt-3 space-y-2 rounded-lg bg-slate-900/90 border border-white/10 p-3 text-xs">
                        <div className="font-semibold text-slate-300 border-b border-white/5 pb-1 flex justify-between">
                          <span>Resultado de Cada Perna:</span>
                          <span className="text-[10px] text-gray-400 font-normal">Hedge 1X (Delta Neutro)</span>
                        </div>

                        {/* Perna 1: Spot LONG */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-gray-300">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Spot (LONG)
                            </span>
                            {entrySpot && <span className="text-slate-400 font-mono text-[11px]">${entrySpot} → ${currentSpot || entrySpot}</span>}
                          </div>
                          <div className={`font-mono font-bold ${spotPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {spotPnL >= 0 ? '+' : ''}${spotPnL.toFixed(4)} USDT
                          </div>
                        </div>

                        {/* Perna 2: Perp SHORT */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-gray-300">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              Perpétuo (SHORT)
                            </span>
                            {entryPerp && <span className="text-slate-400 font-mono text-[11px]">${entryPerp} → ${currentPerp || entryPerp}</span>}
                          </div>
                          <div className={`font-mono font-bold ${perpPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {perpPnL >= 0 ? '+' : ''}${perpPnL.toFixed(4)} USDT
                          </div>
                        </div>

                        {/* Perna 3: Funding Coletado */}
                        <div className="flex items-center justify-between border-t border-white/5 pt-1.5">
                          <div className="flex items-center gap-1.5 text-gray-300">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                              🌾 Funding (8h)
                            </span>
                            <span className="text-slate-400 text-[11px]">Pagamento Corretora</span>
                          </div>
                          <div className="font-mono font-bold text-cyan-300">
                            +${fundingCollected.toFixed(4)} USDT
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2 text-xs text-gray-300">
                        <div>Aberto em: <span className="text-slate-300">{s.positionOpenedAt ? new Date(s.positionOpenedAt).toLocaleString() : 'Recentemente'}</span></div>
                        <div>Funding Rate Atual: <span className="font-semibold text-emerald-400">{s.currentFundingRate !== undefined && s.currentFundingRate !== null ? `${s.currentFundingRate.toFixed(4)}%` : '—'}</span></div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Conteúdo da Aba Histórico Casadas */}
        {opTab === 'executed' && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {marriedTrades.length === 0 ? (
              <div className="col-span-full rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-500">
                Nenhuma operação casada executada ou simulada ainda.
              </div>
            ) : (
              marriedTrades.map((trade) => {
                const statusInfo = STATUS_LABELS[trade.status] ?? { label: trade.status, cls: 'bg-slate-500/15 text-slate-300' };
                const strategyName = typeof trade.strategyId === 'object' && trade.strategyId !== null ? (trade.strategyId as any).name : null;
                const isClose = trade.type === 'close_hedge';
                const hasPnl = trade.pnl !== null && trade.pnl !== undefined;
                const isProfit = hasPnl && Number(trade.pnl) >= 0;

                return (
                  <div key={trade._id} className={`rounded-xl border p-4 flex flex-col justify-between ${isClose ? (isProfit ? 'border-emerald-500/40 bg-emerald-950/20' : 'border-red-500/40 bg-red-950/20') : 'border-white/10 bg-slate-900'}`}>
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-bold text-white flex items-center gap-2">
                            {isClose ? (
                              <span className="px-2.5 py-1 rounded-md text-[11px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-wider">
                                🏁 ENCERRAMENTO (FECHAMENTO)
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-md text-[11px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider">
                                🟢 ABERTURA (HEDGE)
                              </span>
                            )}
                            {strategyName && <span className="text-xs text-slate-300">({strategyName})</span>}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">{new Date(trade.createdAt).toLocaleString()}</div>
                        </div>
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] uppercase tracking-[0.15em] font-semibold ${statusInfo.cls}`}>{statusInfo.label}</span>
                      </div>

                      {/* Bloco de Resultado para Fechamento / PnL Realizado */}
                      {isClose && (
                        <div className={`mt-3.5 rounded-lg border p-3 ${isProfit ? 'bg-emerald-900/40 border-emerald-500/30' : 'bg-red-900/40 border-red-500/30'}`}>
                          <div className="text-xs font-semibold text-gray-300 mb-0.5">Resultado Final da Operação:</div>
                          <div className={`text-lg font-black flex items-center gap-1.5 ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isProfit ? '🟢 LUCRO REALIZADO:' : '🔴 PREJUÍZO REALIZADO:'} {isProfit ? '+' : ''}${Number(trade.pnl || 0).toFixed(4)} USDT
                          </div>
                        </div>
                      )}

                      <div className="mt-3 grid gap-2 sm:grid-cols-2 text-xs text-gray-400 border-t border-white/5 pt-2.5">
                        <div>Preço Spot: <span className="text-slate-200 font-medium">{trade.spotPrice !== undefined ? `$${trade.spotPrice.toLocaleString()}` : 'n/a'}</span></div>
                        <div>Preço Perp: <span className="text-slate-200 font-medium">{trade.perpPrice !== undefined ? `$${trade.perpPrice.toLocaleString()}` : 'n/a'}</span></div>
                        <div>Montante HFT: <span className="text-slate-200 font-medium">{trade.amount} USDT</span></div>
                        {!isClose && hasPnl && (
                          <div>P&amp;L Acumulado: <span className={`font-bold ${Number(trade.pnl) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{Number(trade.pnl) >= 0 ? '+' : ''}${Number(trade.pnl).toFixed(4)} USDT</span></div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Quadro 2 (MEIO): Estratégias Ocupando Toda a Largura */}
      <div className="mt-6 rounded-xl border border-white/10 bg-slate-950/70 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Estratégias</h2>
            <p className="text-sm text-gray-400">Gerencie limites, parâmetros e proteções por par.</p>
          </div>
          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-gray-300">
            {strategies.length} estratégias
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loadingStrategies && strategies.length === 0 && <div className="text-sm text-gray-400 col-span-full">Carregando...</div>}
          {!loadingStrategies && strategies.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-500">
              Nenhuma estratégia.{' '}
              <button onClick={() => setShowForm({ mode: 'create' })} className="text-indigo-400 underline hover:text-indigo-300">Criar agora</button>
            </div>
          )}
          {strategies.map((s) => (
            <StrategyCard
              key={s._id}
              strategy={s}
              onUpdate={(upd) => handleUpdateWithConfirm(upd, s)}
              onDelete={handleDelete}
              onEdit={(strat) => setShowForm({ mode: 'edit', strategy: strat })}
            />
          ))}
        </div>
      </div>

      {/* Quadro 3 (FUNDO): Histórico de Intenções */}
      <div className="mt-6 rounded-xl border border-white/10 bg-slate-950/70 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Histórico de Intenções</h2>
            <p className="text-sm text-gray-400">Oportunidades de funding analisadas e verificadas pelo scanner do robô.</p>
          </div>
          {intentionTrades.length > 0 && (
            <button
              onClick={handleClearTrades}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-red-300 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" /> Limpar Intenções
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {loadingTrades && intentionTrades.length === 0 && <div className="text-sm text-gray-400 col-span-full">Carregando...</div>}
          {!loadingTrades && intentionTrades.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-500 col-span-full">
              Nenhuma intenção registrada no scanner.
            </div>
          )}
          {intentionTrades.map((trade) => {
            const statusInfo = STATUS_LABELS[trade.status] ?? { label: trade.status, cls: 'bg-slate-500/15 text-slate-300' };
            const strategyName = typeof trade.strategyId === 'object' && trade.strategyId !== null ? (trade.strategyId as any).name : null;
            return (
              <div key={trade._id} className="rounded-xl border border-white/10 bg-slate-900 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-200 truncate">
                    {strategyName || trade.type.replace(/_/g, ' ').toUpperCase()}
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider shrink-0 ${statusInfo.cls}`}>
                    {statusInfo.label}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-gray-500">{new Date(trade.createdAt).toLocaleString()}</div>

                <div className="mt-3 grid grid-cols-2 gap-1.5 text-xs text-gray-400 border-t border-white/5 pt-2">
                  <div>Spot: <span className="text-slate-200">{trade.spotPrice !== undefined ? `$${trade.spotPrice.toLocaleString()}` : 'n/a'}</span></div>
                  <div>Perp: <span className="text-slate-200">{trade.perpPrice !== undefined ? `$${trade.perpPrice.toLocaleString()}` : 'n/a'}</span></div>
                  <div>Montante: <span className="text-slate-200">{trade.amount} USDT</span></div>
                  {trade.fundingPct !== undefined && trade.fundingPct !== null && (
                    <div>Funding: <span className={trade.fundingPct >= 0 ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>{trade.fundingPct.toFixed(4)}%</span></div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
