import { Suspense } from 'react';

export const dynamic = 'force-dynamic';
import OverviewWidget from './OverviewWidget';
import TrafficWidget from './TrafficWidget';
import CountriesWidget from './CountriesWidget';
import BrowsersWidget from './BrowsersWidget';
import TopPagesWidget from './TopPagesWidget';
import TopRocketsWidget from './TopRocketsWidget';
import TopSatellitesWidget from './TopSatellitesWidget';
import SearchesWidget from './SearchesWidget';

export default function AnalyticsDashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-light tracking-wide mb-2">Orbica Analytics</h1>
        <p className="text-white/50 text-sm">Real-time performance and user insights.</p>
      </div>

      <Suspense fallback={<div className="h-24 bg-white/5 animate-pulse rounded-lg" />}>
        <OverviewWidget />
      </Suspense>

      <Suspense fallback={<div className="h-64 bg-white/5 animate-pulse rounded-lg" />}>
        <TrafficWidget />
      </Suspense>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Suspense fallback={<div className="h-64 bg-white/5 animate-pulse rounded-lg" />}>
          <CountriesWidget />
        </Suspense>
        <Suspense fallback={<div className="h-64 bg-white/5 animate-pulse rounded-lg" />}>
          <BrowsersWidget />
        </Suspense>
        <Suspense fallback={<div className="h-64 bg-white/5 animate-pulse rounded-lg" />}>
          <TopPagesWidget />
        </Suspense>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Suspense fallback={<div className="h-64 bg-white/5 animate-pulse rounded-lg" />}>
          <TopSatellitesWidget />
        </Suspense>
        <Suspense fallback={<div className="h-64 bg-white/5 animate-pulse rounded-lg" />}>
          <TopRocketsWidget />
        </Suspense>
        <Suspense fallback={<div className="h-64 bg-white/5 animate-pulse rounded-lg" />}>
          <SearchesWidget />
        </Suspense>
      </div>
    </div>
  );
}
