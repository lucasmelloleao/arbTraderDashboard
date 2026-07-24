import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import FlashLoanStrategy from '@/models/FlashLoanStrategy';
import { withAuth } from '@/lib/auth';

const TOKEN_REGISTRY: Record<string, Record<string, string>> = {
  arbitrum: {
    'USDC': '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    'USDT': '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    'WETH': '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    'ARB': '0x912CE59144191C1204E64559FE8253a0e49E6548',
    'WBTC': '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
    'LINK': '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',
    'DAI': '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    'GMX': '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a',
    'MAGIC': '0x539bdE0d7Dbd336b79148AA742883198BBF60342'
  },
  polygon: {
    'USDC': '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    'USDT': '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    'WETH': '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    'MATIC': '0x0000000000000000000000000000000000001010',
    'WMATIC': '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    'WBTC': '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
    'DAI': '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063'
  },
  solana: {
    'SOL': 'So11111111111111111111111111111111111111112',
    'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    'RAY': '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    'BONK': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    'WIF': 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    'POPCAT': '7GCihgDB8fe6KNjn2g7hu4pGte2L4bT53G2r7Z4fN1hX',
    'MEW': 'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5',
    'JUP': 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    'PYTH': 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3GBfWejP87qQ2U',
    'JTO': 'jtojtomepa8beP8AuQc6eP9fH63Kx5YxV5fJkFz7yTz'
  }
};

function resolveTokenAddress(network: string, input: string): { address: string, symbol: string } {
  const net = network || 'solana';
  
  // Handle comma-separated list of tokens
  const tokens = input.split(',').map(t => t.trim()).filter(t => t.length > 0);
  
  const resolvedAddresses: string[] = [];
  const resolvedSymbols: string[] = [];

  for (const token of tokens) {
    const cleanInput = token.toUpperCase();
    
    // If it's a known symbol
    if (TOKEN_REGISTRY[net] && TOKEN_REGISTRY[net][cleanInput]) {
      resolvedAddresses.push(TOKEN_REGISTRY[net][cleanInput]);
      resolvedSymbols.push(cleanInput);
    }
    // If it's a direct address (very rough heuristic)
    else if (cleanInput.length > 20) {
      resolvedAddresses.push(token);
      resolvedSymbols.push('CUSTOM');
    }
    else {
      throw new Error(`Token ${token} not found in ${net} registry. Please provide the full contract address.`);
    }
  }

  return { 
    address: resolvedAddresses.join(','), 
    symbol: resolvedSymbols.join(',') 
  };
}

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();
    const strategies = await FlashLoanStrategy.find({ userId });
    return NextResponse.json(strategies);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});

export const POST = withAuth(async (req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();
    let { name, walletId, network, contractAddress, tokenAMint, tokenBMint, tokenBSymbol, borrowAmount, minProfitUsdc, provider, lendingProvider, temporary, mevProtection } = await req.json();

    if (!name || !walletId || !tokenBMint || !borrowAmount) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    try {
      const net = network || 'solana';
      const resolvedA = resolveTokenAddress(net, tokenAMint || 'USDC');
      const resolvedB = resolveTokenAddress(net, tokenBMint);
      
      tokenAMint = resolvedA.address;
      tokenBMint = resolvedB.address;
      if (!tokenBSymbol || tokenBSymbol === 'UNKNOWN') {
        tokenBSymbol = resolvedB.symbol;
      }
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }

    const strategy = await FlashLoanStrategy.create({ 
      userId, 
      walletId,
      name, 
      network: network || 'solana',
      contractAddress,
      tokenAMint, 
      tokenBMint, 
      tokenBSymbol,
      borrowAmount, 
      minProfitUsdc, 
      provider,
      lendingProvider,
      mevProtection: mevProtection !== undefined ? mevProtection : true,
      temporary: temporary || false
    });
    return NextResponse.json(strategy, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});

export const PUT = withAuth(async (req: NextRequest, userId: string) => {
  try {
    await connectToDatabase();
    const body = await req.json();
    let { id, active, borrowAmount, minProfitUsdc, name, walletId, network, contractAddress, provider, lendingProvider, tokenAMint, tokenBMint, tokenBSymbol, mevProtection } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
    }

    const currentStrategy = await FlashLoanStrategy.findOne({ _id: id, userId });
    if (!currentStrategy) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const net = network || currentStrategy.network;

    if (tokenAMint) {
      try {
        const resolved = resolveTokenAddress(net, tokenAMint);
        tokenAMint = resolved.address;
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
    }
    if (tokenBMint) {
      try {
        const resolved = resolveTokenAddress(net, tokenBMint);
        tokenBMint = resolved.address;
        if (!tokenBSymbol || tokenBSymbol === 'UNKNOWN') {
          tokenBSymbol = resolved.symbol;
        }
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
    }

    const updateData: any = {};
    if (active !== undefined) updateData.active = active;
    if (borrowAmount !== undefined) updateData.borrowAmount = Number(borrowAmount);
    if (minProfitUsdc !== undefined) updateData.minProfitUsdc = Number(minProfitUsdc);
    if (name !== undefined) updateData.name = name;
    if (walletId !== undefined) updateData.walletId = walletId;
    if (network !== undefined) updateData.network = network;
    if (contractAddress !== undefined) updateData.contractAddress = contractAddress;
    if (provider !== undefined) updateData.provider = provider;
    if (lendingProvider !== undefined) updateData.lendingProvider = lendingProvider;
    if (tokenAMint !== undefined) updateData.tokenAMint = tokenAMint;
    if (tokenBMint !== undefined) updateData.tokenBMint = tokenBMint;
    if (tokenBSymbol !== undefined) updateData.tokenBSymbol = tokenBSymbol;
    if (mevProtection !== undefined) updateData.mevProtection = mevProtection;

    const strategy = await FlashLoanStrategy.findOneAndUpdate(
      { _id: id, userId },
      updateData,
      { new: true }
    );

    if (!strategy) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json(strategy);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req: NextRequest, userId: string) => {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await connectToDatabase();
    const strategy = await FlashLoanStrategy.findOneAndDelete({ _id: id, userId });
    
    if (!strategy) return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 404 });
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
