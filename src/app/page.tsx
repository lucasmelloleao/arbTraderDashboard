import Link from 'next/link';
import { Zap, TrendingUp, Shield, BrainCircuit, ArrowRight, BarChart3, Activity } from 'lucide-react';

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
          <div>
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
              Operações de Perpétuos Ativas
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight mb-8">
              Maximize seus lucros com <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
                Arbitragem de Perpétuos
              </span>
            </h1>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              Descubra oportunidades únicas com o poder da <strong className="text-white">Inteligência Artificial</strong>, que encontra as melhores taxas de funding, executa arbitragem de perpétuos e rastreia todo o processo em tempo real enquanto a plataforma trabalha por você.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                href="/login"
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 text-lg"
              >
                Começar Agora <ArrowRight className="w-5 h-5" />
              </Link>
              <a 
                href="#benefits"
                className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-white px-8 py-3.5 rounded-xl font-medium transition-all flex items-center justify-center gap-2 text-lg"
              >
                Conhecer Benefícios
              </a>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section id="benefits" className="py-24 bg-slate-900/50 border-y border-slate-800/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-white mb-4">Por que operar Perpétuos?</h2>
              <p className="text-slate-400 max-w-2xl mx-auto">
                Mercados futuros perpétuos oferecem vantagens exclusivas que, aliadas à nossa plataforma, garantem oportunidades consistentes de ganho de capital.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              <FeatureCard 
                icon={<Activity className="w-6 h-6 text-indigo-400" />}
                title="Funding Rate Arbitrage"
                description="Lucre com a diferença das taxas de funding entre diferentes corretoras mantendo posições neutras no mercado (Delta Neutro), reduzindo os riscos direcionais."
              />
              <FeatureCard 
                icon={<TrendingUp className="w-6 h-6 text-cyan-400" />}
                title="Alavancagem Eficiente"
                description="Otimize o uso do seu capital utilizando alavancagem para maximizar os retornos em pequenas discrepâncias de preços, mantendo margens seguras."
              />
              <FeatureCard 
                icon={<BarChart3 className="w-6 h-6 text-emerald-400" />}
                title="Alta Liquidez"
                description="Opere nos mercados mais líquidos do ecossistema cripto, garantindo que suas ordens de arbitragem sejam executadas instantaneamente e sem grande slippage."
              />
              <FeatureCard 
                icon={<BrainCircuit className="w-6 h-6 text-fuchsia-400" />}
                title="Movido a Inteligência Artificial"
                description="A plataforma utiliza IA avançada para varrer o mercado em busca das melhores oportunidades e para rastrear, ajustar e otimizar as estratégias continuamente."
              />
              <FeatureCard 
                icon={<Shield className="w-6 h-6 text-rose-400" />}
                title="Gestão de Risco Avançada"
                description="Sistemas automáticos que monitoram a saúde da margem de manutenção e realizam auto-close em cenários adversos, preservando o seu capital."
              />
              <FeatureCard 
                icon={<Zap className="w-6 h-6 text-yellow-400" />}
                title="Execução Relâmpago"
                description="Infraestrutura otimizada para capturar spreads instantâneos, aproveitando as ineficiências entre os mercados descentralizados e centralizados."
              />
            </div>
          </div>
        </section>
        
        {/* CTA Section */}
        <section className="py-24 relative overflow-hidden">
           <div className="absolute inset-0 bg-indigo-900/10 -z-10" />
           <div className="max-w-4xl mx-auto px-4 text-center">
             <h2 className="text-4xl font-bold text-white mb-6">Pronto para dominar os mercados Perpétuos?</h2>
             <p className="text-xl text-slate-400 mb-10">Junte-se a investidores que estão revolucionando suas carteiras com as nossas estratégias avançadas de arbitragem.</p>
             <Link 
                href="/login"
                className="inline-flex bg-white hover:bg-slate-100 text-slate-900 px-8 py-4 rounded-xl font-bold transition-all shadow-xl shadow-white/10 items-center justify-center gap-2 text-lg"
              >
                Criar Minha Conta Gratuita <ArrowRight className="w-5 h-5" />
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
