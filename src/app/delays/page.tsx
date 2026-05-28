"use client";

import { useEffect, useState } from "react";
import {
  Clock, Plus, RefreshCw, CheckCircle, ChevronDown,
  ChevronRight, AlertTriangle, Calendar, User,
} from "lucide-react";
import toast from "react-hot-toast";

type DelayStatus = "OPEN" | "MONITORING" | "RESOLVED";
type DelayType =
  | "WEATHER" | "MATERIAL" | "MANPOWER" | "DESIGN" | "RFI"
  | "ACCESS" | "INSPECTION" | "OUTAGE" | "SAFETY" | "EQUIPMENT"
  | "OWNER_DECISION" | "UTILITY";

interface Delay {
  id:              string;
  projectId:       string;
  title:           string;
  delayType:       DelayType;
  status:          DelayStatus;
  startDate:       string | null;
  endDate:         string | null;
  daysDelayed:     number | null;
  cause:           string | null;
  responsibleParty: string | null;
  impact:          string | null;
  notes:           string | null;
  createdBy:       string | null;
  createdAt:       string;
  activity?:       { id: string; activityDescription: string; location: string | null } | null;
  subcontractor?:  { id: string; name: string } | null;
}

const DELAY_TYPES: DelayType[] = [
  "WEATHER","MATERIAL","MANPOWER","DESIGN","RFI","ACCESS",
  "INSPECTION","OUTAGE","SAFETY","EQUIPMENT","OWNER_DECISION","UTILITY",
];

const TYPE_LABELS: Record<DelayType, string> = {
  WEATHER: "Weather", MATERIAL: "Material", MANPOWER: "Manpower",
  DESIGN: "Design", RFI: "RFI", ACCESS: "Access",
  INSPECTION: "Inspection", OUTAGE: "Outage", SAFETY: "Safety",
  EQUIPMENT: "Equipment", OWNER_DECISION: "Owner Decision", UTILITY: "Utility",
};

const STATUS_CONFIG: Record<DelayStatus, { label: string; color: string }> = {
  OPEN:       { label: "Open",       color: "text-red-600 bg-red-50 border-red-200" },
  MONITORING: { label: "Monitoring", color: "text-yellow-700 bg-yellow-50 border-yellow-200" },
  RESOLVED:   { label: "Resolved",   color: "text-green-700 bg-green-50 border-green-200" },
};

const emptyForm = {
  title: "", delayType: "MATERIAL" as DelayType, startDate: "",
  endDate: "", daysDelayed: "", cause: "", responsibleParty: "", impact: "", notes: "",
};

export default function DelaysPage() {
  const [delays, setDelays]             = useState<Delay[]>([]);
  const [loading, setLoading]           = useState(true);
  const [expanded, setExpanded]         = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<DelayStatus | "ALL">("ALL");
  const [showForm, setShowForm]         = useState(false);
  const [form, setForm]                 = useState(emptyForm);
  const [saving, setSaving]             = useState(false);
  const [projectId, setProjectId]       = useState<string | null>(null);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [projRes, delayRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/delays"),
      ]);
      const projects = await projRes.json();
      const delays   = await delayRes.json();
      if (projects.length > 0) setProjectId(projects[0].id);
      setDelays(Array.isArray(delays) ? delays : []);
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  }

  async function saveDelay() {
    if (!form.title.trim() || !projectId) { toast.error("Title required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/delays", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          ...form,
          projectId,
          daysDelayed: form.daysDelayed ? parseInt(form.daysDelayed) : null,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Delay logged");
      setForm(emptyForm);
      setShowForm(false);
      await fetchAll();
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  }

  async function updateStatus(id: string, status: DelayStatus) {
    try {
      await fetch("/api/delays", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id, status }),
      });
      toast.success(`Marked ${STATUS_CONFIG[status].label}`);
      await fetchAll();
    } catch { toast.error("Update failed"); }
  }

  const filtered = statusFilter === "ALL" ? delays : delays.filter((d) => d.status === statusFilter);
  const totalDays = delays.filter((d) => d.daysDelayed).reduce((a, d) => a + (d.daysDelayed ?? 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Delay Log</h1>
          <p className="text-gray-500 text-sm mt-0.5">Track schedule delays, causes, and impacts</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Log Delay
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Open",       value: delays.filter((d) => d.status === "OPEN").length,       color: "text-red-600" },
          { label: "Monitoring", value: delays.filter((d) => d.status === "MONITORING").length, color: "text-yellow-600" },
          { label: "Resolved",   value: delays.filter((d) => d.status === "RESOLVED").length,   color: "text-green-600" },
          { label: "Total Days", value: totalDays,                                               color: "text-orange-500" },
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
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Log New Delay</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Delay title*"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={form.delayType}
              onChange={(e) => setForm((f) => ({ ...f, delayType: e.target.value as DelayType }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {DELAY_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
            <input
              type="number"
              value={form.daysDelayed}
              onChange={(e) => setForm((f) => ({ ...f, daysDelayed: e.target.value }))}
              placeholder="Days delayed"
              min={0}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              value={form.responsibleParty}
              onChange={(e) => setForm((f) => ({ ...f, responsibleParty: e.target.value }))}
              placeholder="Responsible party"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              value={form.cause}
              onChange={(e) => setForm((f) => ({ ...f, cause: e.target.value }))}
              placeholder="Root cause"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="sm:col-span-2">
              <textarea
                rows={2}
                value={form.impact}
                onChange={(e) => setForm((f) => ({ ...f, impact: e.target.value }))}
                placeholder="Impact / additional notes"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={saveDelay} disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg">
              {saving ? "Saving…" : "Save Delay"}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["ALL","OPEN","MONITORING","RESOLVED"] as const).map((f) => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              statusFilter === f ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
            }`}>
            {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
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
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-16 text-center">
          <CheckCircle className="w-12 h-12 text-green-200 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No delays logged</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((d) => {
            const stat = STATUS_CONFIG[d.status];
            const open = expanded.has(d.id);
            return (
              <div key={d.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpanded((s) => { const n = new Set(s); n.has(d.id) ? n.delete(d.id) : n.add(d.id); return n; })}
                  className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${d.status === "OPEN" ? "text-red-500" : "text-gray-300"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">{d.title}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${stat.color}`}>{stat.label}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-700 border border-purple-200">{TYPE_LABELS[d.delayType]}</span>
                      {d.daysDelayed != null && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-orange-50 text-orange-700 border border-orange-200">{d.daysDelayed}d delayed</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                      {d.responsibleParty && <span className="flex items-center gap-1"><User className="w-3 h-3" />{d.responsibleParty}</span>}
                      {d.startDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(d.startDate).toLocaleDateString()}</span>}
                      {d.cause && <span>{d.cause}</span>}
                    </div>
                  </div>
                  {open ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                </button>

                {open && (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
                    {d.impact && <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2"><strong>Impact:</strong> {d.impact}</p>}
                    {d.notes  && <p className="text-sm text-gray-500 text-xs">{d.notes}</p>}
                    {d.subcontractor && <p className="text-xs text-gray-400">Subcontractor: {d.subcontractor.name}</p>}
                    {d.createdBy && <p className="text-xs text-gray-400">Logged by {d.createdBy} · {new Date(d.createdAt).toLocaleDateString()}</p>}
                    <div className="flex items-center gap-2 flex-wrap">
                      {d.status === "OPEN" && (
                        <button onClick={() => updateStatus(d.id, "MONITORING")}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200 text-xs font-medium rounded-lg">
                          <Clock className="w-3.5 h-3.5" /> Monitoring
                        </button>
                      )}
                      {d.status !== "RESOLVED" && (
                        <button onClick={() => updateStatus(d.id, "RESOLVED")}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-xs font-medium rounded-lg">
                          <CheckCircle className="w-3.5 h-3.5" /> Resolved
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
