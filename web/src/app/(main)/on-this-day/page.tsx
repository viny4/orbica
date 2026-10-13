export const runtime = "edge";
import Link from "next/link";
import { api } from "@/lib/api";
import { PageHeader, Outcome } from "@/components/ui";
import { safe } from "@/components/EmptyState";

export const metadata = {
  title: "On This Day in Spaceflight — Orbica",
  description: "Orbital launches that happened on today's date across seventy years of spaceflight history.",
};

export default async function OnThisDayPage() {
  const launches = await safe(api.onThisDay(50), []);
  // The API's "today" is the database's UTC date; label it the same way.
  const dateStr = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(new Date());

  return (
    <div>
      <PageHeader
        eyebrow="Historical archive"
        title={`On this day: ${dateStr}`}
        meta="Orbital launches that happened on this date over seventy years of spaceflight history."
      />

      {launches.length === 0 ? (
        <div className="border border-line py-20 text-center font-mono text-sm uppercase tracking-widest text-ink-3">
          No recorded orbital launches on this date.
        </div>
      ) : (
        <div className="tile-grid md:grid-cols-2 lg:grid-cols-3">
          {launches.map((l, i) => (
            <Link key={l.id} href={`/launches/${l.id}`} className="tile group reveal p-6" style={{ ["--i" as string]: i % 6 }}>
              <div className="mb-4 flex items-center justify-between">
                <span className="font-mono text-2xl font-extralight text-accent-blue">{l.launch_year}</span>
                <Outcome outcome={l.outcome} />
              </div>
              <h3 className="mb-2 text-xl font-light transition-colors group-hover:text-accent">{l.name}</h3>
              <div className="mt-4 flex flex-col gap-1">
                <span className="text-xs text-ink-3">{l.rocket_name || "Unknown rocket"}</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-ink-4">{l.agency_name || "Unknown agency"}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
