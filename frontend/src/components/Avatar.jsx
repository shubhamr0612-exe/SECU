import { Shield, Bot } from "lucide-react";

const STATE_STYLES = {
  IDLE: { ring: "#00F0FF", glow: "rgba(0,240,255,0.35)", label: "Ready to chat" },
  WAKE: { ring: "#00F0FF", glow: "rgba(0,240,255,0.25)", label: "Say \"Hey SECU\"" },
  LISTENING: { ring: "#3B82F6", glow: "rgba(59,130,246,0.5)", label: "Listening to you..." },
  THINKING: { ring: "#F59E0B", glow: "rgba(245,158,11,0.45)", label: "Thinking..." },
  SPEAKING: { ring: "#10B981", glow: "rgba(16,185,129,0.5)", label: "SECU is speaking" },
};

export const Avatar = ({ state = "IDLE" }) => {
  const s = STATE_STYLES[state] || STATE_STYLES.IDLE;
  return (
    <div className="relative flex items-center justify-center" style={{ width: 260, height: 260 }}
         data-testid="secu-avatar" data-state={state}>
      {/* pulsing rings */}
      {(state === "LISTENING" || state === "SPEAKING") && (
        <>
          <span className="absolute rounded-full" style={{
            width: 220, height: 220, border: `2px solid ${s.ring}`,
            animation: "secu-pulse-ring 1.6s ease-out infinite" }} />
          <span className="absolute rounded-full" style={{
            width: 220, height: 220, border: `2px solid ${s.ring}`,
            animation: "secu-pulse-ring 1.6s ease-out infinite .8s" }} />
        </>
      )}
      {/* orbiting rings */}
      <div className="absolute animate-spin-slow rounded-full"
           style={{ width: 240, height: 240, border: `1px dashed ${s.ring}66` }} />
      <div className="absolute animate-spin-rev rounded-full"
           style={{ width: 200, height: 200, border: `1px dashed ${s.ring}44` }} />

      {/* core */}
      <div className={`relative flex items-center justify-center rounded-full ${state === "THINKING" ? "animate-breathe" : "animate-float"}`}
           style={{
             width: 160, height: 160,
             background: "radial-gradient(circle at 35% 30%, #1A2438, #0B0F17)",
             border: `2px solid ${s.ring}`,
             boxShadow: `0 0 50px ${s.glow}, inset 0 0 30px ${s.glow}`,
           }}>
        <Bot size={70} color={s.ring} strokeWidth={1.5} />
        <Shield size={24} color={s.ring} className="absolute" style={{ bottom: 26, opacity: .8 }} />
      </div>
    </div>
  );
};

export const stateLabel = (state) => (STATE_STYLES[state] || STATE_STYLES.IDLE).label;
export const stateColor = (state) => (STATE_STYLES[state] || STATE_STYLES.IDLE).ring;
