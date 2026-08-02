'use client';

import React, { useState } from 'react';
import { Bot, Sparkles, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

export function AiAdvisorCard() {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchAnalysis = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/ai/analyze-portfolio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setAnalysis(data.analysis);
        setExpanded(true);
      } else {
        setAnalysis(`⚠️ ${data.reason || 'Erro ao gerar análise da IA.'}`);
        setExpanded(true);
      }
    } catch (err: any) {
      setAnalysis(`❌ Falha de conexão: ${err.message}`);
      setExpanded(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/30 p-5 shadow-lg relative overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">IA Copilot — Diagnóstico &amp; Rebalanceamento</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                AI Powered
              </span>
            </div>
            <p className="text-xs text-slate-400">Análise em tempo real de risco, performance e sugestões de alocação de banca</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {analysis && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center gap-1 border border-slate-700"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {expanded ? 'Ocultar' : 'Ver Análise'}
            </button>
          )}
          <button
            onClick={fetchAnalysis}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg shadow-md transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin text-white" />
                Analisando Dados...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-cyan-200" />
                {analysis ? 'Re-Analisar com IA' : 'Gerar Análise com IA'}
              </>
            )}
          </button>
        </div>
      </div>

      {expanded && analysis && (
        <div className="mt-4 pt-4 border-t border-cyan-500/20 text-xs sm:text-sm text-slate-200 leading-relaxed space-y-3 font-sans">
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 font-mono whitespace-pre-wrap">
            {analysis}
          </div>
        </div>
      )}
    </div>
  );
}
