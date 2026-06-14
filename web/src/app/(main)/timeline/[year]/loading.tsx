import { PageHeaderSkel, ListSkel } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div>
      <PageHeaderSkel />
      <ListSkel rows={10} />
    </div>
  );
}
