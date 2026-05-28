"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  MapPin, Loader2, Plus, X, Trash2, Edit3, Check, Search,
  ChevronDown, Archive, Layers, Activity, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface Location {
  id: string;
  name: string;
  zone: string | null;
  floor: string | null;
  description: string | null;
  color: string | null;
  sortOrder: number;
  deletedAt: string | null;
  createdAt: string;
  _count: { activities: number; conflicts: number };
}

const ZONE_COLORS = [
  "#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444",
  "#06b6d4", "#ec4899", "#f97316", "#14b8a6", "#6366f1",
];

export default function LocationsPage() {
  const { companySlug, projectSlug } = useParams<{ companySlug: string; projectSlug: string }>();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading]     = useState(true);
  const [projectId, setProjectId] = useState<string | null>(null);

  // Form
  const [showForm, setShowForm]   = useState(false);
  const [creating, setCreating]   = useState(false);
  const [fName, setFName]         = useState("");
  const [fZone, setFZone]         = useState("");
  const [fFloor, setFFloor]       = useState("");
  const [fDesc, setFDesc]         = useState("");
  const [fColor, setFColor]       = useState(ZONE_COLORS[0]);

  // Edit
  const [editing, setEditing]       = useState<string | null>(null);
  const [editName, setEditName]     = useState("");
  const [editZone, setEditZone]     = useState("");
  const [editFloor, setEditFloor]   = useState("");
  const [editDesc, setEditDesc]     = useState("");

  // Filter
  const [search, setSearch]       = useState("");
  const [filterZone, setFilterZone] = useState("");

  // Deleted history
  const [deletedItems, setDeletedItems] = useState<Location[]>([]);
  const [showDeleted, setShowDeleted]   = useState(false);
  const [deletedLoaded, setDeletedLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pRes = await fetch(`/api/companies/${companySlug}/projects/${projectSlug}`);
      if (!pRes.ok) { setLoading(false); return; }
      const proj = await pRes.json();
      setProjectId(proj.id);
      const lRes = await fetch(`/api/projects/${proj.id}/locations`);
      if (lRes.ok) setLocations(await lRes.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [companySlug, projectSlug]);

  useEffect(() => { load(); }, [load]);

  async function createLocation(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/locations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fName, zone: fZone || null, floor: fFloor || null,
          description: fDesc || null, color: fColor,
        }),
      });
      if (res.ok) {
        toast.success("Location created");
        setShowForm(false);
        setFName(""); setFZone(""); setFFloor(""); setFDesc("");
        setFColor(ZONE_COLORS[Math.floor(Math.random() * ZONE_COLORS.length)]);
        load();
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Failed");
      }
    } catch { toast.error("Failed"); }
    finally { setCreating(false); }
  }

  async function saveEdit(id: string) {
    if (!projectId) return;
    const res = await fetch(`/api/projects/${projectId}/locations`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id, name: editName, zone: editZone || null,
        floor: editFloor || null, description: editDesc || null,
      }),
    });
    if (res.ok) { toast.success("Updated"); setEditing(null); load(); }
    else toast.error("Update failed");
  }

  async function deleteLocation(loc: Location) {
    if (!projectId) return;
    if (!confirm(`Delete "${loc.name}"? Activities using this location won't be affected.`)) return;
    const res = await fetch(`/api/projects/${projectId}/locations`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: loc.id }),
    });
    if (res.ok) { toast.success("Deleted"); load(); }
    else toast.error("Delete failed");
  }

  function startEdit(loc: Location) {
    setEditing(loc.id);
    setEditName(loc.name);
    setEditZone(loc.zone ?? "");
    setEditFloor(loc.floor ?? "");
    setEditDesc(loc.description ?? "");
  }

  async function loadDeleted() {
    if (!projectId) return;
    const res = await fetch(`/api/projects/${projectId}/locations?deleted=only`);
    if (res.ok) setDeletedItems(await res.json());
    setDeletedLoaded(true);
  }

  function toggleDeleted() {
    const next = !showDeleted;
    setShowDeleted(next);
    if (next && !deletedLoaded) loadDeleted();
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-sky-500 animate-spin" /></div>;

  // Derive zones from existing data
  const zones = [...new Set(locations.filter(l => l.zone).map(l => l.zone!))].sort();

  const filtered = locations.filter(l => {
    if (filterZone && l.zone !== filterZone) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!l.name.toLowerCase().includes(q) && !l.zone?.toLowerCase().includes(q) && !l.floor?.toLowerCase().includes(q) && !l.description?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Group by zone
  const grouped: Record<string, Location[]> = {};
  const noZone: Location[] = [];
  filtered.forEach(l => {
    if (l.zone) {
      if (!grouped[l.zone]) grouped[l.zone] = [];
      grouped[l.zone].push(l);
    } else {
      noZone.push(l);
    }
  });

  const totalActivities = locations.reduce((s, l) => s + l._count.activities, 0);
  const totalConflicts = locations.reduce((s, l) => s + l._count.conflicts, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Locations & Sectors</h1>
          <p className="text-slate-500 text-sm mt-1">
            {locations.length > 0
              ? `${locations.length} location${locations.length !== 1 ? "s" : ""} defined${zones.length > 0 ? ` across ${zones.length} zone${zones.length !== 1 ? "s" : ""}` : ""}`
              : "Define jobsite areas, zones, and sectors"}
          </p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-cyan-500/20">
          <Plus className="w-4 h-4" /> Add Location
        </button>
      </div>

      {/* Summary cards */}
      {locations.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="px-5 py-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
            <p className="text-cyan-300 text-2xl font-black">{locations.length}</p>
            <p className="text-slate-500 text-[10px] font-semibold uppercase">Locations</p>
          </div>
          <div className="px-5 py-3 rounded-xl bg-sky-500/10 border border-sky-500/20">
            <p className="text-sky-300 text-2xl font-black">{totalActivities}</p>
            <p className="text-slate-500 text-[10px] font-semibold uppercase">Activities Assigned</p>
          </div>
          <div className="px-5 py-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
            <p className={cn("text-2xl font-black", totalConflicts > 0 ? "text-orange-300" : "text-emerald-300")}>{totalConflicts}</p>
            <p className="text-slate-500 text-[10px] font-semibold uppercase">Conflicts</p>
          </div>
        </div>
      )}

      {/* Search + zone filter */}
      {locations.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search locations..."
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500" />
          </div>
          {zones.length > 0 && (
            <select value={filterZone} onChange={e => setFilterZone(e.target.value)}
              className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white">
              <option value="">All Zones</option>
              {zones.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          )}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <form onSubmit={createLocation} className="bg-slate-800/50 rounded-2xl border border-cyan-500/20 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-bold flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cyan-400" /> Add Location
            </h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Location Name *</label>
              <input value={fName} onChange={e => setFName(e.target.value)} required
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                placeholder="e.g., West Gate, Control Room 2A" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Zone / Area</label>
              <input value={fZone} onChange={e => setFZone(e.target.value)}
                list="zone-suggestions"
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                placeholder="e.g., Zone A, Building 1" />
              <datalist id="zone-suggestions">
                {zones.map(z => <option key={z} value={z} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Floor / Level</label>
              <input value={fFloor} onChange={e => setFFloor(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                placeholder="e.g., Level 1, Basement" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Description</label>
              <input value={fDesc} onChange={e => setFDesc(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                placeholder="Additional notes about this location" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Color</label>
              <div className="flex items-center gap-2">
                {ZONE_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setFColor(c)}
                    className={cn("w-6 h-6 rounded-full border-2 transition-all", fColor === c ? "border-white scale-110" : "border-transparent opacity-60 hover:opacity-100")}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
          <button type="submit" disabled={creating}
            className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
            {creating ? "Creating..." : "Create Location"}
          </button>
        </form>
      )}

      {/* Empty state */}
      {locations.length === 0 && !showForm && (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-16 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-sky-500/10 flex items-center justify-center">
            <MapPin className="w-10 h-10 text-cyan-500/60" />
          </div>
          <p className="text-white text-lg font-semibold">No Locations Defined</p>
          <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto">
            Define jobsite locations like areas, zones, rooms, and floors. Use them to assign activities to specific areas and detect crew overlap conflicts.
          </p>
          <button onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white rounded-xl text-sm font-semibold transition-all">
            <Plus className="w-4 h-4" /> Add First Location
          </button>
        </div>
      )}

      {/* Locations grouped by zone */}
      {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([zone, locs]) => (
        <div key={zone}>
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider px-1 mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" /> {zone}
            <span className="text-slate-600 font-normal text-xs">({locs.length})</span>
          </h2>
          <div className="grid gap-2">
            {locs.map(loc => renderLocation(loc))}
          </div>
        </div>
      ))}

      {noZone.length > 0 && (
        <div>
          {Object.keys(grouped).length > 0 && (
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider px-1 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Unzoned
              <span className="text-slate-600 font-normal text-xs">({noZone.length})</span>
            </h2>
          )}
          <div className="grid gap-2">
            {noZone.map(loc => renderLocation(loc))}
          </div>
        </div>
      )}

      {/* Deleted History */}
      {projectId && (
        <div className="pt-2">
          <button onClick={toggleDeleted}
            className="text-sm font-bold text-slate-600 uppercase tracking-wider px-1 flex items-center gap-2 hover:text-slate-400 transition-colors">
            <Archive className="w-4 h-4" /> Deleted History
            {deletedLoaded && <span className="text-xs font-normal">({deletedItems.length})</span>}
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showDeleted && "rotate-180")} />
          </button>
          {showDeleted && (
            <div className="mt-3 space-y-2">
              {!deletedLoaded && <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 text-slate-600 animate-spin" /></div>}
              {deletedLoaded && deletedItems.length === 0 && <p className="text-slate-600 text-sm px-1">No deleted locations.</p>}
              {deletedItems.map(loc => (
                <div key={loc.id} className="bg-slate-800/20 rounded-xl border border-slate-800 p-4 opacity-50 hover:opacity-70 transition-opacity">
                  <div className="flex items-center gap-3">
                    <Trash2 className="w-4 h-4 text-slate-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-400 font-medium line-through">{loc.name}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-600 mt-0.5">
                        {loc.zone && <span>{loc.zone}</span>}
                        {loc.floor && <span>{loc.floor}</span>}
                        {loc.deletedAt && <span className="text-red-400/60">Deleted {new Date(loc.deletedAt).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  function renderLocation(loc: Location) {
    const isEditing = editing === loc.id;

    if (isEditing) {
      return (
        <div key={loc.id} className="bg-slate-800/50 rounded-xl border border-cyan-500/30 p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input value={editName} onChange={e => setEditName(e.target.value)}
              className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="Name" />
            <input value={editZone} onChange={e => setEditZone(e.target.value)}
              className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="Zone" />
            <input value={editFloor} onChange={e => setEditFloor(e.target.value)}
              className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="Floor" />
            <div className="flex items-center gap-2">
              <button onClick={() => saveEdit(loc.id)}
                className="px-3 py-2 bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 rounded-lg text-sm font-semibold hover:bg-emerald-600/30 transition-colors">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => setEditing(null)}
                className="px-3 py-2 bg-slate-700/50 border border-slate-600 text-slate-400 rounded-lg text-sm hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={loc.id} className="bg-slate-800/30 rounded-xl border border-slate-700/50 hover:border-slate-600 p-4 transition-all group">
        <div className="flex items-center gap-4">
          {/* Color dot */}
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: loc.color ?? "#64748b" }} />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold">{loc.name}</p>
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
              {loc.zone && <span className="text-cyan-400/70">{loc.zone}</span>}
              {loc.floor && <span>{loc.floor}</span>}
              {loc.description && <span className="truncate max-w-[300px]">{loc.description}</span>}
            </div>
          </div>

          {/* Counts */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {loc._count.activities > 0 && (
              <span className="flex items-center gap-1 text-xs text-sky-400/70">
                <Activity className="w-3 h-3" /> {loc._count.activities}
              </span>
            )}
            {loc._count.conflicts > 0 && (
              <span className="flex items-center gap-1 text-xs text-orange-400/70">
                <AlertTriangle className="w-3 h-3" /> {loc._count.conflicts}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button onClick={() => startEdit(loc)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-sky-400 hover:bg-sky-500/10 transition-colors">
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => deleteLocation(loc)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }
}
