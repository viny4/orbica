import type { Article } from "@/lib/api";
import { SafeImg } from "@/components/SafeImg";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  const days = Math.floor((Date.now() - d) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// Real news pulled from the Spaceflight News API, linked at the DB level.
export function News({ articles, heading = "In the news" }: { articles: Article[]; heading?: string }) {
  if (!articles?.length) return null;
  return (
    <section className="mt-16">
      <h2 className="text-[11px] tracking-[0.3em] uppercase text-ink-3 mb-5 border-b border-line pb-3">
        {heading}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/5">
        {articles.map((a) => (
          <a
            key={a.id}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex gap-4 bg-surface p-4 hover:bg-surface-2 transition-colors"
          >
            {a.image_url && (
              <SafeImg
                src={a.image_url}
                alt=""
                className="w-24 h-24 object-cover flex-shrink-0 border border-line"
              />
            )}
            <div className="min-w-0">
              <div className="text-sm font-light leading-snug group-hover:text-accent transition-colors line-clamp-3">
                {a.title}
              </div>
              <div className="mt-2 text-[10px] tracking-[0.18em] uppercase text-ink-4 font-mono">
                {a.news_site} · {timeAgo(a.published_at)}
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
