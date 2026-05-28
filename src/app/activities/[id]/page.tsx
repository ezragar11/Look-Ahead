"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate, formatDateShort, cn } from "@/lib/utils";
import type { Activity, ActivityStatus } from "@/types";
import { STATUS_LABELS } from "@/types";
import {
  ArrowLeft, MapPin, Users, Edit3, Save, X, RefreshCcw, Flag,
  ClipboardList, MessageSquare, Trash2, Send, History, AlertTriangle,
} from "lucide-react";

const STATUSES: ActivityStatus[] = [
  "PLANNED", "IN_PROGRESS", "COMPLETE", "DELAYED",
  "MISSED", "BLOCKED", "CANCELLED", "NEEDS_FOLLOW_UP",
];

interface Note     { id: string; noteText: string; author: string | null; createdAt: string; }
interface AuditLog { id: string; fieldChanged: string | null; action: string; oldValue: string | null; newValue: string | null; changedBy: string | null; createdAt: string; user?: { name: string } | null; }

export default function ActivityDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const [activity, setActivity] = useState<Activity & { activityNotes?: Note[]; auditLogs?: AuditLog[] } | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [tab, setTab]           = useState<"details" | "notes" | "history">("details");

  const [form, setForm] = useState({
    status:             "PLANNED" as ActivityStatus,
    percentComplete:    0,
    actualStart:        "",
    actualFinish:       "",
    delayReason:        "",
    notes:              "",
    needsFollowUp:      false,
    inspectionRequired: false,
    outageRequired:     false,
    materialRequired:   false,
    safetyConcern:      false,
  });

  const loadActivity = async () => {
    try {
      const res = await fetch(`/api/activities/${id}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setActivity(data);
      setForm({
        status:             data.status,
        percentComplete:    data.percentComplete,
        actualStart:        data.actualStart ? data.actualStart.split("T")[0] : "",
        actualFinish:       data.actualFinish ? data.actualFinish.split("T")[0] : "",
        delayReason:        data.delayReason  ?? "",
        notes:              data.notes         ?? "",
        needsFollowUp:      data.needsFollowUp,
        inspectionRequired: data.inspectionRequired,
        outageRequired:     data.outageRequired,
        materialRequired:   data.materialRequired,
        safetyConcern:      data.safetyConcern,
      });
    } catch {
      toast.error("Activity not found");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadActivity(); }, [id]);

  const handleSave = async () => {
    if (!activity) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/activities/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status:             form.status,
          percentComplete:    form.percentComplete,
          actualStart:        form.actualStart  ? new Date(form.actualStart  + "T12:00:00").toISOString() : null,
          actualFinish:       form.actualFinish ? new Date(form.actualFinish + "T12:00:00").toISOString() : null,
          delayReason:        form.delayReason  || null,
          notes:              form.notes         || null,
          needsFollowUp:      form.needsFollowUp,
          inspectionRequired: form.inspectionRequired,
          outageRequired:     form.outageRequired,
          materialRequired:   form.materialRequired,
          safetyConcern:      form.safetyConcern,
        }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setActivity((p) => ({ ...p!, ...updated }));
      setEditing(false);
      toast.success("Activity updated");
    } catch { toast.error("Failed to save"); }
    finally  { setSaving(false); }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch("/api/notes", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ activityId: id, noteText, author: "Field User" }),
      });
      if (!res.ok) throw new Error();
      setNoteText("");
      toast.success("Note saved");
      loadActivity();
    } catch { toast.error("Failed to save note"); }
    finally  { setSavingNote(false); }
  };

  const handleDeleteNote = async (noteId: string) => {
    await fetch(`/api/notes?id=${noteId}`, { method: "DELETE" });
    toast.success("Note deleted");
    loadActivity();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCcw className="w-6 h-6 text-blue-500 animate-spin" /></div>;

  if (!activity) return (
    <div className="text-center py-16">
      <AlertTriangle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
      <p className="text-gray-500">Activity not found</p>
      <Link href="/schedule" className="mt-3 text-sm text-blue-600 hover:underline block">← Schedule</Link>
    </div>
  );

  const occurrences = activity.occurrences     ?? [];
  const notes       = activity.activityNotes   ?? [];
  const auditLogs   = activity.auditLogs       ?? [];

  const activeFlags = [
    { key: "needsFollowUp",     label: "Needs Follow-Up",    color: "text-purple-700 bg-purple-50 border-purple-200" },
    { key: "inspectionRequired", label: "Inspection Required", color: "text-blue-700 bg-blue-50 border-blue-200" },
    { key: "outageRequired",    label: "Outage Required",    color: "text-orange-700 bg-orange-50 border-orange-200" },
    { key: "materialRequired",  label: "Material Required",  color: "text-amber-700 bg-amber-50 border-amber-200" },
    { key: "safetyConcern",     label: "Safety Concern",     color: "text-red-700 bg-red-50 border-red-200" },
  ].filter(({ key }) => activity[key as keyof Activity]);

  return (
    <div className="max-w-3xl space-y-5">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {activity.category && (
              <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">{activity.category}</p>
            )}
            <h1 className="text-xl font-bold text-gray-900 leading-snug">{activity.activityDescription}</h1>
            <div className="flex flex-wrap items-center gap-4 mt-3">
              {activity.location && (
                <span className="flex items-center gap-1.5 text-sm text-gray-500">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" /> {activity.location}
                </span>
              )}
              {(activity.subcontractor || activity.responsibleSubcontractorRaw) && (
                <span className="flex items-center gap-1.5 text-sm font-semibold text-blue-600">
                  <Users className="w-3.5 h-3.5" />
                  {activity.subcontractor?.name ?? activity.responsibleSubcontractorRaw}
                </span>
              )}
              {activity.lookahead && (
                <span className="flex items-center gap-1.5 text-xs text-gray-400">
                  <ClipboardList className="w-3.5 h-3.5" /> {(activity.lookahead as any).name}
                </span>
              )}
            </div>
            {activeFlags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {activeFlags.map(({ label, color }) => (
                  <span key={label} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-semibold ${color}`}>
                    <Flag className="w-3 h-3" /> {label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusBadge status={activity.status} />
            {!editing && (
              <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg hover:bg-gray-50">
                <Edit3 className="w-3 h-3" /> Update
              </button>
            )}
          </div>
        </div>
        {activity.percentComplete > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Completion</span><span className="font-semibold">{activity.percentComplete}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${activity.percentComplete}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Edit form */}
      {editing && (
        <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-6 space-y-4">
          <h3 className="font-bold text-gray-800 text-sm">Update Activity</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ActivityStatus })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">% Complete</label>
              <input type="number" min={0} max={100} value={form.percentComplete}
                onChange={(e) => setForm({ ...form, percentComplete: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Actual Start</label>
              <input type="date" value={form.actualStart} onChange={(e) => setForm({ ...form, actualStart: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Actual Finish</label>
              <input type="date" value={form.actualFinish} onChange={(e) => setForm({ ...form, actualFinish: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          {["DELAYED","BLOCKED","MISSED"].includes(form.status) && (
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Delay / Block Reason</label>
              <input type="text" value={form.delayReason} onChange={(e) => setForm({ ...form, delayReason: e.target.value })}
                placeholder="e.g. Material not received, weather, outage not approved…"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3} placeholder="Notes for reports…"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div className="flex flex-wrap gap-4">
            {[
              { key: "needsFollowUp",     label: "Needs Follow-Up"    },
              { key: "inspectionRequired", label: "Inspection Required" },
              { key: "outageRequired",    label: "Outage Required"    },
              { key: "materialRequired",  label: "Material Required"  },
              { key: "safetyConcern",     label: "Safety Concern"     },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
                <input type="checkbox" checked={form[key as keyof typeof form] as boolean}
                  onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                {label}
              </label>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
              {saving ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
            </button>
            <button onClick={() => setEditing(false)} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100">
          {[
            { key: "details", label: "Details",                 Icon: ClipboardList  },
            { key: "notes",   label: `Notes (${notes.length})`, Icon: MessageSquare  },
            { key: "history", label: "Change History",           Icon: History        },
          ].map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setTab(key as typeof tab)}
              className={cn(
                "flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors",
                tab === key
                  ? "border-blue-600 text-blue-700 bg-blue-50/40"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              )}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* ── Details ── */}
        {tab === "details" && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              {[
                { label: "Planned Start",  value: formatDate(activity.plannedStart)  },
                { label: "Planned Finish", value: formatDate(activity.plannedFinish) },
                { label: "Actual Start",   value: formatDate(activity.actualStart)   },
                { label: "Actual Finish",  value: formatDate(activity.actualFinish)  },
                { label: "% Complete",     value: `${activity.percentComplete}%`      },
                { label: "Priority",       value: activity.priority                  },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{label}</p>
                  <p className="text-sm text-gray-700 mt-0.5 font-medium">{value}</p>
                </div>
              ))}
            </div>
            {activity.delayReason && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-xs font-bold text-orange-500 uppercase tracking-wide mb-1">Delay Reason</p>
                <p className="text-sm text-gray-700">{activity.delayReason}</p>
              </div>
            )}
            {activity.notes && (
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Notes</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{activity.notes}</p>
              </div>
            )}
            {occurrences.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Planned Work Days ({occurrences.length})</p>
                <div className="flex flex-wrap gap-2">
                  {occurrences.map((occ) => (
                    <div key={occ.id} className={cn(
                      "px-3 py-1.5 rounded-lg border text-xs font-medium",
                      occ.status === "COMPLETE" ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : occ.status === "MISSED" ? "bg-red-50 border-red-200 text-red-600"
                        : "bg-blue-50 border-blue-200 text-blue-700"
                    )}>
                      <span className="font-bold">{occ.dayOfWeek}</span>{" "}
                      {formatDateShort(occ.plannedDate)}
                      {occ.plannedWeekLabel && <span className="ml-1 text-gray-400 font-normal">· {occ.plannedWeekLabel}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Notes ── */}
        {tab === "notes" && (
          <div className="p-6 space-y-4">
            <div className="flex gap-3">
              <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a field note, observation, or update…" rows={2}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              <button onClick={handleAddNote} disabled={savingNote || !noteText.trim()}
                className="self-end flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-40">
                <Send className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            {notes.length === 0
              ? <p className="text-sm text-gray-400 text-center py-6">No notes yet.</p>
              : notes.map((note) => (
                <div key={note.id} className="flex items-start gap-3 bg-gray-50 rounded-lg p-3">
                  <div className="flex-1">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.noteText}</p>
                    <p className="text-xs text-gray-400 mt-1">{note.author ?? "Field User"} · {formatDate(note.createdAt)}</p>
                  </div>
                  <button onClick={() => handleDeleteNote(note.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            }
          </div>
        )}

        {/* ── History ── */}
        {tab === "history" && (
          <div className="p-6">
            {auditLogs.length === 0
              ? <p className="text-sm text-gray-400 text-center py-6">No changes recorded yet.</p>
              : (
                <div className="space-y-2">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 text-sm py-2 border-b border-gray-50 last:border-0">
                      <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0 mt-1.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{log.action.replace(/_/g, " ")}</span>
                          {log.fieldChanged && (
                            <span className="font-medium text-gray-700 capitalize">{log.fieldChanged.replace(/([A-Z])/g, " $1")}</span>
                          )}
                        </div>
                        {(log.oldValue || log.newValue) && (
                          <div className="mt-0.5 text-xs">
                            {log.oldValue && <><span className="font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{log.oldValue}</span><span className="text-gray-400 mx-1">→</span></>}
                            {log.newValue && <span className="font-mono bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded">{log.newValue}</span>}
                          </div>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          {log.user?.name ?? log.changedBy ?? "System"} · {formatDate(new Date(log.createdAt))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        )}
      </div>
    </div>
  );
}
