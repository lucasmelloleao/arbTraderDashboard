'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, Clock, ArrowUpRight, History } from 'lucide-react';
import Link from 'next/link';

type WalletPopulated = {
  _id: string;
  acronym: string;
  publicKey: string;
}

type Transaction = {
  _id: string;
  walletId: WalletPopulated;
  fromPublicKey: string;
  toPublicKey: string;
  amount: number;
  asset: string;
  txid: string;
  status: string;
  networkFee: number;
  createdAt: string;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const res = await fetch('/api/transactions', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) {
          const data: Transaction[] = await res.json();
          setTransactions(data);

          // Em paralelo, checar o status de transações pendentes
          const pendingTxs = data.filter(tx => tx.status === 'pending');
          if (pendingTxs.length > 0) {
            pendingTxs.forEach(async (tx) => {
              try {
                const updateRes = await fetch('/api/transactions', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                  body: JSON.stringify({ txid: tx.txid })
                });
                if (updateRes.ok) {
                  const updatedTx = await updateRes.json();
                  if (updatedTx.status !== 'pending') {
                    setTransactions(prev => prev.map(t => t._id === updatedTx._id ? updatedTx : t));
                  }
                }
              } catch (err) {
                console.error("Error updating tx status:", err);
              }
            });
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTransactions();
  }, []);

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(dateString));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md text-xs font-medium">Sucesso</span>;
      case 'pending':
        return <span className="px-2 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md text-xs font-medium">Pendente</span>;
      case 'failed':
        return <span className="px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-md text-xs font-medium">Falhou</span>;
      default:
        return <span className="px-2 py-1 bg-slate-500/10 text-slate-400 border border-slate-500/20 rounded-md text-xs font-medium">{status}</span>;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-white flex items-center gap-2">
          <History className="w-6 h-6 text-indigo-500" /> Histórico de Transações
        </h3>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-900/50 border-b border-slate-800 text-slate-400">
              <tr>
                <th className="px-6 py-4 font-medium">Data / Hora</th>
                <th className="px-6 py-4 font-medium">Carteira de Origem</th>
                <th className="px-6 py-4 font-medium">Endereço de Destino</th>
                <th className="px-6 py-4 font-medium">Valor</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Explorador</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">Carregando histórico...</td></tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <Clock className="w-8 h-8 text-slate-600 mb-3" />
                      <p>Nenhuma transação encontrada.</p>
                      <p className="text-xs mt-1">As transferências feitas pelo painel aparecerão aqui.</p>
                    </div>
                  </td>
                </tr>
              ) : transactions.map(tx => (
                <tr key={tx._id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 text-slate-400 font-mono text-xs">{formatDate(tx.createdAt)}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-white font-medium">{tx.walletId?.acronym || 'Unknown Wallet'}</span>
                      <span className="text-slate-500 font-mono text-[10px]">{tx.fromPublicKey.substring(0, 8)}...{tx.fromPublicKey.substring(tx.fromPublicKey.length - 8)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-slate-400 font-mono text-xs">{tx.toPublicKey.substring(0, 8)}...{tx.toPublicKey.substring(tx.toPublicKey.length - 8)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <ArrowUpRight className="w-4 h-4 text-rose-400" />
                      <span className="font-medium text-white">{tx.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                      <span className="text-indigo-400 text-xs font-bold">{tx.asset}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(tx.status)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link 
                      href={`https://solscan.io/tx/${tx.txid}`} 
                      target="_blank"
                      className="inline-flex items-center gap-1 text-slate-500 hover:text-indigo-400 transition-colors bg-slate-800/50 hover:bg-slate-800 px-3 py-1.5 rounded-md text-xs font-medium"
                    >
                      View <ExternalLink className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
