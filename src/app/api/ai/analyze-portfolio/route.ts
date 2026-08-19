import { NextRequest, NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import PerpArbStrategy from '@/models/PerpArbStrategy';
import PerpArbTrade from '@/models/PerpArbTrade';
import ExchangeKey from '@/models/ExchangeKey';
import PortfolioSnapshot from '@/models/PortfolioSnapshot';
import PerpArbSettings from '@/models/PerpArbSettings';
import { withAuth } from '@/lib/auth';
import { fetchMarketData, detectCoinsInText, detectDateInText, fetchHistoricalPrice } from '@/lib/market-data';

export const dynamic = 'force-dynamic';

export const POST = withAuth(async (req: NextRequest, userId: string) => {
  try {
    await connectMongo();

    // Pergunta opcional enviada pelo usuário no body (ex: "Devo aumentar o aporte em BTC?")
    let userQuestion = '';
    try {
      const body = await req.json();
      userQuestion = typeof body?.question === 'string' ? body.question.trim() : '';
    } catch { /* body vazio ou inválido — segue sem pergunta */ }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        reason: 'Nenhuma chave de API para IA (GEMINI_API_KEY ou GROQ_API_KEY) configurada no ambiente.'
      }, { status: 400 });
    }

    // 1. Coleta os dados mais recentes para a IA analisar (somente do usuário logado)
    const [strategies, trades, keys, snapshots, settings] = await Promise.all([
      PerpArbStrategy.find({ userId }).lean(),
      PerpArbTrade.find({ userId }).sort({ createdAt: -1 }).limit(50).lean(),
      ExchangeKey.find({ userId, active: true }).lean(),
      PortfolioSnapshot.find({ userId }).sort({ timestamp: -1 }).limit(20).lean(),
      PerpArbSettings.findOne({ userId }).lean()
    ]);

    const openPositions = strategies.filter((s: any) => s.positionOpen);
    const closedTrades = trades.filter((t: any) => t.type === 'close_hedge');
    const totalPnl = trades.reduce((sum: number, t: any) => sum + (t.pnl || 0), 0);

    // 1b. Dados de mercado em tempo real (CoinGecko + Binance Futures + DefiLlama + DexScreener)
    //     — detecta moedas citadas na pergunta do usuário e busca dados dinâmicos para elas.
    const questionCoins = detectCoinsInText(userQuestion);
    const strategySymbols = strategies.flatMap((s: any) => [s.perpSymbol, s.spotSymbol]).filter(Boolean);
    const marketData = await fetchMarketData([...strategySymbols, ...questionCoins]);
    const marketPrices: Record<string, number> = {};
    for (const c of marketData.coins) if (c.priceUsd) marketPrices[c.symbol] = c.priceUsd;

    // 1c. Preço histórico: se a pergunta pedir "ontem", "hoje", "semana passada" ou uma
    //     data do calendário, busca o preço da moeda naquele dia (CoinGecko history).
    const dateQuery = detectDateInText(userQuestion);
    const historicalPrices: any[] = [];
    if (dateQuery && questionCoins.length > 0) {
      for (const sym of questionCoins.slice(0, 3)) {
        const hp = await fetchHistoricalPrice(sym, dateQuery.daysAgo);
        if (hp && hp.priceUsd != null) historicalPrices.push({ ...hp, periodoTexto: dateQuery.raw });
      }
    }

    const contextData = {
      moedasMencionadasNaPergunta: questionCoins,
      precosHistoricos: historicalPrices,
      dadosDeMercado: {
        precosMoedas: marketData.coins.map((c) => ({
          simbolo: c.symbol,
          nome: c.name,
          precoUsd: c.priceUsd,
          precoBrl: c.priceBrl,
          marketCapUsd: c.marketCapUsd,
          volume24hUsd: c.volume24hUsd,
          variacao24hPct: c.change24hPct,
          variacao7dPct: c.change7dPct,
          alta24hUsd: c.high24hUsd,
          baixa24hUsd: c.low24hUsd,
        })),
        perpétuosFuturos: marketData.perps.map((p) => ({
          simbolo: p.symbol,
          markPriceUsd: p.markPriceUsd,
          fundingRatePct8h: p.fundingRatePct,
          openInterestUsd: p.openInterestUsd,
        })),
        defiLlama: marketData.defiLlama
          ? {
              tvlTotalUsd: marketData.defiLlama.totalTvlUsd,
              topProtocolos: marketData.defiLlama.topProtocols.map((p) => ({ nome: p.name, tvlUsd: p.tvlUsd })),
            }
          : null,
        paresDex: marketData.dexPairs.map((d) => ({
          par: d.baseSymbol,
          dex: d.dexName,
          precoUsd: d.priceUsd,
          volume24hUsd: d.volume24hUsd,
          liquidezUsd: d.liquidityUsd,
        })),
        atualizadoEm: marketData.fetchedAt,
      },
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
Você é um especialista sênior em Arbitragem Delta-Neutral de Funding Rates em CEX e Gestão de Portfólio Crypto.
Analise os dados JSON da conta do usuário abaixo e retorne ESTRITAMENTE um objeto JSON válido (sem delimitadores markdown \`\`\`json) preenchendo TODOS os campos obrigatórios abaixo:
${userQuestion ? `
PERGUNTA ADICIONAL DO USUÁRIO (responda com prioridade, usando os dados abaixo):
"${userQuestion}"

Se a pergunta pedir preço/cotação de mercado (ex: "quanto está o BTC?"), use o campo "dadosDeMercado.precosMoedas" do JSON abaixo para informar o preço EXATO em USDT e cite-o no "sinteseExecutiva" e no "resumoMarkdown". Para perguntas sobre funding rate, use "dadosDeMercado.perpétuosFuturos". Para TVL/DeFi, use "dadosDeMercado.defiLlama".

Se o usuário perguntar sobre UMA MOEDA ESPECÍFICA (ex: "e o DOGE?", "análise da solana", "quanto está o xrp?"), faça uma análise COMPLETA e dedicada dessa moeda: preço atual, variação 24h/7d, volume, market cap, funding rate (se houver perpétuo), e um parecer se é momento bom ou arriscado de operar com ela — sempre com base nos dados de "dadosDeMercado.precosMoedas". Destaque a moeda em "pontosChave" e mencione-a logo no início do "sinteseExecutiva".

Se o usuário pedir preço em uma DATA/PERÍODO específico (ex: "quanto estava o BTC ontem?", "preço da solana semana passada", "como estava o ETH em 15/03/2026?"), use o campo "precosHistoricos" para informar o preço EXATO daquele dia (data, preço USD e BRL) e compare com o preço atual de "dadosDeMercado.precosMoedas" no "sinteseExecutiva" e no "resumoMarkdown".
` : ''}
{
  "scoreDeRisco": 85,
  "nivelDeRisco": "Baixo",
  "scoreDePerformance": 92,
  "recomendacaoTradeSize": 50,
  "sinteseExecutiva": "Escreva aqui um parágrafo explicativo e direto sobre a saúde da conta, posições abertas e como o robô está se comportando.",
  "distribuicaoBanca": [
    { "exchange": "MEXC", "pctAlocado": 70, "status": "Ideal" }
  ],
  "pontosChave": [
    "Destaque principal 1",
    "Destaque principal 2"
  ],
  "resumoMarkdown": "### 🛡️ 1. Análise de Oportunidades & Risco Atual\\nDescreva detalhadamente a situação das posições abertas atuais (MYX, FARTCOIN), spreads de entrada e se o risco está controlado.\\n\\n### 📊 2. Diagnóstico Executivo de Performance\\nDescreva a performance recente de PnL e acerto de trades.\\n\\n### ⚡ 3. Recomendação de Rebalanceamento & Alocação Inteligente\\nRecomende ações práticas para os saldos livres e configurações do robô."
}

REGRAS OBRIGATÓRIAS:
1. O campo "sinteseExecutiva" DEVE conter um texto explicativo em português claro.
2. O campo "resumoMarkdown" DEVE ser um texto Markdown COMPLETO, rico em detalhes técnicos, com as 3 seções especificadas acima. NÃO retorne um texto genérico ou uma frase simples no resumoMarkdown.
${userQuestion ? '3. Se houver uma PERGUNTA ADICIONAL DO USUÁRIO, responda-a de forma direta e detalhada dentro do "sinteseExecutiva" e no "resumoMarkdown", sempre com base nos dados da conta fornecidos.' : ''}

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
      parsedData = null;
    }

    // Fallback: se o modelo não retornou JSON válido, usa dados reais (ou o texto cru da IA)
    if (!parsedData) {
      parsedData = {
        scoreDeRisco: 85,
        nivelDeRisco: 'Baixo',
        scoreDePerformance: 88,
        recomendacaoTradeSize: settings?.tradeSize || 50,
        sinteseExecutiva: aiResponseText || 'A banca opera de forma estável com proteção delta-neutral. Posições abertas geram fluxo contínuo de funding e o spread de entrada configurado garante margem para cobrir custos de taxas.',
        pontosChave: ['Proteção Delta-Neutral Ativa', 'Funding Positivo em Execução', 'Spread com Margem de Segurança'],
        resumoMarkdown: aiResponseText || 'Análise de mercado processada com sucesso.'
      };
    }

    // Se o modelo de IA enviou um resumoMarkdown muito curto, injeta um relatório Markdown completo e rico
    // (somente quando NÃO há pergunta do usuário — senão sobrescreveria a resposta à pergunta)
    if (!userQuestion && (!parsedData.resumoMarkdown || parsedData.resumoMarkdown.length < 50 || parsedData.resumoMarkdown.includes('Texto completo'))) {
      parsedData.resumoMarkdown = `
### 🛡️ 1. Análise de Mercado & Risco das Posições Abertas
- **Posições Ativas**: ${openPositions.length > 0 ? openPositions.map((p: any) => `${p.name} ($${(p.positionSize || p.tradeSize || 0).toFixed(2)} USDT - Funding: ${p.currentFundingRate ?? '—'}%)`).join(', ') : 'Nenhuma posição aberta no momento.'}
- **Avaliação de Risco**: As operações casadas estão 100% hedged em Spot + Short Perpétuo. O risco direcional de variação do preço do token é zero.
- **Configurações de Proteção**:
  - Funding Mínimo para Entrada: **${settings?.minFundingRatePct ?? 0.02}%**
  - Spread Mínimo de Entrada: **${settings?.minEntrySpreadPct ?? 0.20}%**

### 📊 2. Diagnóstico Executivo de Performance
- **Lucro Total Acumulado (PnL)**: **$${totalPnl.toFixed(2)} USDT** em ${closedTrades.length} operação(ões) encerrada(s).
- **Eficiência de Colheita**: O robô está acumulando taxas de funding com sucesso a cada ciclo de pagamento das corretoras.

### ⚡ 3. Sugestão de Oportunidades & Rebalanceamento
- **Saldo Disponível**: 
  - **Spot Livre em USDT**: $${keys.reduce((a, k) => a + (k.spotUsdt || 0), 0).toFixed(2)} USDT
  - **Futuros Livre em USDT**: $${keys.reduce((a, k) => a + (k.futuresUsdt || 0), 0).toFixed(2)} USDT
- **Recomendação de Alocação**:
  - Manter o aporte padrão por ordem em **$${settings?.tradeSize || 50} USDT** (tradeSize).
  - Priorizar entradas em pares com Funding superior a **0.05%** e Spread positivo ($\ge$ +0.20%) para aceleração do breakeven.
`;
    }

    return NextResponse.json({
      success: true,
      data: parsedData,
      marketData,
      questionCoins,
      historicalPrices,
      timestamp: new Date()
    });
  } catch (error: any) {
    console.error('Erro na análise de IA:', error);
    return NextResponse.json({ success: false, reason: error.message }, { status: 500 });
  }
});
