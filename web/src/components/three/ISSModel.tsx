import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Reusable Solar Array Blanket component to create a detailed amber cell grid
interface SolarPanelBlanketProps {
  position: [number, number, number];
  width: number;
  length: number;
}

function SolarPanelBlanket({ position, width, length }: SolarPanelBlanketProps) {
  return (
    <group position={position}>
      {/* Dark backing/frame */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width + 0.001, 0.0004, length + 0.001]} />
        <meshStandardMaterial color="#0f172a" roughness={0.7} metalness={0.2} />
      </mesh>
      
      {/* Golden-amber solar cells */}
      <mesh position={[0, 0.0001, 0]}>
        <boxGeometry args={[width, 0.0003, length]} />
        <meshStandardMaterial
          color="#d97706"
          roughness={0.18}
          metalness={0.85}
          emissive="#78350f"
          emissiveIntensity={0.25}
        />
      </mesh>
      
      {/* Structural cell dividers (grid lines) */}
      {/* Vertical center divider */}
      <mesh position={[0, 0.0003, 0]}>
        <boxGeometry args={[0.0005, 0.0001, length]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} />
      </mesh>
      {/* Horizontal fold dividers */}
      {[-0.4, -0.2, 0, 0.2, 0.4].map((t, idx) => (
        <mesh key={idx} position={[0, 0.0003, t * length]}>
          <boxGeometry args={[width, 0.0001, 0.0005]} />
          <meshStandardMaterial color="#0f172a" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

export default function ISSModel() {
  const groupRef = useRef<THREE.Group>(null);

  // Slowly rotate the ISS model for a dynamic, realistic in-orbit look
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.12;
    }
  });

  return (
    <group ref={groupRef} scale={[1.2, 1.2, 1.2]}>
      {/* ==================== 1. INTEGRATED TRUSS STRUCTURE (ITS) ==================== */}
      <group>
        {/* Main longitudinal rails running the length of the truss */}
        <mesh position={[0, 0.003, 0.003]}>
          <boxGeometry args={[0.24, 0.0006, 0.0006]} />
          <meshStandardMaterial color="#64748b" roughness={0.4} metalness={0.8} />
        </mesh>
        <mesh position={[0, 0.003, -0.003]}>
          <boxGeometry args={[0.24, 0.0006, 0.0006]} />
          <meshStandardMaterial color="#64748b" roughness={0.4} metalness={0.8} />
        </mesh>
        <mesh position={[0, -0.003, 0.003]}>
          <boxGeometry args={[0.24, 0.0006, 0.0006]} />
          <meshStandardMaterial color="#64748b" roughness={0.4} metalness={0.8} />
        </mesh>
        <mesh position={[0, -0.003, -0.003]}>
          <boxGeometry args={[0.24, 0.0006, 0.0006]} />
          <meshStandardMaterial color="#64748b" roughness={0.4} metalness={0.8} />
        </mesh>

        {/* Structural vertical frame segments along the truss */}
        {[-0.11, -0.08, -0.05, -0.02, 0.02, 0.05, 0.08, 0.11].map((x, i) => (
          <group key={i} position={[x, 0, 0]}>
            {/* Top strut */}
            <mesh position={[0, 0.003, 0]}>
              <boxGeometry args={[0.0006, 0.0006, 0.006]} />
              <meshStandardMaterial color="#475569" />
            </mesh>
            {/* Bottom strut */}
            <mesh position={[0, -0.003, 0]}>
              <boxGeometry args={[0.0006, 0.0006, 0.006]} />
              <meshStandardMaterial color="#475569" />
            </mesh>
            {/* Left strut */}
            <mesh position={[0, 0, 0.003]}>
              <boxGeometry args={[0.0006, 0.006, 0.0006]} />
              <meshStandardMaterial color="#475569" />
            </mesh>
            {/* Right strut */}
            <mesh position={[0, 0, -0.003]}>
              <boxGeometry args={[0.0006, 0.006, 0.0006]} />
              <meshStandardMaterial color="#475569" />
            </mesh>
          </group>
        ))}

        {/* Solar Alpha Rotary Joints (SARJ) - collar gears on port/starboard sides */}
        <group position={[-0.075, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <mesh>
            <cylinderGeometry args={[0.007, 0.007, 0.004, 16]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.1} />
          </mesh>
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.009, 0.009, 0.0015, 24]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
        <group position={[0.075, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <mesh>
            <cylinderGeometry args={[0.007, 0.007, 0.004, 16]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.1} />
          </mesh>
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.009, 0.009, 0.0015, 24]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>

        {/* External Logistics Carriers (ELC) payload platforms */}
        <mesh position={[-0.04, 0.004, 0.004]}>
          <boxGeometry args={[0.012, 0.005, 0.01]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.5} />
        </mesh>
        <mesh position={[0.04, 0.004, 0.004]}>
          <boxGeometry args={[0.012, 0.005, 0.01]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.5} />
        </mesh>
      </group>

      {/* ==================== 2. US SEGMENT MODULES (Forward Z > 0) ==================== */}
      <group>
        {/* Node 1 (Unity) - Central connector hub */}
        <group position={[0, 0, 0.002]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.0072, 0.0072, 0.008, 16]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.4} />
          </mesh>
          {/* Docking collars (top/bottom/port/starboard) */}
          {/* Starboard port */}
          <mesh position={[0.0072, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.004, 0.004, 0.0015, 12]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
          </mesh>
          {/* Port port */}
          <mesh position={[-0.0072, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.004, 0.004, 0.0015, 12]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
          </mesh>
          {/* Zenith port */}
          <mesh position={[0, 0.0072, 0]} rotation={[0, 0, 0]}>
            <cylinderGeometry args={[0.004, 0.004, 0.0015, 12]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
          </mesh>
        </group>

        {/* Quest Joint Airlock - extending from Node 1 Starboard */}
        <group position={[0.012, 0, 0.002]} rotation={[0, 0, Math.PI / 2]}>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[0.006, 0.006, 0.008, 12]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.006, 0]}>
            <sphereGeometry args={[0.0045, 12, 12]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.5} roughness={0.4} />
          </mesh>
        </group>

        {/* Tranquility (Node 3) - extending from Node 1 Port */}
        <group position={[-0.012, 0, 0.002]} rotation={[0, 0, Math.PI / 2]}>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[0.006, 0.006, 0.008, 12]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.7} roughness={0.3} />
          </mesh>
          
          {/* Cupola window dome facing Earth (Nadir / downwards Y < 0) */}
          <group position={[0, 0, -0.006]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh>
              <cylinderGeometry args={[0.0022, 0.0038, 0.0028, 8]} />
              <meshStandardMaterial color="#1e293b" roughness={0.8} />
            </mesh>
            {/* Windows */}
            <mesh position={[0, -0.0015, 0]}>
              <sphereGeometry args={[0.0018, 8, 8]} />
              <meshBasicMaterial color="#38bdf8" />
            </mesh>
          </group>
        </group>

        {/* Destiny Lab (US Laboratory) - main silver cylinder extending along Z */}
        <group position={[0, 0, 0.018]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.0072, 0.0072, 0.024, 16]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.92} roughness={0.15} />
          </mesh>
          {/* Dark utility cuffs/rings */}
          <mesh position={[0, 0, 0.008]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.0075, 0.0075, 0.001, 16]} />
            <meshStandardMaterial color="#475569" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0, -0.008]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.0075, 0.0075, 0.001, 16]} />
            <meshStandardMaterial color="#475569" roughness={0.6} />
          </mesh>
          {/* Earth-facing window (Nadir) */}
          <mesh position={[0, -0.0073, 0]} rotation={[0, 0, 0]}>
            <cylinderGeometry args={[0.0015, 0.0015, 0.0004, 8]} />
            <meshBasicMaterial color="#0284c7" />
          </mesh>
        </group>

        {/* Node 2 (Harmony) - forward connector hub */}
        <group position={[0, 0, 0.0355]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.0072, 0.0072, 0.01, 16]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.4} />
          </mesh>
          
          {/* Columbus (ESA Lab) - extending Starboard */}
          <group position={[0.013, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[0.0062, 0.0062, 0.018, 12]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.88} roughness={0.2} />
            </mesh>
            {/* End cap decoration */}
            <mesh position={[0, 0.009, 0]}>
              <cylinderGeometry args={[0.0064, 0.0064, 0.001, 12]} />
              <meshStandardMaterial color="#2563eb" roughness={0.5} />
            </mesh>
          </group>

          {/* Kibō (JEM Pressurized Module) - extending Port */}
          <group position={[-0.015, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[0.0072, 0.0072, 0.022, 16]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.15} />
            </mesh>
            {/* Kibō Exposed Facility (JEM-EF) platform at the end */}
            <group position={[0, 0.017, 0]} rotation={[0, 0, -Math.PI / 2]}>
              <mesh castShadow receiveShadow>
                <boxGeometry args={[0.012, 0.008, 0.014]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.5} roughness={0.5} />
              </mesh>
              {/* Exposed payload experiment units (tiny colored boxes) */}
              <mesh position={[0.003, 0.005, 0.003]}>
                <boxGeometry args={[0.003, 0.003, 0.003]} />
                <meshStandardMaterial color="#ffffff" roughness={0.8} />
              </mesh>
              <mesh position={[-0.003, 0.005, -0.003]}>
                <boxGeometry args={[0.003, 0.003, 0.003]} />
                <meshStandardMaterial color="#b45309" metalness={0.8} />
              </mesh>
              <mesh position={[0.003, 0.005, -0.003]}>
                <boxGeometry args={[0.002, 0.003, 0.002]} />
                <meshStandardMaterial color="#1e3a8a" roughness={0.2} metalness={0.7} />
              </mesh>
            </group>
          </group>
        </group>

        {/* Crew Dragon Spacecraft - docked to Harmony Forward Port */}
        <group position={[0, 0, 0.052]} rotation={[Math.PI / 2, 0, 0]}>
          {/* Dragon Trunk */}
          <mesh position={[0, -0.006, 0]} castShadow>
            <cylinderGeometry args={[0.0036, 0.0036, 0.007, 12]} />
            <meshStandardMaterial color="#ffffff" roughness={0.4} />
          </mesh>
          {/* Dark solar wrap on Dragon trunk side */}
          <mesh position={[0, -0.006, 0.0019]}>
            <boxGeometry args={[0.0015, 0.0068, 0.0032]} />
            <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.8} />
          </mesh>
          {/* Dragon Capsule body */}
          <mesh position={[0, 0, 0]} castShadow>
            <cylinderGeometry args={[0.0016, 0.0036, 0.005, 12]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.2} />
          </mesh>
          {/* Capsule nose cap */}
          <mesh position={[0, 0.003, 0]}>
            <cylinderGeometry args={[0.0008, 0.0016, 0.0012, 12]} />
            <meshStandardMaterial color="#475569" metalness={0.9} />
          </mesh>
        </group>
      </group>

      {/* ==================== 3. RUSSIAN SEGMENT MODULES (Rearward Z < 0) ==================== */}
      <group>
        {/* Zarya (FGB) - Gold Multi-Layer Insulation (MLI) wrap */}
        <group position={[0, 0, -0.02]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.007, 0.007, 0.034, 16]} />
            <meshStandardMaterial color="#c29b53" metalness={0.8} roughness={0.25} />
          </mesh>
          {/* Dark grey rings & instrument boxes on Zarya */}
          <mesh position={[0, 0, 0.012]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.0073, 0.0073, 0.0015, 16]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[0, 0, -0.012]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.0073, 0.0073, 0.0015, 16]} />
            <meshStandardMaterial color="#334155" />
          </mesh>

          {/* Nauka (MLM Lab) - mounted on Zarya Nadir (downwards Y < 0) */}
          <group position={[0, -0.011, 0.002]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[0.0068, 0.0068, 0.02, 12]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.6} roughness={0.4} />
            </mesh>
            {/* European Robotic Arm (ERA) detail */}
            <mesh position={[0.005, 0, 0.004]} rotation={[0.4, 0, 0.2]}>
              <boxGeometry args={[0.001, 0.015, 0.001]} />
              <meshStandardMaterial color="#f1f5f9" />
            </mesh>
          </group>

          {/* Zarya small solar panels (extending Port/Starboard) */}
          <mesh position={[-0.021, 0, 0.002]} rotation={[0.1, 0, 0]}>
            <boxGeometry args={[0.026, 0.0003, 0.008]} />
            <meshStandardMaterial color="#1e293b" roughness={0.3} metalness={0.8} />
          </mesh>
          <mesh position={[0.021, 0, 0.002]} rotation={[0.1, 0, 0]}>
            <boxGeometry args={[0.026, 0.0003, 0.008]} />
            <meshStandardMaterial color="#1e293b" roughness={0.3} metalness={0.8} />
          </mesh>
        </group>

        {/* Zvezda (Service Module) - Grey-white main service block */}
        <group position={[0, 0, -0.052]}>
          {/* Main wider section */}
          <mesh position={[0, 0, 0.005]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.0066, 0.0066, 0.016, 12]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.5} roughness={0.5} />
          </mesh>
          {/* Narrower rear section */}
          <mesh position={[0, 0, -0.009]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.0052, 0.0052, 0.012, 12]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.5} roughness={0.5} />
          </mesh>

          {/* Poisk (Zenith port, Y > 0) */}
          <mesh position={[0, 0.008, 0.003]} rotation={[0, 0, 0]} castShadow>
            <cylinderGeometry args={[0.0032, 0.0032, 0.005, 10]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.7} />
          </mesh>

          {/* Zvezda solar panel wings (extending Port/Starboard) */}
          <mesh position={[-0.023, 0, -0.005]} rotation={[-0.05, 0, 0]}>
            <boxGeometry args={[0.032, 0.0003, 0.006]} />
            <meshStandardMaterial color="#1e293b" roughness={0.3} metalness={0.8} />
          </mesh>
          <mesh position={[0.023, 0, -0.005]} rotation={[-0.05, 0, 0]}>
            <boxGeometry args={[0.032, 0.0003, 0.006]} />
            <meshStandardMaterial color="#1e293b" roughness={0.3} metalness={0.8} />
          </mesh>
        </group>

        {/* Soyuz / Progress Spacecraft - docked to Zvezda Aft Port */}
        <group position={[0, 0, -0.076]} rotation={[Math.PI / 2, 0, 0]}>
          {/* Orbital Module (sphere) */}
          <mesh position={[0, 0.007, 0]} castShadow>
            <sphereGeometry args={[0.0028, 10, 10]} />
            <meshStandardMaterial color="#475569" roughness={0.6} />
          </mesh>
          {/* Descent Module (frustum) */}
          <mesh position={[0, 0.0035, 0]} castShadow>
            <cylinderGeometry args={[0.0028, 0.0022, 0.0035, 10]} />
            <meshStandardMaterial color="#334155" roughness={0.7} />
          </mesh>
          {/* Instrument Module (cylinder) */}
          <mesh position={[0, -0.001, 0]} castShadow>
            <cylinderGeometry args={[0.0028, 0.0028, 0.004, 10]} />
            <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
          </mesh>
          {/* Soyuz Solar Panels (extending Port/Starboard) */}
          <mesh position={[-0.011, -0.001, 0]} rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[0.0002, 0.016, 0.004]} />
            <meshStandardMaterial color="#0f172a" metalness={0.7} />
          </mesh>
          <mesh position={[0.011, -0.001, 0]} rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[0.0002, 0.016, 0.004]} />
            <meshStandardMaterial color="#0f172a" metalness={0.7} />
          </mesh>
        </group>
      </group>

      {/* ==================== 4. SOLAR ARRAY WINGS (SAWs) ==================== */}
      {/* 
          Each side has 4 massive blankets extending from the truss ends.
          SAW assemblies are at X = -0.10 (Port) and X = 0.10 (Starboard).
      */}
      {/* Port Solar Arrays */}
      <group position={[-0.10, 0, 0]}>
        {/* Support Mast boom */}
        <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.0015, 0.0015, 0.012, 8]} />
          <meshStandardMaterial color="#475569" metalness={0.7} />
        </mesh>
        {/* Cross-truss mast extending front-to-back */}
        <mesh position={[-0.005, 0, 0]}>
          <boxGeometry args={[0.002, 0.002, 0.13]} />
          <meshStandardMaterial color="#334155" roughness={0.7} />
        </mesh>

        {/* Detailed Solar Panel Blankets */}
        {/* Forward-Left Blanket */}
        <SolarPanelBlanket position={[-0.016, 0, 0.035]} width={0.018} length={0.054} />
        {/* Forward-Right Blanket */}
        <SolarPanelBlanket position={[0.006, 0, 0.035]} width={0.018} length={0.054} />
        {/* Backward-Left Blanket */}
        <SolarPanelBlanket position={[-0.016, 0, -0.035]} width={0.018} length={0.054} />
        {/* Backward-Right Blanket */}
        <SolarPanelBlanket position={[0.006, 0, -0.035]} width={0.018} length={0.054} />
      </group>

      {/* Starboard Solar Arrays */}
      <group position={[0.10, 0, 0]}>
        {/* Support Mast boom */}
        <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.0015, 0.0015, 0.012, 8]} />
          <meshStandardMaterial color="#475569" metalness={0.7} />
        </mesh>
        {/* Cross-truss mast extending front-to-back */}
        <mesh position={[0.005, 0, 0]}>
          <boxGeometry args={[0.002, 0.002, 0.13]} />
          <meshStandardMaterial color="#334155" roughness={0.7} />
        </mesh>

        {/* Detailed Solar Panel Blankets */}
        {/* Forward-Left Blanket */}
        <SolarPanelBlanket position={[-0.006, 0, 0.035]} width={0.018} length={0.054} />
        {/* Forward-Right Blanket */}
        <SolarPanelBlanket position={[0.016, 0, 0.035]} width={0.018} length={0.054} />
        {/* Backward-Left Blanket */}
        <SolarPanelBlanket position={[-0.006, 0, -0.035]} width={0.018} length={0.054} />
        {/* Backward-Right Blanket */}
        <SolarPanelBlanket position={[0.016, 0, -0.035]} width={0.018} length={0.054} />
      </group>

      {/* ==================== 5. HEAT REJECTION RADIATORS ==================== */}
      {/* 
          Large white radiator panels extending backwards from the main truss.
          Three blades on each side (Port at X ~ -0.04, Starboard at X ~ 0.04).
      */}
      {/* Port Radiator Blades */}
      <group position={[-0.04, 0, -0.004]} rotation={[0.08, 0, 0.02]}>
        {/* Support frame connector */}
        <mesh position={[0, -0.003, -0.002]}>
          <boxGeometry args={[0.01, 0.0008, 0.004]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        {/* Blade 1 */}
        <mesh position={[-0.005, -0.003, -0.024]} castShadow>
          <boxGeometry args={[0.003, 0.0004, 0.042]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.8} metalness={0.1} />
        </mesh>
        {/* Blade 2 */}
        <mesh position={[0, -0.003, -0.024]} castShadow>
          <boxGeometry args={[0.003, 0.0004, 0.042]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.8} metalness={0.1} />
        </mesh>
        {/* Blade 3 */}
        <mesh position={[0.005, -0.003, -0.024]} castShadow>
          <boxGeometry args={[0.003, 0.0004, 0.042]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.8} metalness={0.1} />
        </mesh>
      </group>

      {/* Starboard Radiator Blades */}
      <group position={[0.04, 0, -0.004]} rotation={[0.08, 0, -0.02]}>
        {/* Support frame connector */}
        <mesh position={[0, -0.003, -0.002]}>
          <boxGeometry args={[0.01, 0.0008, 0.004]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        {/* Blade 1 */}
        <mesh position={[-0.005, -0.003, -0.024]} castShadow>
          <boxGeometry args={[0.003, 0.0004, 0.042]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.8} metalness={0.1} />
        </mesh>
        {/* Blade 2 */}
        <mesh position={[0, -0.003, -0.024]} castShadow>
          <boxGeometry args={[0.003, 0.0004, 0.042]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.8} metalness={0.1} />
        </mesh>
        {/* Blade 3 */}
        <mesh position={[0.005, -0.003, -0.024]} castShadow>
          <boxGeometry args={[0.003, 0.0004, 0.042]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.8} metalness={0.1} />
        </mesh>
      </group>

      {/* Photovoltaic Radiators (PVR) - smaller radiators next to Solar alpha joints */}
      <mesh position={[-0.075, 0, -0.014]} rotation={[0.1, 0, 0]}>
        <boxGeometry args={[0.005, 0.0003, 0.018]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.7} />
      </mesh>
      <mesh position={[0.075, 0, -0.014]} rotation={[0.1, 0, 0]}>
        <boxGeometry args={[0.005, 0.0003, 0.018]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.7} />
      </mesh>
    </group>
  );
}
