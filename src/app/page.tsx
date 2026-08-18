import Link from 'next/link';
import { Zap, TrendingUp, Shield, BrainCircuit, ArrowRight, BarChart3, Activity } from 'lucide-react';
import HelpButton from '@/components/HelpButton';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-indigo-500/30">
      {/* Navigation */}
      <nav className="border-b border-slate-800/50 bg-slate-950/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-7 h-7 text-indigo-500" />
            <span className="text-xl font-bold text-white tracking-tight">ArbTrade</span>
          </div>
          <div className="flex items-center gap-3">
            <HelpButton />
            <Link 
              href="/login"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-medium transition-all shadow-lg shadow-indigo-500/20"
            >
              Acessar Plataforma
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="relative pt-24 pb-32 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950 -z-10" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              4 Motores Algorítmicos Ativos em Produção
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight mb-8">
              Negociação Quantitativa de <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400">
                Alta Performance & Zero Risco
              </span>
            </h1>
            <p className="text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
              Explore ineficiências de mercado em tempo real através de inteligência artificial aplicada. De arbitragem de taxas futuros-à-vista à liquidação instantânea por flash loans. **Você foca na estratégia, nossos algoritmos fazem o resto.**
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                href="/login"
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 text-lg"
              >
                Acessar Painel de Operações <ArrowRight className="w-5 h-5" />
              </Link>
              <a 
                href="#strategies"
                className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-white px-8 py-3.5 rounded-xl font-medium transition-all flex items-center justify-center gap-2 text-lg"
              >
                Explorar Estratégias
              </a>
            </div>
          </div>
        </section>

        {/* Live Market Stats Bar */}
        <section className="border-y border-slate-800/80 bg-slate-900/30 backdrop-blur-sm py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div>
                <p className="text-sm text-slate-500 uppercase tracking-wider font-semibold">Volume Arbitrado (24h)</p>
                <p className="text-2xl md:text-3xl font-extrabold text-indigo-400 mt-1">$4,852,192.40</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 uppercase tracking-wider font-semibold">Liquidações Executadas</p>
                <p className="text-2xl md:text-3xl font-extrabold text-cyan-400 mt-1">1,492 transações</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 uppercase tracking-wider font-semibold">Tempo Médio de Varredura</p>
                <p className="text-2xl md:text-3xl font-extrabold text-purple-400 mt-1">&lt; 4.2ms</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 uppercase tracking-wider font-semibold">Sucesso Histórico</p>
                <p className="text-2xl md:text-3xl font-extrabold text-emerald-400 mt-1">99.87%</p>
              </div>
            </div>
          </div>
        </section>

        {/* Strategies Section */}
        <section id="strategies" className="py-24 bg-slate-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-20">
              <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">Nossa Suíte de Estratégias de Elite</h2>
              <p className="text-slate-400 max-w-2xl mx-auto">
                Motores algorítmicos independentes criados para extrair o máximo valor em diferentes ecossistemas da Web3 e Finanças Centralizadas.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <StrategyPromoCard
                color="indigo"
                icon={<Activity className="w-8 h-8 text-indigo-400" />}
                title="Arbitragem de Funding Rates"
                description="Varre infinitas corretoras centralizadas (MEXC, OKX, Binance) em busca de discrepâncias nas taxas de financiamento. Executa hedge automatizado (Long/Short) garantindo ganhos constantes com risco direcional zero (Delta Neutro)."
                stats={["Hedge Neutro Automático", "Scan CEX Multilateral", "Retorno Diário Recorrente"]}
              />
              <StrategyPromoCard
                color="purple"
                icon={<Zap className="w-8 h-8 text-purple-400" />}
                title="Liquidação EVM via Flashloans"
                description="Monitora e liquida devedores subcolateralizados nas redes Arbitrum e Polygon (Aave/Compound). Utilizando Flash Loans sem necessidade de capital de risco próprio: paga a dívida, captura o prêmio e converte o colateral na DEX de forma atômica."
                stats={["Sem Capital Próprio de Entrada", "Transações Atômicas e Seguras", "Proteção Nativa Anti-MEV"]}
              />
              <StrategyPromoCard
                color="cyan"
                icon={<BrainCircuit className="w-8 h-8 text-cyan-400" />}
                title="Arbitragem Flash Solana & Raydium"
                description="Motor ultra veloz integrado ao ecossistema Solana. Monitora pools da Raydium, Meteora e Orca, executando rotas de arbitragem instantâneas para capitalizar variações de preço causadas por grandes fluxos de compra/venda."
                stats={["Velocidade Sub-segundo", "Liquidez Multichain", "Integração Jito MEV Bundle"]}
              />
              <StrategyPromoCard
                color="emerald"
                icon={<TrendingUp className="w-8 h-8 text-emerald-400" />}
                title="CEX Scalping & OKX Engine"
                description="Aproveita a volatilidade extrema de criptoativos de alto beta usando scalping quantitativo de alta frequência. Opera em milissegundos com ordens parciais, take profits curtos e gestão adaptativa de risco."
                stats={["HFT de Volatilidade", "Margem Dinâmica em USDT", "Slippage Protegido"]}
              />
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-24 bg-slate-900/50 border-y border-slate-800/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-white mb-4">A Tecnologia por Trás dos Lucros</h2>
              <p className="text-slate-400 max-w-2xl mx-auto">
                Combinamos infraestrutura robusta, análise de dados inteligente e contratos inteligentes próprios para criar o ecossistema ideal para traders institucionais e de varejo.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              <FeatureCard 
                icon={<Shield className="w-6 h-6 text-indigo-400" />}
                title="Segurança Militar"
                description="Chaves privadas criptografadas com AES-256 e descriptografadas em memória apenas no boot. Seus fundos e acessos permanecem inacessíveis ao mundo exterior."
              />
              <FeatureCard 
                icon={<BrainCircuit className="w-6 h-6 text-fuchsia-400" />}
                title="Telemetria Unificada"
                description="Logs em tempo real e monitoramento centralizado direto no Telegram. Você sabe exatamente quando um lucro é gerado e o status de saúde de cada robô."
              />
              <FeatureCard 
                icon={<BarChart3 className="w-6 h-6 text-emerald-400" />}
                title="Zero Capital Trancado"
                description="Com a estratégia de Flashloans, operamos com milhões de dólares emprestados de protocolos de liquidez na mesma transação. Sem travar seu patrimônio."
              />
            </div>
          </div>
        </section>
        
        {/* CTA Section */}
        <section className="py-24 relative overflow-hidden text-center">
          <div className="absolute inset-0 bg-indigo-900/10 -z-10" />
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-4xl font-extrabold text-white mb-6">Pronto para colocar as estratégias para trabalhar por você?</h2>
            <p className="text-xl text-slate-400 mb-10">Conecte suas chaves de API, configure seus limites e assista aos robôs quantitativos operando de forma delta-neutra.</p>
            <Link 
              href="/login"
              className="inline-flex bg-indigo-500 hover:bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold transition-all shadow-xl shadow-indigo-500/30 items-center justify-center gap-2 text-lg"
            >
              Iniciar Painel de Controle <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-slate-950 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-500">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-indigo-500/50" />
            <span className="text-lg font-bold text-slate-400 tracking-tight">ArbTrade</span>
          </div>
          <p>© {new Date().getFullYear()} ArbTrade. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}

function StrategyPromoCard({ 
  icon, 
  title, 
  description, 
  stats, 
  color 
}: { 
  icon: React.ReactNode, 
  title: string, 
  description: string, 
  stats: string[],
  color: 'indigo' | 'purple' | 'cyan' | 'emerald'
}) {
  const borderColors = {
    indigo: 'hover:border-indigo-500/50',
    purple: 'hover:border-purple-500/50',
    cyan: 'hover:border-cyan-500/50',
    emerald: 'hover:border-emerald-500/50',
  };

  return (
    <div className={`bg-slate-900/60 border border-slate-800/80 rounded-3xl p-8 transition-all hover:translate-y-[-4px] ${borderColors[color]} shadow-lg backdrop-blur-sm flex flex-col justify-between`}>
      <div>
        <div className="w-14 h-14 rounded-2xl bg-slate-800/70 border border-slate-700/50 flex items-center justify-center mb-6">
          {icon}
        </div>
        <h3 className="text-2xl font-bold text-white mb-3">{title}</h3>
        <p className="text-slate-400 leading-relaxed mb-6">
          {description}
        </p>
      </div>
      <div className="border-t border-slate-800/60 pt-6">
        <ul className="space-y-2">
          {stats.map((stat, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-slate-300 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              {stat}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 hover:border-slate-700 transition-colors shadow-sm">
      <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
      <p className="text-slate-400 leading-relaxed">
        {description}
      </p>
    </div>
  );
}
