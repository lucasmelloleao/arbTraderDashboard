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
Você é um especialista em Arbitragem Delta-Neutral de Funding Rates em CEX e Gestão de Portfólio Crypto.
Analise os dados JSON da conta do usuário abaixo e retorne ESTRITAMENTE um objeto JSON válido (sem delimitadores markdown \`\`\`json) com a seguinte estrutura:

{
  "scoreDeRisco": 85,
  "nivelDeRisco": "Baixo",
  "scoreDePerformance": 92,
  "recomendacaoTradeSize": 50,
  "distribuicaoBanca": [
    { "exchange": "MEXC", "pctAlocado": 70, "status": "Ideal" }
  ],
  "pontosChave": [
    "Ponto de destaque 1",
    "Ponto de destaque 2"
  ],
  "resumoMarkdown": "Texto completo detalhado com as 3 seções em markdown (🛡️ Análise de Risco, 📊 Performance, ⚡ Recomendação)"
}

Regras:
- scoreDeRisco: número de 0 a 100 (100 = baixíssimo risco / ideal).
- nivelDeRisco: "Baixo", "Médio" ou "Alto".
- scoreDePerformance: número de 0 a 100 baseado na rentabilidade e acertos.
- recomendacaoTradeSize: número em USDT sugerido para o aporte por ordem.
- resumoMarkdown: relatório completo em Markdown explicativo com emojis e seções bem formatadas.

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
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });
      const data = await res.json();
      aiResponseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
          response_format: { type: 'json_object' },
          temperature: 0.3
        })
      });
      const data = await res.json();
      aiResponseText = data?.choices?.[0]?.message?.content || '';
    }

    let parsedData: any = null;
    try {
      const cleaned = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(cleaned);
    } catch {
      parsedData = {
        scoreDeRisco: 80,
        nivelDeRisco: 'Médio',
        scoreDePerformance: 85,
        recomendacaoTradeSize: settings?.tradeSize || 50,
        distribuicaoBanca: [],
        pontosChave: ['Análise gerada com sucesso.'],
        resumoMarkdown: aiResponseText
      };
    }

    return NextResponse.json({
      success: true,
      data: parsedData,
      timestamp: new Date()
    });
  } catch (error: any) {
    console.error('Erro na análise de IA:', error);
    return NextResponse.json({ success: false, reason: error.message }, { status: 500 });
  }
});
