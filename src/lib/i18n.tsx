'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Lang = 'pt-BR' | 'en-US';

// ── Dicionário de traduções ─────────────────────────────────────────────────
const translations = {
  'pt-BR': {
    // Navegação / Menu
    overview: 'Overview',
    arbitragemFunding: 'Arbitragem Funding',
    arbitragemForex: 'Arbitragem Forex',
    deltaNulo: 'Arbitragem Funding',
    liquidacao: 'Liquidação',
    flashLoans: 'Flash Loans',
    exchanges: 'Exchanges (CEX/DEX)',
    historicoExchange: 'Histórico da Exchange',
    ajuda: 'Ajuda',
    perfil: 'Perfil',
    sair: 'Sair',
    dashboard: 'Dashboard',

    // Login
    login: 'Entrar',
    criarConta: 'Criar Conta',
    entrar: 'Entrar',
    email: 'E-mail',
    senha: 'Senha',
    nome: 'Nome',
    carregando: 'Carregando...',
    codigo2FA: 'Código 2FA',
    verificar2FA: 'Verificar 2FA & Entrar',
    esqueciSenha: 'Esqueci minha senha',
    voltarLogin: 'Voltar ao login',
    enviarLink: 'Enviar link de recuperação',
    redefinirSenha: 'Redefinir senha',
    novaSenha: 'Nova senha',
    confirmarSenha: 'Confirmar senha',
    entrarComGoogle: 'Entrar com Google',
    ouContinueCom: 'Ou continue com',
    naoTemConta: 'Não tem uma conta?',
    jaTemConta: 'Já tem uma conta?',
    cadastrar: 'Cadastrar',
    entrarAgora: 'Entrar',
    voltarAoLogin: 'Voltar ao Login',

    // Perfil
    autenticacaoDoisFatores: 'Autenticação de Dois Fatores (2FA)',
    ativar2FA: 'Ativar 2FA',
    desativar2FA: 'Desativar 2FA',
    habilitado: 'Habilitado',
    desabilitado: 'Desabilitado',
    contaProtegida: 'Sua conta está protegida com autenticação de dois fatores.',
    configurar2FA: 'Configurar 2FA',
    salvar: 'Salvar',
    cancelar: 'Cancelar',
    alterarSenha: 'Alterar senha',
    senhaAtual: 'Senha atual',
    telefone: 'Telefone',
    usuario: 'Usuário',

    // Exchanges
    integracoesExchange: 'Integrações de Exchange',
    corretorasCentralizadas: 'Integrações de Trading (CEX/DEX)',
    corretorasDescentralizadas: 'Corretoras Descentralizadas (DEX / Wallets)',
    novaCEX: 'Nova CEX',
    gerenciamentoAPI: 'Gerenciamento de API Keys',
    descricaoGerenciamentoAPI: 'Registre as suas chaves de API aqui para permitir que o bot execute transações via CCXT nas corretoras centralizadas. Os seus "API Secrets" são criptografados com segurança.',
    nenhumaCorretora: 'Nenhuma corretora registrada. Adicione uma abaixo.',
    chave: 'Chave',
    adicionado: 'Adicionado',
    segredoCriptografado: 'Segredo Criptografado',
    editarConexao: 'Editar Conexão',
    registrarNovaChave: 'Registrar Nova Chave de API',
    corretora: 'Corretora (Exchange)',
    nomeConexao: 'Nome da Conexão',
    apiKey: 'API Key',
    apiSecret: 'API Secret',
    salvarAlteracoes: 'Salvar Alterações',
    registrarChaves: 'Registrar Chaves da API',
    salvoCriptografado: 'Isso será criptografado via AES-256-GCM antes de ser salvo no banco.',
    excluirConexao: 'Excluir conexão?',
    editar: 'Editar',
    excluir: 'Excluir',
    carregarCarteiras: 'Carregando carteiras e saldos...',
    nenhumaCarteira: 'Nenhuma carteira registrada ainda.',
    importarCarteira: 'Importar Carteira',
    gerarNovaCarteira: 'Gerar Nova Carteira',
    carteirasRegistradas: 'Carteiras Registradas',
    rede: 'Rede',
    importar: 'Importar',
    gerar: 'Gerar',
    carteiraGerada: 'Carteira gerada com sucesso!',
    salveFrase: 'Por favor, salve a frase semente de 12 palavras em local seguro. Esta é a ÚNICA vez que ela será exibida!',
    salveiSeguro: 'Salvei em local seguro',
    depositar: 'Depositar (Mostrar QR)',
    enviarFundos: 'Enviar Fundos',
    editarApelido: 'Editar Apelido',
    excluirCarteira: 'Excluir Carteira',

    // Overview
    overviewArbitragem: 'Overview — Arbitragem CEX',
    resumoPatrimonial: 'Resumo patrimonial e saldos das corretoras centralizadas',
    atualizarSaldos: 'Atualizar Saldos',
    atualizando: 'Atualizando...',
    corretorasConectadas: 'Corretoras Conectadas',
    patrimonioGlobal: 'Patrimônio Global',
    saldoTotalSpot: 'Saldo Total Spot (CEX)',
    saldoTotalFuturos: 'Saldo Total Futuros (CEX)',
    disponivelEm: 'Disponível em',
    evolucaoPatrimonial: 'Evolução Patrimonial (Spot vs Futuros)',
    saldoSpot: 'Saldo Spot',
    saldoFuturos: 'Saldo Futuros',
    totalPerpSpot: 'Total (Perp + Spot)',
    nenhumHistorico: 'Nenhum histórico registrado ainda.',
    moedasSpot: 'Moedas Spot — Quantidade e Valor',
    atualizado: 'Atualizado',
    posicoesFuturas: 'Posições Futuras Abertas',
    pnlNaoRealizado: 'PnL Não Realizado',
    corretorasConectadasBalances: 'Saldos das Corretoras Conectadas',
    nenhumaCorretoraConectada: 'Nenhuma corretora conectada.',
    carregandoMoedas: 'Carregando moedas spot...',
    nenhumaMoeda: 'Nenhuma moeda spot encontrada no snapshot.',
    carregandoPosicoes: 'Carregando posições futuras...',
    nenhumaPosicao: 'Nenhuma posição futura aberta.',
    carregandoSaldos: 'Carregando saldos das corretoras...',
    total: 'Total',

    // Comum
    fechar: 'Fechar',
    sim: 'Sim',
    nao: 'Não',
    confirmar: 'Confirmar',
  },
  'en-US': {
    overview: 'Overview',
    arbitragemFunding: 'Funding Arbitrage',
    arbitragemForex: 'Forex Arbitrage',
    deltaNulo: 'Delta Neutral - Short/Long',
    liquidacao: 'Liquidation',
    flashLoans: 'Flash Loans',
    exchanges: 'Exchanges (CEX/DEX)',
    historicoExchange: 'Exchange History',
    ajuda: 'Help',
    perfil: 'Profile',
    sair: 'Sign Out',
    dashboard: 'Dashboard',

    login: 'Sign In',
    criarConta: 'Create Account',
    entrar: 'Sign In',
    email: 'Email',
    senha: 'Password',
    nome: 'Name',
    carregando: 'Loading...',
    codigo2FA: '2FA Code',
    verificar2FA: 'Verify 2FA & Login',
    esqueciSenha: 'Forgot password',
    voltarLogin: 'Back to login',
    enviarLink: 'Send recovery link',
    redefinirSenha: 'Reset password',
    novaSenha: 'New password',
    confirmarSenha: 'Confirm password',
    entrarComGoogle: 'Sign in with Google',
    ouContinueCom: 'Or continue with',
    naoTemConta: "Don't have an account?",
    jaTemConta: 'Already have an account?',
    cadastrar: 'Sign up',
    entrarAgora: 'Log in',
    voltarAoLogin: 'Back to Login',

    autenticacaoDoisFatores: 'Two-Factor Authentication (2FA)',
    ativar2FA: 'Enable 2FA',
    desativar2FA: 'Disable 2FA',
    habilitado: 'Enabled',
    desabilitado: 'Disabled',
    contaProtegida: 'Your account is secured with two-factor authentication.',
    configurar2FA: 'Set up 2FA',
    salvar: 'Save',
    cancelar: 'Cancel',
    alterarSenha: 'Change password',
    senhaAtual: 'Current password',
    telefone: 'Phone',
    usuario: 'User',

    integracoesExchange: 'Exchange Integrations',
    corretorasCentralizadas: 'Trading Integrations (CEX/DEX)',
    corretorasDescentralizadas: 'Decentralized Exchanges (DEX / Wallets)',
    novaCEX: 'New CEX',
    gerenciamentoAPI: 'API Key Management',
    descricaoGerenciamentoAPI: 'Register your API keys here to allow the bot to execute transactions via CCXT on centralized exchanges. Your "API Secrets" are securely encrypted.',
    nenhumaCorretora: 'No exchange registered. Add one below.',
    chave: 'Key',
    adicionado: 'Added',
    segredoCriptografado: 'Encrypted Secret',
    editarConexao: 'Edit Connection',
    registrarNovaChave: 'Register New API Key',
    corretora: 'Exchange',
    nomeConexao: 'Connection Name',
    apiKey: 'API Key',
    apiSecret: 'API Secret',
    salvarAlteracoes: 'Save Changes',
    registrarChaves: 'Register API Keys',
    salvoCriptografado: 'This will be encrypted via AES-256-GCM before being saved to the database.',
    excluirConexao: 'Delete connection?',
    editar: 'Edit',
    excluir: 'Delete',
    carregarCarteiras: 'Loading wallets and balances...',
    nenhumaCarteira: 'No wallets registered yet.',
    importarCarteira: 'Import Wallet',
    gerarNovaCarteira: 'Generate New Wallet',
    carteirasRegistradas: 'Registered Wallets',
    rede: 'Network',
    importar: 'Import',
    gerar: 'Generate',
    carteiraGerada: 'Wallet Generated Successfully!',
    salveFrase: 'Please save the 12-word seed phrase below in a secure location. This is the ONLY time it will be shown!',
    salveiSeguro: 'I have saved it securely',
    depositar: 'Deposit (Show QR)',
    enviarFundos: 'Send Funds',
    editarApelido: 'Edit Acronym',
    excluirCarteira: 'Delete Wallet',

    overviewArbitragem: 'Overview — CEX Arbitrage',
    resumoPatrimonial: 'Portfolio summary and centralized exchange balances',
    atualizarSaldos: 'Refresh Balances',
    atualizando: 'Refreshing...',
    corretorasConectadas: 'Connected Exchanges',
    patrimonioGlobal: 'Global Equity',
    saldoTotalSpot: 'Total Spot Balance (CEX)',
    saldoTotalFuturos: 'Total Futures Balance (CEX)',
    disponivelEm: 'Available in',
    evolucaoPatrimonial: 'Equity Evolution (Spot vs Futures)',
    saldoSpot: 'Spot Balance',
    saldoFuturos: 'Futures Balance',
    totalPerpSpot: 'Total (Perp + Spot)',
    nenhumHistorico: 'No history recorded yet.',
    moedasSpot: 'Spot Coins — Quantity and Value',
    atualizado: 'Updated',
    posicoesFuturas: 'Open Futures Positions',
    pnlNaoRealizado: 'Unrealized PnL',
    corretorasConectadasBalances: 'Connected Exchanges Balances',
    nenhumaCorretoraConectada: 'No exchange connected.',
    carregandoMoedas: 'Loading spot coins...',
    nenhumaMoeda: 'No spot coins found in snapshot.',
    carregandoPosicoes: 'Loading futures positions...',
    nenhumaPosicao: 'No open futures positions.',
    carregandoSaldos: 'Loading exchange balances...',
    total: 'Total',

    fechar: 'Close',
    sim: 'Yes',
    nao: 'No',
    confirmar: 'Confirm',
  },
} as const;

export type TranslationKey = keyof typeof translations['pt-BR'];

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = 'arbtrade-lang';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('pt-BR');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en-US' || saved === 'pt-BR') setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
  };

  const t = (key: TranslationKey): string => translations[lang][key] ?? translations['pt-BR'][key] ?? key;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}

// Seletor de idioma reutilizável (pt-BR / en-US)
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useLanguage();
  return (
    <div className={`flex items-center ${compact ? 'gap-1' : 'gap-1.5'}`}>
      <button
        onClick={() => setLang('pt-BR')}
        title="Português (Brasil)"
        className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors ${
          lang === 'pt-BR'
            ? 'bg-indigo-600 text-white'
            : 'bg-slate-800 text-slate-400 hover:text-white'
        }`}
      >
        PT
      </button>
      <button
        onClick={() => setLang('en-US')}
        title="English (US)"
        className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors ${
          lang === 'en-US'
            ? 'bg-indigo-600 text-white'
            : 'bg-slate-800 text-slate-400 hover:text-white'
        }`}
      >
        EN
      </button>
    </div>
  );
}
