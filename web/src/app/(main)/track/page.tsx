import dynamic from "next/dynamic";
import { Eyebrow } from "@/components/ui";

export const metadata = { title: "Live Tracker — Orbica" };

const GlobalTracker = dynamic(() => import("@/components/track/GlobalTracker"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[78vh] border border-white/10 bg-black grid place-items-center text-white/40 text-sm">
      Connecting to live satellite stream…
    </div>
  ),
});

export default function TrackPage() {
  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-8">
        <div>
          <Eyebrow>Real-time · SGP4 propagation</Eyebrow>
          <h1 className="mt-4 font-light uppercase leading-[0.95] tracking-tight text-4xl sm:text-5xl lg:text-6xl">
            Live Tracker
          </h1>
        </div>
      </div>
      <GlobalTracker />
    </div>
  );
}
