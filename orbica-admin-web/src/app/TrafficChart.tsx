'use client';

import { useEffect, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
// Since Recharts doesn't natively fetch on the server well, we can fetch from a server action or just pass the data as a prop
// Wait, we can make the component a Server Component and wrap the Chart in a Client Component!

// This is a client component that just takes the data
export default function TrafficChart({ data }: { data: any[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-space-accent-2)" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="var(--color-space-accent-2)" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="date" 
            stroke="rgba(255,255,255,0.2)" 
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} 
            tickLine={false}
          />
          <YAxis 
            stroke="rgba(255,255,255,0.2)" 
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
            itemStyle={{ color: 'var(--color-space-accent-2)' }}
          />
          <Area 
            type="monotone" 
            dataKey="views" 
            stroke="var(--color-space-accent-2)" 
            fillOpacity={1} 
            fill="url(#colorViews)" 
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
