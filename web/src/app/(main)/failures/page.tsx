export const runtime = "edge";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui";
import { safe } from "@/components/EmptyState";
import { FailuresList } from "@/components/failures/FailuresList";

export default async function FailuresPage() {
  const failures = await safe(api.failures(1000, 0), []);

  return (
    <div>
      <PageHeader
        eyebrow="Anomaly Archive"
        title="Launch Failures"
        meta="Browse the complete historical record of orbital launch failures, partial failures, and critical mission anomalies."
      />

      <div className="mt-8">
        <FailuresList failures={failures} />
      </div>
    </div>
  );
}
