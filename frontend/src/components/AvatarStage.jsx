import { useEffect, useRef, useState } from "react";
import { stateColor } from "./Avatar";

const POSES = ["walk", "laptop", "walk", "read", "walk", "wave"];
const IMG = (n) => `/avatar/${n}.webp`;
const WALK_MS = 3200;
const HOLD_MS = 5000;

// Idle: SECU wanders the stage doing her work. Active: she walks up close and talks.
export default function AvatarStage({ state = "IDLE", active = false }) {
  const [step, setStep] = useState(0);
  const [x, setX] = useState(30);
  const [facing, setFacing] = useState(1);
  const [mouthOpen, setMouthOpen] = useState(false);
  const xRef = useRef(x); xRef.current = x;
  const color = stateColor(state === "WAKE" ? "IDLE" : state);
  const pose = POSES[step % POSES.length];

  useEffect(() => {
    if (active) return;
    if (pose === "walk") {
      let target = 12 + Math.random() * 76;
      if (Math.abs(target - xRef.current) < 20) target = xRef.current > 50 ? 18 : 82;
      setFacing(target > xRef.current ? 1 : -1);
      const raf = requestAnimationFrame(() => setX(target));
      const t = setTimeout(() => setStep((s) => s + 1), WALK_MS);
      return () => { cancelAnimationFrame(raf); clearTimeout(t); };
    }
    const t = setTimeout(() => setStep((s) => s + 1), HOLD_MS);
    return () => clearTimeout(t);
  }, [step, active]); // eslint-disable-line

  useEffect(() => {
    if (state !== "SPEAKING") { setMouthOpen(false); return; }
    let t;
    const flap = () => { setMouthOpen((m) => !m); t = setTimeout(flap, 90 + Math.random() * 130); };
    flap();
    return () => clearTimeout(t);
  }, [state]);

  const src = active ? IMG(mouthOpen ? "talk" : "close") : IMG(pose);
  const walking = !active && pose === "walk";

  return (
    <div data-testid="secu-avatar" data-state={state} data-pose={active ? "close" : pose}
         className="relative w-full overflow-hidden rounded-2xl my-3"
         style={{ height: 360, background: `radial-gradient(ellipse at 50% 100%, ${color}22, transparent 65%)`,
                  boxShadow: active ? `inset 0 0 60px ${color}33` : "none", transition: "box-shadow .6s ease" }}>
      <div className="absolute left-0 right-0 bottom-6 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}66, transparent)` }} />
      {[ "close", "talk" ].map((n) => <link key={n} rel="preload" as="image" href={IMG(n)} />)}
      <div className="absolute bottom-4"
           style={{ left: `${active ? 50 : x}%`, height: active ? 350 : 210, transform: "translateX(-50%)",
                    transition: `left ${active ? 900 : WALK_MS}ms ${active ? "cubic-bezier(.2,.8,.2,1)" : "linear"}, height 900ms cubic-bezier(.2,.8,.2,1)` }}>
        <img data-testid="secu-avatar-media" src={src} alt="SECU" draggable={false}
             className="h-full w-auto select-none pointer-events-none"
             style={{ transform: `scaleX(${active ? 1 : facing})`, filter: `drop-shadow(0 8px 18px ${color}55)`,
                      animation: walking ? "secu-walk-bob .45s ease-in-out infinite" : state === "THINKING" ? "secu-idle-sway 1.6s ease-in-out infinite" : active ? "secu-float 3.2s ease-in-out infinite" : "secu-idle-sway 3s ease-in-out infinite" }} />
        {state === "THINKING" && (
          <span data-testid="avatar-thinking-bubble" className="absolute -top-2 right-0 px-3 py-1 rounded-full text-sm font-mono glass" style={{ color }}>…</span>
        )}
      </div>
    </div>
  );
}
