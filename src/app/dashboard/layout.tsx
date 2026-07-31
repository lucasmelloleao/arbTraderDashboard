'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Wallet, Zap, LayoutDashboard, LogOut, History, Activity, TrendingUp, User, Menu, X } from 'lucide-react';
import clsx from 'clsx';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{name: string, email: string} | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

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

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  if (!user) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-indigo-500">Loading...</div>;

  const links = [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/dashboard/wallets', label: 'Wallets', icon: Wallet },
    { href: '/dashboard/transactions', label: 'Transactions', icon: History },
    { href: '/dashboard/flash-loan', label: 'Flash Loans', icon: Zap },
    { href: '/dashboard/scalping', label: 'Scalping', icon: Activity },
    { href: '/dashboard/trending', label: 'Trending Coins', icon: TrendingUp },
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
            {!isCollapsed && <span>Solana Flash</span>}
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
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto mt-2">
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
        </nav>
        <div className="p-3 border-t border-slate-800 shrink-0">
          {!isCollapsed ? (
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white shadow-sm shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.name}</p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center mb-4">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white shadow-sm shrink-0" title={user.name}>
                {user.name.charAt(0).toUpperCase()}
              </div>
            </div>
          )}

          <Link 
            href="/dashboard/profile"
            onClick={() => setIsMobileMenuOpen(false)}
            className={clsx(
              "w-full flex items-center text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors mb-1",
              isCollapsed ? "justify-center py-3" : "justify-center gap-2 px-3 py-2"
            )}
            title={isCollapsed ? "Profile" : undefined}
          >
            <User className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>Profile</span>}
          </Link>
          <button 
            onClick={() => { localStorage.removeItem('token'); router.push('/login'); }}
            className={clsx(
              "w-full flex items-center text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors",
              isCollapsed ? "justify-center py-3" : "justify-center gap-2 px-3 py-2"
            )}
            title={isCollapsed ? "Sign Out" : undefined}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center px-4 md:px-8 gap-4 shrink-0">
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
          <h2 className="text-lg font-medium text-white">Dashboard</h2>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="w-full max-w-[1700px] mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
