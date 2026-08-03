'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Key, Link as LinkIcon, Pencil } from 'lucide-react';
import clsx from 'clsx';

const SUPPORTED_EXCHANGES = [
  { id: 'mexc', name: 'MEXC' },
  { id: 'binance', name: 'Binance' },
  { id: 'okx', name: 'OKX' },
  { id: 'bybit', name: 'Bybit' },
  { id: 'gateio', name: 'Gate.io' }
];

type ExchangeKey = {
  _id: string;
  exchangeId: string;
  name: string;
  apiKey: string;
  active: boolean;
  createdAt: string;
};

export default function ExchangesPage() {
  const [exchanges, setExchanges] = useState<ExchangeKey[]>([]);
  const [exchangeId, setExchangeId] = useState(SUPPORTED_EXCHANGES[0].id);
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

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

  useEffect(() => { 
    fetchExchanges(); 
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = '/api/exchanges';
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId 
        ? JSON.stringify({ id: editingId, exchangeId, name, apiKey, apiSecret })
        : JSON.stringify({ exchangeId, name, apiKey, apiSecret });

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body
      });
      
      if (res.ok) {
        setExchangeId(SUPPORTED_EXCHANGES[0].id);
        setName('');
        setApiKey('');
        setApiSecret('');
        setEditingId(null);
        setIsFormOpen(false);
        fetchExchanges();
      } else {
        const err = await res.json();
        alert(err.reason || 'Failed to save exchange key');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (exchange: ExchangeKey) => {
    setEditingId(exchange._id);
    setExchangeId(exchange.exchangeId);
    setName(exchange.name);
    setApiKey(exchange.apiKey);
    setApiSecret(''); // Leave blank to keep existing secret
    setIsFormOpen(true);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setExchangeId(SUPPORTED_EXCHANGES[0].id);
    setName('');
    setApiKey('');
    setApiSecret('');
    setIsFormOpen(false);
  };

  const handleDelete = async (id: string) => {
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-white">Corretoras Centralizadas (CEX)</h3>
        {!isFormOpen && (
          <button onClick={() => setIsFormOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
            <Plus className="w-5 h-5" /> Nova CEX
          </button>
        )}
      </div>

      <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-4 flex items-start gap-4 shadow-sm mb-8">
        <LinkIcon className="w-6 h-6 text-sky-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sky-400 font-bold mb-1">Gerenciamento de API Keys</h4>
          <p className="text-sky-200/80 text-sm">
            Registre as suas chaves de API aqui para permitir que o bot execute transações via CCXT nas corretoras centralizadas. Os seus "API Secrets" são criptografados com segurança no banco de dados.
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
                  Chave: {exchange.apiKey.substring(0, 8)}...{exchange.apiKey.substring(exchange.apiKey.length - 4)}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(exchange)} className="text-slate-600 hover:text-indigo-400 transition-colors p-1 bg-slate-800/50 rounded-md" title="Editar Conexão">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(exchange._id)} className="text-slate-600 hover:text-red-400 transition-colors p-1 bg-slate-800/50 rounded-md">
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

      {isFormOpen && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-sm max-w-2xl">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-lg font-medium text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-500" /> {editingId ? 'Editar Conexão da Corretora' : 'Registrar Nova Chave de API'}
            </h4>
            <button onClick={handleCancelEdit} className="text-xs px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">
              {editingId ? 'Cancelar Edição' : 'Cancelar'}
            </button>
          </div>
        <form onSubmit={handleSubmit} className="space-y-5">
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
              <input required value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500" placeholder="Ex: Minha Conta MEXC Scalper" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">API Key</label>
            <input required type="text" value={apiKey} onChange={e => setApiKey(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 font-mono text-sm" placeholder="Cole sua API Key aqui" />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">API Secret {editingId && <span className="text-xs text-orange-400">(Deixe em branco para manter o atual)</span>}</label>
            <input type="password" required={!editingId} value={apiSecret} onChange={e => setApiSecret(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-indigo-500 font-mono text-sm" placeholder={editingId ? "Cole a nova senha apenas se desejar alterá-la" : "Cole seu API Secret aqui"} />
            <p className="text-xs text-slate-500 mt-1">Isso será criptografado via AES-256-GCM antes de ser salvo no banco.</p>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 mt-4">
            {loading ? 'Salvando...' : (editingId ? 'Salvar Alterações' : 'Registrar Chaves da API')}
          </button>
        </form>
      </div>
      )}
    </div>
  );
}
