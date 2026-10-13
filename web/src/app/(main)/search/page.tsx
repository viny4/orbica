export const runtime = "edge";

import type { Metadata } from "next";
import { api } from "@/lib/api";
import { safe } from "@/components/EmptyState";
import SearchClient, { type SearchResult } from "@/components/SearchClient";

export const metadata: Metadata = {
  title: "Search — Orbica",
  description: "Search every rocket, satellite and space agency in the Orbica catalogue.",
};

// Server-renders results for ?q= (the URL the site's SearchAction structured
// data advertises, and what shared links carry), then hands off to the client
// for as-you-type refinement.
export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q ?? "").trim().slice(0, 100);
  const initial = q.length >= 2 ? await safe(api.search(q), []) : [];
  return <SearchClient initialQuery={q} initialResults={initial as SearchResult[]} />;
}
