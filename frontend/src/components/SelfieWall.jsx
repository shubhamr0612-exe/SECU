import { useEffect, useState } from "react";
import { api } from "../services/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Images, Loader2, Camera } from "lucide-react";

export function SelfieWall({ open, onOpenChange }) {
  const [selfies, setSelfies] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.getRecentSelfies()
      .then((r) => setSelfies(r.data.selfies || []))
      .catch(() => setSelfies([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    load();
    const t = setInterval(load, 15000); // live refresh
    return () => clearInterval(t);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass max-w-2xl max-h-[82vh] overflow-y-auto" data-testid="selfie-wall-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl flex items-center gap-2">
            <Images className="text-[#00F0FF]" /> Selfie Wall
          </DialogTitle>
          <DialogDescription>Recent selfies visitors chose to share. ✨</DialogDescription>
        </DialogHeader>

        {loading && <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-[#00F0FF]" /></div>}

        {!loading && selfies.length === 0 && (
          <div className="py-12 text-center text-muted-foreground" data-testid="selfie-wall-empty">
            <Camera size={40} className="mx-auto mb-3 opacity-50" />
            <p>No selfies yet — be the first! Turn on the camera and tap Selfie. 📸</p>
          </div>
        )}

        {!loading && selfies.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" data-testid="selfie-wall-grid">
            {selfies.map((s) => (
              <div key={s.id} className="rounded-xl overflow-hidden border border-[#00F0FF]/20 hover:border-[#00F0FF] transition-colors animate-rise">
                <img src={s.url} alt="SECU selfie" className="w-full h-full object-cover" loading="lazy" />
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
