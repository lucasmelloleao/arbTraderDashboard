'use client';

import React, { useState } from 'react';
import { X, Building2, Shield } from 'lucide-react';
import { PerpArbStrategy, ExchangeKey } from '../../types';

interface StrategyFormModalProps {
  mode: 'create' | 'edit';
  initial?: PerpArbStrategy;
  exchangeKeys: ExchangeKey[];
  authHeaders: () => Record<string, string>;
  onClose: () => void;
  onSaved: () => void;
}

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

export function StrategyFormModal({
  mode,
  initial,
  exchangeKeys,
  authHeaders,
  onClose,
  onSaved,
}: StrategyFormModalProps) {
  const [form, setForm] = useState<StrategyFormData>(
    initial
      ? {
          name: initial.name,
          perpSymbol: initial.perpSymbol,
          spotSymbol: initial.spotSymbol,
          tradeSize: String(initial.tradeSize),
          minFundingRatePct: String(initial.minFundingRatePct),
          maxSlippagePct: String(initial.maxSlippagePct ?? 0.05),
          closeThresholdPct: String((initial as any).closeThresholdPct ?? 0.3),
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
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Erro ao salvar estratégia'); }
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
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
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
