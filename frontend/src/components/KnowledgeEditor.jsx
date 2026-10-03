import { useEffect, useState } from "react";
import { api } from "../services/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Plus, Trash2, Save, Loader2, BookOpen, Building2, Calendar, Phone, HelpCircle } from "lucide-react";
import { toast } from "sonner";

const emptyCourse = () => ({ name: "", duration: "", fee: "", category: "", summary: "", prerequisites: "" });
const emptyFaq = () => ({ q: "", a: "" });

export function KnowledgeEditor() {
  const [kb, setKb] = useState(null);
  const [saving, setSaving] = useState(false);

  // flattened editable state
  const [institute, setInstitute] = useState({ name: "", tagline: "", description: "" });
  const [courses, setCourses] = useState([]);
  const [seminarsAbout, setSeminarsAbout] = useState("");
  const [seminarTopics, setSeminarTopics] = useState("");
  const [contact, setContact] = useState({ phone: "", email: "", website: "", address: "" });
  const [faqs, setFaqs] = useState([]);

  useEffect(() => {
    api.getKnowledge().then((r) => {
      const d = r.data || {};
      setKb(d);
      const inst = d.institute || {};
      setInstitute({ name: inst.name || "", tagline: inst.tagline || "", description: inst.description || "" });
      const cs = (d.courses && Array.isArray(d.courses.courses)) ? d.courses.courses : [];
      setCourses(cs.map((c) => ({ ...emptyCourse(), ...c })));
      const sem = d.seminars || {};
      setSeminarsAbout(sem.about || "");
      setSeminarTopics((sem.topics_commonly_covered || []).join(", "));
      const con = d.contact || {};
      setContact({ phone: con.phone || "", email: con.email || "", website: con.website || "", address: con.address || "" });
      const fq = (d.faq && Array.isArray(d.faq.faqs)) ? d.faq.faqs : [];
      setFaqs(fq.map((f) => ({ ...emptyFaq(), ...f })));
    }).catch(() => toast.error("Could not load knowledge base"));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        institute: { ...(kb?.institute || {}), ...institute },
        courses: {
          ...(kb?.courses || {}),
          courses: courses.filter((c) => c.name.trim()),
          interest_categories: (kb?.courses?.interest_categories) ||
            ["Cyber Security", "Cloud Security", "AI Security", "Ethical Hacking", "Other"],
        },
        seminars: {
          ...(kb?.seminars || {}),
          about: seminarsAbout,
          topics_commonly_covered: seminarTopics.split(",").map((t) => t.trim()).filter(Boolean),
        },
        contact: { ...(kb?.contact || {}), ...contact },
        faq: { ...(kb?.faq || {}), faqs: faqs.filter((f) => f.q.trim() && f.a.trim()) },
      };
      const r = await api.saveKnowledge(payload);
      setKb(r.data.knowledge);
      toast.success("Knowledge base saved — SECU will use this now.");
    } catch (e) {
      toast.error("Save failed. Please try again.");
    } finally { setSaving(false); }
  };

  if (!kb) return <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-[#00F0FF]" /></div>;

  const setCourse = (i, k, v) => setCourses((cs) => cs.map((c, idx) => (idx === i ? { ...c, [k]: v } : c)));
  const setFaq = (i, k, v) => setFaqs((fs) => fs.map((f, idx) => (idx === i ? { ...f, [k]: v } : f)));

  return (
    <div className="space-y-6" data-testid="knowledge-editor">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Everything here is what SECU is allowed to tell visitors. Only add verified info.</p>
        <Button onClick={save} disabled={saving} data-testid="kb-save-button" className="h-11">
          {saving ? <Loader2 className="animate-spin" /> : <><Save size={18} className="mr-2" /> Save all</>}
        </Button>
      </div>

      {/* Institute */}
      <section className="glass rounded-xl p-5 space-y-3">
        <h3 className="font-heading text-lg font-semibold flex items-center gap-2"><Building2 size={18} className="text-[#00F0FF]" /> Institute</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>Name</Label><Input data-testid="kb-institute-name" value={institute.name} onChange={(e) => setInstitute({ ...institute, name: e.target.value })} /></div>
          <div><Label>Tagline</Label><Input value={institute.tagline} onChange={(e) => setInstitute({ ...institute, tagline: e.target.value })} /></div>
        </div>
        <div><Label>Description</Label><Textarea value={institute.description} onChange={(e) => setInstitute({ ...institute, description: e.target.value })} /></div>
      </section>

      {/* Courses */}
      <section className="glass rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-lg font-semibold flex items-center gap-2"><BookOpen size={18} className="text-[#00F0FF]" /> Courses</h3>
          <Button variant="outline" size="sm" onClick={() => setCourses([...courses, emptyCourse()])} data-testid="kb-add-course-button"><Plus size={16} className="mr-1" /> Add course</Button>
        </div>
        {courses.map((c, i) => (
          <div key={i} className="rounded-lg border border-border p-3 space-y-2" data-testid="kb-course-row">
            <div className="grid sm:grid-cols-2 gap-2">
              <Input placeholder="Course name" value={c.name} onChange={(e) => setCourse(i, "name", e.target.value)} data-testid="kb-course-name" />
              <Input placeholder="Duration (e.g. 45 days)" value={c.duration} onChange={(e) => setCourse(i, "duration", e.target.value)} />
              <Input placeholder="Fee (e.g. ₹15,000)" value={c.fee} onChange={(e) => setCourse(i, "fee", e.target.value)} />
              <Input placeholder="Category (e.g. Cyber Security)" value={c.category} onChange={(e) => setCourse(i, "category", e.target.value)} />
            </div>
            <Input placeholder="Short summary" value={c.summary} onChange={(e) => setCourse(i, "summary", e.target.value)} />
            <Input placeholder="Prerequisites (optional)" value={c.prerequisites} onChange={(e) => setCourse(i, "prerequisites", e.target.value)} />
            <Button variant="ghost" size="sm" className="text-red-400" onClick={() => setCourses(courses.filter((_, idx) => idx !== i))}><Trash2 size={16} className="mr-1" /> Remove</Button>
          </div>
        ))}
      </section>

      {/* Seminars */}
      <section className="glass rounded-xl p-5 space-y-3">
        <h3 className="font-heading text-lg font-semibold flex items-center gap-2"><Calendar size={18} className="text-[#00F0FF]" /> Seminars</h3>
        <div><Label>About seminars</Label><Textarea value={seminarsAbout} onChange={(e) => setSeminarsAbout(e.target.value)} /></div>
        <div><Label>Topics (comma separated)</Label><Input value={seminarTopics} onChange={(e) => setSeminarTopics(e.target.value)} /></div>
      </section>

      {/* Contact */}
      <section className="glass rounded-xl p-5 space-y-3">
        <h3 className="font-heading text-lg font-semibold flex items-center gap-2"><Phone size={18} className="text-[#00F0FF]" /> Contact</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>Phone</Label><Input value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} /></div>
          <div><Label>Email</Label><Input value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} /></div>
          <div><Label>Website</Label><Input value={contact.website} onChange={(e) => setContact({ ...contact, website: e.target.value })} /></div>
          <div><Label>Address</Label><Input value={contact.address} onChange={(e) => setContact({ ...contact, address: e.target.value })} /></div>
        </div>
      </section>

      {/* FAQ */}
      <section className="glass rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-lg font-semibold flex items-center gap-2"><HelpCircle size={18} className="text-[#00F0FF]" /> FAQ</h3>
          <Button variant="outline" size="sm" onClick={() => setFaqs([...faqs, emptyFaq()])}><Plus size={16} className="mr-1" /> Add FAQ</Button>
        </div>
        {faqs.map((f, i) => (
          <div key={i} className="rounded-lg border border-border p-3 space-y-2">
            <Input placeholder="Question" value={f.q} onChange={(e) => setFaq(i, "q", e.target.value)} />
            <Textarea placeholder="Answer" value={f.a} onChange={(e) => setFaq(i, "a", e.target.value)} />
            <Button variant="ghost" size="sm" className="text-red-400" onClick={() => setFaqs(faqs.filter((_, idx) => idx !== i))}><Trash2 size={16} className="mr-1" /> Remove</Button>
          </div>
        ))}
      </section>
    </div>
  );
}
