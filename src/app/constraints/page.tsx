"use client";

import { useEffect, useState } from "react";
import {
  ShieldAlert, Plus, RefreshCw, CheckCircle, Clock,
  XCircle, ChevronDown, ChevronRight, MapPin, Calendar,
} from "lucide-react";
import toast from "react-hot-toast";

type ConstraintStatus   = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CANCELLED";
type ConstraintPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type ConstraintType =
  | "RFI" | "SUBMITTAL" | "MATERIAL" | "EQUIPMENT" | "ACCESS"
  | "OUTAGE" | "INSPECTION" | "WEATHER" | "MANPOWER" | "DESIGN"
  | "OWNER_DECISION" | "SAFETY";

interface Constraint {
  id:              string;
  projectId:       string;
  activityId:      string | null;
  title:           string;
  type:            ConstraintType;
  status:          ConstraintStatus;
  priority:        ConstraintPriority;
  responsibleParty: string | null;
  neededBy:        string | null;
  resolvedAt:      string | null;
  notes:           string | null;
  createdBy:       string | null;
  createdAt:       string;
  activity?: { id: string; activityDescription: string; location: string | null } | null;
}

const PRIORITY_CONFIG: Record<ConstraintPriority, { label: string; dot: string; badge: string }> = {
  CRITICAL: { label: "Critical", dot: "bg-red-500",    badge: "bg-red-50 text-red-700 border-red-200" },
  HIGH:     { label: "High",     dot: "bg-orange-500", badge: "bg-orange-50 text-orange-700 border-orange-200" },
  MEDIUM:   { label: "Medium",   dot: "bg-yellow-500", badge: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  LOW:      { label: "Low",      dot: "bg-gray-400",   badge: "bg-gray-50 text-gray-600 border-gray-200" },
};

const STATUS_CONFIG: Record<ConstraintStatus, { label: string; color: string; icon: React.ReactNode }> = {
  OPEN:        { label: "Open",        color: "text-red-600 bg-red-50 border-red-200",      icon: <ShieldAlert className="w-3.5 h-3.5" /> },
  IN_PROGRESS: { label: "In Progress", color: "text-yellow-700 bg-yellow-50 border-yellow-200", icon: <Clock className="w-3.5 h-3.5" /> },
  RESOLVED:    { label: "Resolved",    color: "text-green-700 bg-green-50 border-green-200", icon: <CheckCircle className="w-3.5 h-3.5" /> },
  CANCELLED:   { label: "Cancelled",   color: "text-gray-500 bg-gray-50 border-gray-200",    icon: <XCircle className="w-3.5 h-3.5" /> },
};

const TYPE_LABELS: Record<ConstraintType, string> = {
  RFI: "RFI", SUBMITTAL: "Submittal", MATERIAL: "Material", EQUIPMENT: "Equipment",
  ACCESS: "Access", OUTAGE: "Outage", INSPECTION: "Inspection", WEATHER: "Weather",
  MANPOWER: "Manpower", DESIGN: "Design", OWNER_DECISION: "Owner Decision", SAFETY: "Safety",
};

const CONSTRAINT_TYPES: ConstraintType[] = [
  "RFI","SUBMITTAL","MATERIAL","EQUIPMENT","ACCESS","OUTAGE",
  "INSPECTION","WEATHER","MANPOWER","DESIGN","OWNER_DECISION","SAFETY",
];

const emptyForm = {
  title: "", type: "MATERIAL" as ConstraintType, priority: "MEDIUM" as ConstraintPriority,
  responsibleParty: "", neededBy: "", notes: "",
};

export default function ConstraintsPage() {
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [loading, setLoading]         = useState(true);
  const [expanded, setExpanded]       = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<ConstraintStatus | "ALL">("ALL");
  const [showForm, setShowForm]       = useState(false);
  const [form, setForm]               = useState(emptyForm);
  const [saving, setSaving]           = useState(false);
  const [projectId, setProjectId]     = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [projRes, constRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/constraints"),
      ]);
      const projects    = await projRes.json();
      const constraints = await constRes.json();
      if (projects.length > 0) setProjectId(projects[0].id);
      setConstraints(Array.isArray(constraints) ? constraints : []);
    } catch { toast.error("Failed to load constraints"); }
    finally { setLoading(false); }
  }

  async function saveConstraint() {
    if (!form.title.trim() || !projectId) { toast.error("Title required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/constraints", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ...form, projectId }),
      });
      if (!res.ok) throw new Error();
      toast.success("Constraint added");
      setForm(emptyForm);
      setShowForm(false);
      await fetchAll();
    } catch { toast.error("Failed to add constraint"); }
    finally { setSaving(false); }
  }

  async function updateStatus(id: string, status: ConstraintStatus) {
    try {
      await fetch("/api/constraints", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id, status }),
      });
      toast.success(`Marked ${STATUS_CONFIG[status].label}`);
      await fetchAll();
    } catch { toast.error("Update failed"); }
  }

  const filtered = statusFilter === "ALL" ? constraints : constraints.filter((c) => c.status === statusFilter);
  const counts   = {
    open:       constraints.filter((c) => c.status === "OPEN").length,
    inProgress: constraints.filter((c) => c.status === "IN_PROGRESS").length,
    resolved:   constraints.filter((c) => c.status === "RESOLVED").length,
    critical:   constraints.filter((c) => c.priority === "CRITICAL" || c.priority === "HIGH").length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Constraint Log</h1>
          <p className="text-gray-500 text-sm mt-0.5">Track RFIs, submittals, materials, and other blocking items</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Constraint
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Open",        value: counts.open,       color: "text-red-600" },
          { label: "In Progress", value: counts.inProgress, color: "text-yellow-600" },
          { label: "High / Critical", value: counts.critical, color: "text-orange-500" },
          { label: "Resolved",    value: counts.resolved,   color: "text-green-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">New Constraint</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Constraint title / description*"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ConstraintType }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CONSTRAINT_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
            <select
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as ConstraintPriority }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="LOW">Low Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="HIGH">High Priority</option>
              <option value="CRITICAL">Critical</option>
            </select>
            <input
              type="text"
              value={form.responsibleParty}
              onChange={(e) => setForm((f) => ({ ...f, responsibleParty: e.target.value }))}
              placeholder="Responsible party"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={form.neededBy}
                onChange={(e) => setForm((f) => ({ ...f, neededBy: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Notes (optional)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={saveConstraint}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? "Saving…" : "Save Constraint"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["ALL","OPEN","IN_PROGRESS","RESOLVED","CANCELLED"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              statusFilter === f
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
            }`}
          >
            {f === "ALL" ? "All" : f === "IN_PROGRESS" ? "In Progress" : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
        <button onClick={fetchAll} className="p-1.5 ml-auto rounded-lg border border-gray-200 bg-white hover:bg-gray-50">
          <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <RefreshCw className="w-8 h-8 text-gray-300 animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-16 text-center">
          <CheckCircle className="w-12 h-12 text-green-200 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No constraints found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const pri  = PRIORITY_CONFIG[c.priority];
            const stat = STATUS_CONFIG[c.status];
            const open = expanded.has(c.id);
            return (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpanded((s) => { const n = new Set(s); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })}
                  className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${pri.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">{c.title}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${pri.badge}`}>{pri.label}</span>
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${stat.color}`}>{stat.icon}{stat.label}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-600 border border-blue-200">{TYPE_LABELS[c.type]}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                      {c.responsibleParty && <span>{c.responsibleParty}</span>}
                      {c.neededBy && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Needed by {new Date(c.neededBy).toLocaleDateString()}
                        </span>
                      )}
                      {c.activity && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {c.activity.activityDescription.slice(0, 40)}
                        </span>
                      )}
                    </div>
                  </div>
                  {open ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />}
                </button>

                {open && (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
                    {c.notes && <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{c.notes}</p>}
                    {c.createdBy && <p className="text-xs text-gray-400">Created by {c.createdBy} · {new Date(c.createdAt).toLocaleDateString()}</p>}
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      {c.status === "OPEN" && (
                        <button onClick={() => updateStatus(c.id, "IN_PROGRESS")}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200 text-xs font-medium rounded-lg transition-colors">
                          <Clock className="w-3.5 h-3.5" /> In Progress
                        </button>
                      )}
                      {c.status !== "RESOLVED" && c.status !== "CANCELLED" && (
                        <button onClick={() => updateStatus(c.id, "RESOLVED")}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-xs font-medium rounded-lg transition-colors">
                          <CheckCircle className="w-3.5 h-3.5" /> Mark Resolved
                        </button>
                      )}
                      {c.status !== "CANCELLED" && c.status !== "RESOLVED" && (
                        <button onClick={() => updateStatus(c.id, "CANCELLED")}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 text-xs font-medium rounded-lg transition-colors">
                          <XCircle className="w-3.5 h-3.5" /> Cancel
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
