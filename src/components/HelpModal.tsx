'use client';

import React, { useState } from 'react';
import { X, Building2, Sprout, CircleDollarSign, Power, BadgeCheck, KeyRound, ShieldAlert, Info } from 'lucide-react';

const steps = [
  {
    icon: Building2,
    title: '1. Crie sua corretora (Exchange)',
    color: 'text-indigo-400',
    body: (
      <>
        <p>Acesse <strong>Exchange Integrations → Corretoras Centralizadas (CEX)</strong> e clique em <strong>Nova CEX</strong>.</p>
        <p className="mt-2">Você vai precisar de uma conta em uma corretora centralizada como <strong>MEXC, Binance, OKX, Bybit ou Gate.io</strong>. Dentro da corretora, gere uma <strong>API Key com permissão de leitura e negociação (spot + futuros)</strong>.</p>
        <p className="mt-2">Preencha no painel:</p>
        <ul className="mt-1 space-y-1">
          <li>• Corretora (Exchange)</li>
          <li>• Nome da Conexão (ex: Minha MEXC)</li>
          <li>• API Key</li>
          <li>• API Secret</li>
        </ul>
        <p className="mt-2">⚠️ <strong>Não compartilhe o API Secret com ninguém.</strong> Ele é criptografado (AES-256-GCM) antes de ser salvo. Guarde também a API Key em local seguro.</p>
      </>
    ),
  },
  {
    icon: KeyRound,
    title: '2. Ative o duplo fator (2FA)',
    color: 'text-amber-400',
    body: (
      <>
        <p>O <strong>2FA (autenticação de dois fatores)</strong> é essencial para proteger sua conta, tanto no painel quanto na corretora.</p>
        <ul className="mt-1 space-y-1">
          <li>• No painel: <strong>Perfil → Two-Factor Authentication (2FA)</strong> → <em>Set up 2FA</em>, escaneie o QR Code com seu app autenticador (Google Authenticator, Authy, etc.) e confirme o código.</li>
          <li>• Na corretora: ative o 2FA nas configurações de segurança e, se exigido, <strong>ative o código anti-phishing</strong>.</li>
        </ul>
        <p className="mt-2">🔐 O 2FA impede que terceiros acessem sua conta mesmo que descubram sua senha — <strong>nunca desative</strong>.</p>
      </>
    ),
  },
  {
    icon: CircleDollarSign,
    title: '3. Deposite USDT na corretora',
    color: 'text-emerald-400',
    body: (
      <>
        <p>O robô opera com <strong>USDT</strong> (também aceita USDC). Faça o depósito na corretora conectada e <strong>transfira o saldo para as contas Spot e Futuros</strong> (ambas as pernas da operação precisam de saldo).</p>
        <p className="mt-2">💰 O robô precisa de USDT disponível nas duas contas para abrir o hedge (Long no Spot + Short no Perpétuo).</p>
      </>
    ),
  },
  {
    icon: Sprout,
    title: '4. Inicie a Colheita Automática',
    color: 'text-emerald-400',
    body: (
      <>
        <p>Na tela de <strong>Arbitragem Perpétuo</strong>, clique em <strong>🌾 Iniciar Colheita</strong> (no topo da tela).</p>
        <p className="mt-2">O robô passa a varrer o mercado em busca de pares com funding favorável. Quando encontra uma oportunidade, abre automaticamente o hedge:</p>
        <ul className="mt-1 space-y-1">
          <li>• <strong>Long no Spot</strong> (compra da moeda)</li>
          <li>• <strong>Short no Perpétuo</strong> (venda futura)</li>
        </ul>
        <p className="mt-2">Com o hedge montado, a cada ciclo de funding (geralmente a cada 8h) você recebe o pagamento da taxa de funding.</p>
      </>
    ),
  },
  {
    icon: CircleDollarSign,
    title: '5. Aumente o aporte da posição',
    color: 'text-indigo-400',
    body: (
      <>
        <p>Em cada posição aberta (aba <strong>Em Aberto</strong>), clique em <strong>+ Aumentar Aporte</strong>.</p>
        <p className="mt-2">Informe o valor extra em USDT. O robô compra mais Spot e abre mais Short no Perpétuo, mantendo o hedge 1:1 (delta neutro).</p>
        <p className="mt-2">💡 Isso aumenta o valor que recebe de funding, pois o pagamento é proporcional ao tamanho da posição.</p>
      </>
    ),
  },
  {
    icon: Power,
    title: '6. Encerre a posição',
    color: 'text-red-400',
    body: (
      <>
        <p>Quando quiser sair, clique em <strong>Encerrar Agora</strong> no card da posição (aba <strong>Em Aberto</strong>).</p>
        <p className="mt-2">O robô executa a saída a mercado: <strong>vende o Spot</strong> e <strong>recompra o Perpétuo</strong> (fecha o Short), devolvendo seu capital + lucro (ou prejuízo) acumulado.</p>
      </>
    ),
  },
  {
    icon: BadgeCheck,
    title: '7. Marque como Encerrada pela Corretora',
    color: 'text-slate-400',
    body: (
      <>
        <p>Use o botão <strong>Encerrada pela Corretora</strong> <em>somente</em> quando a própria corretora já liquidou/encerrou a posição (ex: liquidação forçada).</p>
        <p className="mt-2">Nesse caso <strong>nenhuma ordem é enviada</strong> e o PnL é registrado como zero. Não use para sair por conta própria — para isso, use <em>Encerrar Agora</em>.</p>
      </>
    ),
  },
];

export default function HelpModal({ onClose }: { onClose: () => void }) {
  const [openStep, setOpenStep] = useState<number>(0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl rounded-2xl border border-white/10 bg-slate-900 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-slate-900 px-6 py-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Info className="h-5 w-5 text-indigo-400" /> Como operar na Arbitragem de Perpétuo
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <p>
              <strong>Importante:</strong> o robô não opera com valores menores que <strong>$10 USDT</strong>. Deixe sempre saldo suficiente (acima de $10) nas contas Spot e Futuros para a colheita funcionar.
            </p>
          </div>

          {steps.map((step, i) => {
            const isOpen = openStep === i;
            return (
              <div key={i} className="rounded-xl border border-white/10 bg-slate-950/70 overflow-hidden">
                <button
                  onClick={() => setOpenStep(isOpen ? -1 : i)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-900/60 transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <span className={`rounded-lg bg-slate-800/80 p-2 ${step.color}`}>
                      <step.icon className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-semibold text-white">{step.title}</span>
                  </span>
                  <span className={`text-slate-500 text-lg transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pl-[4.25rem] text-sm text-slate-300 leading-relaxed">
                    {step.body}
                  </div>
                )}
              </div>
            );
          })}

          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200 flex items-start gap-3">
            <CircleDollarSign className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <p>
              <strong>Dica final:</strong> acompanhe a aba <strong>Em Aberto</strong> para ver o PnL por perna, o funding coletado e o APR. Use o botão <strong>Atualizar</strong> para sincronizar saldos e o terminal de logs para acompanhar o robô em tempo real.
            </p>
          </div>
        </div>

        <div className="sticky bottom-0 flex justify-end border-t border-white/10 bg-slate-900 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
          >
            Entendi, vamos operar!
          </button>
        </div>
      </div>
    </div>
  );
}
