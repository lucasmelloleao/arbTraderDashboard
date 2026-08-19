'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Key, Sparkles, AlertTriangle, X, Copy, Check, Edit2, QrCode, Send } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useLanguage } from '@/lib/i18n';

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

export default function WalletsPage() {
  const { t } = useLanguage();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [acronym, setAcronym] = useState('');
  const [network, setNetwork] = useState('Solana');
  const [publicKey, setPublicKey] = useState('');
  const [secretKey, setSecretKey] = useState('');

  const [generateAcronym, setGenerateAcronym] = useState('');
  const [generateNetwork, setGenerateNetwork] = useState('Solana');
  const [generatedMnemonic, setGeneratedMnemonic] = useState('');
  
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

  const fetchWallets = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/wallets', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const dbWallets: Wallet[] = await res.json();
        
        const walletsWithBalances = await Promise.all(dbWallets.map(async (w) => {
          if (w.network === 'EVM') {
            return { ...w, balanceSol: null, tokens: [] }; // skip Solana RPC for EVM
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
      setLoading(false);
    }
  };

  useEffect(() => { fetchWallets(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/wallets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: JSON.stringify({ acronym, secretKey, network })
    });
    if (res.ok) {
      setAcronym(''); setPublicKey(''); setSecretKey('');
      fetchWallets();
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
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

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleEditSubmit = async (e: React.FormEvent) => {
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-white">{t('carteirasRegistradas')}</h3>
      </div>

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
            {loading ? (
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
                    {wallet.network === 'EVM' && (
                      <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/30">EVM</span>
                    )}
                    {wallet.network !== 'EVM' && (
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
                  <button onClick={(e) => handleDelete(wallet._id, e)} className="text-slate-500 hover:text-red-400 transition-colors p-2 rounded-md hover:bg-slate-800/80" title={t('excluirCarteira')}>
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
          <p className="text-sm text-slate-400 mb-6">Importe uma carteira Solana existente colando sua chave privada ou frase semente de 12/24 palavras.</p>
          <form onSubmit={handleAdd} className="space-y-4">
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
          <p className="text-sm text-slate-400 mb-6">Crie uma carteira Solana nova com segurança. Geraremos a frase semente de 12 palavras e a criptografaremos automaticamente no banco.</p>
          <form onSubmit={handleGenerate} className="space-y-4">
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
              <p className="text-sm text-slate-400 mb-2 font-medium">Endereço Solana</p>
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
                Envie apenas SOL ou tokens SPL na rede Solana para este endereço.
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
            <form onSubmit={handleEditSubmit} className="p-6">
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
