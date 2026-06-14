export function EmptyState({ message }: { message: string }) {
  return (
    <div className="border border-white/10 bg-white/[0.015] p-12 text-center text-sm tracking-wide text-white/45">
      {message}
    </div>
  );
}

// Helper to fetch-or-empty so a down API never crashes a page render.
export async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}
