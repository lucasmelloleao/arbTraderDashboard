'use client';

import React, { useState } from 'react';
import { Bot, Sparkles, RefreshCw, ChevronDown, ChevronUp, ShieldCheck, TrendingUp, Wallet, CheckCircle2 } from 'lucide-react';

export function AiAdvisorCard() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any | null>(null);
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
      const resJson = await res.json();
      if (resJson.success && resJson.data) {
        setData(resJson.data);
        setExpanded(true);
      } else {
        setData({
          scoreDeRisco: 50,
          nivelDeRisco: 'Alerta',
          scoreDePerformance: 50,
          recomendacaoTradeSize: 50,
          distribuicaoBanca: [],
          pontosChave: [resJson.reason || 'Erro ao processar dados.'],
          resumoMarkdown: `⚠️ ${resJson.reason || 'Erro ao gerar análise da IA.'}`
        });
        setExpanded(true);
      }
    } catch (err: any) {
      setData({
        scoreDeRisco: 0,
        nivelDeRisco: 'Erro',
        scoreDePerformance: 0,
        recomendacaoTradeSize: 50,
        distribuicaoBanca: [],
        pontosChave: [`Falha de conexão: ${err.message}`],
        resumoMarkdown: `❌ Falha de conexão: ${err.message}`
      });
      setExpanded(true);
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadgeColor = (level: string) => {
    const l = (level || '').toLowerCase();
    if (l.includes('baixo') || l.includes('ideal') || l.includes('seguro')) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    if (l.includes('médio') || l.includes('medio')) return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  };

  return (
    <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-br from-slate-900 via-slate-900/95 to-cyan-950/40 p-5 shadow-xl relative overflow-hidden">
      {/* Header com Botões */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-white">IA Copilot — Diagnóstico &amp; Rebalanceamento</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40">
                AI Powered
              </span>
            </div>
            <p className="text-xs text-slate-400">Análise em tempo real de risco, performance e sugestões de alocação de banca</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {data && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg flex items-center gap-1.5 border border-slate-700 transition-all"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {expanded ? 'Ocultar Detalhes' : 'Ver Detalhes'}
            </button>
          )}
          <button
            onClick={fetchAnalysis}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg shadow-lg hover:shadow-cyan-500/25 transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin text-white" />
                Analisando Dados...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-cyan-200" />
                {data ? 'Re-Analisar com IA' : 'Gerar Diagnóstico Visual'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Painel Visual (Cards Lúdicos) quando há dados de análise */}
      {data && (
        <div className="mt-5 pt-4 border-t border-cyan-500/20 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Score de Risco da Operação */}
            <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" /> Segurança / Risco
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-black border ${getRiskBadgeColor(data.nivelDeRisco)}`}>
                  Risco {data.nivelDeRisco || 'Baixo'}
                </span>
              </div>
              <div className="my-2">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-2xl font-extrabold text-white">{data.scoreDeRisco ?? 85}/100</span>
                  <span className="text-xs font-semibold text-emerald-400">Proteção Ativa</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, data.scoreDeRisco ?? 85))}%` }}
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-400">Métrica baseada na volatilidade e spreads de entrada</p>
            </div>

            {/* Card 2: Score de Eficiência da Performance */}
            <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-cyan-400" /> Eficiência de Trades
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  Performance
                </span>
              </div>
              <div className="my-2">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-2xl font-extrabold text-white">{data.scoreDePerformance ?? 90}/100</span>
                  <span className="text-xs font-semibold text-cyan-400">Taxa de Acerto</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, data.scoreDePerformance ?? 90))}%` }}
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-400">Avaliação do histórico recente de lucros vs colheitas</p>
            </div>

            {/* Card 3: Sugestão de Aporte Ideal (Trade Size) */}
            <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Wallet className="h-4 w-4 text-purple-400" /> Recomendação de Aporte
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  Trade Size
                </span>
              </div>
              <div className="my-2 flex items-baseline justify-between">
                <span className="text-3xl font-black text-purple-300">${data.recomendacaoTradeSize ?? 50} <span className="text-xs font-semibold text-slate-400">USDT / ordem</span></span>
              </div>
              <p className="text-[11px] text-slate-400">Valor ideal sugerido pela IA por operação casada</p>
            </div>
          </div>

          {/* Destaques Rápidos em Badges */}
          {Array.isArray(data.pontosChave) && data.pontosChave.length > 0 && (
            <div className="bg-slate-950/40 border border-slate-800/80 p-3 rounded-xl flex flex-wrap gap-2 items-center">
              <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Highlights:
              </span>
              {data.pontosChave.map((pt: string, idx: number) => (
                <span key={idx} className="px-2.5 py-1 bg-slate-900 border border-slate-700/80 rounded-lg text-xs font-medium text-slate-200">
                  {pt}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Relatório Detalhado em Texto Expandível */}
      {expanded && data?.resumoMarkdown && (
        <div className="mt-4 pt-3 border-t border-cyan-500/20 text-xs sm:text-sm text-slate-200 leading-relaxed font-sans">
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 font-mono whitespace-pre-wrap">
            {data.resumoMarkdown}
          </div>
        </div>
      )}
    </div>
  );
}

