import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { api } from "../services/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Download, RefreshCw, Camera, QrCode, Loader2 } from "lucide-react";

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
  const [shareUrl, setShareUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const startedRef = useRef(false);

  const runCountdown = () => { setPhoto(null); setShareUrl(null); setCount(3); };

  useEffect(() => {
    if (open && !startedRef.current) { startedRef.current = true; runCountdown(); }
    if (!open) { startedRef.current = false; setPhoto(null); setShareUrl(null); setCount(null); }
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
    a.href = photo; a.download = `secu-selfie-${Date.now()}.png`; a.click();
  };

  const share = async () => {
    if (!photo) return;
    setUploading(true);
    try {
      const r = await api.uploadSelfie(photo);
      setShareUrl(r.data.url);
    } catch (_) {} finally { setUploading(false); }
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

        {photo && !shareUrl && (
          <div className="space-y-4 animate-rise" data-testid="selfie-result">
            <img src={photo} alt="Selfie with SECU" className="w-full rounded-lg" />
            <div className="grid grid-cols-3 gap-2">
              <Button onClick={download} className="h-11" data-testid="selfie-download-button">
                <Download size={18} className="mr-1" /> Save
              </Button>
              <Button variant="secondary" onClick={share} disabled={uploading} className="h-11" data-testid="selfie-share-button">
                {uploading ? <Loader2 className="animate-spin" size={18} /> : <><QrCode size={18} className="mr-1" /> QR</>}
              </Button>
              <Button variant="outline" onClick={runCountdown} className="h-11" data-testid="selfie-retake-button">
                <RefreshCw size={18} className="mr-1" /> Retake
              </Button>
            </div>
          </div>
        )}

        {shareUrl && (
          <div className="text-center space-y-3 animate-rise" data-testid="selfie-qr">
            <div className="bg-white p-4 rounded-xl inline-block">
              <QRCodeCanvas value={shareUrl} size={200} includeMargin />
            </div>
            <p className="text-sm text-muted-foreground">📱 Scan with your phone to open & save your selfie</p>
            <div className="flex gap-2">
              <Button onClick={download} variant="secondary" className="flex-1 h-11">
                <Download size={18} className="mr-1" /> Also save here
              </Button>
              <Button variant="outline" onClick={runCountdown} className="h-11">
                <RefreshCw size={18} className="mr-1" /> Retake
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
