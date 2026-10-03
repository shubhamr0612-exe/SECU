import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useMemo, Component } from "react";
import * as THREE from "three";
import { Avatar as Avatar2D } from "./Avatar";

const STATE_COLOR = { IDLE: "#00F0FF", LISTENING: "#3B82F6", THINKING: "#F59E0B", SPEAKING: "#10B981" };

function HackerFigure({ state, color }) {
  const group = useRef();
  const leftEye = useRef();
  const rightEye = useRef();
  const mouth = useRef();

  useFrame((st) => {
    const t = st.clock.elapsedTime;
    if (group.current) {
      group.current.position.y = Math.sin(t * 1.2) * 0.08;
      group.current.rotation.y = Math.sin(t * 0.4) * 0.28;
      group.current.rotation.z = Math.sin(t * 0.3) * 0.03;
    }
    const glow =
      state === "SPEAKING" ? 1.2 + Math.abs(Math.sin(t * 12)) * 2.4 :
      state === "LISTENING" ? 1.6 + Math.sin(t * 5) * 0.7 :
      state === "THINKING" ? 1.0 + Math.sin(t * 3) * 0.5 :
      1.0 + Math.sin(t * 1.5) * 0.3;
    if (leftEye.current) leftEye.current.material.emissiveIntensity = glow;
    if (rightEye.current) rightEye.current.material.emissiveIntensity = glow;
    if (mouth.current) {
      mouth.current.scale.y = state === "SPEAKING"
        ? 0.06 + Math.abs(Math.sin(t * 12)) * 0.26 : 0.04;
    }
  });

  const hoodMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#0c1424", metalness: 0.35, roughness: 0.65 }), []);
  const darkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#070b12", metalness: 0.4, roughness: 0.5 }), []);
  const eyeMat = useMemo(() => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.5 }), [color]);

  return (
    <group ref={group}>
      <mesh material={hoodMat} position={[0, 0.15, -0.15]} scale={[1.25, 1.38, 1.05]}>
        <sphereGeometry args={[1, 48, 48]} />
      </mesh>
      <mesh position={[0, 0.36, 0.3]} rotation={[Math.PI / 2.3, 0, 0]}>
        <torusGeometry args={[0.95, 0.07, 16, 56]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh material={darkMat} position={[0, -0.05, 0.5]} scale={[0.82, 0.92, 0.6]}>
        <sphereGeometry args={[0.8, 48, 48]} />
      </mesh>
      <mesh ref={leftEye} material={eyeMat} position={[-0.27, 0.04, 1.0]}>
        <sphereGeometry args={[0.11, 24, 24]} />
      </mesh>
      <mesh ref={rightEye} material={eyeMat} position={[0.27, 0.04, 1.0]}>
        <sphereGeometry args={[0.11, 24, 24]} />
      </mesh>
      <mesh ref={mouth} position={[0, -0.42, 1.0]}>
        <boxGeometry args={[0.44, 1, 0.04]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} />
      </mesh>
    </group>
  );
}

function Particles({ color }) {
  const ref = useRef();
  const count = 200;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 9;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 9;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 4 - 1.5;
    }
    return arr;
  }, []);
  useFrame((st, delta) => {
    if (!ref.current) return;
    const arr = ref.current.geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] -= delta * 0.7;
      if (arr[i * 3 + 1] < -4.5) arr[i * 3 + 1] = 4.5;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
    ref.current.rotation.y += delta * 0.02;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.045} color={color} transparent opacity={0.55} sizeAttenuation />
    </points>
  );
}

function Rings({ color, state }) {
  const r1 = useRef();
  const r2 = useRef();
  useFrame((st, delta) => {
    const sp = state === "THINKING" ? 3 : state === "LISTENING" ? 1.6 : 0.6;
    if (r1.current) { r1.current.rotation.z += delta * sp * 0.5; r1.current.rotation.x += delta * sp * 0.15; }
    if (r2.current) r2.current.rotation.z -= delta * sp * 0.4;
  });
  return (
    <>
      <mesh ref={r1}><torusGeometry args={[2.15, 0.012, 12, 90]} /><meshBasicMaterial color={color} transparent opacity={0.5} /></mesh>
      <mesh ref={r2} rotation={[Math.PI / 3, 0, 0]}><torusGeometry args={[1.85, 0.01, 12, 90]} /><meshBasicMaterial color={color} transparent opacity={0.3} /></mesh>
    </>
  );
}

function Scene({ state }) {
  const color = STATE_COLOR[state] || STATE_COLOR.IDLE;
  return (
    <>
      <ambientLight intensity={0.95} />
      <directionalLight position={[3, 4, 5]} intensity={2.6} color={color} />
      <directionalLight position={[-3, -2, 2]} intensity={1} color="#3B82F6" />
      <HackerFigure state={state} color={color} />
      <Rings color={color} state={state} />
      <Particles color={color} />
    </>
  );
}

class Boundary extends Component {
  constructor(p) { super(p); this.state = { err: false }; }
  static getDerivedStateFromError() { return { err: true }; }
  render() { return this.state.err ? this.props.fallback : this.props.children; }
}

export default function HackerAvatar3D({ state = "IDLE" }) {
  return (
    <div style={{ width: "100%", height: 340 }} data-testid="secu-avatar-3d" data-state={state}>
      <Boundary fallback={<div className="flex items-center justify-center h-full"><Avatar2D state={state} /></div>}>
        <Canvas camera={{ position: [0, 0, 6], fov: 45 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
          <Scene state={state} />
        </Canvas>
      </Boundary>
    </div>
  );
}
