"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import {
  Megaphone, Plus, X, AlertTriangle, ChevronDown, Filter,
  Clock, CheckCircle2, User, MapPin, Loader2, MessageSquare,
  ArrowUpCircle, ArrowDownCircle, Flame, Info, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── types ──────────────────────────────────────────────────────────────── */

interface AlertItem {
  id: string;
  title: string;
  description: string | null;
  alertType: string;
  priority: string;
  status: string;
  locationText: string | null;
  createdAt: string;
  updatedAt: string;
  resolutionNote: string | null;
  resolvedAt: string | null;
  areaWarning?: string | null;
  projectLocation: { id: string; name: string; zone: string | null; color: string | null } | null;
  activity: { id: string; activityDescription: string; responsibleSubcontractorRaw: string | null } | null;
  subcontractor: { id: string; name: string } | null;
  assignedTo: { id: string; name: string; email: string } | null;
  createdBy: { id: string; name: string } | null;
  resolvedBy: { id: string; name: string } | null;
}

interface ProjectMember {
  id: string;
  userId: string;
  role: string;
  user: { id: string; name: string; email: string };
}

interface LocationItem {
  id: string;
  name: string;
  zone: string | null;
}

/* ── constants ──────────────────────────────────────────────────────────── */

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ComponentType<{ className?: string }> }> = {
  URGENT: { label: "Urgent", color: "text-red-400", bg: "bg-red-500/10 border-red-500/30", icon: Flame },
  HIGH:   { label: "High",   color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30", icon: ArrowUpCircle },
  MEDIUM: { label: "Medium", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30", icon: Info },
  LOW:    { label: "Low",    color: "text-slate-400", bg: "bg-slate-500/10 border-slate-500/30", icon: ArrowDownCircle },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  OPEN:        { label: "Open",        color: "text-blue-400",   bg: "bg-blue-500/10" },
  ASSIGNED:    { label: "Assigned",    color: "text-violet-400", bg: "bg-violet-500/10" },
  IN_PROGRESS: { label: "In Progress", color: "text-amber-400",  bg: "bg-amber-500/10" },
  RESOLVED:    { label: "Resolved",    color: "text-emerald-400",bg: "bg-emerald-500/10" },
  CLOSED:      { label: "Closed",      color: "text-slate-500",  bg: "bg-slate-500/10" },
};

const ALERT_TYPES = ["GENERAL", "SAFETY", "QUALITY", "WEATHER", "MATERIAL", "EQUIPMENT", "RFI", "INSPECTION"];

/* ── main page ──────────────────────────────────────────────────────────── */

export default function AlertsPage() {
  const params = useParams<{ companySlug: string; projectSlug: string }>();

  const [projectId, setProjectId]       = useState<string | null>(null);
  const [alerts, setAlerts]             = useState<AlertItem[]>([]);
  const [members, setMembers]           = useState<ProjectMember[]>([]);
  const [locations, setLocations]       = useState<LocationItem[]>([]);
  const [loading, setLoading]           = useState(true);

  // filters
  const [filterStatus, setFilterStatus]     = useState<string>("active");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [filterAssigned, setFilterAssigned] = useState(false);
  const [searchText, setSearchText]         = useState("");

  // create/edit panel
  const [showPanel, setShowPanel]           = useState(false);
  const [editingAlert, setEditingAlert]     = useState<AlertItem | null>(null);

  // detail panel
  const [selectedAlert, setSelectedAlert]   = useState<AlertItem | null>(null);
  const [showResolve, setShowResolve]       = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");

  // form fields
  const [formTitle, setFormTitle]           = useState("");
  const [formDesc, setFormDesc]             = useState("");
  const [formType, setFormType]             = useState("GENERAL");
  const [formPriority, setFormPriority]     = useState("MEDIUM");
  const [formLocationId, setFormLocationId] = useState("");
  const [formLocationText, setFormLocationText] = useState("");
  const [formAssignedTo, setFormAssignedTo] = useState("");
  const [saving, setSaving]                 = useState(false);
  const [areaWarning, setAreaWarning]       = useState<string | null>(null);

  /* ── load project ID ────────────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/companies/${params.companySlug}/projects/${params.projectSlug}`);
        if (res.ok) { const p = await res.json(); setProjectId(p.id); }
      } catch { /* ignore */ }
    })();
  }, [params.companySlug, params.projectSlug]);

  /* ── load alerts ────────────────────────────────────────────────────── */
  const loadAlerts = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filterStatus === "deleted") qs.set("deleted", "only");
      if (filterStatus !== "active" && filterStatus !== "deleted" && filterStatus !== "") qs.set("status", filterStatus);
      if (filterPriority) qs.set("priority", filterPriority);
      if (filterAssigned) qs.set("assignedToMe", "true");

      const res = await fetch(`/api/projects/${projectId}/alerts?${qs}`);
      if (res.ok) setAlerts(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, [projectId, filterStatus, filterPriority, filterAssigned]);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  /* ── load members & locations ───────────────────────────────────────── */
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const [mRes, lRes] = await Promise.all([
          fetch(`/api/project-users?projectId=${projectId}`),
          fetch(`/api/projects/${projectId}/locations`),
        ]);
        if (mRes.ok) setMembers(await mRes.json());
        if (lRes.ok) setLocations(await lRes.json());
      } catch { /* ignore */ }
    })();
  }, [projectId]);

  /* ── filtered alerts ────────────────────────────────────────────────── */
  const filteredAlerts = alerts.filter((a) => {
    if (filterStatus === "active" && (a.status === "RESOLVED" || a.status === "CLOSED")) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      if (
        !a.title.toLowerCase().includes(q) &&
        !(a.description ?? "").toLowerCase().includes(q) &&
        !(a.projectLocation?.name ?? "").toLowerCase().includes(q) &&
        !(a.assignedTo?.name ?? "").toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  /* ── counts ─────────────────────────────────────────────────────────── */
  const urgentCount = alerts.filter(a => a.priority === "URGENT" && a.status !== "RESOLVED" && a.status !== "CLOSED").length;
  const openCount   = alerts.filter(a => a.status === "OPEN").length;
  const assignedCount = alerts.filter(a => a.status === "ASSIGNED" || a.status === "IN_PROGRESS").length;

  /* ── create / update ────────────────────────────────────────────────── */
  const resetForm = () => {
    setFormTitle(""); setFormDesc(""); setFormType("GENERAL"); setFormPriority("MEDIUM");
    setFormLocationId(""); setFormLocationText(""); setFormAssignedTo("");
    setEditingAlert(null); setAreaWarning(null);
  };

  const openCreate = () => { resetForm(); setShowPanel(true); };

  const openEdit = (a: AlertItem) => {
    setEditingAlert(a);
    setFormTitle(a.title);
    setFormDesc(a.description ?? "");
    setFormType(a.alertType);
    setFormPriority(a.priority);
    setFormLocationId(a.projectLocation?.id ?? "");
    setFormLocationText(a.locationText ?? "");
    setFormAssignedTo(a.assignedTo?.id ?? "");
    setShowPanel(true);
  };

  const handleSave = async () => {
    if (!projectId || !formTitle.trim()) return;
    setSaving(true);
    setAreaWarning(null);

    try {
      if (editingAlert) {
        // PATCH
        const res = await fetch(`/api/projects/${projectId}/alerts`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            alertId: editingAlert.id,
            description: formDesc,
            priority: formPriority,
            locationId: formLocationId || null,
            locationText: formLocationText || null,
            assignedToId: formAssignedTo || undefined,
          }),
        });
        if (!res.ok) { const e = await res.json(); alert(e.error ?? "Failed"); setSaving(false); return; }
      } else {
        // POST
        const res = await fetch(`/api/projects/${projectId}/alerts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formTitle.trim(),
            description: formDesc.trim() || null,
            alertType: formType,
            priority: formPriority,
            locationId: formLocationId || null,
            locationText: formLocationText.trim() || null,
            assignedToId: formAssignedTo || null,
          }),
        });
        if (!res.ok) { const e = await res.json(); alert(e.error ?? "Failed"); setSaving(false); return; }
        const created = await res.json();
        if (created.areaWarning) setAreaWarning(created.areaWarning);
      }
      setShowPanel(false);
      resetForm();
      loadAlerts();
    } catch { alert("Network error"); }
    setSaving(false);
  };

  /* ── status change ──────────────────────────────────────────────────── */
  const changeStatus = async (alertId: string, status: string, note?: string) => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/alerts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId, status, resolutionNote: note }),
      });
      if (!res.ok) { const e = await res.json(); alert(e.error ?? "Failed"); return; }
      loadAlerts();
      setShowResolve(false);
      setResolutionNote("");
      if (selectedAlert?.id === alertId) {
        const updated = await res.json();
        setSelectedAlert(updated);
      }
    } catch { /* ignore */ }
  };

  const deleteAlert = async (alertId: string) => {
    if (!projectId || !confirm("Delete this alert?")) return;
    try {
      await fetch(`/api/projects/${projectId}/alerts`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId }),
      });
      loadAlerts();
      if (selectedAlert?.id === alertId) setSelectedAlert(null);
    } catch { /* ignore */ }
  };

  /* ── render helpers ─────────────────────────────────────────────────── */
  const PriorityBadge = ({ priority }: { priority: string }) => {
    const cfg = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.MEDIUM;
    const Icon = cfg.icon;
    return (
      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium", cfg.bg, cfg.color)}>
        <Icon className="w-3 h-3" /> {cfg.label}
      </span>
    );
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.OPEN;
    return (
      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", cfg.bg, cfg.color)}>
        {cfg.label}
      </span>
    );
  };

  /* ── page ────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Megaphone className="w-7 h-7 text-red-400" /> Alerts
          </h1>
          <p className="text-slate-500 text-sm mt-1">Track safety, quality, and field alerts across the project</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-xl text-sm font-semibold hover:brightness-110 transition shadow-lg shadow-red-500/20"
        >
          <Plus className="w-4 h-4" /> New Alert
        </button>
      </div>

      {/* Area warning toast */}
      {areaWarning && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Crew Overlap Warning</p>
            <p className="text-amber-400/80 mt-0.5">{areaWarning}</p>
          </div>
          <button onClick={() => setAreaWarning(null)} className="ml-auto text-amber-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3">
          <p className="text-red-400 text-xs font-medium uppercase tracking-wide">Urgent</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{urgentCount}</p>
        </div>
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl px-4 py-3">
          <p className="text-blue-400 text-xs font-medium uppercase tracking-wide">Open</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{openCount}</p>
        </div>
        <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl px-4 py-3">
          <p className="text-violet-400 text-xs font-medium uppercase tracking-wide">In Progress</p>
          <p className="text-2xl font-bold text-violet-400 mt-1">{assignedCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search alerts..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-9 pr-4 py-2 bg-slate-800/60 border border-slate-700/50 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50 w-64"
          />
        </div>
        <div className="flex items-center gap-1 bg-slate-800/40 rounded-lg p-0.5 border border-slate-700/30">
          {[
            { value: "active", label: "Active" },
            { value: "OPEN", label: "Open" },
            { value: "ASSIGNED", label: "Assigned" },
            { value: "IN_PROGRESS", label: "In Progress" },
            { value: "RESOLVED", label: "Resolved" },
            { value: "deleted", label: "Deleted" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilterStatus(f.value)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                filterStatus === f.value
                  ? "bg-sky-600/80 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/50"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="px-3 py-2 bg-slate-800/60 border border-slate-700/50 rounded-lg text-sm text-slate-300 focus:outline-none"
        >
          <option value="">All Priorities</option>
          <option value="URGENT">Urgent</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={filterAssigned}
            onChange={(e) => setFilterAssigned(e.target.checked)}
            className="rounded border-slate-600 bg-slate-800 text-sky-500"
          />
          Assigned to me
        </label>
      </div>

      {/* Alert list */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading alerts...
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No alerts found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredAlerts.map((a) => (
            <div
              key={a.id}
              onClick={() => setSelectedAlert(a)}
              className={cn(
                "bg-slate-900/60 border rounded-xl px-5 py-4 cursor-pointer hover:bg-slate-800/60 transition-colors",
                a.priority === "URGENT" ? "border-red-500/30" : "border-slate-700/40",
                selectedAlert?.id === a.id && "ring-1 ring-sky-500/50 bg-slate-800/60"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <PriorityBadge priority={a.priority} />
                    <StatusBadge status={a.status} />
                    <span className="text-slate-600 text-xs">{a.alertType}</span>
                  </div>
                  <h3 className="text-white font-semibold text-sm truncate">{a.title}</h3>
                  {a.description && <p className="text-slate-400 text-xs mt-1 line-clamp-2">{a.description}</p>}
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                    {a.projectLocation && (
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{a.projectLocation.name}</span>
                    )}
                    {a.assignedTo && (
                      <span className="flex items-center gap-1"><User className="w-3 h-3" />{a.assignedTo.name}</span>
                    )}
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(a.createdAt).toLocaleDateString()}</span>
                    {a.createdBy && <span>by {a.createdBy.name}</span>}
                  </div>
                </div>

                {/* Quick actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {a.status !== "RESOLVED" && a.status !== "CLOSED" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedAlert(a); setShowResolve(true); }}
                      className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition"
                      title="Resolve"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Detail slide-over ──────────────────────────────────────────── */}
      {selectedAlert && !showPanel && (
        <div className="fixed inset-y-0 right-0 w-[480px] bg-slate-900 border-l border-slate-700/50 z-40 shadow-2xl overflow-y-auto">
          <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-6 py-4 flex items-center justify-between z-10">
            <h2 className="text-white font-semibold text-sm truncate flex-1">{selectedAlert.title}</h2>
            <button onClick={() => { setSelectedAlert(null); setShowResolve(false); }} className="text-slate-400 hover:text-white p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="px-6 py-5 space-y-5">
            <div className="flex items-center gap-2 flex-wrap">
              <PriorityBadge priority={selectedAlert.priority} />
              <StatusBadge status={selectedAlert.status} />
              <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{selectedAlert.alertType}</span>
            </div>

            {selectedAlert.description && (
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide font-bold">Description</label>
                <p className="text-slate-300 text-sm mt-1">{selectedAlert.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide font-bold">Location</label>
                <p className="text-slate-300 mt-0.5">{selectedAlert.projectLocation?.name ?? selectedAlert.locationText ?? "None"}</p>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide font-bold">Assigned To</label>
                <p className="text-slate-300 mt-0.5">{selectedAlert.assignedTo?.name ?? "Unassigned"}</p>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide font-bold">Created By</label>
                <p className="text-slate-300 mt-0.5">{selectedAlert.createdBy?.name ?? "Unknown"}</p>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide font-bold">Created</label>
                <p className="text-slate-300 mt-0.5">{new Date(selectedAlert.createdAt).toLocaleString()}</p>
              </div>
              {selectedAlert.activity && (
                <div className="col-span-2">
                  <label className="text-[10px] text-slate-500 uppercase tracking-wide font-bold">Related Activity</label>
                  <p className="text-slate-300 mt-0.5">{selectedAlert.activity.activityDescription}</p>
                </div>
              )}
              {selectedAlert.subcontractor && (
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-wide font-bold">Subcontractor</label>
                  <p className="text-slate-300 mt-0.5">{selectedAlert.subcontractor.name}</p>
                </div>
              )}
            </div>

            {selectedAlert.resolvedAt && (
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-4 py-3">
                <label className="text-[10px] text-emerald-400 uppercase tracking-wide font-bold">Resolution</label>
                <p className="text-emerald-300 text-sm mt-1">{selectedAlert.resolutionNote ?? "Resolved"}</p>
                <p className="text-emerald-500/60 text-xs mt-1">
                  {selectedAlert.resolvedBy?.name} - {new Date(selectedAlert.resolvedAt).toLocaleString()}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
              {selectedAlert.status !== "RESOLVED" && selectedAlert.status !== "CLOSED" && (
                <>
                  <button
                    onClick={() => openEdit(selectedAlert)}
                    className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition"
                  >
                    Edit
                  </button>
                  {selectedAlert.status === "OPEN" && (
                    <button
                      onClick={() => changeStatus(selectedAlert.id, "IN_PROGRESS")}
                      className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition"
                    >
                      Start Work
                    </button>
                  )}
                  <button
                    onClick={() => setShowResolve(true)}
                    className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition"
                  >
                    Resolve
                  </button>
                </>
              )}
              {selectedAlert.status === "RESOLVED" && (
                <button
                  onClick={() => changeStatus(selectedAlert.id, "CLOSED")}
                  className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition"
                >
                  Close
                </button>
              )}
              <button
                onClick={() => deleteAlert(selectedAlert.id)}
                className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/20 transition ml-auto"
              >
                Delete
              </button>
            </div>

            {/* Resolve modal */}
            {showResolve && selectedAlert.status !== "RESOLVED" && selectedAlert.status !== "CLOSED" && (
              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 space-y-3">
                <h4 className="text-white text-sm font-semibold flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-400" /> Resolve Alert
                </h4>
                <textarea
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Describe how this was resolved..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => changeStatus(selectedAlert.id, "RESOLVED", resolutionNote)}
                    disabled={!resolutionNote.trim()}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    Resolve
                  </button>
                  <button onClick={() => { setShowResolve(false); setResolutionNote(""); }} className="px-3 py-2 text-slate-400 text-xs hover:text-white transition">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Create / Edit panel ────────────────────────────────────────── */}
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm pt-20 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-white font-semibold">{editingAlert ? "Edit Alert" : "New Alert"}</h2>
              <button onClick={() => { setShowPanel(false); resetForm(); }} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {/* Title */}
              <div>
                <label className="text-xs text-slate-400 font-medium">Title *</label>
                <input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  disabled={!!editingAlert}
                  placeholder="Brief description of the alert"
                  className="mt-1 w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50 disabled:opacity-60"
                />
              </div>

              {/* Type + Priority row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 font-medium">Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    disabled={!!editingAlert}
                    className="mt-1 w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-lg text-sm text-slate-300 focus:outline-none disabled:opacity-60"
                  >
                    {ALERT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium">Priority</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value)}
                    className="mt-1 w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-lg text-sm text-slate-300 focus:outline-none"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-slate-400 font-medium">Description</label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Detailed description (optional)"
                  rows={3}
                  className="mt-1 w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50"
                />
              </div>

              {/* Location */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 font-medium">Location</label>
                  <select
                    value={formLocationId}
                    onChange={(e) => setFormLocationId(e.target.value)}
                    className="mt-1 w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-lg text-sm text-slate-300 focus:outline-none"
                  >
                    <option value="">Select location...</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}{l.zone ? ` (${l.zone})` : ""}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-medium">Or type location</label>
                  <input
                    value={formLocationText}
                    onChange={(e) => setFormLocationText(e.target.value)}
                    placeholder="e.g. Bay 4, Level 2"
                    className="mt-1 w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50"
                  />
                </div>
              </div>

              {/* Assign */}
              <div>
                <label className="text-xs text-slate-400 font-medium">Assign To</label>
                <select
                  value={formAssignedTo}
                  onChange={(e) => setFormAssignedTo(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-lg text-sm text-slate-300 focus:outline-none"
                >
                  <option value="">Unassigned</option>
                  {members.map(m => (
                    <option key={m.user.id} value={m.user.id}>{m.user.name} ({m.role.replace("_", " ")})</option>
                  ))}
                </select>
              </div>

              {/* Save */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => { setShowPanel(false); resetForm(); }}
                  className="px-4 py-2 text-slate-400 text-sm hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !formTitle.trim()}
                  className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-xl text-sm font-semibold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-lg shadow-red-500/20"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingAlert ? "Update Alert" : "Create Alert"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
