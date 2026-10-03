import { useEffect, useRef } from "react";

// Opt-in webcam preview. Exposes a capture() -> dataURL(JPEG) via onReady.
// Stream is fully stopped when inactive. Frames are never stored.
export function CameraView({ active, onReady, onError }) {
  const videoRef = useRef();
  const streamRef = useRef();

  useEffect(() => {
    let cancelled = false;

    const capture = () => {
      const v = videoRef.current;
      if (!v || !v.videoWidth) return null;
      const w = 480;
      const h = Math.round((v.videoHeight / v.videoWidth) * w);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1); // mirror to match preview
      ctx.drawImage(v, 0, 0, w, h);
      ctx.restore();
      return c.toDataURL("image/jpeg", 0.7);
    };

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" }, audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        onReady && onReady(capture);
      } catch (e) {
        onError && onError(e);
      }
    }

    if (active) start();
    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [active]); // eslint-disable-line

  if (!active) return null;
  return (
    <video ref={videoRef} data-testid="camera-video" autoPlay playsInline muted
      style={{ width: "100%", borderRadius: 12, transform: "scaleX(-1)", border: "1px solid rgba(0,240,255,0.25)" }} />
  );
}
