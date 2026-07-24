'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Zap, Settings, Play, Pause, AlertTriangle, Pencil, Activity, Clock, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
import clsx from 'clsx';

const KNOWN_TOKENS = [
  { symbol: 'SOL', mint: 'So11111111111111111111111111111111111111112' },
  { symbol: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
  { symbol: 'USDT', mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' },
  { symbol: 'RAY', mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R' },
  { symbol: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
  { symbol: 'WIF', mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm' },
  { symbol: 'POPCAT', mint: '7GCihgDB8fe6KNjn2g7hu4pGte2L4bT53G2r7Z4fN1hX' },
  { symbol: 'MEW', mint: 'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5' },
  { symbol: 'JUP', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
  { symbol: 'PYTH', mint: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3GBfWejP87qQ2U' },
  { symbol: 'JTO', mint: 'jtojtomepa8beP8AuQc6eP9fH63Kx5YxV5fJkFz7yTz' }
];

const EVM_KNOWN_TOKENS: Record<string, string> = {
  '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8': 'USDC',
  '0xaf88d065e77c8cC2239327C5EDb3A432268e5831': 'USDC',
  '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1': 'WETH',
  '0x912CE59144191C1204E64559FE8253a0e49E6548': 'ARB',
  '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a': 'GMX',
  '0x539bdE0d7Dbd336b79148AA742883198BBF60342': 'MAGIC',
  '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f': 'WBTC',
  '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9': 'USDT'
};

const getDisplaySymbol = (mint: string) => {
  if (!mint) return '';
  const solToken = KNOWN_TOKENS.find(t => t.mint === mint);
  if (solToken) return solToken.symbol;
  if (EVM_KNOWN_TOKENS[mint]) return EVM_KNOWN_TOKENS[mint];
  return mint;
};

type Strategy = {
  _id: string;
  name: string;
  network?: string;
  contractAddress?: string;
  tokenAMint: string;
  tokenBMint: string;
  tokenBSymbol?: string;
  borrowAmount: number;
  minProfitUsdc: number;
  provider: string;
  lendingProvider: string;
  active: boolean;
  mevProtection: boolean;
  walletId?: string;
}

type FlashLoanTrade = {
  _id: string;
  tokenBorrowed: string;
  amountBorrowed: number;
  expectedProfit: number;
  actualProfit: number;
  flashLoanFee: number;
  gasFee: number;
  status: string;
  txid?: string;
  jitoBundleId?: string;
  errorMessage?: string;
  createdAt: string;
}

export default function FlashLoanPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [trades, setTrades] = useState<FlashLoanTrade[]>([]);
  const [name, setName] = useState('');
  const [tokenAMint, setTokenAMint] = useState(KNOWN_TOKENS.find(t => t.symbol === 'USDC')?.mint || '');
  const [tokenBMint, setTokenBMint] = useState(KNOWN_TOKENS[0].mint);
  const [borrowAmount, setBorrowAmount] = useState('');
  const [minProfitUsdc, setMinProfitUsdc] = useState('0');
  const [network, setNetwork] = useState('solana');
  const [contractAddress, setContractAddress] = useState('');
  const [provider, setProvider] = useState('jupiter');
  const [lendingProvider, setLendingProvider] = useState('solend');
  const [mevProtection, setMevProtection] = useState(true);
  const [botOnline, setBotOnline] = useState<boolean>(false);
  const [botMode, setBotMode] = useState<'simulated' | 'live'>('simulated');
  const [connectionMode, setConnectionMode] = useState<'rpc' | 'wss'>('rpc');
  const [loadingStatus, setLoadingStatus] = useState(false);

  const [wallets, setWallets] = useState<any[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState('');
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const fetchStrategies = async () => {
    const res = await fetch('/api/strategies', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (res.ok) setStrategies(await res.json());
  };

  const fetchTrades = async () => {
    try {
      const res = await fetch('/api/flash-loan/trades', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setTrades(await res.json());
    } catch (err) {
      console.error('Error fetching trades:', err);
    }
  };

  const fetchWallets = async () => {
    const res = await fetch('/api/wallets', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (res.ok) {
      const data = await res.json();
      setWallets(data);
      if (data.length > 0) setSelectedWalletId(data[0]._id);
    }
  };

  const checkBotStatus = async () => {
    try {
      const res = await fetch('/api/system/status', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBotOnline(data.botOnline);
        if (data.botMode) setBotMode(data.botMode);
        if (data.connectionMode) setConnectionMode(data.connectionMode);
      }
    } catch (e) {
      setBotOnline(false);
    }
  };

  useEffect(() => { 
    fetchStrategies(); 
    fetchWallets();
    checkBotStatus();
    fetchTrades();
    const interval = setInterval(() => {
      checkBotStatus();
      fetchTrades();
      fetchStrategies();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const toggleBotMode = async () => {
    setLoadingStatus(true);
    const newMode = botMode === 'simulated' ? 'live' : 'simulated';
    try {
      const res = await fetch('/api/system/status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ botMode: newMode })
      });
      if (res.ok) {
        const data = await res.json();
        setBotMode(data.botMode);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStatus(false);
    }
  };

  const toggleConnectionMode = async () => {
    setLoadingStatus(true);
    const newMode = connectionMode === 'rpc' ? 'wss' : 'rpc';
    try {
      const res = await fetch('/api/system/status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ connectionMode: newMode })
      });
      if (res.ok) {
        const data = await res.json();
        setConnectionMode(data.connectionMode);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWalletId) {
      alert('Please select an execution wallet.');
      return;
    }
    const tokenObj = KNOWN_TOKENS.find(t => t.mint === tokenBMint);
    const res = await fetch('/api/strategies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ name, walletId: selectedWalletId, network, contractAddress, tokenAMint, tokenBMint, tokenBSymbol: tokenObj?.symbol || 'UNKNOWN', borrowAmount: Number(borrowAmount), minProfitUsdc: Number(minProfitUsdc), provider, lendingProvider, mevProtection })
    });
    if (res.ok) {
      setName(''); setTokenAMint(KNOWN_TOKENS.find(t => t.symbol === 'USDC')?.mint || ''); setTokenBMint(KNOWN_TOKENS[0].mint); setBorrowAmount(''); setMinProfitUsdc('0'); setLendingProvider(network === 'solana' ? 'solend' : 'aave'); setMevProtection(true); setContractAddress('');
      fetchStrategies();
      setIsFormOpen(false);
    } else {
      const data = await res.json();
      alert(`Erro: ${data.error || 'Falha ao criar estratégia'}`);
    }
  };

  const handleEditSubmit = async () => {
    if (!editingStrategy) return;
    const tokenObj = KNOWN_TOKENS.find(t => t.mint === editingStrategy.tokenBMint);
    const res = await fetch('/api/strategies', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ 
        id: editingStrategy._id, 
        name: editingStrategy.name, 
        borrowAmount: editingStrategy.borrowAmount, 
        minProfitUsdc: editingStrategy.minProfitUsdc,
        network: editingStrategy.network,
        contractAddress: editingStrategy.contractAddress,
        provider: editingStrategy.provider,
        lendingProvider: editingStrategy.lendingProvider,
        mevProtection: editingStrategy.mevProtection,
        tokenAMint: editingStrategy.tokenAMint,
        tokenBMint: editingStrategy.tokenBMint,
        tokenBSymbol: tokenObj?.symbol || editingStrategy.tokenBSymbol || 'UNKNOWN',
        walletId: editingStrategy.walletId
      })
    });
    if (res.ok) {
      setEditingStrategy(null);
      fetchStrategies();
    } else {
      const data = await res.json();
      alert(`Erro: ${data.error || 'Falha ao editar estratégia'}`);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/strategies?id=${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (res.ok) fetchStrategies();
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    const res = await fetch('/api/strategies', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ id, active: !currentActive })
    });
    if (res.ok) fetchStrategies();
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <h3 className="text-2xl font-bold text-white flex items-center gap-2">
            Flash Loan Arbitrage
          </h3>
          <button 
            onClick={() => setIsFormOpen(!isFormOpen)} 
            className={clsx(
              "px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm",
              isFormOpen ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-indigo-600 text-white hover:bg-indigo-700"
            )}
          >
            {isFormOpen ? 'Cancelar' : <><Plus className="w-4 h-4" /> Nova estratégia</>}
          </button>
        </div>
        
        {/* Flash Loan Engine Controls */}
        <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 py-2 px-4 rounded-xl">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="text-slate-400">Status:</span>
            {botOnline ? (
              <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full text-xs border border-emerald-400/20">
                <Activity className="w-3 h-3 animate-pulse" /> Online
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-rose-400 bg-rose-400/10 px-2.5 py-1 rounded-full text-xs border border-rose-400/20">
                <span className="w-2 h-2 rounded-full bg-rose-400"></span> Offline
              </span>
            )}
          </div>
          
          <div className="h-6 w-px bg-slate-800"></div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-400">Mode:</span>
            <button
              onClick={toggleBotMode}
              disabled={loadingStatus}
              className={clsx(
                "relative inline-flex h-8 items-center rounded-full w-32 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900",
                botMode === 'live' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-emerald-500 hover:bg-emerald-600',
                loadingStatus && "opacity-50 cursor-not-allowed"
              )}
            >
              <span className="sr-only">Toggle Bot Mode</span>
              <span
                className={clsx(
                  "inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out flex items-center justify-center",
                  botMode === 'live' ? 'translate-x-[6.5rem]' : 'translate-x-1'
                )}
              >
                {botMode === 'live' ? <Pause className="w-3 h-3 text-rose-500" /> : <Play className="w-3 h-3 text-emerald-500" />}
              </span>
              <span className={clsx(
                "absolute text-xs font-bold text-white transition-opacity",
                botMode === 'live' ? 'left-3' : 'left-9'
              )}>
                {botMode === 'live' ? 'LIVE (DANGER)' : 'SIMULATED'}
              </span>
            </button>
          </div>

          <div className="h-6 w-px bg-slate-800"></div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-400">Conn:</span>
            <button
              onClick={toggleConnectionMode}
              disabled={loadingStatus}
              className={clsx(
                "relative inline-flex h-8 items-center rounded-full w-24 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900",
                connectionMode === 'wss' ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-slate-600 hover:bg-slate-700',
                loadingStatus && "opacity-50 cursor-not-allowed"
              )}
            >
              <span className="sr-only">Toggle Connection Mode</span>
              <span
                className={clsx(
                  "inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out flex items-center justify-center",
                  connectionMode === 'wss' ? 'translate-x-[4.5rem]' : 'translate-x-1'
                )}
              >
                <Activity className={clsx("w-3 h-3", connectionMode === 'wss' ? "text-indigo-500" : "text-slate-600")} />
              </span>
              <span className={clsx(
                "absolute text-xs font-bold text-white transition-opacity",
                connectionMode === 'wss' ? 'left-3' : 'left-7'
              )}>
                {connectionMode === 'wss' ? 'WSS' : 'RPC'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {botOnline === false && (
        <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-4 shadow-sm">
          <AlertTriangle className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-red-400 font-bold mb-1">Bot Engine is Paused</h4>
            <p className="text-red-200/80 text-sm">
              Your Flash Loan strategies are not running. To start scanning for arbitrage, please run the command <code className="bg-red-950/50 px-1.5 py-0.5 rounded text-red-300 font-mono">npm run start:monitor</code> in sua pasta flash-go no terminal.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {strategies.length === 0 ? (
          <div className="col-span-full p-8 border border-dashed border-slate-700 rounded-xl text-center text-slate-500">
            No strategies configured. Add one below to start scanning for arbitrage.
          </div>
        ) : strategies.map(strat => (
          <div key={strat._id} className={clsx("bg-slate-900 border rounded-xl p-5 shadow-sm transition-colors", strat.active ? "border-emerald-500/50 shadow-emerald-500/10" : "border-slate-800 hover:border-slate-700")}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="text-lg font-bold text-white flex items-center gap-3">
                  {strat.name}
                  <button 
                    onClick={() => handleToggleActive(strat._id, strat.active)}
                    className={clsx(
                      "flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-colors hover:brightness-125", 
                      strat.active ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-slate-800 text-slate-400 border border-slate-700"
                    )}
                    title={strat.active ? "Pause Engine" : "Start Engine"}
                  >
                    {strat.active ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    {strat.active ? 'Running' : 'Paused'}
                  </button>
                </h4>
                <p className="text-xs text-slate-400 font-mono mt-1 flex items-center gap-2">
                  <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[10px] font-bold">{strat.tokenBSymbol || 'UNKNOWN'}</span>
                  {strat.tokenBMint.includes(',') ? <span className="text-[10px]">Múltiplos Contratos</span> : `${strat.tokenBMint.substring(0,6)}...${strat.tokenBMint.substring(strat.tokenBMint.length-6)}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!strat.active && (
                  <button onClick={() => setEditingStrategy(strat)} className="text-slate-600 hover:text-indigo-400 transition-colors p-1 bg-slate-800/50 rounded-md" title="Edit Strategy">
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => handleDelete(strat._id)} className="text-slate-600 hover:text-red-400 transition-colors p-1 bg-slate-800/50 rounded-md">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                <p className="text-xs text-slate-500 mb-1">Borrow Size</p>
                <p className="text-sm font-semibold text-emerald-400">${strat.borrowAmount.toLocaleString()} {KNOWN_TOKENS.find(t => t.mint === strat.tokenAMint)?.symbol || 'USDC'}</p>
              </div>
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                <p className="text-xs text-slate-500 mb-1">Network</p>
                <p className="text-sm font-semibold text-white capitalize">
                  {strat.network || 'solana'}
                </p>
              </div>
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                <p className="text-xs text-slate-500 mb-1">Lending Prov.</p>
                <p className="text-sm font-semibold text-indigo-400 capitalize">
                  {strat.lendingProvider === 'kamino' ? 'Kamino' : strat.lendingProvider === 'none' ? 'Recursos Próprios' : strat.lendingProvider} 
                </p>
              </div>
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                <p className="text-xs text-slate-500 mb-1">DEX Prov.</p>
                <p className="text-sm font-semibold text-sky-400 capitalize">
                  {strat.provider}
                </p>
              </div>
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                <p className="text-xs text-slate-500 mb-1">MEV Protection</p>
                <p className="text-sm font-semibold text-white">
                  {strat.mevProtection ? (
                    <span className="text-emerald-400 flex items-center gap-1"><Zap className="w-3 h-3" /> {(strat.network || 'solana') === 'solana' ? 'Jito Active' : 'Flashbots Active'}</span>
                  ) : (
                    <span className="text-rose-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Disabled</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isFormOpen && (
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-sm max-w-2xl">
        <h4 className="text-lg font-medium text-white mb-6 flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-500" /> Configure New Strategy
        </h4>
        <form onSubmit={handleAdd} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Network</label>
              <select value={network} onChange={e => {
                const newNet = e.target.value;
                setNetwork(newNet);
                setProvider(newNet === 'solana' ? 'jupiter' : 'uniswap');
                setLendingProvider(newNet === 'solana' ? 'solend' : 'aave');
              }} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 appearance-none">
                <option value="solana">Solana</option>
                <option value="arbitrum">Arbitrum (EVM)</option>
                <option value="polygon">Polygon (EVM)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Strategy Name</label>
              <input required value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500" placeholder="e.g. USDC/SOL Arb" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {network === 'solana' ? (
              <div>
                <label className="block text-sm text-slate-400 mb-1">DEX Provider</label>
                <select value={provider} onChange={e => setProvider(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 appearance-none">
                  <option value="jupiter">Jupiter (Default)</option>
                  <option value="raptor">Raptor API</option>
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-sm text-slate-400 mb-1">DEX Providers</label>
                <input disabled value="Auto-Routing (All DEXes)" className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-4 py-2 text-slate-500 outline-none cursor-not-allowed" />
              </div>
            )}
            <div>
              <label className="block text-sm text-slate-400 mb-1">Execution Wallet</label>
              <select required value={selectedWalletId} onChange={e => setSelectedWalletId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 appearance-none">
                {wallets.length === 0 ? <option value="">No wallets registered</option> : null}
                {wallets.map(w => (
                  <option key={w._id} value={w._id}>{w.acronym} - {w.publicKey.substring(0,6)}...{w.publicKey.substring(w.publicKey.length-4)}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm text-slate-400 mb-1">Lending Provider</label>
              <select value={lendingProvider} onChange={e => setLendingProvider(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 appearance-none">
                {network === 'solana' ? (
                  <>
                    <option value="solend">Solend (Main Pool)</option>
                    <option value="kamino">Kamino Finance (K-Lend)</option>
                    <option value="none">Recursos Próprios (Sem Flash Loan)</option>
                  </>
                ) : (
                  <>
                    <option value="aave">Aave V3</option>
                    <option value="balancer">Balancer FlashLoans</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Base Token (Symbol or Address)</label>
              <input required value={tokenAMint} onChange={e => setTokenAMint(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 font-mono text-sm" placeholder="e.g. USDC or 0x..." />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Target Token (Symbol or Address)</label>
              <input required value={tokenBMint} onChange={e => setTokenBMint(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 font-mono text-sm" placeholder="e.g. WETH or 0x..." />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Borrow Amount ({KNOWN_TOKENS.find(t => t.mint === tokenAMint)?.symbol || 'USDC'})</label>
              <input required type="number" value={borrowAmount} onChange={e => setBorrowAmount(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 font-mono" placeholder="100" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Min. Profit ({KNOWN_TOKENS.find(t => t.mint === tokenAMint)?.symbol || 'USDC'})</label>
              <input required type="number" step="0.01" value={minProfitUsdc} onChange={e => setMinProfitUsdc(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 font-mono" placeholder="0" />
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg flex items-start gap-4">
            <div className="pt-1">
              <input 
                type="checkbox" 
                id="mevProtection"
                checked={mevProtection}
                onChange={(e) => setMevProtection(e.target.checked)}
                className="w-4 h-4 text-indigo-600 bg-slate-900 border-slate-700 rounded focus:ring-indigo-600 focus:ring-2"
              />
            </div>
            <div>
              <label htmlFor="mevProtection" className="block text-sm font-medium text-white mb-1 flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" /> Private RPC / MEV Protection
              </label>
              <p className="text-xs text-slate-400">
                Routes transactions through a private RPC (like Jito Block Engine). 
                Protects against frontrunning and failed transaction gas fees. 
                <span className="text-emerald-400 ml-1">Highly Recommended.</span>
              </p>
            </div>
          </div>

          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 mt-4">
            <Plus className="w-5 h-5" /> Deploy Strategy
          </button>
        </form>
      </div>
      )}

      <div className="mt-8 bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-sm">
        <h4 className="text-lg font-medium text-white mb-6 flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-500" /> Recent Arbitrage Operations
        </h4>
        
        {trades.length === 0 ? (
          <div className="p-8 border border-dashed border-slate-700 rounded-xl text-center text-slate-500">
            No operations found. Deployed strategies will record executed trades here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-400 uppercase bg-slate-950 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Borrowed</th>
                  <th className="px-4 py-3">Fee</th>
                  <th className="px-4 py-3">Expected Profit</th>
                  <th className="px-4 py-3">Actual Profit</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Explorer</th>
                </tr>
              </thead>
              <tbody>
                {trades.map(trade => (
                  <tr key={trade._id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {new Date(trade.createdAt).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {new Date(trade.createdAt).toLocaleDateString('pt-BR')}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-white font-mono">
                      ${trade.amountBorrowed.toLocaleString()} <span className="text-indigo-400 text-xs">{trade.tokenBorrowed}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                      ${trade.flashLoanFee.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-emerald-400 font-mono font-semibold">
                      +${trade.expectedProfit.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold">
                      {trade.actualProfit > 0 ? (
                        <span className="text-emerald-400">+${trade.actualProfit.toFixed(4)}</span>
                      ) : trade.status === 'success' ? (
                        <span className="text-emerald-400">+${trade.expectedProfit.toFixed(4)}</span>
                      ) : (
                        <span className="text-slate-500">$0.0000</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {trade.status === 'success' && <span className="text-emerald-400 text-xs font-bold uppercase bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Success</span>}
                      {trade.status === 'failed' && <span className="text-red-400 text-xs font-bold uppercase bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20" title={trade.errorMessage}>Failed</span>}
                      {trade.status === 'pending' && <span className="text-amber-400 text-xs font-bold uppercase bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 animate-pulse">Pending</span>}
                      {trade.status === 'simulated' && <span className="text-sky-400 text-xs font-bold uppercase bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">Simulated</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {trade.txid ? (
                        <a 
                          href={`https://solscan.io/tx/${trade.txid}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="inline-flex items-center gap-1 text-slate-400 hover:text-indigo-400 transition-colors bg-slate-800/50 hover:bg-slate-800 px-2 py-1 rounded text-xs"
                        >
                          View <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-500 text-xs font-mono">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingStrategy && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg w-full max-w-md my-8">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Pencil className="w-5 h-5 text-indigo-500" /> Edit Strategy
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Network</label>
                  <select value={editingStrategy.network || 'solana'} onChange={e => {
                    const newNet = e.target.value;
                    setEditingStrategy({
                      ...editingStrategy, 
                      network: newNet,
                      provider: newNet === 'solana' ? 'jupiter' : 'uniswap',
                      lendingProvider: newNet === 'solana' ? 'solend' : 'aave'
                    });
                  }} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 appearance-none">
                    <option value="solana">Solana</option>
                    <option value="arbitrum">Arbitrum (EVM)</option>
                    <option value="polygon">Polygon (EVM)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Strategy Name</label>
                  <input value={editingStrategy.name} onChange={e => setEditingStrategy({...editingStrategy, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Execution Wallet</label>
                  <select value={editingStrategy.walletId || ''} onChange={e => setEditingStrategy({...editingStrategy, walletId: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 appearance-none">
                    <option value="" disabled>Select a wallet</option>
                    {wallets.map(w => (
                      <option key={w._id} value={w._id}>{w.acronym} - {w.publicKey.substring(0,6)}...{w.publicKey.substring(w.publicKey.length-4)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Lending Provider</label>
                  <select value={editingStrategy.lendingProvider} onChange={e => setEditingStrategy({...editingStrategy, lendingProvider: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 appearance-none">
                    {(editingStrategy.network || 'solana') === 'solana' ? (
                      <>
                        <option value="solend">Solend (Main Pool)</option>
                        <option value="kamino">Kamino Finance (K-Lend)</option>
                        <option value="none">Recursos Próprios</option>
                      </>
                    ) : (
                      <>
                        <option value="aave">Aave V3</option>
                        <option value="balancer">Balancer FlashLoans</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  {(editingStrategy.network || 'solana') === 'solana' ? (
                    <>
                      <label className="block text-sm text-slate-400 mb-1">DEX Provider</label>
                      <select value={editingStrategy.provider} onChange={e => setEditingStrategy({...editingStrategy, provider: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 appearance-none">
                        <option value="jupiter">Jupiter</option>
                        <option value="raptor">Raptor API</option>
                      </select>
                    </>
                  ) : (
                    <>
                      <label className="block text-sm text-slate-400 mb-1">DEX Providers</label>
                      <input disabled value="Auto-Routing (All DEXes)" className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-4 py-2 text-slate-500 outline-none cursor-not-allowed" />
                    </>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Base Token (Symbol or Address)</label>
                  <input value={getDisplaySymbol(editingStrategy.tokenAMint)} onChange={e => setEditingStrategy({...editingStrategy, tokenAMint: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 font-mono text-sm" placeholder="e.g. USDC or 0x..." />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Target Token (Symbol or Address)</label>
                  <input value={getDisplaySymbol(editingStrategy.tokenBMint)} onChange={e => setEditingStrategy({...editingStrategy, tokenBMint: e.target.value, tokenBSymbol: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 font-mono text-sm" placeholder="e.g. WETH or 0x..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Borrow Amount ({KNOWN_TOKENS.find(t => t.mint === editingStrategy.tokenAMint)?.symbol || 'USDC'})</label>
                  <input type="number" value={editingStrategy.borrowAmount || 0} onChange={e => setEditingStrategy({...editingStrategy, borrowAmount: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 font-mono" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Min. Profit ({KNOWN_TOKENS.find(t => t.mint === editingStrategy.tokenAMint)?.symbol || 'USDC'})</label>
                  <input type="number" step="0.01" value={editingStrategy.minProfitUsdc ?? 0} onChange={e => setEditingStrategy({...editingStrategy, minProfitUsdc: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 font-mono" />
                </div>
              </div>
              
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg flex items-start gap-4">
                <div className="pt-1">
                  <input 
                    type="checkbox" 
                    id="editMevProtection"
                    checked={editingStrategy.mevProtection ?? true}
                    onChange={(e) => setEditingStrategy({...editingStrategy, mevProtection: e.target.checked})}
                    className="w-4 h-4 text-indigo-600 bg-slate-900 border-slate-700 rounded focus:ring-indigo-600 focus:ring-2"
                  />
                </div>
                <div>
                  <label htmlFor="editMevProtection" className="block text-sm font-medium text-white mb-1 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-400" /> Private RPC / MEV Protection
                  </label>
                  <p className="text-xs text-slate-400">
                    Use Jito bundles to prevent frontrunning and save on gas.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setEditingStrategy(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg transition-colors">Cancel</button>
                <button onClick={handleEditSubmit} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg transition-colors font-medium">Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
