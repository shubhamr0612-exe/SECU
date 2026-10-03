import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Download, RefreshCw, Camera } from "lucide-react";

function brand(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const pad = 26, footer = 78;
      const c = document.createElement("canvas");
      c.width = img.width + pad * 2;
      c.height = img.height + pad + footer;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#0B0F17";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, pad, pad, img.width, img.height);
      ctx.strokeStyle = "#00F0FF";
      ctx.lineWidth = 3;
      ctx.strokeRect(pad - 2, pad - 2, img.width + 4, img.height + 4);
      ctx.fillStyle = "#00F0FF";
      ctx.font = "bold 28px Chivo, sans-serif";
      ctx.fillText("eSecurityIn", pad, img.height + pad + 42);
      ctx.fillStyle = "#94A3B8";
      ctx.font = "16px Inter, sans-serif";
      ctx.fillText("Selfie with SECU — your AI Buddy", pad, img.height + pad + 64);
      resolve(c.toDataURL("image/png"));
    };
    img.src = dataUrl;
  });
}

export function SelfieModal({ open, onOpenChange, capture }) {
  const [count, setCount] = useState(null);
  const [photo, setPhoto] = useState(null);
  const startedRef = useRef(false);

  const runCountdown = () => { setPhoto(null); setCount(3); };

  useEffect(() => {
    if (open && !startedRef.current) { startedRef.current = true; runCountdown(); }
    if (!open) { startedRef.current = false; setPhoto(null); setCount(null); }
  }, [open]);

  useEffect(() => {
    if (count === null) return;
    if (count === 0) {
      const raw = capture && capture();
      if (raw) brand(raw).then(setPhoto);
      setCount(null);
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 900);
    return () => clearTimeout(t);
  }, [count]); // eslint-disable-line

  const download = () => {
    if (!photo) return;
    const a = document.createElement("a");
    a.href = photo;
    a.download = `secu-selfie-${Date.now()}.png`;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass max-w-md" data-testid="selfie-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl flex items-center gap-2">
            <Camera className="text-[#00F0FF]" /> Selfie with SECU
          </DialogTitle>
        </DialogHeader>

        {count !== null && (
          <div className="py-16 text-center" data-testid="selfie-countdown">
            <p className="font-heading text-7xl font-black text-[#00F0FF] animate-breathe">{count === 0 ? "📸" : count}</p>
            <p className="text-muted-foreground mt-4">Smile! 😄</p>
          </div>
        )}

        {photo && (
          <div className="space-y-4 animate-rise" data-testid="selfie-result">
            <img src={photo} alt="Selfie with SECU" className="w-full rounded-lg" />
            <div className="flex gap-2">
              <Button onClick={download} className="flex-1 h-11" data-testid="selfie-download-button">
                <Download size={18} className="mr-2" /> Download
              </Button>
              <Button variant="outline" onClick={runCountdown} className="h-11" data-testid="selfie-retake-button">
                <RefreshCw size={18} className="mr-2" /> Retake
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
