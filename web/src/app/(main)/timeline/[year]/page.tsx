import { api } from "@/lib/api";
import { safe } from "@/components/EmptyState";
import { PageHeader } from "@/components/ui";
import LaunchFeed from "@/components/timeline/LaunchFeed";

export default async function YearPage({ params }: { params: { year: string } }) {
  const year = Number(params.year);
  // Total comes from the cached year rollup — the list itself streams in.
  const years = await safe(api.timelineYears(), []);
  const total = years.find((y) => y.launch_year === year)?.total_launches ?? 0;

  return (
    <div>
      <PageHeader
        eyebrow="Launch Year"
        title={String(year)}
        meta={`${total} launch${total === 1 ? "" : "es"}`}
        back={{ href: "/timeline", label: "Timeline" }}
      />
      <LaunchFeed year={year} />
    </div>
  );
}
