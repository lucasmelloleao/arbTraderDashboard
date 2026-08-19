'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Key, Link as LinkIcon, Pencil, Sparkles, AlertTriangle, X, Copy, Check, Edit2, QrCode, Send, Wallet as WalletIcon } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import clsx from 'clsx';
import { useLanguage } from '@/lib/i18n';

// --- CEX Constants & Types ---
const SUPPORTED_EXCHANGES = [
  { id: 'mexc', name: 'MEXC' },
  { id: 'binance', name: 'Binance' },
  { id: 'okx', name: 'OKX' },
  { id: 'bybit', name: 'Bybit' },
  { id: 'gateio', name: 'Gate.io' },
  { id: 'ctrader', name: 'cTrader (Pepperstone)' },
  { id: 'fix', name: 'FIX API (Pepperstone)' }
];

const CTRADER_IDS = ['ctrader', 'pepperstone'];
const FIX_IDS = ['fix', 'pepperstone-fix', 'ctrader-fix'];

type ExchangeKey = {
  _id: string;
  exchangeId: string;
  name: string;
  apiKey: string;
  clientId?: string;
  accountId?: string;
  environment?: string;
  host?: string;
  senderCompId?: string;
  targetCompId?: string;
  username?: string;
  quotePort?: number;
  tradePort?: number;
  active: boolean;
  createdAt: string;
};

// --- DEX (Wallets) Constants & Types ---
type TokenBalance = {
  symbol: string;
  mint: string;
  balance: number;
}

type Wallet = {
  _id: string;
  acronym: string;
  network?: string;
  publicKey: string;
  balanceSol?: number | null;
  tokens?: TokenBalance[];
}

export default function ExchangesPage() {
  // --- Tab State ---
  const [activeTab, setActiveTab] = useState<'cex' | 'dex'>('cex');
  const { t } = useLanguage();

  // ==========================================
  // CEX STATES
  // ==========================================
  const [exchanges, setExchanges] = useState<ExchangeKey[]>([]);
  const [exchangeId, setExchangeId] = useState(SUPPORTED_EXCHANGES[0].id);
  const [cexName, setCexName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  // cTrader Open API fields
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [accountId, setAccountId] = useState('');
  const [environment, setEnvironment] = useState<'live' | 'demo'>('live');
  // FIX API fields
  const [fixHost, setFixHost] = useState('');
  const [fixQuotePort, setFixQuotePort] = useState('5211');
  const [fixTradePort, setFixTradePort] = useState('5212');
  const [fixSenderCompId, setFixSenderCompId] = useState('');
  const [fixTargetCompId, setFixTargetCompId] = useState('CSERVER');
  const [fixUsername, setFixUsername] = useState('');
  const [fixPassword, setFixPassword] = useState('');
  const [cexLoading, setCexLoading] = useState(false);
  const [editingCexId, setEditingCexId] = useState<string | null>(null);
  const [isCexFormOpen, setIsCexFormOpen] = useState(false);

  // ==========================================
  // DEX (WALLETS) STATES
  // ==========================================
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [dexLoading, setDexLoading] = useState(true);
  
  // Import state
  const [acronym, setAcronym] = useState('');
  const [network, setNetwork] = useState('Solana');
  const [secretKey, setSecretKey] = useState('');

  // Generate state
  const [generateAcronym, setGenerateAcronym] = useState('');
  const [generateNetwork, setGenerateNetwork] = useState('Solana');
  const [generatedMnemonic, setGeneratedMnemonic] = useState('');
  
  // Modals state
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [copied, setCopied] = useState(false);
  
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  const [editAcronym, setEditAcronym] = useState('');

  const [transferWallet, setTransferWallet] = useState<Wallet | null>(null);
  const [transferToAddress, setTransferToAddress] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [transferSuccess, setTransferSuccess] = useState('');

  // ==========================================
  // CEX FUNCTIONS
  // ==========================================
  const fetchExchanges = async () => {
    try {
      const res = await fetch('/api/exchanges', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setExchanges(data.exchanges || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCexSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCexLoading(true);
    try {
      const saved = await saveCexKey();
      if (saved) {
        resetCexForm();
        fetchExchanges();
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to save exchange key');
    } finally {
      setCexLoading(false);
    }
  };

  // Salva a chave (cria ou atualiza) e retorna o id salvo (ou null em falha).
  const saveCexKey = async (): Promise<string | null> => {
    const url = '/api/exchanges';
    const method = editingCexId ? 'PUT' : 'POST';
    const isCtraderKey = CTRADER_IDS.includes(exchangeId);
    const isFixKey = FIX_IDS.includes(exchangeId);
    const baseBody: any = { exchangeId, name: cexName };
    if (isCtraderKey) {
      Object.assign(baseBody, {
        clientId,
        clientSecret,
        accessToken,
        refreshToken,
        accountId,
        environment,
      });
    } else if (isFixKey) {
      Object.assign(baseBody, {
        host: fixHost,
        quotePort: fixQuotePort,
        tradePort: fixTradePort,
        senderCompId: fixSenderCompId,
        targetCompId: fixTargetCompId,
        username: fixUsername,
        password: fixPassword,
      });
    } else {
      Object.assign(baseBody, { apiKey, apiSecret });
    }
    if (editingCexId) baseBody.id = editingCexId;

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify(baseBody),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.reason || 'Failed to save exchange key');
    }
    return data.exchange?._id || editingCexId;
  };

  // Salva a chave cTrader e abre o fluxo OAuth para obter os tokens.
  // Escopo 'accounts' = leitura (funciona com app "Submitted"); quando o app for
  // aprovado ("Active"), troque para 'trading' para operar ordens.
  const handleCtraderAuthorize = async () => {
    if (!clientId.trim()) { alert('Preencha o Client ID antes de autorizar.'); return; }
    setCexLoading(true);
    try {
      const savedId = await saveCexKey();
      if (!savedId) throw new Error('Falha ao salvar a chave');
      resetCexForm();
      fetchExchanges();
      // Abre o login do cTrader ID; ao voltar, o redirect (raiz) captura o ?code=
      // e o /api/ctrader/callback salva os tokens usando o clientSecret salvo.
      const authUrl = `https://openapi.ctrader.com/apps/auth?client_id=${encodeURIComponent(clientId.trim())}&redirect_uri=${encodeURIComponent('https://arb-trader-dashboard.vercel.app/')}&scope=accounts`;
      window.location.href = authUrl;
    } catch (err: any) {
      alert(err?.message || 'Falha ao salvar a chave antes de autorizar');
    } finally {
      setCexLoading(false);
    }
  };

  const resetCexForm = () => {
    setExchangeId(SUPPORTED_EXCHANGES[0].id);
    setCexName('');
    setApiKey('');
    setApiSecret('');
    setClientId('');
    setClientSecret('');
    setAccessToken('');
    setRefreshToken('');
    setAccountId('');
    setEnvironment('live');
    setFixHost('');
    setFixQuotePort('5211');
    setFixTradePort('5212');
    setFixSenderCompId('');
    setFixTargetCompId('CSERVER');
    setFixUsername('');
    setFixPassword('');
    setEditingCexId(null);
    setIsCexFormOpen(false);
  };

  const handleCexEdit = (exchange: ExchangeKey) => {
    setEditingCexId(exchange._id);
    setExchangeId(exchange.exchangeId);
    setCexName(exchange.name);
    setApiKey(exchange.apiKey);
    setApiSecret(''); // Leave blank to keep existing secret
    const isCtraderKey = CTRADER_IDS.includes(exchange.exchangeId);
    const isFixKey = FIX_IDS.includes(exchange.exchangeId);
    setClientId(isCtraderKey ? (exchange.clientId || exchange.apiKey) : '');
    setClientSecret(''); // Leave blank to keep existing
    setAccessToken('');
    setRefreshToken('');
    setAccountId(isCtraderKey ? (exchange.accountId || '') : '');
    setEnvironment(isCtraderKey ? (exchange.environment === 'demo' ? 'demo' : 'live') : 'live');
    setFixHost(isFixKey ? (exchange.host || '') : '');
    setFixQuotePort(isFixKey ? String(exchange.quotePort || 5211) : '5211');
    setFixTradePort(isFixKey ? String(exchange.tradePort || 5212) : '5212');
    setFixSenderCompId(isFixKey ? (exchange.senderCompId || '') : '');
    setFixTargetCompId(isFixKey ? (exchange.targetCompId || 'CSERVER') : 'CSERVER');
    setFixUsername(isFixKey ? (exchange.username || '') : '');
    setFixPassword('');
    setIsCexFormOpen(true);
  };

  const handleCexCancelEdit = () => {
    resetCexForm();
  };

  const handleCexDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API Key?')) return;
    try {
      const res = await fetch(`/api/exchanges?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) fetchExchanges();
    } catch (e) {
      console.error(e);
    }
  };

  const getExchangeName = (id: string) => {
    return SUPPORTED_EXCHANGES.find(e => e.id === id)?.name || id;
  };

  // ==========================================
  // DEX FUNCTIONS
  // ==========================================
  const fetchWallets = async () => {
    setDexLoading(true);
    try {
      const res = await fetch('/api/wallets', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const dbWallets: Wallet[] = await res.json();
        
        const walletsWithBalances = await Promise.all(dbWallets.map(async (w) => {
          if (w.network === 'EVM') {
            return { ...w, balanceSol: null, tokens: [] };
          }
          try {
            const rpcRes = await fetch(`/api/solana/balance?publicKey=${w.publicKey}`, {
              headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (!rpcRes.ok) throw new Error('Failed to fetch balance');
            const rpcData = await rpcRes.json();
            return { ...w, balanceSol: rpcData.balanceSol ?? null, tokens: rpcData.tokens || [] };
          } catch (err) {
            return { ...w, balanceSol: null, tokens: [] };
          }
        }));
        setWallets(walletsWithBalances);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDexLoading(false);
    }
  };

  const handleDexImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/wallets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ acronym, secretKey, network })
    });
    if (res.ok) {
      setAcronym(''); setSecretKey('');
      fetchWallets();
    }
  };

  const handleDexGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneratedMnemonic('');
    const res = await fetch('/api/wallets/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ acronym: generateAcronym, network: generateNetwork })
    });
    if (res.ok) {
      const data = await res.json();
      setGenerateAcronym('');
      setGeneratedMnemonic(data.mnemonic);
      fetchWallets();
    }
  };

  const handleDexDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this Wallet?')) return;
    const res = await fetch(`/api/wallets?id=${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (res.ok) fetchWallets();
  };

  const openEditModal = (wallet: Wallet, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingWallet(wallet);
    setEditAcronym(wallet.acronym);
  };

  const openDepositModal = (wallet: Wallet, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedWallet(wallet);
  };

  const openTransferModal = (wallet: Wallet, e: React.MouseEvent) => {
    e.stopPropagation();
    setTransferWallet(wallet);
    setTransferToAddress('');
    setTransferAmount('');
    setTransferError('');
    setTransferSuccess('');
  };

  const handleDexEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWallet) return;
    
    const res = await fetch(`/api/wallets`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ id: editingWallet._id, acronym: editAcronym })
    });
    if (res.ok) {
      setEditingWallet(null);
      fetchWallets();
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferWallet || isTransferring) return;

    setIsTransferring(true);
    setTransferError('');
    setTransferSuccess('');

    try {
      const res = await fetch('/api/solana/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({
          walletId: transferWallet._id,
          toAddress: transferToAddress,
          amount: parseFloat(transferAmount)
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to transfer');
      }

      setTransferSuccess(`Transaction Sent! TxID: ${data.txid}`);
      setTimeout(() => {
        setTransferWallet(null);
      }, 5000);
    } catch (err: any) {
      setTransferError(err.message);
    } finally {
      setIsTransferring(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ==========================================
  // INITIALIZATION
  // ==========================================
  useEffect(() => { 
    if (activeTab === 'cex') {
      fetchExchanges(); 
    } else {
      fetchWallets();
    }
  }, [activeTab]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-2xl font-bold text-white flex items-center gap-3">
          {t('integracoesExchange')}
        </h3>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-slate-800 mb-8">
        <button 
          onClick={() => setActiveTab('cex')}
          className={clsx("pb-3 font-medium transition-colors border-b-2", activeTab === 'cex' ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-400 hover:text-slate-200")}
        >
          {t('corretorasCentralizadas')}
        </button>
        <button 
          onClick={() => setActiveTab('dex')}
          className={clsx("pb-3 font-medium transition-colors border-b-2", activeTab === 'dex' ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-400 hover:text-slate-200")}
        >
          {t('corretorasDescentralizadas')}
        </button>
      </div>

      {/* ==============================================
          CEX TAB CONTENT
          ============================================== */}
      {activeTab === 'cex' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex justify-end mb-6">
            {!isCexFormOpen && (
              <button onClick={() => setIsCexFormOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
                <Plus className="w-5 h-5" /> {t('novaCEX')}
              </button>
            )}
          </div>

          <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-4 flex items-start gap-4 shadow-sm mb-8">
            <LinkIcon className="w-6 h-6 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sky-400 font-bold mb-1">{t('gerenciamentoAPI')}</h4>
              <p className="text-sky-200/80 text-sm">
                {t('descricaoGerenciamentoAPI')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {exchanges.length === 0 ? (
              <div className="col-span-full p-8 border border-dashed border-slate-700 rounded-xl text-center text-slate-500">
                Nenhuma corretora registrada. Adicione uma abaixo.
              </div>
            ) : exchanges.map(exchange => (
              <div key={exchange._id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm hover:border-slate-700 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-lg font-bold text-white flex items-center gap-3">
                      {exchange.name}
                      <span className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                        {getExchangeName(exchange.exchangeId)}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-400 font-mono mt-2">
                      {CTRADER_IDS.includes(exchange.exchangeId) ? (
                        <>
                          Client ID: {exchange.clientId || exchange.apiKey}
                          {exchange.accountId && <> · Account: {exchange.accountId}</>}
                          {exchange.environment && <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${exchange.environment === 'demo' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{exchange.environment.toUpperCase()}</span>}
                        </>
                      ) : FIX_IDS.includes(exchange.exchangeId) ? (
                        <>
                          {exchange.host && <span className="text-slate-400">{exchange.host}</span>}
                          {exchange.senderCompId && <span className="text-slate-500"> · {exchange.senderCompId}</span>}
                          {exchange.username && <span className="text-slate-500"> · a/c {exchange.username}</span>}
                        </>
                      ) : (
                        <>Chave: {exchange.apiKey.substring(0, 8)}...{exchange.apiKey.substring(exchange.apiKey.length - 4)}</>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleCexEdit(exchange)} className="text-slate-600 hover:text-indigo-400 transition-colors p-1 bg-slate-800/50 rounded-md" title="Editar Conexão">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleCexDelete(exchange._id)} className="text-slate-600 hover:text-red-400 transition-colors p-1 bg-slate-800/50 rounded-md">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-800/50 flex justify-between items-center text-xs text-slate-500">
                  <span>Adicionado: {new Date(exchange.createdAt).toLocaleDateString()}</span>
                  <span className="text-emerald-400 flex items-center gap-1"><Key className="w-3 h-3" /> Segredo Criptografado</span>
                </div>
              </div>
            ))}
          </div>

          {isCexFormOpen && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-sm max-w-2xl">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-lg font-medium text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-indigo-500" /> {editingCexId ? 'Editar Conexão da Corretora' : 'Registrar Nova Chave de API'}
                </h4>
                <button onClick={handleCexCancelEdit} className="text-xs px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">
                  {editingCexId ? 'Cancelar Edição' : 'Cancelar'}
                </button>
              </div>
              <form onSubmit={handleCexSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Corretora (Exchange)</label>
                    <select required value={exchangeId} onChange={e => setExchangeId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 appearance-none">
                      {SUPPORTED_EXCHANGES.map(ex => (
                        <option key={ex.id} value={ex.id}>{ex.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Nome da Conexão</label>
                    <input required value={cexName} onChange={e => setCexName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500" placeholder="Ex: Minha Conta MEXC Scalper" />
                  </div>
                </div>

                {CTRADER_IDS.includes(exchangeId) ? (
                  <>
                    <div className="rounded-lg bg-sky-500/5 border border-sky-500/20 p-3 text-xs text-sky-200/80">
                      Credenciais da cTrader Open API (Spotware). Acesse <span className="font-mono text-sky-300">connect.spotware.com</span> → Applications → Credentials. Preencha Client ID/Secret e clique em <b>Autorizar cTrader</b> para obter os tokens automaticamente. <b>Escopo atual: leitura (accounts)</b> — funciona enquanto o app está "Submitted". Quando a Spotware aprovar o app ("Active"), a autorização passará a incluir trading (ordens).
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Client ID (App ID)</label>
                        <input required type="text" value={clientId} onChange={e => setClientId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 font-mono text-sm" placeholder="Ex: 1234567" />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Client Secret {editingCexId && <span className="text-xs text-orange-400">(vazio = manter)</span>}</label>
                        <input type="password" required={!editingCexId} value={clientSecret} onChange={e => setClientSecret(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 font-mono text-sm" placeholder={editingCexId ? "Deixe em branco para manter" : "App secret"} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Account ID (ctidTraderAccountId) <span className="text-xs text-slate-500">(opcional — detecta pelo token)</span></label>
                      <input type="text" value={accountId} onChange={e => setAccountId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 font-mono text-sm" placeholder="Ex: 1250012345" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Ambiente</label>
                        <select value={environment} onChange={e => setEnvironment(e.target.value as 'live' | 'demo')} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 appearance-none">
                          <option value="live">Live</option>
                          <option value="demo">Demo</option>
                        </select>
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          disabled={cexLoading}
                          onClick={handleCtraderAuthorize}
                          className={`w-full text-center px-4 py-2 rounded-lg font-medium transition-colors text-sm ${clientId.trim() && !cexLoading ? 'bg-sky-600 hover:bg-sky-700 text-white' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                        >
                          {cexLoading ? 'Salvando...' : 'Autorizar cTrader'}
                        </button>
                      </div>
                    </div>
                  </>
                ) : FIX_IDS.includes(exchangeId) ? (
                  <>
                    <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3 text-xs text-emerald-200/80">
                      Credenciais da <b>FIX API</b> (Pepperstone/cTrader). Encontre em <span className="font-mono text-emerald-300">cTrader → Configurações → FIX API</span>. A senha será criptografada (AES-256-GCM). Portas: QUOTE 5211 / TRADE 5212 (SSL).
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Host (Quote/Trade)</label>
                        <input required type="text" value={fixHost} onChange={e => setFixHost(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-emerald-500 font-mono text-sm" placeholder="Ex: live-us-eqx-01.p.c-trader.com" />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">SenderCompID</label>
                        <input required type="text" value={fixSenderCompId} onChange={e => setFixSenderCompId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-emerald-500 font-mono text-sm" placeholder="Ex: live.pepperstone.1382148" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Username (Login da conta)</label>
                        <input required type="text" value={fixUsername} onChange={e => setFixUsername(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-emerald-500 font-mono text-sm" placeholder="Ex: 1382148" />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Password {editingCexId && <span className="text-xs text-orange-400">(vazio = manter)</span>}</label>
                        <input type="password" required={!editingCexId} value={fixPassword} onChange={e => setFixPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-emerald-500 font-mono text-sm" placeholder={editingCexId ? "Deixe em branco para manter" : "Senha FIX da conta"} />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Porta Quote (SSL)</label>
                        <input type="number" value={fixQuotePort} onChange={e => setFixQuotePort(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-emerald-500 font-mono text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Porta Trade (SSL)</label>
                        <input type="number" value={fixTradePort} onChange={e => setFixTradePort(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-emerald-500 font-mono text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">TargetCompID</label>
                        <input type="text" value={fixTargetCompId} onChange={e => setFixTargetCompId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-emerald-500 font-mono text-sm" />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">API Key</label>
                      <input required type="text" value={apiKey} onChange={e => setApiKey(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 font-mono text-sm" placeholder="Cole sua API Key aqui" />
                    </div>

                    <div>
                      <label className="block text-sm text-slate-400 mb-1">API Secret {editingCexId && <span className="text-xs text-orange-400">(Deixe em branco para manter o atual)</span>}</label>
                      <input type="password" required={!editingCexId} value={apiSecret} onChange={e => setApiSecret(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 font-mono text-sm" placeholder={editingCexId ? "Cole a nova senha apenas se desejar alterá-la" : "Cole seu API Secret aqui"} />
                      <p className="text-xs text-slate-500 mt-1">Isso será criptografado via AES-256-GCM antes de ser salvo no banco.</p>
                    </div>
                  </>
                )}

                <button type="submit" disabled={cexLoading} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 mt-4">
                  {cexLoading ? 'Salvando...' : (editingCexId ? 'Salvar Alterações' : 'Registrar Chaves da API')}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ==============================================
          DEX (WALLETS) TAB CONTENT
          ============================================== */}
      {activeTab === 'dex' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto mb-8 shadow-sm">
            <table className="w-full text-left text-sm whitespace-nowrap md:whitespace-normal">
              <thead className="bg-slate-900/50 border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Apelido</th>
                  <th className="px-6 py-4 font-medium">Chave Pública</th>
                  <th className="px-6 py-4 font-medium">Saldos</th>
                  <th className="px-6 py-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {dexLoading ? (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">{t('carregarCarteiras')}</td></tr>
                ) : wallets.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">{t('nenhumaCarteira')}</td></tr>
                ) : wallets.map(wallet => (
                  <tr 
                    key={wallet._id} 
                    className="hover:bg-slate-800/30 transition-colors group"
                  >
                    <td className="px-6 py-4 font-medium text-white transition-colors align-top pt-5">
                      <div className="flex items-center gap-2">
                        {wallet.acronym}
                        {wallet.network === 'EVM' ? (
                          <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/30">EVM</span>
                        ) : (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">SOL</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-400 font-mono text-xs align-top pt-5">{wallet.publicKey}</td>
                    <td className="px-6 py-4 align-top">
                      <div className="flex flex-col items-start gap-2">
                        <span className="font-medium text-emerald-400">
                          {wallet.network === 'EVM' 
                            ? 'EVM Ready'
                            : (wallet.balanceSol !== undefined && wallet.balanceSol !== null 
                              ? `${wallet.balanceSol.toFixed(4)} SOL` 
                              : (wallet.balanceSol === null ? 'Error loading' : '...'))
                          }
                        </span>
                        {wallet.tokens && wallet.tokens.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-1">
                            {wallet.tokens.map((token, idx) => (
                              <span key={idx} className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded-md border border-slate-700 flex items-center gap-1">
                                <span className="text-white font-medium">{token.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                                <span className={token.symbol !== 'Unknown' ? 'text-indigo-400' : 'text-slate-500'}>{token.symbol}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right flex items-center justify-end gap-2 align-top pt-5">
                      <button onClick={(e) => openTransferModal(wallet, e)} className="text-slate-500 hover:text-amber-400 transition-colors p-2 rounded-md hover:bg-slate-800/80" title={t('enviarFundos')}>
                        <Send className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => openDepositModal(wallet, e)} className="text-slate-500 hover:text-emerald-400 transition-colors p-2 rounded-md hover:bg-slate-800/80" title={t('depositar')}>
                        <QrCode className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => openEditModal(wallet, e)} className="text-slate-500 hover:text-indigo-400 transition-colors p-2 rounded-md hover:bg-slate-800/80" title={t('editarApelido')}>
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => handleDexDelete(wallet._id, e)} className="text-slate-500 hover:text-red-400 transition-colors p-2 rounded-md hover:bg-slate-800/80" title={t('excluirCarteira')}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {generatedMnemonic && (
            <div className="mb-8 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 text-emerald-100">
              <div className="flex items-center gap-3 mb-2 text-emerald-400">
                <AlertTriangle className="w-6 h-6" />
                <h4 className="text-lg font-bold">{t('carteiraGerada')}</h4>
              </div>
              <p className="text-sm mb-4">{t('salveFrase')}</p>
              <div className="bg-emerald-950/50 border border-emerald-800/50 p-4 rounded-lg font-mono text-lg text-center tracking-wide shadow-inner">
                {generatedMnemonic}
              </div>
              <button onClick={() => setGeneratedMnemonic('')} className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm">
                {t('salveiSeguro')}
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Import Form */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-sm">
              <h4 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                <Key className="w-5 h-5 text-indigo-500" /> {t('importarCarteira')}
              </h4>
              <p className="text-sm text-slate-400 mb-6">Importe uma carteira Solana/EVM existente colando sua chave privada ou frase semente de 12/24 palavras.</p>
              <form onSubmit={handleDexImport} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">{t('rede')}</label>
                  <select 
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                    value={network}
                    onChange={(e) => setNetwork(e.target.value)}
                  >
                    <option value="Solana">Solana</option>
                    <option value="EVM">EVM (Arbitrum, Ethereum, etc)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Apelido</label>
                  <input required value={acronym} onChange={e => setAcronym(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500" placeholder="e.g. MAIN_WALLET" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Chave Secreta ou Frase Semente (12/24 palavras)</label>
                  <input required type="password" value={secretKey} onChange={e => setSecretKey(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 font-mono text-sm" placeholder="Cole sua chave secreta ou frase semente aqui" />
                </div>
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 mt-2 w-full justify-center">
                  <Plus className="w-4 h-4" /> {t('importarCarteira')}
                </button>
              </form>
            </div>

            {/* Generate Form */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-32 bg-indigo-500/5 rounded-full blur-3xl -z-10 -mr-16 -mt-16"></div>
              <h4 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" /> {t('gerarNovaCarteira')}
              </h4>
              <p className="text-sm text-slate-400 mb-6">Crie uma carteira nova com segurança. Geraremos a frase semente e a criptografaremos automaticamente.</p>
              <form onSubmit={handleDexGenerate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">{t('rede')}</label>
                  <select 
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                    value={generateNetwork}
                    onChange={(e) => setGenerateNetwork(e.target.value)}
                  >
                    <option value="Solana">Solana</option>
                    <option value="EVM">EVM (Arbitrum, Ethereum, etc)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Apelido</label>
                  <input required value={generateAcronym} onChange={e => setGenerateAcronym(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500" placeholder="e.g. FLASH_LOAN_BOT" />
                </div>
                <div className="pt-2">
                  <button type="submit" className="bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:border-indigo-500 text-white px-4 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 w-full justify-center shadow-lg">
                    <Sparkles className="w-4 h-4 text-indigo-400" /> Gerar Carteira com Segurança
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================
          DEX MODALS
          ============================================== */}
      
      {/* Deposit Modal */}
      {selectedWallet && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedWallet(null)}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
              <h3 className="font-bold text-white flex items-center gap-2">
                Depositar em {selectedWallet.acronym}
              </h3>
              <button onClick={() => setSelectedWallet(null)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex flex-col items-center">
              <div className="bg-white p-3 rounded-xl shadow-sm mb-6">
                <QRCodeSVG value={selectedWallet.publicKey} size={200} level="M" includeMargin={false} />
              </div>
              <p className="text-sm text-slate-400 mb-2 font-medium">Endereço Público</p>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 w-full flex items-center gap-3">
                <p className="text-xs text-white font-mono break-all flex-1">{selectedWallet.publicKey}</p>
                <button 
                  onClick={() => copyToClipboard(selectedWallet.publicKey)}
                  className="bg-slate-800 hover:bg-slate-700 p-2 rounded-md transition-colors text-slate-300 hover:text-white shrink-0"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-center text-slate-500 mt-4">
                Envie apenas ativos suportados na rede {selectedWallet.network || 'Solana'} para este endereço.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingWallet && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setEditingWallet(null)}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
              <h3 className="font-bold text-white flex items-center gap-2">
                Editar Carteira
              </h3>
              <button onClick={() => setEditingWallet(null)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleDexEditSubmit} className="p-6">
              <div className="mb-4">
                <label className="block text-sm text-slate-400 mb-1">Apelido</label>
                <input required value={editAcronym} onChange={e => setEditAcronym(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500" placeholder="e.g. FLASH_LOAN_BOT" />
              </div>
              <p className="text-xs text-slate-500 mb-6">Nota: a alteração da chave pública ou privada está desabilitada por segurança. Exclua e reimporte se necessário.</p>
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
                {t('salvarAlteracoes')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {transferWallet && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setTransferWallet(null)}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
              <h3 className="font-bold text-white flex items-center gap-2">
                {t('enviarFundos')}
              </h3>
              <button onClick={() => setTransferWallet(null)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleTransferSubmit} className="p-6">
              {transferError && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm mb-4">
                  {transferError}
                </div>
              )}
              {transferSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 p-3 rounded-lg text-sm mb-4 break-all">
                  {transferSuccess}
                </div>
              )}

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Carteira de Origem</label>
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                    <p className="text-sm font-medium text-white">{transferWallet.acronym}</p>
                    <p className="text-xs font-mono text-slate-500 break-all">{transferWallet.publicKey}</p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Ativo</label>
                  <select disabled className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none appearance-none opacity-80">
                    <option>Solana (SOL)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">Endereço de Destino</label>
                  <input required value={transferToAddress} onChange={e => setTransferToAddress(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 font-mono text-sm" placeholder="Cole o endereço Solana" />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">Valor</label>
                  <div className="relative">
                    <input required type="number" step="0.000000001" min="0" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-4 pr-16 py-2 text-white outline-none focus:border-indigo-500" placeholder="0.00" />
                    <div className="absolute right-0 top-0 bottom-0 flex items-center pr-4 pointer-events-none">
                      <span className="text-slate-500 text-sm font-medium">SOL</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center mb-6 text-sm">
                <span className="text-slate-500">Taxa da Rede</span>
                <span className="text-slate-300 font-medium">~0.000005 SOL</span>
              </div>

              <button disabled={isTransferring} type="submit" className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:hover:bg-amber-500 text-amber-950 px-4 py-2 rounded-lg font-bold transition-colors flex justify-center items-center gap-2">
                {isTransferring ? 'Enviando...' : 'Confirmar Transferência'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
