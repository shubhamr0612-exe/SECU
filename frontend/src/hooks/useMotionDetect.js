import { useEffect, useRef } from "react";

// Cheap on-device motion check on the live camera preview (no frames leave the browser).
// Calls onMotion when the scene changes noticeably, e.g. someone walks up to the kiosk.
export function useMotionDetect({ enabled, onMotion, threshold = 16, intervalMs = 1000 }) {
  const cb = useRef(onMotion); cb.current = onMotion;

  useEffect(() => {
    if (!enabled) return;
    const c = document.createElement("canvas");
    c.width = 32; c.height = 24;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    let prev = null;
    const t = setInterval(() => {
      const v = document.querySelector('[data-testid="camera-video"]');
      if (!v || !v.videoWidth) return;
      ctx.drawImage(v, 0, 0, 32, 24);
      const px = ctx.getImageData(0, 0, 32, 24).data;
      const gray = new Float32Array(32 * 24);
      for (let i = 0; i < gray.length; i++) gray[i] = (px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]) / 3;
      if (prev) {
        let diff = 0;
        for (let i = 0; i < gray.length; i++) diff += Math.abs(gray[i] - prev[i]);
        if (diff / gray.length > threshold) cb.current();
      }
      prev = gray;
    }, intervalMs);
    return () => clearInterval(t);
  }, [enabled, threshold, intervalMs]);
}
