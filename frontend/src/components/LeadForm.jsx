import { useState } from "react";
import { api } from "../services/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";

const INTERESTS = ["Cyber Security", "Cloud Security", "AI Security", "Ethical Hacking", "Other"];

export const LeadForm = ({ open, onOpenChange, sessionId, defaultInterest = "Cyber Security" }) => {
  const [form, setForm] = useState({
    name: "", phone: "", email: "", college: "", year: "", interest: defaultInterest,
  });
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target?.value ?? e }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Please enter your name");
    if (!/^[+]?\d[\d\s-]{7,14}$/.test(form.phone.trim()))
      return toast.error("Please enter a valid phone number");
    setLoading(true);
    try {
      await api.createLead({ ...form, session_id: sessionId });
      toast.success("Thanks! Our reception team will reach out soon. 🙌");
      setForm({ name: "", phone: "", email: "", college: "", year: "", interest: defaultInterest });
      onOpenChange(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass max-w-md" data-testid="lead-form-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">Request a callback</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Share your details and the eSecurityIn team will get in touch. 📞
          </p>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3 mt-2">
          <div>
            <Label>Name *</Label>
            <Input data-testid="lead-name-input" value={form.name} onChange={set("name")} placeholder="Your name" />
          </div>
          <div>
            <Label>Phone *</Label>
            <Input data-testid="lead-phone-input" value={form.phone} onChange={set("phone")} placeholder="+91 98765 43210" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>College</Label>
              <Input data-testid="lead-college-input" value={form.college} onChange={set("college")} placeholder="College" />
            </div>
            <div>
              <Label>Year</Label>
              <Input data-testid="lead-year-input" value={form.year} onChange={set("year")} placeholder="e.g. 2nd" />
            </div>
          </div>
          <div>
            <Label>Email (optional)</Label>
            <Input data-testid="lead-email-input" value={form.email} onChange={set("email")} placeholder="you@email.com" />
          </div>
          <div>
            <Label>Interest</Label>
            <Select value={form.interest} onValueChange={(v) => setForm((f) => ({ ...f, interest: v }))}>
              <SelectTrigger data-testid="lead-interest-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {INTERESTS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={loading} data-testid="lead-form-submit-button"
                  className="w-full h-12 text-base font-semibold">
            {loading ? <Loader2 className="animate-spin" /> : <><Send size={18} className="mr-2" /> Send my details</>}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
