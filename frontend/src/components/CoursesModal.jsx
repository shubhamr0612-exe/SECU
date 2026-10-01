import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Clock, Shield } from "lucide-react";

// V1 verified course info only. More courses can be added to knowledge/courses.json.
const COURSES = [
  {
    name: "Cyber Security Course",
    duration: "45 days",
    category: "Cyber Security",
    summary: "A hands-on, practical cyber security program covering core security skills.",
  },
];

export const CoursesModal = ({ open, onOpenChange, onAsk }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="glass max-w-lg" data-testid="courses-dialog">
      <DialogHeader>
        <DialogTitle className="font-heading text-2xl flex items-center gap-2">
          <Shield className="text-[#00F0FF]" /> Our Courses
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3 mt-2">
        {COURSES.map((c) => (
          <div key={c.name} className="rounded-xl border border-border p-4 hover:border-[#00F0FF] transition-colors">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-lg font-semibold">{c.name}</h3>
              <span className="text-xs font-mono px-2 py-1 rounded bg-[#00F0FF]/10 text-[#00F0FF] flex items-center gap-1">
                <Clock size={12} /> {c.duration}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">{c.summary}</p>
            <Button variant="outline" size="sm" className="mt-3"
                    data-testid="ask-secu-course-button"
                    onClick={() => { onAsk?.(`Tell me about the ${c.name}`); onOpenChange(false); }}>
              Ask SECU about this
            </Button>
          </div>
        ))}
        <p className="text-xs text-muted-foreground text-center pt-1">
          More course details? Just ask SECU or request a callback. 😊
        </p>
      </div>
    </DialogContent>
  </Dialog>
);
