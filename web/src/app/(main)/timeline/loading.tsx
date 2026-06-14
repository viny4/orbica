import { PageHeaderSkel, Skel } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div>
      <PageHeaderSkel />
      <div className="space-y-14">
        {Array.from({ length: 3 }).map((_, s) => (
          <div key={s}>
            <Skel className="h-5 w-48 mb-5 rounded" />
            <div className="grid grid-cols-4 sm:grid-cols-7 md:grid-cols-10 gap-px bg-white/5">
              {Array.from({ length: 20 }).map((_, i) => (
                <Skel key={i} className="aspect-square" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
