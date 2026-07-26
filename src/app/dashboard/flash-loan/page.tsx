'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Zap, Settings, Play, Pause, AlertTriangle, Pencil, Activity, Clock, TrendingUp, TrendingDown, ExternalLink, ScanSearch, CheckCircle2, XCircle, Loader2, RefreshCw, TriangleAlert } from 'lucide-react';
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

  // --- Monitor Snapshot ---
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotResult, setSnapshotResult] = useState<any>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [snapshotAmount, setSnapshotAmount] = useState('100');
  const [snapshotForceExecute, setSnapshotForceExecute] = useState(false);

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

  const runMonitorSnapshot = async () => {
    setSnapshotLoading(true);
    setSnapshotResult(null);
    setSnapshotError(null);
    try {
      const res = await fetch(`/api/monitor/snapshot?amount=${snapshotAmount}&forceExecute=${snapshotForceExecute}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (!res.ok) {
        setSnapshotError(data.error || 'Erro desconhecido');
      } else {
        setSnapshotResult(data);
      }
    } catch (e: any) {
      setSnapshotError(e.message || 'Falha ao conectar com a API');
    } finally {
      setSnapshotLoading(false);
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

      {/* ===== PAINEL: MONITOR SOLANA SNAPSHOT ===== */}
      <div className="mt-8 overflow-hidden rounded-2xl" style={{background: 'linear-gradient(135deg, #0f0c1a 0%, #0d1117 40%, #0a0f1e 100%)', border: '1px solid rgba(139,92,246,0.2)', boxShadow: '0 0 60px -10px rgba(139,92,246,0.15)'}}>
        
        {/* Glow top bar */}
        <div style={{height: '2px', background: 'linear-gradient(90deg, transparent, #8b5cf6, #a78bfa, #8b5cf6, transparent)'}} />

        <div className="p-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 4px 15px rgba(124,58,237,0.4)'}}>
                  <ScanSearch className="w-4 h-4 text-white" />
                </div>
                <h4 className="text-xl font-bold text-white tracking-tight">Monitor Solana</h4>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)'}}>SCAN RÁPIDO</span>
              </div>
              <p className="text-sm text-slate-400 ml-12">Cotações ao vivo via RPC · Orca · Raydium · Meteora · SOL/USDC</p>
            </div>

            <div className="flex items-center gap-3 ml-12 sm:ml-0">
              <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700/50 rounded-xl px-3 py-2">
                <span className="text-xs text-slate-400 font-medium">Capital</span>
                <span className="text-slate-600">|</span>
                <span className="text-xs text-violet-300 font-bold">USDC</span>
                <input
                  type="number"
                  value={snapshotAmount}
                  onChange={e => setSnapshotAmount(e.target.value)}
                  className="w-16 bg-transparent text-white outline-none font-mono text-sm text-center"
                  min="1"
                  disabled={snapshotLoading}
                />
              </div>

              <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700/50 rounded-xl px-3 py-2 cursor-pointer" onClick={() => !snapshotLoading && setSnapshotForceExecute(!snapshotForceExecute)}>
                <input
                  type="checkbox"
                  checked={snapshotForceExecute}
                  onChange={() => {}}
                  className="w-4 h-4 text-rose-500 bg-slate-900 border-slate-700 rounded focus:ring-rose-500 focus:ring-2 pointer-events-none"
                />
                <span className="text-xs text-rose-400 font-bold uppercase tracking-wider">Forçar Jito</span>
              </div>

              <button
                id="btn-monitor-snapshot"
                onClick={runMonitorSnapshot}
                disabled={snapshotLoading}
                className="relative flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden group"
                style={{background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 4px 20px rgba(124,58,237,0.35)'}}
              >
                <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{background: 'linear-gradient(135deg, #6d28d9, #4338ca)'}} />
                <span className="relative flex items-center gap-2">
                  {snapshotLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Escaneando...</>
                    : <><ScanSearch className="w-4 h-4" /> Executar Scan</>}
                </span>
              </button>
            </div>
          </div>

          {/* Estado inicial */}
          {!snapshotLoading && !snapshotResult && !snapshotError && (
            <div className="py-16 flex flex-col items-center gap-5">
              <div className="relative">
                <div className="w-24 h-24 rounded-full flex items-center justify-center" style={{background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)', border: '1px dashed rgba(139,92,246,0.3)'}}>
                  <ScanSearch className="w-10 h-10 text-violet-500/60" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-violet-500/20 border border-violet-500/40 animate-ping" />
              </div>
              <div className="text-center">
                <p className="text-slate-300 font-medium mb-2">Pronto para escanear o mercado</p>
                <p className="text-sm text-slate-500">Clique em <span className="text-violet-400 font-semibold">Executar Scan</span> para buscar as cotações ao vivo</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-900/60 border border-slate-800 rounded-lg px-4 py-2">
                <span className="text-slate-500">Servidor:</span>
                <code className="text-violet-400 font-mono">npx tsx snapshot.ts</code>
                <span className="text-slate-600">na pasta flash-solana</span>
              </div>
            </div>
          )}

          {/* Loading */}
          {snapshotLoading && (
            <div className="py-16 flex flex-col items-center gap-6">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full animate-spin" style={{border: '2px solid transparent', borderTopColor: '#8b5cf6', borderRightColor: '#8b5cf6'}} />
                <div className="absolute inset-2 rounded-full animate-spin" style={{border: '2px solid transparent', borderTopColor: '#a78bfa', animationDirection: 'reverse', animationDuration: '0.8s'}} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{background: 'rgba(139,92,246,0.2)'}}>
                    <ScanSearch className="w-4 h-4 text-violet-400" />
                  </div>
                </div>
              </div>
              <div className="text-center">
                <p className="text-white font-semibold mb-1">Conectando ao RPC Solana...</p>
                <p className="text-sm text-slate-500">Lendo estado das pools Orca · Raydium · Meteora</p>
              </div>
              <div className="flex items-center gap-3">
                {['Orca', 'Raydium', 'Meteora'].map((d, i) => (
                  <div key={d} className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" style={{animationDelay: `${i * 200}ms`}} />
                    {d}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Erro */}
          {snapshotError && !snapshotLoading && (
            <div className="rounded-xl p-5 flex items-start gap-4" style={{background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)'}}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{background: 'rgba(239,68,68,0.15)'}}>
                <XCircle className="w-5 h-5 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h5 className="text-red-400 font-bold mb-1">Falha no Scan</h5>
                <p className="text-red-200/70 text-sm break-words">{snapshotError}</p>
                <div className="mt-3 flex items-center gap-2 text-xs bg-red-950/30 border border-red-500/10 rounded-lg px-3 py-2 font-mono text-red-300/50">
                  <span>$</span><span>cd flash-solana && npm run start:snapshot</span>
                </div>
              </div>
              <button onClick={() => setSnapshotError(null)} className="text-red-500/30 hover:text-red-400 transition-colors shrink-0">
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Resultado */}
          {snapshotResult && !snapshotLoading && (() => {
            const r = snapshotResult;
            const prices = r.quotes.filter((q: any) => q.status === 'ok').map((q: any) => q.price);
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            const spreadPct = prices.length > 1 ? ((maxPrice - minPrice) / minPrice) * 100 : 0;

            return (
              <div className="space-y-6">

                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-600 font-mono">{new Date(r.timestamp).toLocaleTimeString('pt-BR')}</span>
                  <span className="text-slate-700">·</span>
                  <span className="text-slate-500 font-mono font-semibold">{r.pair}</span>
                  <span className="text-slate-700">·</span>
                  <span className="text-slate-500">${r.borrowAmount} USDC simulados</span>
                  <span className="text-slate-700">·</span>
                  <span className="text-slate-600">⚡ {r.durationMs}ms via RPC</span>
                  <button
                    onClick={runMonitorSnapshot}
                    className="ml-auto flex items-center gap-1.5 text-slate-400 hover:text-violet-400 transition-colors bg-slate-800/60 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700/50"
                  >
                    <RefreshCw className="w-3 h-3" /> Atualizar
                  </button>
                </div>

                {/* DEX Quote Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {r.quotes.map((q: any, idx: number) => {
                    const isHighest = q.status === 'ok' && q.price === maxPrice;
                    const isLowest = q.status === 'ok' && q.price === minPrice && prices.length > 1;
                    const barWidth = q.status === 'ok' && prices.length > 1
                      ? ((q.price - minPrice) / (maxPrice - minPrice || 1)) * 100
                      : 0;
                    const colors = [
                      {grad: 'from-cyan-500/10 to-cyan-500/5', border: 'rgba(6,182,212,0.25)', dot: '#06b6d4', bar: 'rgba(6,182,212,0.5)'},
                      {grad: 'from-amber-500/10 to-amber-500/5', border: 'rgba(245,158,11,0.25)', dot: '#f59e0b', bar: 'rgba(245,158,11,0.5)'},
                      {grad: 'from-violet-500/10 to-violet-500/5', border: 'rgba(139,92,246,0.25)', dot: '#8b5cf6', bar: 'rgba(139,92,246,0.5)'},
                      {grad: 'from-lime-500/10 to-lime-500/5', border: 'rgba(132,204,22,0.25)', dot: '#84cc16', bar: 'rgba(132,204,22,0.5)'},
                    ];
                    const c = colors[idx] || colors[0];
                    return (
                      <div
                        key={q.dex}
                        className={clsx('rounded-2xl p-5 relative overflow-hidden transition-all', q.status !== 'ok' && 'opacity-50')}
                        style={{background: `linear-gradient(135deg, rgba(15,12,26,0.9), rgba(10,15,30,0.8))`, border: `1px solid ${c.border}`}}
                      >
                        {/* Top accent */}
                        <div className="absolute top-0 left-0 right-0 h-px" style={{background: `linear-gradient(90deg, transparent, ${c.dot}, transparent)`}} />

                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{background: c.dot, boxShadow: `0 0 8px ${c.dot}`}} />
                            <span className="text-sm font-bold text-white">{q.dex}</span>
                          </div>
                          {q.status === 'ok' ? (
                            <div className="flex flex-col items-end gap-1">
                              {isHighest && prices.length > 1 && (
                                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">VENDER AQUI</span>
                              )}
                              {isLowest && (
                                <span className="text-[9px] font-black uppercase tracking-widest text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-full">COMPRAR AQUI</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[9px] font-black uppercase text-red-400/60">OFFLINE</span>
                          )}
                        </div>

                        {q.status === 'ok' ? (
                          <>
                            {/* Price */}
                            <div className="mb-4">
                              <p className="text-3xl font-black text-white font-mono tracking-tight">
                                ${q.price.toFixed(2)}
                                <span className="text-base font-normal text-slate-500 ml-1">.{q.price.toFixed(6).split('.')[1]?.slice(2)}</span>
                              </p>
                              <p className="text-xs text-slate-500 mt-1">1 SOL → USDC</p>
                            </div>

                            {/* Spread bar */}
                            <div className="space-y-1.5">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="text-slate-600">Spread relativo</span>
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className="px-1.5 py-0.5 rounded font-bold uppercase tracking-wide"
                                    style={{
                                      fontSize: '8px',
                                      background: q.feeSource === 'onchain' ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.12)',
                                      color: q.feeSource === 'onchain' ? '#34d399' : '#64748b',
                                      border: `1px solid ${q.feeSource === 'onchain' ? 'rgba(16,185,129,0.25)' : 'rgba(100,116,139,0.2)'}`,
                                    }}
                                  >
                                    {q.feeSource === 'onchain' ? '⛓ on-chain' : 'estimada'}
                                  </span>
                                  <span className="text-slate-500 font-mono">Fee {(q.feeRawPct ?? ((1 - q.fee) * 100)).toFixed(3)}%</span>
                                </div>
                              </div>
                              <div className="h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-700"
                                  style={{width: `${Math.max(barWidth, 8)}%`, background: `linear-gradient(90deg, ${c.dot}80, ${c.dot})`}}
                                />
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="py-4">
                            <p className="text-sm text-slate-500">Pool indisponível</p>
                            <p className="text-xs text-slate-600 mt-1">{q.error}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Spread summary */}
                {prices.length > 1 && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)'}}>
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 mb-1">Spread Bruto entre pools</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-800/80 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{width: `${Math.min(spreadPct * 500, 100)}%`, background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)'}} />
                        </div>
                        <span className="text-sm font-bold font-mono text-violet-300">{spreadPct.toFixed(4)}%</span>
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <p className="text-slate-600">Diferença</p>
                      <p className="text-slate-300 font-mono font-semibold">${(maxPrice - minPrice).toFixed(4)}</p>
                    </div>
                  </div>
                )}

                {/* Resultado de arbitragem */}
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: r.hasOpportunity
                      ? 'linear-gradient(135deg, rgba(4,120,87,0.12), rgba(6,78,59,0.08))'
                      : 'linear-gradient(135deg, rgba(15,23,42,0.8), rgba(10,15,30,0.6))',
                    border: r.hasOpportunity ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(51,65,85,0.5)',
                  }}
                >
                  {/* Result header */}
                  <div className="px-6 py-4 flex items-center gap-4" style={{borderBottom: r.hasOpportunity ? '1px solid rgba(16,185,129,0.15)' : '1px solid rgba(51,65,85,0.3)'}}>
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{background: r.hasOpportunity ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.1)'}}
                    >
                      {r.hasOpportunity
                        ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        : <TriangleAlert className="w-5 h-5 text-slate-500" />
                      }
                    </div>
                    <div>
                      <h5 className={clsx('font-black text-lg', r.hasOpportunity ? 'text-emerald-400' : 'text-slate-400')}>
                        {r.hasOpportunity ? 'Oportunidade Detectada!' : 'Sem Oportunidade Lucrativa'}
                      </h5>
                      <p className="text-xs text-slate-500">
                        {r.hasOpportunity
                          ? `Lucro potencial com $${r.borrowAmount} USDC de capital`
                          : 'Spread insuficiente para cobrir as taxas de transação'}
                      </p>
                    </div>

                    {r.bestRoute && (
                      <div className="ml-auto text-right">
                        <p className={clsx('text-3xl font-black font-mono', r.bestRoute.profit > 0 ? 'text-emerald-400' : 'text-rose-400')}>
                          {r.bestRoute.profit > 0 ? '+' : ''}${r.bestRoute.profit.toFixed(4)}
                        </p>
                        <p className={clsx('text-xs font-semibold font-mono', r.bestRoute.profitPct > 0 ? 'text-emerald-500' : 'text-rose-500')}>
                          {r.bestRoute.profitPct > 0 ? '+' : ''}{r.bestRoute.profitPct.toFixed(4)}% ROI
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Routes table */}
                  <div className="px-6 py-4 space-y-2">
                    <p className="text-[10px] uppercase tracking-widest text-slate-600 font-bold mb-3">Todas as rotas · ordenadas por profit</p>
                    {r.allRoutes.map((route: any, i: number) => {
                      const isFirst = i === 0;
                      const maxAbs = Math.abs(r.allRoutes[0]?.profit || 1);
                      const barW = Math.abs(route.profit) / maxAbs * 100;
                      return (
                        <div
                          key={i}
                          className={clsx('flex items-center gap-4 px-4 py-3 rounded-xl transition-all', isFirst && r.hasOpportunity && 'ring-1 ring-emerald-500/30')}
                          style={{background: isFirst ? (r.hasOpportunity ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.04)') : 'rgba(15,23,42,0.4)'}}
                        >
                          <span className="text-[10px] font-bold text-slate-600 w-4 shrink-0">#{i + 1}</span>
                          <span className="text-sm text-slate-300 flex-1">{route.route}</span>
                          <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden shrink-0">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${barW}%`,
                                background: route.profit > 0 ? 'linear-gradient(90deg, #059669, #10b981)' : 'linear-gradient(90deg, #be123c, #f43f5e)'
                              }}
                            />
                          </div>
                          <span className={clsx('font-black font-mono text-sm w-24 text-right shrink-0', route.profit > 0 ? 'text-emerald-400' : 'text-rose-400')}>
                            {route.profit > 0 ? '+' : ''}${route.profit.toFixed(4)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ===== SIMULAÇÃO DE FLASH LOAN ===== */}
                {r.flashLoanSim && r.flashLoanSim.triggered && (() => {
                  const sim = r.flashLoanSim;
                  const isProfit = sim.isProfitable;
                  const isWarn = !isProfit && sim.netProfit > -sim.fees.totalFees * 0.5;

                  return (
                    <div
                      className="rounded-2xl overflow-hidden"
                      style={{
                        background: 'linear-gradient(135deg, rgba(15,12,26,0.95), rgba(10,15,30,0.9))',
                        border: isProfit
                          ? '1px solid rgba(16,185,129,0.3)'
                          : isWarn
                            ? '1px solid rgba(245,158,11,0.3)'
                            : '1px solid rgba(99,102,241,0.25)',
                        boxShadow: isProfit
                          ? '0 0 30px -8px rgba(16,185,129,0.15)'
                          : '0 0 30px -8px rgba(99,102,241,0.1)',
                      }}
                    >
                      {/* Top accent bar */}
                      <div style={{height: '2px', background: isProfit
                        ? 'linear-gradient(90deg, transparent, #10b981, transparent)'
                        : isWarn
                          ? 'linear-gradient(90deg, transparent, #f59e0b, transparent)'
                          : 'linear-gradient(90deg, transparent, #6366f1, transparent)'
                      }} />

                      {/* Header */}
                      <div className="px-6 py-4 flex items-center gap-4" style={{borderBottom: '1px solid rgba(30,41,59,0.8)'}}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', boxShadow: '0 4px 15px rgba(99,102,241,0.3)'}}>
                          <Zap className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="text-white font-black text-base">Simulação de Flash Loan</p>
                          <p className="text-xs text-slate-500">
                            Disparado porque profit bruto (${sim.grossProfit.toFixed(4)}) &lt; ${sim.threshold.toFixed(2)} · Protocolo: {sim.lendingProvider}
                          </p>
                        </div>
                        <div className={`ml-auto px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider ${
                          isProfit
                            ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                            : isWarn
                              ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                              : 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
                        }`}>
                          {isProfit ? 'Lucrativo' : isWarn ? 'Marginal' : 'Inviável'}
                        </div>
                      </div>

                      <div className="px-6 py-5 space-y-5">

                        {/* Breakdown de fees */}
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-slate-600 font-bold mb-3">Breakdown de Custos</p>
                          <div className="space-y-2">
                            {/* Profit bruto */}
                            <div className="flex items-center justify-between py-2 px-3 rounded-lg" style={{background: 'rgba(15,23,42,0.6)'}}>
                              <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                                <span className="text-sm text-slate-300">Profit Bruto (spread das DEXes)</span>
                              </div>
                              <span className={`font-mono font-bold text-sm ${sim.grossProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {sim.grossProfit >= 0 ? '+' : ''}${sim.grossProfit.toFixed(6)}
                              </span>
                            </div>

                            {/* Divider */}
                            <div className="relative flex items-center gap-2 py-1">
                              <div className="flex-1 h-px bg-slate-800" />
                              <span className="text-[9px] text-slate-600 uppercase tracking-widest">Custos</span>
                              <div className="flex-1 h-px bg-slate-800" />
                            </div>

                            {/* Flash loan fee */}
                            <div className="flex items-center justify-between py-2 px-3 rounded-lg" style={{background: 'rgba(15,23,42,0.4)'}}>
                              <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                <span className="text-sm text-slate-400">{sim.fees.lendingProvider} Flash Loan Fee</span>
                                <span className="text-[10px] text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded font-mono">{sim.fees.flashLoanFeePct.toFixed(2)}%</span>
                              </div>
                              <span className="font-mono text-sm text-rose-400/80">−${sim.fees.flashLoanFee.toFixed(6)}</span>
                            </div>

                            {/* Solana network fee */}
                            <div className="flex items-center justify-between py-2 px-3 rounded-lg" style={{background: 'rgba(15,23,42,0.4)'}}>
                              <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                                <span className="text-sm text-slate-400">Solana Network Fee</span>
                                <span className="text-[10px] text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded font-mono">~0.00041 SOL</span>
                              </div>
                              <span className="font-mono text-sm text-rose-400/80">−${sim.fees.solanaNetworkFee.toFixed(6)}</span>
                            </div>

                            {/* Jito bundle tip */}
                            <div className="flex items-center justify-between py-2 px-3 rounded-lg" style={{background: 'rgba(15,23,42,0.4)'}}>
                              <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                <span className="text-sm text-slate-400">Jito Bundle Tip</span>
                                <span className="text-[10px] text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded font-mono">0.001 SOL</span>
                              </div>
                              <span className="font-mono text-sm text-rose-400/80">−${sim.fees.jitoBundleTip.toFixed(6)}</span>
                            </div>

                            {/* Total fees divider */}
                            <div className="border-t border-slate-800/80 pt-2">
                              <div className="flex items-center justify-between py-2 px-3 rounded-lg" style={{background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.1)'}}>
                                <span className="text-sm font-semibold text-slate-300">Total de Taxas</span>
                                <span className="font-mono font-bold text-sm text-rose-400">−${sim.fees.totalFees.toFixed(6)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Net profit resultado */}
                        <div
                          className="rounded-xl p-4 flex items-center justify-between"
                          style={{
                            background: isProfit
                              ? 'linear-gradient(135deg, rgba(4,120,87,0.15), rgba(6,78,59,0.1))'
                              : 'linear-gradient(135deg, rgba(127,29,29,0.15), rgba(69,10,10,0.1))',
                            border: isProfit ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(239,68,68,0.2)',
                          }}
                        >
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Lucro Líquido (após todas as taxas)</p>
                            <p className={`text-3xl font-black font-mono ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {sim.netProfit >= 0 ? '+' : ''}${sim.netProfit.toFixed(6)}
                            </p>
                            <p className={`text-xs font-mono font-semibold mt-0.5 ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {sim.netProfitPct >= 0 ? '+' : ''}{sim.netProfitPct.toFixed(4)}% ROI líquido
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-500 mb-1">SOL price usado</p>
                            <p className="text-sm font-mono text-slate-300">${sim.solPriceUsed.toFixed(2)}</p>
                          </div>
                        </div>

                        {/* Veredito */}
                        <div className="flex items-start gap-3 px-4 py-3 rounded-xl" style={{background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(30,41,59,0.5)'}}>
                          <div className="text-base mt-0.5">{isProfit ? '✅' : isWarn ? '⚠️' : '❌'}</div>
                          <div>
                            <p className={`text-sm font-bold ${isProfit ? 'text-emerald-400' : isWarn ? 'text-amber-400' : 'text-rose-400'}`}>
                              Veredito
                            </p>
                            <p className="text-sm text-slate-300 mt-0.5">{sim.verdict}</p>
                          </div>
                        </div>

                        {/* Break-even capital */}
                        {!isProfit && isFinite(sim.breakEvenCapital) && (
                          <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)'}}>
                            <div>
                              <p className="text-xs text-slate-500 mb-0.5">Capital mínimo para break-even</p>
                              <p className="text-xs text-slate-600">Com este spread, seria necessário:</p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-black font-mono text-violet-300">
                                ${sim.breakEvenCapital.toLocaleString('pt-BR')}
                              </p>
                              <p className="text-xs text-violet-500 font-mono">USDC de capital</p>
                            </div>
                          </div>
                        )}

                      </div>
                    </div>
                  );
                })()}
                {/* ===== FIM DA SIMULAÇÃO ===== */}

              </div>
            );
          })()}
        </div>

        {/* Bottom glow */}
        <div style={{height: '1px', background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.15), transparent)'}} />
      </div>
      {/* ===== FIM DO PAINEL SNAPSHOT ===== */}

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
