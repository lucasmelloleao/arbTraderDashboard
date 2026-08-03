import { NextRequest, NextResponse } from 'next/server';

const WSOL_ADDRESS = "So11111111111111111111111111111111111111112";
const USDC_ADDRESS = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDT_ADDRESS = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

export async function GET(req: NextRequest) {
  try {
    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    
    if (!groqKey && !geminiKey) {
      return NextResponse.json({ error: 'Nenhuma chave de IA configurada (.env)' }, { status: 500 });
    }

    // 1. Fetch DexScreener
    const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${WSOL_ADDRESS}`);
    const dexData = await dexRes.json();
    const pairsSol = dexData.pairs || [];

    if (pairsSol.length === 0) {
      return NextResponse.json({ error: 'DexScreener retornou 0 pares' }, { status: 500 });
    }

    // Filter valid pairs
    let validPairs = pairsSol.filter((p: any) =>
      p.chainId === 'solana' &&
      p.liquidity?.usd > 50000 &&
      p.volume?.h24 > 100000
    );

    validPairs.sort((a: any, b: any) => b.volume.h24 - a.volume.h24);
    validPairs = validPairs.slice(0, 30);

    const tokenListForAI: any[] = [];
    const seenSymbols = new Set<string>();

    validPairs.forEach((p: any) => {
      const isBaseSol = p.baseToken.address === WSOL_ADDRESS;
      const targetToken = isBaseSol ? p.quoteToken : p.baseToken;
      const sym = (targetToken?.symbol || '').toUpperCase();
      const cleanAddr = (targetToken?.address || '').replace(/\s+/g, '');

      if (sym && cleanAddr && !seenSymbols.has(sym) && cleanAddr !== USDC_ADDRESS && cleanAddr !== USDT_ADDRESS && cleanAddr !== WSOL_ADDRESS) {
        seenSymbols.add(sym);
        const nextId = tokenListForAI.length + 1;
        tokenListForAI.push({
          id: nextId,
          symbol: sym,
          address: cleanAddr,
          dataString: `[ID:${nextId}] ${sym} | Preço: $${p.priceUsd} | Vol: $${p.volume?.h24} | Liq: $${p.liquidity?.usd} | 5m: ${p.priceChange?.m5}% | 1h: ${p.priceChange?.h1}% | 6h: ${p.priceChange?.h6}%`
        });
      }
    });

    if (tokenListForAI.length === 0) {
      return NextResponse.json({ error: 'Nenhum token válido encontrado.' }, { status: 500 });
    }

    const systemPrompt = "Você é um especialista em memecoins e altcoins da rede Solana focado em Arbitragem de Flash Loans. Sua função é analisar o cenário de curto prazo (como variações de 5 minutos, 1 hora, 6 horas). Avalie se a moeda tem liquidez e volatilidade suficientes para gerar lucros em operações de Flash Loan rápidas (comprando na baixa e vendendo na alta no mesmo bloco). Responda APENAS com um array JSON com 3 objetos contendo 'id' (número), 'symbol' (texto), e 'reason' (uma justificativa curta de no max 80 chars explicando por que está ideal para flashloan baseado nos tempos curtos). O json DEVE estar formatado como [{...}, {...}]. Não inclua mais nada.";

    const userPrompt = `Lista de tokens:
${tokenListForAI.slice(0, 15).map(t => t.dataString).join('\n')}

Retorne APENAS o JSON. Exemplo: [{"id":1,"symbol":"USDT","reason":"Alto volume e liquidez"},{"id":2,"symbol":"WIF","reason":"Alta volatilidade"}]`;

    // 2. Fetch AI (Gemini or Groq)
    let aiResponse = '{}';
    
    if (geminiKey) {
      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }]
        })
      });

      const geminiData = await geminiRes.json();
      if (!geminiRes.ok) {
        return NextResponse.json({ error: geminiData.error?.message || 'Erro na IA Gemini' }, { status: geminiRes.status });
      }
      aiResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    } else {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.1
        })
      });

      const groqData = await groqRes.json();
      if (!groqRes.ok) {
        return NextResponse.json({ error: groqData.error?.message || 'Erro na IA Groq' }, { status: groqRes.status });
      }
      aiResponse = groqData.choices?.[0]?.message?.content || '{}';
    }
    let cleanJson = aiResponse;
    const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
    if (jsonMatch) cleanJson = jsonMatch[0];
    else cleanJson = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();

    let parsedTokens;
    try {
        parsedTokens = JSON.parse(cleanJson);
    } catch (e) {
        return NextResponse.json({ error: 'IA retornou um JSON inválido.' }, { status: 500 });
    }
    
    const topTokens = Array.isArray(parsedTokens) ? parsedTokens : [parsedTokens];

    const results = topTokens.map(item => {
      const match = tokenListForAI.find(t => t.id === item.id) || tokenListForAI.find(t => t.symbol === item.symbol);
      if (match) {
        return {
          symbol: match.symbol,
          address: match.address,
          reason: item.reason || 'Sugerido pela IA'
        };
      }
      return null;
    }).filter(Boolean);

    return NextResponse.json({ tokens: results });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
