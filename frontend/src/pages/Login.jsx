import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Shield, Loader2, ArrowLeft } from "lucide-react";

function formatErr(detail) {
  if (!detail) return "Login failed. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => e.msg || JSON.stringify(e)).join(" ");
  return String(detail);
}

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      await login(email, password);
      nav("/admin");
    } catch (ex) {
      setErr(formatErr(ex.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <div className="glass rounded-2xl p-8 w-full max-w-md glow-cyan animate-rise">
        <Link to="/" className="text-sm text-muted-foreground flex items-center gap-1 mb-6 hover:text-foreground">
          <ArrowLeft size={16} /> Back to reception
        </Link>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-[#00F0FF]/10 flex items-center justify-center">
            <Shield className="text-[#00F0FF]" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold">SECU Admin</h1>
            <p className="text-sm text-muted-foreground">Sign in to the dashboard</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input data-testid="admin-login-email-input" type="email" value={email}
                   onChange={(e) => setEmail(e.target.value)} placeholder="admin@esecurityin.com" />
          </div>
          <div>
            <Label>Password</Label>
            <Input data-testid="admin-login-password-input" type="password" value={password}
                   onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          {err && <p className="text-sm text-red-400" data-testid="login-error">{err}</p>}
          <Button type="submit" disabled={loading} className="w-full h-12 font-semibold"
                  data-testid="admin-login-submit-button">
            {loading ? <Loader2 className="animate-spin" /> : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
