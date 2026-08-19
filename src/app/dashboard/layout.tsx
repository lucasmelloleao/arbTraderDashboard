'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Wallet, Zap, LayoutDashboard, LogOut, History, Activity, TrendingUp, User, Menu, X, CalendarRange, Terminal, ShieldAlert, ChevronDown, HelpCircle, Globe } from 'lucide-react';
import clsx from 'clsx';
import HelpModal from '@/components/HelpModal';
import { useLanguage, LanguageSwitcher } from '@/lib/i18n';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();
 
  const [user, setUser] = useState<{ name: string, email: string } | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Invalid token');
        return res.json();
      })
      .then(data => setUser(data))
      .catch(() => {
        localStorage.removeItem('token');
        router.push('/login');
      });
  }, [router]);

  // Close mobile menu and user menu on route change or click outside
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-indigo-500">{t('carregando')}</div>;

  const links = [
    { href: '/dashboard', label: t('overview'), icon: LayoutDashboard },
    { href: '/dashboard/perpetual-arb', label: t('arbitragemFunding'), icon: TrendingUp },
    { href: '/dashboard/forex-arb', label: t('arbitragemForex'), icon: Globe },
    { href: '/dashboard/liquidation', label: t('liquidacao'), icon: ShieldAlert },
    { href: '/dashboard/flash-loan', label: t('flashLoans'), icon: Zap },
    { href: '/dashboard/exchanges', label: t('exchanges'), icon: Wallet },
    { href: '/dashboard/exchange-history', label: t('historicoExchange'), icon: CalendarRange },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex overflow-hidden">
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        "fixed inset-y-0 left-0 z-50 bg-slate-900 border-r border-slate-800 flex flex-col transform transition-all duration-300 ease-in-out md:relative md:translate-x-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        isCollapsed ? "w-20" : "w-64"
      )}>
        <div className={clsx("p-6 flex items-center md:block", isCollapsed ? "justify-center" : "justify-between")}>
          <h1 className={clsx("text-xl font-bold text-white flex items-center gap-2", isCollapsed && "justify-center")}>
            <Zap className="w-6 h-6 text-indigo-500 shrink-0" />
            {!isCollapsed && <span>ArbTrade</span>}
          </h1>
          {!isCollapsed && (
            <button
              className="md:hidden text-slate-400 hover:text-white"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto mt-2 mb-4">
          {links.map(link => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={clsx(
                  "flex items-center rounded-lg text-sm font-medium transition-colors group",
                  isCollapsed ? "justify-center py-3" : "gap-3 px-3 py-2.5",
                  isActive ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                )}
                title={isCollapsed ? link.label : undefined}
              >
                <Icon className={clsx("w-5 h-5 shrink-0", isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300")} />
                {!isCollapsed && <span className="truncate">{link.label}</span>}
              </Link>
            )
          })}

          {/* Ajuda */}
          <button
            onClick={() => { setIsHelpOpen(true); setIsMobileMenuOpen(false); }}
            className={clsx(
              "flex items-center rounded-lg text-sm font-medium transition-colors group w-full",
              isCollapsed ? "justify-center py-3" : "gap-3 px-3 py-2.5",
              "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            )}
            title={isCollapsed ? t('ajuda') : undefined}
          >
            <HelpCircle className="w-5 h-5 shrink-0 text-slate-500 group-hover:text-slate-300" />
            {!isCollapsed && <span className="truncate">{t('ajuda')}</span>}
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between px-4 md:px-8 gap-4 shrink-0">
          <div className="flex items-center gap-4">
            <button
              className="text-slate-400 hover:text-white p-1.5 hover:bg-slate-800 rounded-md transition-colors"
              onClick={() => {
                if (window.innerWidth < 768) {
                  setIsMobileMenuOpen(!isMobileMenuOpen);
                } else {
                  setIsCollapsed(!isCollapsed);
                }
              }}
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-lg font-medium text-white">{t('dashboard')}</h2>
          </div>

          {/* Language + User Top Navbar Menu */}
          <div className="flex items-center gap-3">
            <LanguageSwitcher compact />
            <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-slate-800/60 border border-transparent hover:border-slate-800 transition-all group"
            >
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-600/20 shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-sm font-medium text-white group-hover:text-indigo-400 transition-colors leading-tight">{user.name}</span>
                <span className="text-xs text-slate-400 truncate max-w-[150px] leading-tight">{user.email}</span>
              </div>
              <ChevronDown className={clsx("w-4 h-4 text-slate-400 transition-transform duration-200", isUserMenuOpen && "rotate-180")} />
            </button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-xl py-2 z-50 divide-y divide-slate-800 animate-in fade-in zoom-in-95">
                <div className="px-4 py-3 sm:hidden">
                  <p className="text-sm font-medium text-white">{user.name}</p>
                  <p className="text-xs text-slate-400 truncate">{user.email}</p>
                </div>

                <div className="py-1">
                  <Link
                    href="/dashboard/profile"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors"
                  >
                    <User className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>{t('perfil')}</span>
                  </Link>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => { setIsHelpOpen(true); setIsUserMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors"
                  >
                    <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>{t('ajuda')}</span>
                  </button>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => { localStorage.removeItem('token'); router.push('/login'); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span>{t('sair')}</span>
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="w-full max-w-[1700px] mx-auto">
            {children}
          </div>
        </div>
      </main>

      {/* Help Modal */}
      {isHelpOpen && <HelpModal onClose={() => setIsHelpOpen(false)} />}
    </div>
  );
}
