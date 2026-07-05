import { fetchAnalytics } from './fetcher';
import TrafficChart from './TrafficChart';

export default async function TrafficWidget() {
  const data = await fetchAnalytics('/traffic');

  return (
    <div className="p-6 bg-white/5 border border-white/10 rounded-xl">
      <h3 className="text-white/80 font-medium mb-6">Traffic (Last 30 Days)</h3>
      <TrafficChart data={data || []} />
    </div>
  );
}
