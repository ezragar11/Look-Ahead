"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  CheckCircle,
  Clock,
  XCircle,
  Zap,
  MapPin,
  Link2,
  MessageSquare,
} from "lucide-react";
import toast from "react-hot-toast";
import { formatDate } from "@/lib/utils";

type ConflictStatus = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "CLOSED";
type ConflictSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
type ConflictType =
  | "TRADE_OVERLAP"
  | "CREW_AVAILABILITY"
  | "SEQUENCE_ISSUE"
  | "MATERIAL_DELIVERY"
  | "OTHER";

interface ConflictActivity {
  id: string;
  activity: {
    id: string;
    activityDescription: string;
    location: string | null;
    subcontractor: { name: string } | null;
  };
}

interface ConflictNote {
  id: string;
  noteText: string;
  author: string | null;
  createdAt: string;
}

interface Conflict {
  id: string;
  projectId: string;
  title: string;
  description: string;
  conflictType: ConflictType;
  severity: ConflictSeverity;
  status: ConflictStatus;
  location: string | null;
  isAutoDetected: boolean;
  dateIdentified: string;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  conflictActivities: ConflictActivity[];
  notes: ConflictNote[];
}

const SEVERITY_CONFIG: Record<
  ConflictSeverity,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  CRITICAL: {
    label: "Critical",
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    dot: "bg-red-500",
  },
  HIGH: {
    label: "High",
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    dot: "bg-orange-500",
  },
  MEDIUM: {
    label: "Medium",
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    border: "border-yellow-200",
    dot: "bg-yellow-500",
  },
  LOW: {
    label: "Low",
    bg: "bg-gray-50",
    text: "text-gray-600",
    border: "border-gray-200",
    dot: "bg-gray-400",
  },
};

const TYPE_LABELS: Record<ConflictType, string> = {
  TRADE_OVERLAP: "Trade Overlap",
  CREW_AVAILABILITY: "Crew Availability",
  SEQUENCE_ISSUE: "Sequence Issue",
  MATERIAL_DELIVERY: "Material / Delivery",
  OTHER: "Other",
};

const STATUS_CONFIG: Record<
  ConflictStatus,
  { label: string; icon: React.ReactNode; color: string }
> = {
  OPEN: {
    label: "Open",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    color: "text-red-600 bg-red-50 border-red-200",
  },
  UNDER_REVIEW: {
    label: "Under Review",
    icon: <Clock className="w-3.5 h-3.5" />,
    color: "text-yellow-700 bg-yellow-50 border-yellow-200",
  },
  RESOLVED: {
    label: "Resolved",
    icon: <CheckCircle className="w-3.5 h-3.5" />,
    color: "text-green-700 bg-green-50 border-green-200",
  },
  CLOSED: {
    label: "Closed",
    icon: <XCircle className="w-3.5 h-3.5" />,
    color: "text-gray-500 bg-gray-50 border-gray-200",
  },
};

export default function ConflictsPage() {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ConflictStatus | "ALL">("ALL");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [resolutionText, setResolutionText] = useState<Record<string, string>>({});
  const [noteText, setNoteText] = useState<Record<string, string>>({});
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    fetchConflicts();
    fetchFirstProject();
  }, []);

  async function fetchFirstProject() {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) setProjectId(data[0].id);
      }
    } catch {
      // ignore
    }
  }

  async function fetchConflicts() {
    setLoading(true);
    try {
      const res = await fetch("/api/conflicts");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setConflicts(data);
    } catch {
      toast.error("Failed to load conflicts");
    } finally {
      setLoading(false);
    }
  }

  async function runDetection() {
    if (!projectId) {
      toast.error("No project found — upload a lookahead first");
      return;
    }
    setDetecting(true);
    try {
      const res = await fetch("/api/conflicts/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        await fetchConflicts();
      } else {
        toast.error(data.error || "Detection failed");
      }
    } catch {
      toast.error("Detection failed");
    } finally {
      setDetecting(false);
    }
  }

  async function updateStatus(id: string, status: ConflictStatus) {
    const payload: Record<string, unknown> = { id, status };
    if (status === "RESOLVED") {
      payload.resolvedAt = new Date().toISOString();
      if (resolutionText[id]) payload.resolutionNotes = resolutionText[id];
    }
    try {
      const res = await fetch("/api/conflicts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Update failed");
      toast.success(`Conflict marked as ${STATUS_CONFIG[status].label}`);
      await fetchConflicts();
    } catch {
      toast.error("Failed to update conflict");
    }
  }

  async function addNote(conflictId: string) {
    const text = noteText[conflictId]?.trim();
    if (!text) return;
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conflictId, noteText: text, author: "Field Team" }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Note added");
      setNoteText((prev) => ({ ...prev, [conflictId]: "" }));
      await fetchConflicts();
    } catch {
      toast.error("Failed to add note");
    }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const filtered =
    statusFilter === "ALL"
      ? conflicts
      : conflicts.filter((c) => c.status === statusFilter);

  const counts = {
    open: conflicts.filter((c) => c.status === "OPEN").length,
    critical: conflicts.filter(
      (c) => c.severity === "CRITICAL" || c.severity === "HIGH"
    ).length,
    total: conflicts.length,
    resolved: conflicts.filter(
      (c) => c.status === "RESOLVED" || c.status === "CLOSED"
    ).length,
  };

  const STATUS_FILTERS: { value: ConflictStatus | "ALL"; label: string }[] = [
    { value: "ALL", label: "All" },
    { value: "OPEN", label: "Open" },
    { value: "UNDER_REVIEW", label: "Under Review" },
    { value: "RESOLVED", label: "Resolved" },
    { value: "CLOSED", label: "Closed" },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Conflicts</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Track and resolve schedule conflicts
          </p>
        </div>
        <button
          onClick={runDetection}
          disabled={detecting}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {detecting ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Zap className="w-4 h-4" />
          )}
          {detecting ? "Detecting…" : "Run Auto-Detection"}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
            Open
          </p>
          <p className="text-3xl font-bold text-red-600 mt-1">{counts.open}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
            High / Critical
          </p>
          <p className="text-3xl font-bold text-orange-500 mt-1">{counts.critical}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
            Resolved
          </p>
          <p className="text-3xl font-bold text-green-600 mt-1">{counts.resolved}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
            Total
          </p>
          <p className="text-3xl font-bold text-gray-700 mt-1">{counts.total}</p>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => {
          const count =
            f.value === "ALL"
              ? conflicts.length
              : conflicts.filter((c) => c.status === f.value).length;
          return (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                statusFilter === f.value
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
              }`}
            >
              {f.label}
              <span
                className={`ml-1.5 text-xs ${
                  statusFilter === f.value ? "text-blue-100" : "text-gray-400"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Conflict list */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <RefreshCw className="w-8 h-8 text-gray-300 animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading conflicts…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-16 text-center">
          <CheckCircle className="w-12 h-12 text-green-200 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">
            {statusFilter === "ALL"
              ? "No conflicts detected"
              : `No ${STATUS_CONFIG[statusFilter as ConflictStatus]?.label ?? statusFilter} conflicts`}
          </p>
          <p className="text-gray-400 text-sm mt-1">
            {statusFilter === "ALL"
              ? "Upload a lookahead or run auto-detection to scan for issues."
              : "Try a different filter above."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((conflict) => {
            const sev = SEVERITY_CONFIG[conflict.severity];
            const stat = STATUS_CONFIG[conflict.status];
            const isOpen = expanded.has(conflict.id);

            return (
              <div
                key={conflict.id}
                className={`bg-white rounded-xl border shadow-sm overflow-hidden ${sev.border}`}
              >
                {/* Row header */}
                <button
                  onClick={() => toggleExpand(conflict.id)}
                  className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  {/* Severity dot */}
                  <span
                    className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${sev.dot}`}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm leading-snug">
                        {conflict.title}
                      </span>
                      {/* Severity badge */}
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium border ${sev.bg} ${sev.text} ${sev.border}`}
                      >
                        {sev.label}
                      </span>
                      {/* Status badge */}
                      <span
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${stat.color}`}
                      >
                        {stat.icon}
                        {stat.label}
                      </span>
                      {/* Auto-detected badge */}
                      {conflict.isAutoDetected && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-600 border border-purple-200">
                          Auto-detected
                        </span>
                      )}
                      {/* Type badge */}
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200">
                        {TYPE_LABELS[conflict.conflictType]}
                      </span>
                    </div>

                    <p className="text-gray-500 text-xs mt-1 leading-relaxed line-clamp-2">
                      {conflict.description}
                    </p>

                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                      {conflict.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {conflict.location}
                        </span>
                      )}
                      <span>
                        Identified {formatDate(new Date(conflict.dateIdentified))}
                      </span>
                      {conflict.notes.length > 0 && (
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {conflict.notes.length} note
                          {conflict.notes.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  {isOpen ? (
                    <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  )}
                </button>

                {/* Expanded details */}
                {isOpen && (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-4">
                    {/* Related activities */}
                    {conflict.conflictActivities.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                          <Link2 className="w-3.5 h-3.5" />
                          Related Activities ({conflict.conflictActivities.length})
                        </p>
                        <div className="space-y-1.5">
                          {conflict.conflictActivities.map((ca) => (
                            <a
                              key={ca.id}
                              href={`/activities/${ca.activity.id}`}
                              className="flex items-start gap-2 text-sm p-2 rounded-lg bg-gray-50 hover:bg-blue-50 hover:text-blue-700 transition-colors group"
                            >
                              <span className="text-gray-700 group-hover:text-blue-700 leading-snug flex-1">
                                {ca.activity.activityDescription}
                              </span>
                              <div className="flex items-center gap-2 flex-shrink-0 text-xs text-gray-400">
                                {ca.activity.location && (
                                  <span className="flex items-center gap-0.5">
                                    <MapPin className="w-3 h-3" />
                                    {ca.activity.location}
                                  </span>
                                )}
                                {ca.activity.subcontractor && (
                                  <span>{ca.activity.subcontractor.name}</span>
                                )}
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Resolution notes */}
                    {conflict.status !== "RESOLVED" &&
                      conflict.status !== "CLOSED" && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                            Resolution Notes
                          </p>
                          <textarea
                            rows={2}
                            value={resolutionText[conflict.id] ?? conflict.resolutionNotes ?? ""}
                            onChange={(e) =>
                              setResolutionText((prev) => ({
                                ...prev,
                                [conflict.id]: e.target.value,
                              }))
                            }
                            placeholder="Describe how this was resolved or what action was taken…"
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          />
                        </div>
                      )}

                    {/* Existing resolution notes (if resolved) */}
                    {(conflict.status === "RESOLVED" ||
                      conflict.status === "CLOSED") &&
                      conflict.resolutionNotes && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                            Resolution
                          </p>
                          <p className="text-sm text-gray-700 bg-green-50 rounded-lg px-3 py-2 border border-green-100">
                            {conflict.resolutionNotes}
                          </p>
                          {conflict.resolvedAt && (
                            <p className="text-xs text-gray-400 mt-1">
                              Resolved {formatDate(new Date(conflict.resolvedAt))}
                            </p>
                          )}
                        </div>
                      )}

                    {/* Notes */}
                    {conflict.notes.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                          Notes
                        </p>
                        <div className="space-y-2">
                          {conflict.notes.map((note) => (
                            <div
                              key={note.id}
                              className="bg-gray-50 rounded-lg px-3 py-2 text-sm"
                            >
                              <p className="text-gray-700">{note.noteText}</p>
                              <p className="text-xs text-gray-400 mt-1">
                                {note.author ?? "Unknown"} ·{" "}
                                {formatDate(new Date(note.createdAt))}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add note */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Add Note
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={noteText[conflict.id] ?? ""}
                          onChange={(e) =>
                            setNoteText((prev) => ({
                              ...prev,
                              [conflict.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") addNote(conflict.id);
                          }}
                          placeholder="Add a note…"
                          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={() => addNote(conflict.id)}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      {conflict.status === "OPEN" && (
                        <button
                          onClick={() => updateStatus(conflict.id, "UNDER_REVIEW")}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200 text-xs font-medium rounded-lg transition-colors"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          Mark Under Review
                        </button>
                      )}
                      {(conflict.status === "OPEN" ||
                        conflict.status === "UNDER_REVIEW") && (
                        <button
                          onClick={() => updateStatus(conflict.id, "RESOLVED")}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-xs font-medium rounded-lg transition-colors"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Mark Resolved
                        </button>
                      )}
                      {conflict.status !== "CLOSED" && (
                        <button
                          onClick={() => updateStatus(conflict.id, "CLOSED")}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 text-xs font-medium rounded-lg transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Close
                        </button>
                      )}
                      {(conflict.status === "RESOLVED" ||
                        conflict.status === "CLOSED") && (
                        <button
                          onClick={() => updateStatus(conflict.id, "OPEN")}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-medium rounded-lg transition-colors"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Re-open
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
