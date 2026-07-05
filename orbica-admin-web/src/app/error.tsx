'use client';

import { useEffect } from 'react';

export default function AnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-6 bg-red-500/10 border border-red-500/20 rounded-xl">
      <h2 className="text-xl font-bold text-red-400 mb-4">Analytics Dashboard Error</h2>
      <p className="text-white/70 mb-6 text-center max-w-lg">
        {error.message.includes('ADMIN_SECRET') 
          ? "The ADMIN_SECRET is missing from your environment variables. Please add ADMIN_SECRET to both your web/.env.local and root .env files." 
          : error.message}
      </p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors font-medium"
      >
        Try Again
      </button>
    </div>
  );
}
