import { useEffect, useRef } from "react";
import { stateColor } from "./Avatar";

const RATE = { IDLE: 0.8, WAKE: 0.6, LISTENING: 1, THINKING: 0.5, SPEAKING: 1.35 };

export default function HackerAvatarGif({ state = "IDLE" }) {
  const vid = useRef(null);
  const color = stateColor(state === "WAKE" ? "IDLE" : state);
  const pulsing = state === "LISTENING" || state === "SPEAKING";

  useEffect(() => {
    if (vid.current) vid.current.playbackRate = RATE[state] || 1;
  }, [state]);

  return (
    <div className="relative flex items-center justify-center my-4" style={{ width: 340, maxWidth: "90vw", aspectRatio: "512 / 331" }}
         data-testid="secu-avatar" data-state={state}>
      {pulsing && [0, 0.8].map((d) => (
        <span key={d} className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{ border: `2px solid ${color}`, animation: `secu-pulse-ring 1.6s ease-out infinite ${d}s` }} />
      ))}
      <div className="relative w-full h-full rounded-2xl overflow-hidden"
           style={{ border: `2px solid ${color}`, boxShadow: `0 0 ${state === "SPEAKING" ? 48 : 28}px ${color}88`,
                    transition: "box-shadow .3s ease, border-color .3s ease" }}>
        <video ref={vid} data-testid="secu-avatar-media" poster="/secu-hacker-poster.jpg"
               autoPlay loop muted playsInline className="w-full h-full object-cover"
               style={{ filter: state === "THINKING" ? "hue-rotate(-150deg) saturate(1.2)" : state === "WAKE" ? "brightness(.7) saturate(.6)" : "none",
                        transition: "filter .4s ease" }}>
          <source src="/secu-hacker.webm" type="video/webm" />
          <source src="/secu-hacker.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 pointer-events-none mix-blend-overlay"
             style={{ background: `linear-gradient(180deg, transparent 55%, ${color}55)` }} />
      </div>
    </div>
  );
}
