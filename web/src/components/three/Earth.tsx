"use client";

import { useRef, useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EARTH_R, EARTH_ROTATION_Y } from "./geo";

// Textured, slowly-rotating Earth. Textures live in /public/textures.
const AtmosphereShader = {
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vWorldPos;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;
    varying vec3 vWorldPos;
    uniform vec3 uSunDir;
    uniform float uTime;
    void main() {
      float ndv = max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0);
      // Rim-only glow so the atmosphere rims the limb instead of washing over the globe.
      float rim = pow(1.0 - ndv, 3.0);
      // Brighter on the sunlit limb.
      float sunDot = max(0.0, dot(normalize(vWorldPos), uSunDir));
      float sunlit = 0.5 + 0.9 * smoothstep(-0.3, 0.5, sunDot);
      float pulse = 1.0 + sin(uTime * 0.5) * 0.05;
      gl_FragColor = vec4(0.25, 0.55, 1.0, 1.0) * rim * sunlit * pulse;
    }
  `,
  uniforms: {
    uSunDir: { value: new THREE.Vector3() },
    uTime: { value: 0 },
  },
};

const CloudShader = {
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vWorldNormal;
    void main() {
      vUv = uv;
      vWorldNormal = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying vec3 vWorldNormal;
    uniform sampler2D uCloudMap;
    uniform float uTime;
    uniform vec3 uSunDir;
    void main() {
      // Animate clouds slowly
      vec2 uv = vUv + vec2(uTime * 0.0001, uTime * 0.00005);
      float cloud = texture2D(uCloudMap, uv).r;
      // Keep only the thickest cloud tops so continents read through.
      float alpha = smoothstep(0.74, 1.0, cloud);
      // Clouds are lit by the Sun, so they vanish on the night side.
      float sunDot = dot(normalize(vWorldNormal), normalize(uSunDir));
      float lit = smoothstep(-0.15, 0.4, sunDot);
      gl_FragColor = vec4(vec3(1.0), alpha * 0.22 * lit);
    }
  `,
  uniforms: {
    uCloudMap: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3() },
  },
  transparent: true,
  depthWrite: false,
};

const NightLightsShader = {
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vWorldNormal;
    void main() {
      vUv = uv;
      vWorldNormal = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying vec3 vWorldNormal;
    uniform sampler2D uNightMap;
    uniform vec3 uSunDir;
    void main() {
      // Only show city lights on the night side (world-space sun comparison).
      float sunDot = dot(normalize(vWorldNormal), normalize(uSunDir));
      float night = smoothstep(-0.05, 0.35, -sunDot);
      vec3 lights = texture2D(uNightMap, vUv).rgb;
      lights *= 0.8;
      gl_FragColor = vec4(lights, night);
    }
  `,
  uniforms: {
    uNightMap: { value: null as THREE.Texture | null },
    uSunDir: { value: new THREE.Vector3() },
  },
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
};

// Cache loaded textures at module scope so toggling Sky View (which unmounts the
// globe) doesn't re-download them.
type EarthTextures = {
  day: THREE.Texture | null;
  normal: THREE.Texture | null;
  specular: THREE.Texture | null;
  night: THREE.Texture | null;
  clouds: THREE.Texture | null;
};
let earthTextureCache: EarthTextures | null = null;
let earthTexturePromise: Promise<EarthTextures> | null = null;

function loadEarthTextures(): Promise<EarthTextures> {
  if (earthTextureCache) return Promise.resolve(earthTextureCache);
  if (earthTexturePromise) return earthTexturePromise;
  const loader = new THREE.TextureLoader();
  // Bump when the texture assets are replaced so browsers pick up the new files.
  const TEX_VERSION = "2";
  const load = (path: string) =>
    new Promise<THREE.Texture | null>((resolve) => {
      loader.load(
        `${path}?v=${TEX_VERSION}`,
        (tex) => {
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          tex.anisotropy = 8;
          tex.colorSpace = THREE.SRGBColorSpace;
          resolve(tex);
        },
        undefined,
        () => resolve(null), // optional layers (night/clouds) may not ship
      );
    });
  earthTexturePromise = Promise.all([
    load("/textures/earth_day.jpg"),
    load("/textures/earth_normal.jpg"),
    load("/textures/earth_specular.jpg"),
    load("/textures/earth_night.jpg"),
    load("/textures/earth_clouds.jpg"),
  ]).then(([day, normal, specular, night, clouds]) => {
    earthTextureCache = { day, normal, specular, night, clouds };
    return earthTextureCache;
  });
  return earthTexturePromise;
}

interface EarthProps {
  spin?: boolean;
  showClouds?: boolean;
  showNightLights?: boolean;
  showAtmosphere?: boolean;
  sunDirection?: THREE.Vector3;
}

export function Earth({ 
  spin = true, 
  showClouds = true,
  showNightLights = true,
  showAtmosphere = true,
  sunDirection = new THREE.Vector3(1, 0, 0)
}: EarthProps) {
  const ref = useRef<THREE.Group>(null);
  const { clock } = useThree();
  const [textures, setTextures] = useState<EarthTextures>(() => earthTextureCache ?? {
    day: null, normal: null, specular: null, night: null, clouds: null,
  });

  useEffect(() => {
    let alive = true;
    loadEarthTextures().then((t) => { if (alive) setTextures(t); });
    return () => { alive = false; };
  }, []);

  useFrame((_, delta) => {
    if (spin && ref.current) {
      ref.current.rotation.y += delta * 0.02;
    }
    // Update shader uniforms
    AtmosphereShader.uniforms.uTime.value = clock.getElapsedTime();
    AtmosphereShader.uniforms.uSunDir.value.copy(sunDirection).normalize();
    CloudShader.uniforms.uTime.value = clock.getElapsedTime();
    CloudShader.uniforms.uSunDir.value.copy(sunDirection).normalize();
    NightLightsShader.uniforms.uSunDir.value.copy(sunDirection).normalize();
  });

  const { day, normal, specular, night, clouds } = textures;

  // Bind the optional maps into the shared shader uniforms once they load.
  useEffect(() => {
    NightLightsShader.uniforms.uNightMap.value = night;
    CloudShader.uniforms.uCloudMap.value = clouds;
  }, [night, clouds]);

  return (
    <group ref={ref} rotation={[0, EARTH_ROTATION_Y, 0]}>
      {/* Main Earth surface with day texture */}
      {day && (
        <mesh>
          <sphereGeometry args={[EARTH_R, 64, 64]} />
          <meshPhongMaterial
            map={day}
            normalMap={normal}
            specularMap={specular}
            specular={new THREE.Color("#223355")}
            shininess={12}
          />
        </mesh>
      )}

      {/* Night lights on dark side */}
      {showNightLights && night && (
        <mesh scale={1.001}>
          <sphereGeometry args={[EARTH_R, 64, 64]} />
          <shaderMaterial
            vertexShader={NightLightsShader.vertexShader}
            fragmentShader={NightLightsShader.fragmentShader}
            uniforms={NightLightsShader.uniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {/* Cloud layer */}
      {showClouds && clouds && (
        <mesh scale={1.012}>
          <sphereGeometry args={[EARTH_R, 48, 48]} />
          <shaderMaterial
            vertexShader={CloudShader.vertexShader}
            fragmentShader={CloudShader.fragmentShader}
            uniforms={CloudShader.uniforms}
            transparent
            depthWrite={false}
          />
        </mesh>
      )}

      {/* High-tech tactical grid wireframe */}
      <mesh scale={1.002}>
        <sphereGeometry args={[EARTH_R, 36, 36]} />
        <meshBasicMaterial color="#4f75ff" wireframe transparent opacity={0.06} />
      </mesh>

      {/* Upgraded atmosphere glow with sun interaction */}
      {showAtmosphere && (
        <mesh scale={1.12}>
          <sphereGeometry args={[EARTH_R, 48, 48]} />
          <shaderMaterial
            vertexShader={AtmosphereShader.vertexShader}
            fragmentShader={AtmosphereShader.fragmentShader}
            uniforms={AtmosphereShader.uniforms}
            blending={THREE.AdditiveBlending}
            side={THREE.FrontSide}
            transparent
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
