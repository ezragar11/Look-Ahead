"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate, formatDateShort, truncate } from "@/lib/utils";
import type { Activity, ActivityStatus } from "@/types";
import { STATUS_LABELS } from "@/types";
import {
  Search, Filter, ChevronDown, ChevronUp, ChevronsUpDown,
  RefreshCcw, AlertTriangle, ExternalLink,
} from "lucide-react";

const STATUSES: ActivityStatus[] = [
  "PLANNED", "IN_PROGRESS", "COMPLETE", "DELAYED",
  "MISSED", "BLOCKED", "CANCELLED", "NEEDS_FOLLOW_UP",
];

export default function SchedulePage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [page, setPage]             = useState(1);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<ActivityStatus>("PLANNED");
  const limit = 50;

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search)         params.set("search", search);
      if (statusFilter)   params.set("status", statusFilter);
      if (categoryFilter) params.set("category", categoryFilter);
      params.set("page",  String(page));
      params.set("limit", String(limit));

      const res = await fetch(`/api/activities?${params}`);
      const data = await res.json();
      setActivities(data.activities ?? []);
      setTotal(data.total ?? 0);

      // Collect unique categories
      if (data.activities?.length > 0) {
        const cats = [...new Set<string>(
          data.activities.map((a: Activity) => a.category).filter(Boolean) as string[]
        )].sort();
        setCategories(cats);
      }
    } catch {
      toast.error("Failed to load activities");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, categoryFilter, page]);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);

  const handleStatusUpdate = async (activityId: string, newStatus: ActivityStatus) => {
    try {
      const res = await fetch("/api/activities", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id: activityId, status: newStatus }),
      });
      if (!res.ok) throw new Error("Update failed");
      toast.success("Status updated");
      setEditingId(null);
      fetchActivities();
    } catch {
      toast.error("Failed to update status");
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total} activities total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search activities, locations, subs…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[140px]"
          >
            <option value="">All Statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>

          {/* Category filter */}
          {categories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[160px]"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}

          {(search || statusFilter || categoryFilter) && (
            <button
              onClick={() => { setSearch(""); setStatusFilter(""); setCategoryFilter(""); setPage(1); }}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCcw className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-16">
            <AlertTriangle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No activities found</p>
            <p className="text-gray-400 text-sm mt-1">
              {search || statusFilter || categoryFilter
                ? "Try adjusting your filters"
                : "Upload a lookahead to get started"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full data-table">
              <thead>
                <tr>
                  <th>Activity</th>
                  <th>Category</th>
                  <th>Subcontractor</th>
                  <th>Location</th>
                  <th>Planned Dates</th>
                  <th>Actual Start</th>
                  <th>Status</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {activities.map((a) => {
                  const occurrenceDates = a.occurrences ?? [];
                  const firstDate = occurrenceDates[0]?.plannedDate;
                  const lastDate  = occurrenceDates[occurrenceDates.length - 1]?.plannedDate;

                  return (
                    <tr key={a.id} className="cursor-pointer">
                      <td>
                        <Link
                          href={`/activities/${a.id}`}
                          className="font-medium text-gray-800 hover:text-blue-700 transition-colors flex items-start gap-1.5 group"
                        >
                          <span className="truncate max-w-xs">{truncate(a.activityDescription, 60)}</span>
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5 text-blue-500" />
                        </Link>
                        {a.needsFollowUp && (
                          <span className="text-xs text-purple-600 font-medium">⚑ Needs Follow-Up</span>
                        )}
                      </td>
                      <td>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          {a.category ?? "—"}
                        </span>
                      </td>
                      <td>
                        <span className="text-sm text-blue-600 font-medium">
                          {a.subcontractor?.name ?? a.responsibleSubcontractorRaw ?? "—"}
                        </span>
                      </td>
                      <td className="text-gray-500">{a.location ?? "—"}</td>
                      <td className="text-gray-500 text-xs">
                        {occurrenceDates.length > 0
                          ? firstDate === lastDate
                            ? formatDate(firstDate)
                            : `${formatDateShort(firstDate)} – ${formatDate(lastDate)}`
                          : "—"}
                        {occurrenceDates.length > 1 && (
                          <span className="ml-1 text-gray-400">({occurrenceDates.length}d)</span>
                        )}
                      </td>
                      <td className="text-gray-500 text-xs">{a.actualStart ? formatDate(a.actualStart) : "—"}</td>
                      <td>
                        {editingId === a.id ? (
                          <div className="flex items-center gap-1">
                            <select
                              value={editStatus}
                              onChange={(e) => setEditStatus(e.target.value as ActivityStatus)}
                              className="text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              autoFocus
                            >
                              {STATUSES.map((s) => (
                                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleStatusUpdate(a.id, editStatus)}
                              className="text-xs px-1.5 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >✓</button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                            >✕</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingId(a.id); setEditStatus(a.status); }}
                            className="hover:opacity-80 transition-opacity"
                          >
                            <StatusBadge status={a.status} size="sm" />
                          </button>
                        )}
                      </td>
                      <td>
                        <Link href={`/activities/${a.id}`} className="p-1 hover:bg-gray-100 rounded block">
                          <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * limit >= total}
                className="px-3 py-1 text-xs border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
