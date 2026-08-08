"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Stars } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import * as THREE from "three";
import { deriveConfig, type RocketSpec, type RocketConfig } from "./rocketConfig";
import {
  deriveProfile,
  altitudeAt,
  velocityAt,
  currentEvent,
  formatT,
  type LaunchProfile,
} from "./launchProfile";
import { useInView } from "@/components/three/useInView";

// An ascent-to-orbit animation driven by the vehicle's real specs: engine count
// sets the plume, boosters/stages/fairing are shed at the right moments, and a
// reusable first stage flies back. The rocket holds frame while the world falls
// away — the usual trick for keeping the subject readable in a long climb.

const SKY_GROUND = new THREE.Color("#7fa9d6"); // hazy blue at sea level
const SKY_MID = new THREE.Color("#0b2447"); // upper atmosphere
const SKY_SPACE = new THREE.Color("#03050c"); // vacuum

// ── exhaust ────────────────────────────────────────────────────────────────

// `len` is the flame length in the same (vehicle-local) units as `radius`, so
// the exhaust stays proportional to the rocket regardless of the group scale.
function Plume({ radius, len, power, sea }: { radius: number; len: number; power: number; sea: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    // flicker so the flame reads as combustion rather than a static cone
    const f = 1 + Math.sin(clock.elapsedTime * 42) * 0.08 + Math.sin(clock.elapsedTime * 17) * 0.06;
    ref.current.scale.set(1, power * f, 1);
    ref.current.visible = power > 0.02;
  });
  // In vacuum the plume balloons out; at sea level it stays pencil-thin.
  const spread = 1 + (1 - sea) * 1.7;
  return (
    <group ref={ref}>
      {/* outer flame */}
      <mesh position={[0, -len / 2, 0]}>
        <coneGeometry args={[radius * 1.15 * spread, len, 28, 1, true]} />
        <meshBasicMaterial color="#ff9d3c" transparent opacity={0.45} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* inner core */}
      <mesh position={[0, -len * 0.3, 0]}>
        <coneGeometry args={[radius * 0.7 * spread, len * 0.62, 24, 1, true]} />
        <meshBasicMaterial color="#ffe9b8" transparent opacity={0.9} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <pointLight position={[0, -len * 0.2, 0]} color="#ff9a45" intensity={14 * power} distance={len * 6} />
    </group>
  );
}

// ── vehicle parts (separable) ──────────────────────────────────────────────

function Booster({ cfg, angle, r, h }: { cfg: RocketConfig; angle: number; r: number; h: number }) {
  const br = r * (cfg.boosterKind === "strapon" ? 0.42 : 0.34);
  const bh = h * (cfg.boosterKind === "strapon" ? 0.45 : 0.55);
  const d = r + br * 0.92;
  return (
    <group position={[Math.cos(angle) * d, bh / 2, Math.sin(angle) * d]}>
      <mesh>
        <cylinderGeometry args={[br, br, bh, 20]} />
        <meshStandardMaterial color={cfg.palette.booster} metalness={0.25} roughness={0.5} />
      </mesh>
      <mesh position={[0, bh * 0.66, 0]}>
        <coneGeometry args={[br, bh * 0.3, 18]} />
        <meshStandardMaterial color={cfg.palette.booster} metalness={0.25} roughness={0.5} />
      </mesh>
      <Plume radius={br} len={bh * 0.55} power={0.75} sea={1} />
    </group>
  );
}

function Vehicle({ cfg, p, t }: { cfg: RocketConfig; p: LaunchProfile; t: number }) {
  const r = cfg.diameter / 2;
  const h = cfg.height;
  const scale = 9 / h;
  const stage1H = h * 0.55;
  const upperH = h * 0.27;

  const boostersGone = p.hasBoosters && t > p.boosterSepT;
  const stage1Gone = t > p.stageSepT;
  const fairingGone = p.fairingT !== null && t > p.fairingT;

  // Throttle: down through Max Q, off at MECO, upper stage lights after sep.
  const stage1Power = t < 0 ? 0 : t > p.stageSepT - 4 ? 0 : t > 60 && t < 85 ? 0.65 : 1;
  const upperPower = stage1Gone && t < p.duration - 12 ? 0.8 : 0;
  const seaLevel = Math.max(0, 1 - altitudeAt(t, p) / 80); // 1 at pad → 0 in vacuum

  const boosterAngles = useMemo(
    () => Array.from({ length: cfg.boosters }, (_, i) => (i / Math.max(1, cfg.boosters)) * Math.PI * 2),
    [cfg.boosters],
  );

  // Separated hardware tumbles away rather than vanishing.
  const sepFall = (since: number) => -(since * since) * 0.5;

  // Gravity turn: vertical off the pad, then a progressive pitch downrange
  // until the vehicle is flying nearly horizontal for orbital insertion.
  const pitch =
    t < 12 ? 0 : Math.min(1.35, ((t - 12) / (p.duration - 12)) * 1.7);

  return (
    <group scale={scale} rotation={[0, 0, -pitch]}>
      {/* ── first stage ── */}
      {!stage1Gone ? (
        <group>
          <mesh position={[0, stage1H / 2, 0]}>
            <cylinderGeometry args={[r, r * 1.02, stage1H, 36]} />
            <meshStandardMaterial color={cfg.palette.body} metalness={0.22} roughness={0.55} />
          </mesh>
          <Plume radius={r} len={h * 0.3} power={stage1Power} sea={seaLevel} />
          {!boostersGone &&
            boosterAngles.map((a, i) => <Booster key={i} cfg={cfg} angle={a} r={r} h={h} />)}
        </group>
      ) : (
        // discarded stage falling back
        <group position={[r * 2.5, sepFall(t - p.stageSepT) * 6, 0]} rotation={[0.4, 0, 0.7]}>
          <mesh>
            <cylinderGeometry args={[r, r * 1.02, stage1H, 24]} />
            <meshStandardMaterial color={cfg.palette.body} metalness={0.22} roughness={0.6} />
          </mesh>
          {p.landingT !== null && t > p.landingT - 40 && <Plume radius={r} len={h * 0.18} power={0.5} sea={0.4} />}
        </group>
      )}

      {/* separated boosters drifting off */}
      {boostersGone &&
        t < p.boosterSepT + 8 &&
        boosterAngles.map((a, i) => {
          const s = t - p.boosterSepT;
          const d = (r + r * 0.5) * (1 + s * 1.4);
          return (
            <group
              key={`sep${i}`}
              position={[Math.cos(a) * d, sepFall(s) * 3, Math.sin(a) * d]}
              rotation={[s * 0.5, 0, Math.cos(a) * s * 0.6]}
            >
              <mesh>
                <cylinderGeometry args={[r * 0.4, r * 0.4, h * 0.45, 16]} />
                <meshStandardMaterial color={cfg.palette.booster} metalness={0.25} roughness={0.6} />
              </mesh>
            </group>
          );
        })}

      {/* ── upper stage (rides at stage-1 top until separation) ── */}
      <group position={[0, stage1Gone ? 0 : stage1H, 0]}>
        <mesh position={[0, upperH / 2, 0]}>
          <cylinderGeometry args={[r * 0.92, r * 0.94, upperH, 32]} />
          <meshStandardMaterial color={cfg.palette.upper} metalness={0.25} roughness={0.5} />
        </mesh>
        {upperPower > 0 && <Plume radius={r * 0.55} len={h * 0.22} power={upperPower} sea={0} />}

        {/* payload fairing / capsule */}
        {!fairingGone ? (
          <mesh position={[0, upperH + h * 0.07, 0]}>
            <coneGeometry args={[r * 0.92, h * 0.16, 32]} />
            <meshStandardMaterial color={cfg.palette.upper} metalness={0.2} roughness={0.5} />
          </mesh>
        ) : (
          <>
            {/* exposed payload */}
            <mesh position={[0, upperH + h * 0.04, 0]}>
              <boxGeometry args={[r * 0.9, h * 0.08, r * 0.9]} />
              <meshStandardMaterial color="#c8ccd4" metalness={0.6} roughness={0.35} />
            </mesh>
            {/* the two shroud halves falling away */}
            {[-1, 1].map((s) => {
              const since = t - (p.fairingT ?? 0);
              return (
                since < 6 && (
                  <mesh
                    key={s}
                    position={[s * r * (1 + since * 2), upperH - since * since * 2, 0]}
                    rotation={[0, 0, s * since * 0.8]}
                  >
                    <coneGeometry args={[r * 0.9, h * 0.16, 16, 1, true, 0, Math.PI]} />
                    <meshStandardMaterial color={cfg.palette.upper} side={THREE.DoubleSide} metalness={0.2} roughness={0.5} />
                  </mesh>
                )
              );
            })}
          </>
        )}
      </group>
    </group>
  );
}

// ── world: pad, ground, sky ────────────────────────────────────────────────

function World({ p, tRef }: { p: LaunchProfile; tRef: React.MutableRefObject<number> }) {
  const groundRef = useRef<THREE.Group>(null);
  const scene = useThree((s) => s.scene);

  useFrame(() => {
    const t = tRef.current;
    const alt = altitudeAt(t, p);
    // The ground drops away logarithmically so early metres feel fast and the
    // pad is still faintly visible for a while.
    const drop = Math.log10(1 + alt * 9) * 26;
    if (groundRef.current) {
      groundRef.current.position.y = -0.02 - drop;
      // Above ~70 km the flat disc stops reading as ground and starts looking
      // like a stray plane — retire it and let the starfield carry the scene.
      groundRef.current.visible = alt < 70;
    }
    // sky: blue → navy → black
    const f = Math.min(1, alt / 100);
    const c = new THREE.Color().copy(SKY_GROUND).lerp(SKY_MID, Math.min(1, f * 2)).lerp(SKY_SPACE, Math.max(0, f * 2 - 1));
    if (scene) scene.background = c;
  });

  return (
    <group ref={groundRef}>
      {/* pad + terrain */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[240, 48]} />
        <meshStandardMaterial color="#2a3341" roughness={1} />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[3.2, 32]} />
        <meshStandardMaterial color="#3d4653" roughness={0.9} />
      </mesh>
      {/* launch tower — sized against the ~9-unit vehicle, set back so it
          frames the pad instead of blocking the shot */}
      <mesh position={[4.2, 4.4, -1.2]}>
        <boxGeometry args={[0.55, 8.8, 0.55]} />
        <meshStandardMaterial color="#4a525f" metalness={0.4} roughness={0.7} />
      </mesh>
    </group>
  );
}

// Camera: hold the vehicle in frame, easing back as it accelerates.
function Rig({ p, tRef, fullH, upperH }: {
  p: LaunchProfile; tRef: React.MutableRefObject<number>; fullH: number; upperH: number;
}) {
  const dist = useRef(16);
  const aim = useRef(4);
  useFrame(({ camera }, delta) => {
    const t = Math.max(0, tRef.current);
    const f = Math.min(1, t / p.duration);
    // Frame whatever is still flying: the full stack before staging, just the
    // upper stage after — otherwise the subject shrinks to a speck.
    const staged = t > p.stageSepT;
    const subject = staged ? upperH : fullH;
    const wantDist = subject * 1.9 + 3;
    const wantAim = staged ? upperH * 0.45 : fullH * 0.42;
    // ease so the post-staging push-in is a move, not a jump
    const k = Math.min(1, delta * 1.6);
    dist.current += (wantDist - dist.current) * k;
    aim.current += (wantAim - aim.current) * k;
    const ang = 0.5 + f * 1.1; // slow orbit around the stack
    camera.position.set(Math.sin(ang) * dist.current, aim.current + subject * 0.15, Math.cos(ang) * dist.current);
    camera.lookAt(0, aim.current, 0);
  });
  return null;
}

// The parent re-renders every frame while playing, so `t` as a prop keeps the
// vehicle's separation states in sync; camera/world read the ref inside useFrame
// so they stay smooth even when React is idle (paused/scrubbing).
function Scene({ cfg, p, t, tRef }: { cfg: RocketConfig; p: LaunchProfile; t: number; tRef: React.MutableRefObject<number> }) {
  const alt = altitudeAt(t, p);
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[12, 18, 8]} intensity={1.8} color="#fff6e8" />
      <directionalLight position={[-10, 4, -6]} intensity={0.35} color="#9fb6d4" />
      {alt > 40 && <Stars radius={300} depth={60} count={2500} factor={5} fade speed={0} />}
      <Rig p={p} tRef={tRef} fullH={9} upperH={9 * 0.42} />
      <World p={p} tRef={tRef} />
      <Vehicle cfg={cfg} p={p} t={t} />
    </>
  );
}

// ── component ──────────────────────────────────────────────────────────────

export default function LaunchAnimation({ spec }: { spec: RocketSpec }) {
  const cfg = useMemo(() => deriveConfig(spec), [spec]);
  const profile = useMemo(
    () => deriveProfile(cfg, { reusable: spec.reusable, name: spec.name }),
    [cfg, spec.reusable, spec.name],
  );

  const { ref, inView, armed } = useInView<HTMLDivElement>();
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(-6);
  const tRef = useRef(-6);
  tRef.current = t;

  // Clock: 1× real time, stopping at the end. Pauses when off-screen.
  useEffect(() => {
    if (!playing || !inView) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setT((prev) => {
        const next = prev + dt * 4; // 4× so a 9-minute ascent plays in ~2 minutes
        if (next >= profile.duration) {
          setPlaying(false);
          return profile.duration;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, inView, profile.duration]);

  const ev = currentEvent(t, profile);
  const alt = altitudeAt(t, profile);
  const vel = velocityAt(t, profile);
  const done = t >= profile.duration;

  const replay = () => {
    setT(-6);
    setPlaying(true);
  };

  return (
    <div ref={ref} className="relative w-full aspect-[4/3] overflow-hidden border border-white/10 bg-[#05070f]">
      {armed ? (
        <Canvas camera={{ position: [8, 3, 16], fov: 45 }} dpr={[1, 2]} frameloop={inView ? "always" : "never"}>
          <Suspense fallback={<Html center>Loading…</Html>}>
            <Scene cfg={cfg} p={profile} t={t} tRef={tRef} />
          </Suspense>
        </Canvas>
      ) : (
        <div className="absolute inset-0 grid place-items-center text-white/30 text-xs tracking-[0.2em] uppercase">
          Launch sequence
        </div>
      )}

      {/* telemetry */}
      {/* sits below the mode tabs, which occupy the top-left corner */}
      <div className="absolute top-14 left-3 font-mono text-[11px] leading-relaxed pointer-events-none">
        <div className="text-[var(--color-space-accent-2)] text-sm">{formatT(t)}</div>
        <div className="text-white/70 tabular-nums">ALT {alt < 10 ? alt.toFixed(1) : alt.toFixed(0)} km</div>
        <div className="text-white/70 tabular-nums">VEL {vel.toFixed(2)} km/s</div>
      </div>

      {/* current milestone */}
      {ev && (
        <div className="absolute top-14 right-3 max-w-[46%] text-right pointer-events-none">
          <div className="text-[11px] tracking-[0.2em] uppercase text-[var(--color-space-accent-2)]">{ev.label}</div>
          <div className="text-[11px] text-white/55 mt-1 leading-snug">{ev.detail}</div>
        </div>
      )}

      {/* controls */}
      <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center gap-3">
          <button
            onClick={() => (done ? replay() : setPlaying((v) => !v))}
            className="shrink-0 px-4 py-1.5 border border-white/25 text-[11px] tracking-[0.18em] uppercase text-white hover:bg-white/10 transition-colors"
          >
            {done ? "Replay" : playing ? "Pause" : t > -6 ? "Resume" : "Launch"}
          </button>
          <input
            type="range"
            min={-6}
            max={profile.duration}
            step={0.5}
            value={t}
            onChange={(e) => {
              setPlaying(false);
              setT(parseFloat(e.target.value));
            }}
            aria-label="Scrub the launch timeline"
            className="w-full accent-[var(--color-space-accent-2)]"
          />
        </div>
        {/* milestone ticks */}
        <div className="hidden sm:flex flex-wrap gap-x-4 gap-y-1 mt-2">
          {profile.events.map((e) => (
            <button
              key={e.kind}
              onClick={() => {
                setPlaying(false);
                setT(e.t);
              }}
              className={`text-[9px] tracking-[0.14em] uppercase transition-colors ${
                ev?.kind === e.kind ? "text-[var(--color-space-accent-2)]" : "text-white/35 hover:text-white/70"
              }`}
            >
              {formatT(e.t)} {e.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
