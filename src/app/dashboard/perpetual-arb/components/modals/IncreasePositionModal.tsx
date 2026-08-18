'use client';

import React, { useState } from 'react';
import { Plus, X, RefreshCw } from 'lucide-react';

interface IncreasePositionModalProps {
  strategy: any;
  onClose: () => void;
  onConfirmIncrease: (strategy: any, amount: number) => Promise<void>;
}

export function IncreasePositionModal({
  strategy,
  onClose,
  onConfirmIncrease,
}: IncreasePositionModalProps) {
  const [amount, setAmount] = useState<string>('50');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numAmount = Number(amount);
  const currentSize = Number(strategy.positionSize || strategy.tradeSize || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Informe um valor válido em USDT (maior que 0).');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await onConfirmIncrease(strategy, numAmount);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao aumentar aporte.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-indigo-500/40 bg-slate-950 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-indigo-500/20 p-2 text-indigo-400 border border-indigo-500/30">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Aumentar Posição (Hedge)</h3>
              <p className="text-xs text-slate-400">
                {strategy.name ? strategy.name.replace(/^\[SCAN.*?\]\s*/i, '') : `${strategy.perpSymbol}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-300">
              {error}
            </div>
          )}

          <div className="rounded-lg bg-slate-900/80 border border-white/5 p-3 text-xs space-y-1.5">
            <div className="flex justify-between text-slate-300">
              <span>Posição Atual:</span>
              <span className="font-bold text-white">${currentSize.toFixed(2)} USDT</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Operação executada:</span>
              <span className="font-semibold text-emerald-400">Compra Spot + Short Perpétuo</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Aporte Adicional (USDT)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">$</span>
              <input
                type="number"
                step="any"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ex: 50"
                className="w-full rounded-lg border border-indigo-500/30 bg-slate-900 py-2.5 pl-7 pr-4 text-sm font-bold text-white focus:border-indigo-400 focus:outline-none"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              O robô irá comprar <strong>{amount || 0} USDT</strong> no Spot e vender (Short) a equivalente no Perpétuo em 1X.
            </p>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[25, 50, 100, 200].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setAmount(String(val))}
                className={`rounded-lg border px-2 py-1.5 text-xs font-bold transition-all ${
                  amount === String(val)
                    ? 'border-indigo-400 bg-indigo-600/30 text-white'
                    : 'border-white/10 bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                +${val}
              </button>
            ))}
          </div>

          <div className="rounded-lg bg-indigo-950/30 border border-indigo-500/20 p-3 text-xs text-indigo-300">
            <span>Nova Posição Estimada: </span>
            <span className="font-black text-white">
              ${(currentSize + (isNaN(numAmount) || numAmount < 0 ? 0 : numAmount)).toFixed(2)} USDT
            </span>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 rounded-lg border border-slate-700 bg-slate-900 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || isNaN(numAmount) || numAmount <= 0}
              className="w-1/2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white py-2 text-xs font-bold transition-all shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Processando...
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" /> Aumentar Aporte
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
