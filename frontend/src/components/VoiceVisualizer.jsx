export const VoiceVisualizer = ({ active = false, color = "#00F0FF" }) => {
  const bars = Array.from({ length: 28 }, (_, i) => `bar-${i}`);
  return (
    <div className="flex items-end justify-center gap-[3px] h-12" data-testid="voice-visualizer">
      {bars.map((barId, i) => {
        const delay = (i % 7) * 0.08;
        const base = 6 + ((i * 37) % 26);
        return (
          <span
            key={barId}
            style={{
              width: 3,
              height: active ? `${base + 10}px` : "5px",
              background: color,
              borderRadius: 3,
              transition: "height .2s ease",
              animation: active ? `secu-breathe ${0.6 + (i % 5) * 0.12}s ease-in-out ${delay}s infinite` : "none",
              opacity: active ? 0.9 : 0.3,
            }}
          />
        );
      })}
    </div>
  );
};
