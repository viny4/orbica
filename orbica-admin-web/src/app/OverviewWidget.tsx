import { fetchAnalytics } from './fetcher';
import { Users, Eye, Clock, Activity } from 'lucide-react';

export default async function OverviewWidget() {
  const data = await fetchAnalytics('/overview');

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="p-6 bg-white/5 border border-white/10 rounded-xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-space-accent-2)]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white/60 text-sm font-medium tracking-wide">Unique Visitors</h3>
          <Users size={16} className="text-[var(--color-space-accent-2)]" />
        </div>
        <p className="text-3xl font-bold">{data.visitors || 0}</p>
      </div>
      
      <div className="p-6 bg-white/5 border border-white/10 rounded-xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-space-accent-3)]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white/60 text-sm font-medium tracking-wide">Page Views</h3>
          <Eye size={16} className="text-[var(--color-space-accent-3)]" />
        </div>
        <p className="text-3xl font-bold">{data.page_views || 0}</p>
      </div>

      <div className="p-6 bg-white/5 border border-white/10 rounded-xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white/60 text-sm font-medium tracking-wide">Avg Session</h3>
          <Clock size={16} className="text-purple-400" />
        </div>
        <p className="text-3xl font-bold">2m 45s</p>
      </div>

      <div className="p-6 bg-[var(--color-space-accent-2)]/10 border border-[var(--color-space-accent-2)]/30 rounded-xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[var(--color-space-accent-2)] text-sm font-bold tracking-wide flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--color-space-accent-2)] animate-pulse" />
            Live Now
          </h3>
          <Activity size={16} className="text-[var(--color-space-accent-2)]" />
        </div>
        <p className="text-3xl font-bold text-white">{data.online || 0}</p>
      </div>
    </div>
  );
}
