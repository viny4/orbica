import { PageHeaderSkel, GridSkel } from "@/components/Skeleton";

// Fallback loading screen for any content route without its own loading.tsx.
export default function Loading() {
  return (
    <div>
      <PageHeaderSkel />
      <GridSkel count={9} />
    </div>
  );
}
