import { NextRequest, NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import PerpArbStrategy from '@/models/PerpArbStrategy';
import PerpArbTrade from '@/models/PerpArbTrade';
import ExchangeKey from '@/models/ExchangeKey';
import PortfolioSnapshot from '@/models/PortfolioSnapshot';
import PerpArbSettings from '@/models/PerpArbSettings';
import { withAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (req: NextRequest, userId: string) => {
  try {
    await connectMongo();

    const apiKey = process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        reason: 'Nenhuma chave de API para IA (GEMINI_API_KEY ou GROQ_API_KEY) configurada no ambiente.'
      }, { status: 400 });
    }

    // 1. Coleta os dados mais recentes para a IA analisar
    const [strategies, trades, keys, snapshots, settings] = await Promise.all([
      PerpArbStrategy.find({}).lean(),
      PerpArbTrade.find({}).sort({ createdAt: -1 }).limit(50).lean(),
      ExchangeKey.find({ userId, active: true }).lean(),
      PortfolioSnapshot.find({}).sort({ timestamp: -1 }).limit(20).lean(),
      PerpArbSettings.findOne({}).lean()
    ]);

    const openPositions = strategies.filter((s: any) => s.positionOpen);
    const closedTrades = trades.filter((t: any) => t.type === 'close_hedge');
    const totalPnl = trades.reduce((sum: number, t: any) => sum + (t.pnl || 0), 0);

    const contextData = {
      patrimonio: {
        corretorasConectadas: keys.map((k: any) => ({
          name: k.name,
          exchangeId: k.exchangeId,
          spotTotalUsd: k.spotTotalEquity || (k.spotUsdt + k.spotUsdc),
          spotUsdtLivre: k.spotUsdt,
          futuresTotalUsd: k.futuresTotalEquity || (k.futuresUsdt + k.futuresUsdc),
          futuresUsdtLivre: k.futuresUsdt,
        })),
        snapshotsRecentes: snapshots.slice(0, 5).map((s: any) => ({
          exchange: s.exchange,
          totalUsd: s.totalUsdValue,
          data: s.timestamp
        }))
      },
      posicoesAbertas: openPositions.map((s: any) => ({
        nome: s.name,
        par: `${s.perpSymbol} / ${s.spotSymbol}`,
        tamanhoUsdt: s.positionSize || s.tradeSize,
        fundingRateAtualPct: s.currentFundingRate,
        fundingColetadoUsdt: s.fundingCollected,
        dataAbertura: s.createdAt
      })),
      estatisticasTrades: {
        totalTradesEncerrados: closedTrades.length,
        pnlTotalRealizadoUsdt: totalPnl,
        ultimos10Trades: trades.slice(0, 10).map((t: any) => ({
          tipo: t.type,
          par: t.perpSymbol,
          pnl: t.pnl,
          status: t.status,
          data: t.createdAt
        }))
      },
      configuracoesRobo: {
        tradeSize: settings?.tradeSize,
        minFundingRatePct: settings?.minFundingRatePct,
        minEntrySpreadPct: settings?.minEntrySpreadPct,
        maxSlippagePct: settings?.maxSlippagePct,
        isScanningEnabled: settings?.isScanningEnabled
      }
    };

    const promptText = `
Você é um especialista em Arbitragem Delta-Neutral de Funding Rates em CEX (Corretoras Centralizadas) e Gestão de Portfólio Crypto.
Análise o seguinte estado em JSON da conta do usuário e forneça um relatório executivo claro, direto e pragmático em português do Brasil com 3 seções estruturadas em Markdown:

### 1. 🛡️ Análise de Oportunidades & Risco Atual (Posições e Scanner)
- Avalie as posições abertas atuais (se houver), seus riscos de spread e a qualidade das entradas.
- Comente sobre as configurações de risco (Funding Mínimo: ${settings?.minFundingRatePct}%, Spread Mínimo: ${settings?.minEntrySpreadPct}%).

### 2. 📊 Diagnóstico Executivo de Performance
- Resumo do PnL acumulado ($${totalPnl.toFixed(2)} USDT), taxa de acerto dos trades encerrados recentes e eficiência da colheita de funding.
- Destaque os pontos fortes e o comportamento recente da banca.

### 3. ⚡ Recomendação de Rebalanceamento & Alocação Inteligente
- Avalie a distribuição de USDT livre vs alocado nas corretoras (${keys.map(k => k.name).join(', ')}).
- Sugira ajustes práticos no aporte por ordem (tradeSize: $${settings?.tradeSize}) ou rebalanceamento para otimizar o rendimento das futuras oportunidades.

Dados da Conta:
${JSON.stringify(contextData, null, 2)}
`;

    // 2. Chamada à API da IA (Suporta Google Gemini API ou GROQ API)
    let aiResponseText = '';
    const geminiKey = process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;

    if (geminiKey) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }]
        })
      });
      const data = await res.json();
      aiResponseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Não foi possível obter resposta da IA Gemini.';
    } else if (groqKey) {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: promptText }],
          temperature: 0.3
        })
      });
      const data = await res.json();
      aiResponseText = data?.choices?.[0]?.message?.content || 'Não foi possível obter resposta da IA Groq.';
    }

    return NextResponse.json({
      success: true,
      analysis: aiResponseText,
      timestamp: new Date()
    });
  } catch (error: any) {
    console.error('Erro na análise de IA:', error);
    return NextResponse.json({ success: false, reason: error.message }, { status: 500 });
  }
});
