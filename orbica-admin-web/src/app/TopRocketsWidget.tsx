import { fetchAnalytics } from './fetcher';

export default async function TopRocketsWidget() {
  const data = await fetchAnalytics('/top-rockets');

  return (
    <div className="p-6 bg-white/5 border border-white/10 rounded-xl h-full">
      <h3 className="text-white/80 font-medium mb-6">Top Rockets</h3>
      <div className="space-y-4">
        {data?.length ? data.map((item: any, i: number) => (
          <div key={i} className="flex justify-between items-center">
            <span className="text-sm text-[var(--color-space-accent-3)] truncate mr-4">{item.path.replace('/rockets/', '')}</span>
            <span className="text-sm font-medium shrink-0">{item.views}</span>
          </div>
        )) : <div className="text-white/30 text-sm">No data yet</div>}
      </div>
    </div>
  );
}
