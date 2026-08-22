'use client';

import React from 'react';
import { Shield } from 'lucide-react';
import { ExchangeKey } from '../../types';

interface SettingsModalProps {
  settings: any;
  isEditingSettings: boolean;
  settingsForm: any;
  exchangeKeys: ExchangeKey[];
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onSaveSettings: (form: any) => void;
  onUpdateSettingsForm: (form: any) => void;
}

export function SettingsModal({
  settings,
  isEditingSettings,
  settingsForm,
  exchangeKeys,
  onStartEditing,
  onCancelEditing,
  onSaveSettings,
  onUpdateSettingsForm,
}: SettingsModalProps) {
  if (!settings) return null;

  return (
    <div className="rounded-xl border border-indigo-500/20 bg-slate-900/80 p-4 shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-indigo-400" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-indigo-400">Configurações Globais do Robô</h2>
        </div>
        {!isEditingSettings ? (
          <button onClick={onStartEditing} className="text-xs font-semibold text-indigo-300 hover:text-white underline">
            Editar
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={onCancelEditing} className="text-xs font-semibold text-slate-400 hover:text-white underline">
              Cancelar
            </button>
            <button onClick={() => onSaveSettings(settingsForm)} className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 underline">
              Salvar
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-8 text-sm">
        <div>
          <span className="block text-xs text-slate-500 mb-1">Colheita Automática</span>
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold ${settings.isScanningEnabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'}`}>
            <span className={`h-2 w-2 rounded-full ${settings.isScanningEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            {settings.isScanningEnabled ? 'Ativa' : 'Pausada'}
          </span>
        </div>
        <div>
          <span className="block text-xs text-slate-500 mb-1">Aporte p/ Moeda (USDT)</span>
          {!isEditingSettings ? (
            <span className="font-bold text-white">${settings.tradeSize}</span>
          ) : (
            <input
              type="number"
              value={settingsForm.tradeSize}
              onChange={e => onUpdateSettingsForm({ ...settingsForm, tradeSize: Number(e.target.value) })}
              className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-white"
            />
          )}
        </div>

        <div>
          <span className="block text-xs text-slate-500 mb-1">Funding Mínimo (%)</span>
          {!isEditingSettings ? (
            <span className="font-bold text-white">{settings.minFundingRatePct}%</span>
          ) : (
            <input
              type="number"
              step="0.001"
              value={settingsForm.minFundingRatePct}
              onChange={e => onUpdateSettingsForm({ ...settingsForm, minFundingRatePct: Number(e.target.value) })}
              className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-white"
            />
          )}
        </div>

        <div>
          <span className="block text-xs text-slate-500 mb-1">Spread Mínimo Entrada (%)</span>
          {!isEditingSettings ? (
            <span className="font-bold text-emerald-400">{settings.minEntrySpreadPct ?? 0}%</span>
          ) : (
            <input
              type="number"
              step="0.01"
              value={settingsForm.minEntrySpreadPct ?? 0}
              onChange={e => onUpdateSettingsForm({ ...settingsForm, minEntrySpreadPct: Number(e.target.value) })}
              className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-white"
            />
          )}
        </div>

        <div>
          <span className="block text-xs text-slate-500 mb-1">Vol 24h Mínimo (USDT)</span>
          {!isEditingSettings ? (
            <span className="font-bold text-white">${settings.minVolume24hUSD?.toLocaleString()}</span>
          ) : (
            <input
              type="number"
              value={settingsForm.minVolume24hUSD}
              onChange={e => onUpdateSettingsForm({ ...settingsForm, minVolume24hUSD: Number(e.target.value) })}
              className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-white"
            />
          )}
        </div>

        <div>
          <span className="block text-xs text-slate-500 mb-1">Max Slippage (%)</span>
          {!isEditingSettings ? (
            <span className="font-bold text-white">{settings.maxSlippagePct}%</span>
          ) : (
            <input
              type="number"
              step="0.01"
              value={settingsForm.maxSlippagePct}
              onChange={e => onUpdateSettingsForm({ ...settingsForm, maxSlippagePct: Number(e.target.value) })}
              className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-white"
            />
          )}
        </div>

        <div>
          <span className="block text-xs text-slate-500 mb-1">Max Perda Diária (USDT)</span>
          {!isEditingSettings ? (
            <span className="font-bold text-white">${settings.maxDailyLoss}</span>
          ) : (
            <input
              type="number"
              value={settingsForm.maxDailyLoss}
              onChange={e => onUpdateSettingsForm({ ...settingsForm, maxDailyLoss: Number(e.target.value) })}
              className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-white"
            />
          )}
        </div>

        <div>
          <span className="block text-xs text-slate-500 mb-1">Limite Máx Carteira (USDT)</span>
          {!isEditingSettings ? (
            <span className="font-bold text-indigo-300">${settings.maxPortfolioCapUSD ?? 500}</span>
          ) : (
            <input
              type="number"
              value={settingsForm.maxPortfolioCapUSD ?? 500}
              onChange={e => onUpdateSettingsForm({ ...settingsForm, maxPortfolioCapUSD: Number(e.target.value) })}
              className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-white"
            />
          )}
        </div>

        <div>
          <span className="block text-xs text-slate-500 mb-1">Ciclo de Scan (Minutos)</span>
          {!isEditingSettings ? (
            <span className="font-bold text-white">{(settings.scanIntervalMs || 120000) / 60000}</span>
          ) : (
            <input
              type="number"
              min="1"
              step="1"
              value={(settingsForm.scanIntervalMs || 120000) / 60000}
              onChange={e => onUpdateSettingsForm({ ...settingsForm, scanIntervalMs: Number(e.target.value) * 60000 })}
              className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-white"
            />
          )}
        </div>
        
        <div className="sm:col-span-8 border-t border-white/10 pt-4 mt-2">
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
                        onUpdateSettingsForm({ ...settingsForm, allowedExchanges: curr });
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
  );
}
