import { useEffect, useState } from "react";
import { api } from "../services/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Clock, Shield, IndianRupee, Loader2, Calendar } from "lucide-react";

export const CoursesModal = ({ open, onOpenChange, onAsk }) => {
  const [courses, setCourses] = useState([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.getPublicKnowledge()
      .then((r) => {
        const c = r.data.courses || {};
        setCourses(Array.isArray(c.courses) ? c.courses : []);
        setNote(c._note || "");
      })
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass max-w-lg max-h-[80vh] overflow-y-auto" data-testid="courses-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl flex items-center gap-2">
            <Shield className="text-[#00F0FF]" /> Our Courses
          </DialogTitle>
          <DialogDescription>Verified course information from eSecurityIn.</DialogDescription>
        </DialogHeader>

        {loading && <div className="py-10 flex justify-center"><Loader2 className="animate-spin" /></div>}

        {!loading && (
          <div className="space-y-3 mt-2">
            {courses.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Course details coming soon. Ask SECU or request a callback. 😊
              </p>
            )}
            {courses.map((c, i) => (
              <div key={c.id || c.name || i} className="rounded-xl border border-border p-4 hover:border-[#00F0FF] transition-colors">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="font-heading text-lg font-semibold">{c.name}</h3>
                  <div className="flex items-center gap-2">
                    {c.duration && (
                      <span className="text-xs font-mono px-2 py-1 rounded bg-[#00F0FF]/10 text-[#00F0FF] flex items-center gap-1">
                        <Clock size={12} /> {c.duration}
                      </span>
                    )}
                    {c.fee && (
                      <span className="text-xs font-mono px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 flex items-center gap-1">
                        <IndianRupee size={12} /> {String(c.fee).replace(/^₹|^rs\.?\s*/i, "")}
                      </span>
                    )}
                  </div>
                </div>
                {c.category && <p className="text-xs text-muted-foreground mt-1">{c.category}</p>}
                {c.summary && <p className="text-sm text-muted-foreground mt-2">{c.summary}</p>}
                {c.batch && (
                  <p className="text-xs text-[#00F0FF] mt-2 flex items-center gap-1">
                    <Calendar size={12} /> {c.batch}
                  </p>
                )}
                {c.prerequisites && <p className="text-xs text-muted-foreground mt-1"><b>Prereq:</b> {c.prerequisites}</p>}
                <Button variant="outline" size="sm" className="mt-3"
                        data-testid="ask-secu-course-button"
                        onClick={() => { onAsk?.(`Tell me about the ${c.name}`); onOpenChange(false); }}>
                  Ask SECU about this
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
