export const runtime = "edge";
import type { Metadata } from "next";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui";
import { EmptyState, safe } from "@/components/EmptyState";
import { FailuresList } from "@/components/failures/FailuresList";

export const metadata: Metadata = {
  title: "Launch Failures — Orbica",
  description: "The historical record of orbital launch failures and partial failures since 1957 — every vehicle, mission and operator.",
};

export default async function FailuresPage() {
  const failures = await safe(api.failures(1000, 0), null);

  return (
    <div>
      <PageHeader
        eyebrow="Anomaly archive"
        title="Launch Failures"
        meta="The historical record of orbital launch failures, partial failures and mission anomalies."
      />
      {failures === null ? (
        <EmptyState message="The failure archive is unavailable right now — please try again shortly." />
      ) : (
        <FailuresList failures={failures} />
      )}
    </div>
  );
}
