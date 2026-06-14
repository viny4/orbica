import { PageHeaderSkel, GridSkel } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div>
      <PageHeaderSkel />
      <GridSkel count={9} image />
    </div>
  );
}
