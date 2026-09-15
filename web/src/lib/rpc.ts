// Routes the app's REST-shaped paths to Supabase RPC calls.
//
// The Go API is the normal backend. When it isn't reachable (its host suspended
// the service), the same queries are available as read-only Postgres functions
// exposed through Supabase's PostgREST — one function per endpoint, running the
// exact SQL the Go handler ran, so responses are identical and nothing
// downstream has to change.
//
// Configure with NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY.
// Unset -> routing is disabled and callers use the Go API as before.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") || "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export function rpcEnabled(): boolean {
  return Boolean(SUPABASE_URL && ANON);
}

const int = (v: string | null, d: number) => {
  const n = v == null ? NaN : parseInt(v, 10);
  return Number.isFinite(n) ? n : d;
};

/** Map a `/api/v1`-style path (with query string) to an RPC name + args. */
export function route(path: string): { fn: string; args: Record<string, unknown> } | null {
  const [p, qs] = path.split("?");
  const q = new URLSearchParams(qs || "");
  const seg = p.split("/").filter(Boolean); // e.g. ["rockets","falcon-9","articles"]
  const [a, b, c] = seg;

  switch (a) {
    case "timeline":
      if (b === "years" && c) return { fn: "api_timeline_year", args: { p1: int(c, 0), p2: int(q.get("limit"), 30), p3: int(q.get("offset"), 0) } };
      if (b === "years") return { fn: "api_timeline_years", args: {} };
      if (b === "on-this-day") return { fn: "api_timeline_on_this_day", args: { p1: int(q.get("limit"), 10) } };
      return null;

    case "agencies":
      return b ? { fn: "api_get_agency", args: { p1: b } } : { fn: "api_list_agencies", args: {} };

    case "rockets":
      if (b && c === "articles") return { fn: "api_rocket_articles", args: { p1: b } };
      if (b && c === "launches") return { fn: "api_rocket_launches", args: { p1: b } };
      if (b && c === "payloads") return { fn: "api_rocket_payloads", args: { p1: b, p2: int(q.get("limit"), 60), p3: int(q.get("offset"), 0) } };
      if (b) return { fn: "api_get_rocket", args: { p1: b } };
      return { fn: "api_list_rockets", args: {
        p1: q.get("status") || "", p2: q.get("reusable") || "", p3: q.get("q") || "",
        p4: int(q.get("limit"), 60), p5: int(q.get("offset"), 0) } };

    case "satellites":
      if (b === "slugs") return { fn: "api_satellite_slugs", args: {} };
      if (b && c === "tle") return { fn: "api_satellite_tle", args: { p1: b } };
      if (b && c === "articles") return { fn: "api_satellite_articles", args: { p1: b } };
      if (b) return { fn: "api_get_satellite", args: { p1: b } };
      return { fn: "api_list_satellites", args: {
        p1: q.get("purpose") || "", p2: q.get("orbit_type") || "", p3: q.get("status") || "",
        p4: q.get("constellation") || "", p5: q.get("owner") || "", p6: q.get("object_type") || "",
        p7: q.get("q") || "", p8: int(q.get("limit"), 60), p9: int(q.get("offset"), 0) } };

    case "launches":
      if (b === "upcoming") return { fn: "api_upcoming_launches", args: { p1: int(q.get("limit"), 4) } };
      if (b === "failures") return { fn: "api_failures", args: { p1: int(q.get("limit"), 100), p2: int(q.get("offset"), 0) } };
      if (b) return { fn: "api_get_launch", args: { p1: b } };
      return null;

    case "constellations":
      return b ? { fn: "api_constellation", args: { p1: decodeURIComponent(b) } } : { fn: "api_list_constellations", args: {} };

    case "intel":
      if (b === "conjunctions") return { fn: "api_conjunctions", args: {} };
      if (b === "reentries") return { fn: "api_reentries", args: {} };
      if (b === "spaceweather") return { fn: "api_space_weather", args: {} };
      if (b === "events") return { fn: "api_space_events", args: {} };
      return null;

    case "articles":
      return b === "latest" ? { fn: "api_latest_articles", args: {} } : null;

    case "track":
      return b === "meta" ? { fn: "api_track_meta", args: {} } : null;

    // Bulk TLEs for the client-side tracker (no Go hub needed).
    case "all-tles":
      return { fn: "api_all_tles", args: {} };

    case "search":
      return { fn: "api_search", args: { p1: q.get("q") || "" } };

    case "on-this-day":
      return { fn: "api_on_this_day", args: { p1: q.get("date") || "" } };

    case "stats":
      return b === "overview" ? { fn: "api_stats_overview", args: {} } : null;

    default:
      return null;
  }
}

/** Call the mapped RPC. Throws if the path has no mapping or the call fails. */
export async function rpcFetch(path: string, signal?: AbortSignal): Promise<Response> {
  const r = route(path);
  if (!r) throw new Error(`no RPC mapping for ${path}`);
  return fetch(`${SUPABASE_URL}/rest/v1/rpc/${r.fn}`, {
    method: "POST",
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(r.args),
    signal,
  });
}
