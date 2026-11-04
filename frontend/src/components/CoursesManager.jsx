import { useEffect, useState } from "react";
import { api } from "../services/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { Plus, Pencil, Trash2, Loader2, BookOpen, Clock, IndianRupee, CalendarDays } from "lucide-react";
import { toast } from "sonner";

const EMPTY = { name: "", duration: "", fee: "", category: "", batch: "", summary: "", prerequisites: "" };
const FIELDS = [
  ["name", "Course name *", "e.g. Ethical Hacking"], ["duration", "Duration", "e.g. 45 days"],
  ["fee", "Fee", "e.g. ₹15,000"], ["category", "Category", "e.g. Cyber Security"],
  ["batch", "Batch dates / timings", "e.g. Starts 1 Aug · Mon-Fri 10am-12pm"],
  ["prerequisites", "Prerequisites", "optional"],
];

const CourseForm = ({ open, initial, onClose, onSave, saving }) => {
  const [f, setF] = useState(EMPTY);
  useEffect(() => { if (open) setF({ ...EMPTY, ...(initial || {}) }); }, [open, initial]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass max-w-lg" data-testid="course-form-dialog">
        <DialogHeader><DialogTitle>{initial?.id ? "Edit course" : "Add course"}</DialogTitle></DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          {FIELDS.map(([k, label, ph]) => (
            <div key={k} className={k === "batch" || k === "prerequisites" ? "sm:col-span-2" : ""}>
              <Label>{label}</Label>
              <Input data-testid={`course-input-${k}`} placeholder={ph} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
            </div>
          ))}
          <div className="sm:col-span-2">
            <Label>Summary</Label>
            <Textarea data-testid="course-input-summary" placeholder="What students will learn" value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="course-form-cancel">Cancel</Button>
          <Button disabled={saving || !f.name.trim()} onClick={() => onSave(f)} data-testid="course-form-save">
            {saving ? <Loader2 className="animate-spin" size={16} /> : "Save course"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const CourseCard = ({ c, onEdit, onDelete }) => (
  <div className="glass rounded-xl p-4 flex flex-col gap-2" data-testid="course-card">
    <div className="flex items-start justify-between gap-2">
      <div>
        <p className="font-heading font-semibold" data-testid="course-card-name">{c.name}</p>
        {c.category && <p className="text-xs text-[#00F0FF]">{c.category}</p>}
      </div>
      <div className="flex gap-1">
        <Button size="icon" variant="ghost" onClick={onEdit} data-testid="course-edit-button"><Pencil size={16} /></Button>
        <Button size="icon" variant="ghost" className="text-red-400" onClick={onDelete} data-testid="course-delete-button"><Trash2 size={16} /></Button>
      </div>
    </div>
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {c.duration && <span className="flex items-center gap-1"><Clock size={12} />{c.duration}</span>}
      {c.fee && <span className="flex items-center gap-1"><IndianRupee size={12} />{c.fee}</span>}
      {c.batch && <span className="flex items-center gap-1"><CalendarDays size={12} />{c.batch}</span>}
    </div>
    {c.summary && <p className="text-sm text-muted-foreground line-clamp-3">{c.summary}</p>}
  </div>
);

export function CoursesManager() {
  const [courses, setCourses] = useState(null);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => api.listCourses().then((r) => setCourses(r.data.courses)).catch(() => toast.error("Could not load courses"));
  useEffect(() => { load(); }, []);

  const save = async (f) => {
    setSaving(true);
    try {
      const { id, ...body } = f;
      if (editing?.id) await api.editCourse(editing.id, body); else await api.addCourse(body);
      toast.success("Course saved — SECU will use it right away.");
      setEditing(null); load();
    } catch (_) { toast.error("Save failed. Please try again."); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    try { await api.deleteCourse(toDelete.id); toast.success("Course deleted"); load(); }
    catch (_) { toast.error("Delete failed"); }
    finally { setToDelete(null); }
  };

  if (!courses) return <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-[#00F0FF]" /></div>;

  return (
    <div className="space-y-4" data-testid="courses-manager">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground flex items-center gap-2"><BookOpen size={16} className="text-[#00F0FF]" /> {courses.length} course(s) · SECU answers visitors from this list.</p>
        <Button onClick={() => setEditing({})} data-testid="course-add-button"><Plus size={16} className="mr-1" /> Add course</Button>
      </div>
      {courses.length === 0 && <p className="text-center text-muted-foreground py-10" data-testid="courses-empty">No courses yet. Add your first course.</p>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map((c) => <CourseCard key={c.id} c={c} onEdit={() => setEditing(c)} onDelete={() => setToDelete(c)} />)}
      </div>
      <CourseForm open={!!editing} initial={editing} onClose={() => setEditing(null)} onSave={save} saving={saving} />
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent data-testid="course-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{toDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>SECU will stop telling visitors about this course.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="course-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} data-testid="course-delete-confirm">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
