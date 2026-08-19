'use client';

import React, { useState } from 'react';
import { Bot, Sparkles, RefreshCw, ChevronDown, ChevronUp, ShieldCheck, TrendingUp, Wallet, CheckCircle2, X, MessageSquareText } from 'lucide-react';

export function AiAdvisorCard() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any | null>(null);
  const [marketData, setMarketData] = useState<any | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [askedQuestion, setAskedQuestion] = useState('');
  const [questionCoins, setQuestionCoins] = useState<string[]>([]);
  const [historicalPrices, setHistoricalPrices] = useState<any[]>([]);

  const fetchAnalysis = async (customQuestion?: string) => {
    setLoading(true);
    setAskOpen(false);
    setAskedQuestion(customQuestion?.trim() || '');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/ai/analyze-portfolio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ question: customQuestion || '' })
      });
      const resJson = await res.json();
      if (resJson.success && resJson.data) {
        setData(resJson.data);
        setMarketData(resJson.marketData || null);
        setQuestionCoins(Array.isArray(resJson.questionCoins) ? resJson.questionCoins : []);
        setHistoricalPrices(Array.isArray(resJson.historicalPrices) ? resJson.historicalPrices : []);
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

  const handleAskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    fetchAnalysis(question.trim());
  };

  const getRiskBadgeColor = (level: string) => {
    const l = (level || '').toLowerCase();
    if (l.includes('baixo') || l.includes('ideal') || l.includes('seguro')) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    if (l.includes('médio') || l.includes('medio')) return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  };

  const fmtUsd = (v: any, digits = 2) => {
    const n = Number(v);
    return Number.isFinite(n) && n !== 0 ? `$${n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}` : '—';
  };
  const fmtPct = (v: any, digits = 2) => {
    const n = Number(v);
    return Number.isFinite(n) ? `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%` : '—';
  };

  const hasMarketData = marketData && (marketData.coins?.length || marketData.perps?.length || marketData.defiLlama || marketData.dexPairs?.length);

  return (
    <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-br from-slate-900 via-slate-900/95 to-cyan-950/40 p-5 shadow-xl relative overflow-hidden">
      {/* Modal de Pergunta para a IA */}
      {askOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setAskOpen(false)}>
          <div
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 bg-slate-900 px-6 py-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <MessageSquareText className="h-5 w-5 text-cyan-400" /> Pergunte à IA Copilot
              </h2>
              <button onClick={() => setAskOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAskSubmit} className="p-6 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">
                  Sua pergunta <span className="text-slate-600">(opcional)</span>
                </label>
                <textarea
                  autoFocus
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={5}
                  placeholder="Ex: Devo aumentar o aporte em alguma posição? O que está pesando no meu risco hoje? Qual corretora está com o melhor saldo livre?"
                  className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none resize-none"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  A IA analisará seus dados (posições, saldos, trades) e responderá sua pergunta em conjunto com o diagnóstico.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAskOpen(false)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!question.trim()}
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 px-4 py-2 text-sm font-semibold text-white transition-all disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" /> Analisar com IA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
            onClick={() => setAskOpen(true)}
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

      {/* Banner: Pergunta feita + moedas analisadas */}
      {askedQuestion && (
        <div className="mt-4 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 flex flex-wrap items-center gap-2">
          <MessageSquareText className="h-4 w-4 text-cyan-400 shrink-0" />
          <span className="text-xs text-slate-300">
            <strong className="text-white">Pergunta:</strong> {askedQuestion}
          </span>
          {questionCoins.length > 0 && (
            <span className="ml-auto flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Analisando</span>
              {questionCoins.map((c) => (
                <span key={c} className="px-2 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-[11px] font-black">
                  {c}
                </span>
              ))}
            </span>
          )}
        </div>
      )}

      {/* Cotação direta da moeda perguntada */}
      {questionCoins.length > 0 && marketData?.coins?.length > 0 && (() => {
        const coins = marketData.coins.filter((c: any) => questionCoins.includes(c.symbol));
        if (coins.length === 0) return null;
        return (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {coins.slice(0, 3).map((c: any) => {
              const chg = Number(c.change24hPct);
              const up = chg >= 0;
              return (
                <div key={c.symbol} className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{c.symbol} <span className="text-slate-400 font-normal">{c.name}</span></span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${up ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                      {up ? '▲' : '▼'} {Math.abs(chg).toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-2 space-y-1">
                    <p className="text-lg font-black text-white">USD: <span className="font-mono">{fmtUsd(c.priceUsd)}</span></p>
                    <p className="text-sm font-semibold text-emerald-400">BRL: <span className="font-mono">R$ {c.priceBrl ? Number(c.priceBrl).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</span></p>
                    <p className="text-[11px] text-slate-400">Variação (24h): <span className={`font-bold ${up ? 'text-emerald-400' : 'text-red-400'}`}>{up ? '+' : ''}{chg.toFixed(1)}%</span></p>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Cotação histórica (ontem, data específica, período) */}
      {historicalPrices.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {historicalPrices.map((hp: any, i: number) => {
            const chg = Number(hp.change24hPct);
            const up = chg >= 0;
            return (
              <div key={i} className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{hp.symbol} <span className="text-slate-400 font-normal">em {hp.periodoTexto || hp.date}</span></span>
                </div>
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-slate-400 font-mono">Data: {new Date(hp.date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                  <p className="text-lg font-black text-white">USD: <span className="font-mono">{fmtUsd(hp.priceUsd)}</span></p>
                  <p className="text-sm font-semibold text-emerald-400">BRL: <span className="font-mono">R$ {hp.priceBrl ? Number(hp.priceBrl).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</span></p>
                  {hp.change24hPct !== null && (
                    <p className="text-[11px] text-slate-400">Var. do dia: <span className={`font-bold ${up ? 'text-emerald-400' : 'text-red-400'}`}>{up ? '+' : ''}{chg.toFixed(1)}%</span></p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

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

          {/* Síntese Explicativa Direta em Texto */}
          {data.sinteseExecutiva && (
            <div className="bg-slate-950/80 border border-cyan-500/20 p-4 rounded-xl">
              <h4 className="text-xs font-extrabold uppercase tracking-widest text-cyan-400 mb-1 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-cyan-300" /> Parecer da Inteligência Artificial
              </h4>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {data.sinteseExecutiva}
              </p>
            </div>
          )}

          {/* Destaques Rápidos em Badges */}
          {Array.isArray(data.pontosChave) && data.pontosChave.length > 0 && (
            <div className="bg-slate-950/40 border border-slate-800/80 p-3 rounded-xl flex flex-wrap gap-2 items-center">
              <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Destaques:
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

      {/* 📊 Dados de Mercado em Tempo Real */}
      {hasMarketData && (
        <div className="mt-4 pt-4 border-t border-cyan-500/20 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-widest text-cyan-400 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-cyan-300" /> Dados de Mercado em Tempo Real
            </h4>
            {marketData.fetchedAt && (
              <span className="text-[10px] text-slate-500 font-mono">
                Atualizado: {new Date(marketData.fetchedAt).toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* Moedas (CoinGecko) */}
          {marketData.coins?.length > 0 && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-900/50 border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Moeda</th>
                    <th className="px-3 py-2 font-medium text-right">Preço</th>
                    <th className="px-3 py-2 font-medium text-right">Var. 24h</th>
                    <th className="px-3 py-2 font-medium text-right">Var. 7d</th>
                    <th className="px-3 py-2 font-medium text-right">Volume 24h</th>
                    <th className="px-3 py-2 font-medium text-right">Market Cap</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {marketData.coins.map((c: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-3 py-2 font-semibold text-white">{c.symbol} <span className="text-slate-500 font-normal">{c.name}</span></td>
                      <td className="px-3 py-2 text-right font-mono text-slate-200">{fmtUsd(c.priceUsd)}</td>
                      <td className={`px-3 py-2 text-right font-mono ${Number(c.change24hPct) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtPct(c.change24hPct)}</td>
                      <td className={`px-3 py-2 text-right font-mono ${Number(c.change7dPct) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtPct(c.change7dPct)}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-300">{fmtUsd(c.volume24hUsd, 0)}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-300">{fmtUsd(c.marketCapUsd, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Perpétuos (Binance Futures) */}
          {marketData.perps?.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {marketData.perps.map((p: any, i: number) => (
                <div key={i} className="bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{p.symbol}</p>
                    <p className="text-[10px] text-slate-500">Mark: <span className="text-slate-300 font-mono">{fmtUsd(p.markPriceUsd)}</span></p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-[11px] font-black ${Number(p.fundingRatePct) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      Funding {fmtPct(p.fundingRatePct, 4)}
                    </p>
                    <p className="text-[10px] text-slate-500">OI: <span className="text-slate-300 font-mono">{fmtUsd(p.openInterestUsd, 0)}</span></p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* DeFi (DefiLlama) */}
          {marketData.defiLlama && (
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg px-4 py-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-semibold text-slate-300">🏦 TVL Total do Mercado DeFi</span>
                <span className="text-sm font-black text-emerald-400 font-mono">{fmtUsd(marketData.defiLlama.totalTvlUsd, 0)}</span>
              </div>
              {marketData.defiLlama.topProtocols?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {marketData.defiLlama.topProtocols.map((p: any, i: number) => (
                    <span key={i} className="text-[10px] bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                      {p.name} <strong className="text-emerald-400">{fmtUsd(p.tvlUsd, 0)}</strong>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pares DEX (DexScreener) */}
          {marketData.dexPairs?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {marketData.dexPairs.map((d: any, i: number) => (
                <span key={i} className="text-[10px] bg-slate-800/80 text-slate-300 px-2 py-1 rounded border border-slate-700">
                  {d.baseSymbol} @ {d.dex} — {fmtUsd(d.priceUsd)} · Vol {fmtUsd(d.volume24hUsd, 0)} · Liq {fmtUsd(d.liquidityUsd, 0)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Relatório Técnico Detalhado Visível por Padrão */}
      {data?.resumoMarkdown && (
        <div className="mt-4 pt-4 border-t border-cyan-500/20 space-y-3">
          <div className="bg-slate-950/90 p-4 rounded-xl border border-slate-800 text-slate-300 leading-relaxed shadow-inner">
            <h4 className="text-xs font-black uppercase tracking-widest text-cyan-400 mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-300" /> Relatório &amp; Diagnóstico Técnico Detalhado
            </h4>
            <div className="text-xs sm:text-sm text-slate-200 font-sans leading-relaxed whitespace-pre-wrap">
              {data.resumoMarkdown}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
