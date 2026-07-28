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
  maxDailyLoss: number;
  cooldownAfterLossMs: number;
  autoExecute: boolean;
  active: boolean;
  currentFundingRate?: number | null;
  dailyLossAccum?: number;
  lastLossAt?: string | null;
  perpExchangeKeyId?: { _id: string; name: string; exchangeId: string } | null;
  spotExchangeKeyId?: { _id: string; name: string; exchangeId: string } | null;
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PerpetualArbPage() {
  const [strategies, setStrategies] = useState<PerpArbStrategy[]>([]);
  const [trades, setTrades] = useState<PerpArbTrade[]>([]);
  const [loadingStrategies, setLoadingStrategies] = useState(false);
  const [loadingTrades, setLoadingTrades] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState<{ mode: 'create' | 'edit'; strategy?: PerpArbStrategy } | null>(null);
  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [exchangeKeys, setExchangeKeys] = useState<ExchangeKey[]>([]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalPnl = trades.reduce((acc, t) => acc + (t.pnl ?? 0), 0);
  const executedCount = trades.filter((t) => t.status === 'executed').length;
  const activeCount = strategies.filter((s) => s.active).length;

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
    fetchStrategies(); fetchTrades(); fetchExchanges();
    const interval = setInterval(() => { fetchStrategies(); fetchTrades(); }, 5000);
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

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Funding Arb</h1>
          <p className="mt-1 text-sm text-gray-400">Arbitragem de funding rate entre mercados perpétuos e spot.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { fetchStrategies(); fetchTrades(); }}
            disabled={loadingStrategies || loadingTrades}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${(loadingStrategies || loadingTrades) ? 'animate-spin' : ''}`} /> Atualizar
          </button>
          <button
            onClick={() => setShowForm({ mode: 'create' })}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
          >
            <Plus className="h-4 w-4" /> Nova Estratégia
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-600 bg-red-950/50 p-3 text-sm text-red-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {/* Ideal values reference card */}
      <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Shield className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Valores ideais recomendados</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-5 text-xs text-slate-400">
          <div><span className="text-slate-500">Min Funding</span><div className="mt-0.5 font-bold text-emerald-300">≥ 0.18%</div></div>
          <div><span className="text-slate-500">Trade Size</span><div className="mt-0.5 font-bold text-emerald-300">$100–500 USDT</div></div>
          <div><span className="text-slate-500">Max Slippage</span><div className="mt-0.5 font-bold text-emerald-300">0.05%</div></div>
          <div><span className="text-slate-500">Max Perda/Dia</span><div className="mt-0.5 font-bold text-emerald-300">10 USDT (10% do size)</div></div>
          <div><span className="text-slate-500">Cooldown</span><div className="mt-0.5 font-bold text-emerald-300">3 600 000 ms (1h)</div></div>
        </div>
      </div>

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

      {/* Main grid */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Strategies */}
        <div className="rounded-xl border border-white/10 bg-slate-950/70 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Estratégias</h2>
              <p className="text-sm text-gray-400">Gerencie limites e proteções.</p>
            </div>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.16em] text-gray-300">{strategies.length} estratégias</span>
          </div>
          <div className="space-y-4">
            {loadingStrategies && strategies.length === 0 && <div className="text-sm text-gray-400">Carregando...</div>}
            {!loadingStrategies && strategies.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-500">
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

        {/* Trades */}
        <div className="rounded-xl border border-white/10 bg-slate-950/70 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Histórico de Intenções</h2>
              <p className="text-sm text-gray-400">Oportunidades detectadas e executadas.</p>
            </div>
            {trades.length > 0 && (
              <button onClick={handleClearTrades}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-red-300 transition-colors">
                <Trash2 className="h-3.5 w-3.5" /> Limpar
              </button>
            )}
          </div>
          <div className="space-y-3">
            {loadingTrades && trades.length === 0 && <div className="text-sm text-gray-400">Carregando...</div>}
            {!loadingTrades && trades.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-500">Nenhum trade encontrado.</div>
            )}
            {trades.map((trade) => {
              const statusInfo = STATUS_LABELS[trade.status] ?? { label: trade.status, cls: 'bg-slate-500/15 text-slate-300' };
              const strategyName = typeof trade.strategyId === 'object' ? (trade.strategyId as any).name : null;
              return (
                <div key={trade._id} className="rounded-xl border border-white/10 bg-slate-900 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-slate-100">
                        {trade.type.replace(/_/g, ' ').toUpperCase()}
                        {strategyName && <span className="ml-2 text-xs font-normal text-slate-400">({strategyName})</span>}
                      </div>
                      <div className="text-xs text-gray-500">{new Date(trade.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] uppercase tracking-[0.15em] ${statusInfo.cls}`}>{statusInfo.label}</span>
                      {trade.fundingPct !== undefined && trade.fundingPct !== null && (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${trade.fundingPct >= 0 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
                          {trade.fundingPct >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                          {trade.fundingPct.toFixed(4)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 text-sm text-gray-400">
                    <div>Spot: <span className="text-slate-200">{trade.spotPrice !== undefined ? `$${trade.spotPrice.toLocaleString()}` : 'n/a'}</span></div>
                    <div>Perp: <span className="text-slate-200">{trade.perpPrice !== undefined ? `$${trade.perpPrice.toLocaleString()}` : 'n/a'}</span></div>
                    <div>Amount: <span className="text-slate-200">{trade.amount} USDT</span></div>
                    {trade.pnl !== null && trade.pnl !== undefined && (
                      <div>P&amp;L: <span className={`font-semibold ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(4)} USDT</span></div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
