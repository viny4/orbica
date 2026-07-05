import React from 'react';
import Link from 'next/link';
import { Activity, BarChart2, Globe, LayoutDashboard, Rocket, Settings } from 'lucide-react';
import './globals.css';

export const metadata = {
  title: 'Orbica Admin',
  description: 'Admin dashboard for Orbica.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-[#03050a] text-white flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/10 p-6 flex flex-col h-screen sticky top-0 bg-black/50 backdrop-blur-xl">
        <div className="mb-12">
          <Link href="/">
            <h1 className="text-xl font-bold tracking-widest text-[var(--color-space-accent-2)]">
              ORBICA
            </h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/50 mt-1">Admin Console</p>
          </Link>
        </div>

        <nav className="flex-1 space-y-2">
          <Link 
            href="/" 
            className="flex items-center gap-3 px-4 py-3 bg-white/10 text-white rounded transition-colors"
          >
            <LayoutDashboard size={18} />
            <span className="text-sm font-medium">Analytics</span>
          </Link>
          <Link 
            href="/admin/data" 
            className="flex items-center gap-3 px-4 py-3 text-white/60 hover:text-white hover:bg-white/5 rounded transition-colors"
          >
            <Rocket size={18} />
            <span className="text-sm font-medium">Data Sync</span>
          </Link>
        </nav>

        <div className="pt-6 border-t border-white/10">
          <Link 
            href="/api/auth/logout" 
            className="flex items-center gap-3 px-4 py-3 text-white/60 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
          >
            <span className="text-sm font-medium">Sign Out</span>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-screen overflow-y-auto">
        <div className="max-w-7xl mx-auto p-8">
          {children}
          </div>
        </main>
      </div>
      </body>
    </html>
  );
}
