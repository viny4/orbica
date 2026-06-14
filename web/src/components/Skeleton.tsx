// Shared skeleton primitives — shown via Next.js loading.tsx while a route's
// server data is in flight (slow API, cold cache, etc.).

export function Skel({ className = "" }: { className?: string }) {
  return <div className={`bg-white/[0.06] animate-pulse ${className}`} />;
}

export function PageHeaderSkel() {
  return (
    <div className="mb-12">
      <Skel className="h-3 w-40 mb-5 rounded" />
      <Skel className="h-12 sm:h-16 w-2/3 max-w-md rounded" />
    </div>
  );
}

export function GridSkel({ count = 9, image = false }: { count?: number; image?: boolean }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-[#06080f]">
          {image && <Skel className="aspect-[4/3] w-full" />}
          <div className="p-5 space-y-3">
            <Skel className="h-5 w-2/3 rounded" />
            <Skel className="h-3 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DetailSkel() {
  return (
    <div>
      <PageHeaderSkel />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Skel className="aspect-square w-full" />
        <div className="space-y-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between border-b border-white/10 pb-3">
              <Skel className="h-3 w-24 rounded" />
              <Skel className="h-3 w-32 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ListSkel({ rows = 8 }: { rows?: number }) {
  return (
    <div className="border-t border-white/10">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-4 border-b border-white/10">
          <div className="flex-1 space-y-2.5">
            <Skel className="h-4 w-2/3 rounded" />
            <Skel className="h-3 w-1/3 rounded" />
          </div>
          <Skel className="h-3 w-14 rounded" />
        </div>
      ))}
    </div>
  );
}
