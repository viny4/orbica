import { cookies } from 'next/headers';

export async function fetchAnalytics(endpoint: string) {
  const adminSecret = process.env.ADMIN_SECRET;
  
  if (!adminSecret) {
    throw new Error('ADMIN_SECRET is not configured');
  }

  // We are fetching the Go Analytics server internally, so we use localhost:4001
  // In production, this would be the internal Docker network URL like http://analytics:4001
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? 'http://analytics:4001/api/v1/admin' 
    : 'http://localhost:4001/api/v1/admin';

  const url = `${baseUrl}${endpoint}`;

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${adminSecret}`,
    },
    next: {
      revalidate: 60, // Cache for 60 seconds
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch analytics: ${res.statusText}`);
  }

  return res.json();
}
