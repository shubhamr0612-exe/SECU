import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";
import { Users, TrendingUp, MessageSquare, Award, LogOut, Download, Shield, Loader2, BarChart3, BookMarked } from "lucide-react";
import { toast } from "sonner";
import { KnowledgeEditor } from "../components/KnowledgeEditor";

const COLORS = ["#00F0FF", "#10B981", "#3B82F6", "#F59E0B", "#A855F7"];

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="glass rounded-xl p-5" data-testid="stat-card">
    <div className="flex items-center justify-between">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <Icon size={18} style={{ color }} />
    </div>
    <p className="font-heading text-3xl font-extrabold mt-2">{value}</p>
  </div>
);

export default function Admin() {
  const { user, ready, logout } = useAuth();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    if (ready && !user) nav("/login");
  }, [ready, user, nav]);

  const load = async () => {
    try {
      const [a, l] = await Promise.all([api.analytics(), api.getLeads()]);
      setData(a.data); setLeads(l.data.leads);
    } catch (e) {
      if (e.response?.status === 401) { logout(); nav("/login"); }
    } finally { setLoading(false); }
  };

  useEffect(() => { if (user) load(); }, [user]); // eslint-disable-line

  const changeStatus = async (id, status) => {
    await api.updateLeadStatus(id, status);
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
    toast.success("Status updated");
  };

  const exportCsv = () => {
    const rows = [["Name", "Phone", "Email", "College", "Year", "Interest", "Status", "Created"]];
    leads.forEach((l) => rows.push([l.name, l.phone, l.email || "", l.college || "", l.year || "", l.interest, l.status, l.created_at]));
    const csv = rows.map((r) => r.map((c) => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "secu_leads.csv"; a.click();
  };

  const filtered = filter === "all" ? leads : leads.filter((l) => l.status === filter);

  if (!ready || loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-[#00F0FF]" size={32} /></div>;
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Shield className="text-[#00F0FF]" />
          <h1 className="font-heading text-xl font-bold">SECU Admin</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/"><Button variant="outline" size="sm">Reception</Button></Link>
          <Button variant="outline" size="sm" onClick={() => { logout(); nav("/login"); }} data-testid="admin-logout-button">
            <LogOut size={16} className="mr-1" /> Logout
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-5 space-y-6">
        <div className="flex gap-2">
          <Button variant={tab === "overview" ? "default" : "outline"} size="sm" onClick={() => setTab("overview")} data-testid="admin-tab-overview">
            <BarChart3 size={16} className="mr-1" /> Overview
          </Button>
          <Button variant={tab === "knowledge" ? "default" : "outline"} size="sm" onClick={() => setTab("knowledge")} data-testid="admin-tab-knowledge">
            <BookMarked size={16} className="mr-1" /> Knowledge Base
          </Button>
        </div>

        {tab === "knowledge" && <KnowledgeEditor />}

        {tab === "overview" && (<>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={MessageSquare} label="Conversations Today" value={data.today_conversations} color="#00F0FF" />
          <StatCard icon={TrendingUp} label="Total Conversations" value={data.total_conversations} color="#3B82F6" />
          <StatCard icon={Users} label="Leads Today" value={data.today_leads} color="#F59E0B" />
          <StatCard icon={Award} label="Total Leads" value={data.total_leads} color="#10B981" />
        </div>

        <div className="glass rounded-xl p-5">
          <h2 className="font-heading text-lg font-semibold mb-4">Course Interest</h2>
          {data.interest.length === 0 ? (
            <p className="text-muted-foreground text-sm">No leads yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.interest} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" stroke="#64748b" allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke="#94a3b8" width={110} />
                <Tooltip contentStyle={{ background: "#131B2A", border: "1px solid #1E293B", borderRadius: 8 }} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {data.interest.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="glass rounded-xl p-5">
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <h2 className="font-heading text-lg font-semibold">Recent Leads</h2>
            <div className="flex items-center gap-2">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-40" data-testid="lead-filter-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="New">New</SelectItem>
                  <SelectItem value="Contacted">Contacted</SelectItem>
                  <SelectItem value="Enrolled">Enrolled</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={exportCsv} data-testid="admin-export-csv-button">
                <Download size={16} className="mr-1" /> CSV
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table data-testid="leads-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Phone</TableHead>
                  <TableHead>College</TableHead><TableHead>Interest</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No leads found.</TableCell></TableRow>
                )}
                {filtered.map((l) => (
                  <TableRow key={l.id} data-testid="lead-row">
                    <TableCell className="font-medium">{l.name}</TableCell>
                    <TableCell className="font-mono text-sm">{l.phone}</TableCell>
                    <TableCell>{l.college || "—"}</TableCell>
                    <TableCell>{l.interest}</TableCell>
                    <TableCell>
                      <Select value={l.status} onValueChange={(v) => changeStatus(l.id, v)}>
                        <SelectTrigger className="w-32 h-9" data-testid="admin-lead-status-select"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="New">New</SelectItem>
                          <SelectItem value="Contacted">Contacted</SelectItem>
                          <SelectItem value="Enrolled">Enrolled</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        </>)}
      </main>
    </div>
  );
}
