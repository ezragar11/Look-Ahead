"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Map, Loader2, MapPin, AlertTriangle, Activity, ZoomIn, ZoomOut,
  Maximize2, Minimize2, ChevronDown, X, GripVertical, Eye, EyeOff,
  Image as ImageIcon, Crosshair,
} from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

// ── Types ────────────────────────────────────────────────────────────────────

interface Location {
  id: string;
  name: string;
  zone: string | null;
  floor: string | null;
  description: string | null;
  color: string | null;
  mapX: number | null;
  mapY: number | null;
  _count: { activities: number; conflicts: number };
}

interface SitePlan {
  id: string;
  name: string;
  type: string;
  mimeType: string | null;
  storedName: string | null;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ProjectMapPage() {
  const { companySlug, projectSlug } = useParams<{ companySlug: string; projectSlug: string }>();

  const [projectId, setProjectId]       = useState<string | null>(null);
  const [loading, setLoading]           = useState(true);
  const [locations, setLocations]       = useState<Location[]>([]);
  const [sitePlans, setSitePlans]       = useState<SitePlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [zoom, setZoom]                 = useState(1);
  const [fullscreen, setFullscreen]     = useState(false);
  const [placing, setPlacing]           = useState<string | null>(null); // locationId being placed
  const [dragging, setDragging]         = useState<string | null>(null);
  const [selected, setSelected]         = useState<string | null>(null); // selected pin
  const [showUnplaced, setShowUnplaced] = useState(true);
  const [showLabels, setShowLabels]     = useState(true);

  const mapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // ── Load data ──────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const pRes = await fetch(`/api/companies/${companySlug}/projects/${projectSlug}`);
      if (!pRes.ok) { setLoading(false); return; }
      const proj = await pRes.json();
      setProjectId(proj.id);

      // Load locations & site plans in parallel
      const [lRes, sRes] = await Promise.all([
        fetch(`/api/projects/${proj.id}/locations`),
        fetch(`/api/projects/${proj.id}/site-plans`),
      ]);
      if (lRes.ok) setLocations(await lRes.json());
      if (sRes.ok) {
        const plans: SitePlan[] = await sRes.json();
        setSitePlans(plans);
        // Restore saved map background or default to first image plan
        const saved = proj.mapSitePlanId;
        if (saved && plans.find(p => p.id === saved)) {
          setSelectedPlanId(saved);
        } else if (plans.length > 0) {
          const imgPlan = plans.find(p => p.mimeType?.startsWith("image/"));
          if (imgPlan) setSelectedPlanId(imgPlan.id);
        }
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [companySlug, projectSlug]);

  useEffect(() => { load(); }, [load]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const activePlan = sitePlans.find(p => p.id === selectedPlanId);
  const planUrl = activePlan?.storedName && projectId
    ? `/api/files/projects/${projectId}/site-plans/${activePlan.storedName}`
    : null;

  const placedLocations   = locations.filter(l => l.mapX !== null && l.mapY !== null);
  const unplacedLocations = locations.filter(l => l.mapX === null || l.mapY === null);

  function getMapCoords(e: React.MouseEvent): { x: number; y: number } | null {
    const el = mapRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  }

  async function updateLocationPin(locId: string, mapX: number, mapY: number) {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/locations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: locId, mapX, mapY }),
      });
      if (res.ok) {
        setLocations(prev => prev.map(l => l.id === locId ? { ...l, mapX, mapY } : l));
      }
    } catch { /* ignore */ }
  }

  async function removePin(locId: string) {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/locations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: locId, mapX: null, mapY: null }),
      });
      if (res.ok) {
        setLocations(prev => prev.map(l => l.id === locId ? { ...l, mapX: null, mapY: null } : l));
        setSelected(null);
        toast.success("Pin removed");
      }
    } catch { /* ignore */ }
  }

  async function saveMapBackground(planId: string) {
    if (!projectId) return;
    setSelectedPlanId(planId);
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapSitePlanId: planId }),
      });
    } catch { /* ignore */ }
  }

  // ── Map click / drag handlers ──────────────────────────────────────────────

  function handleMapClick(e: React.MouseEvent) {
    if (dragging) return;
    const coords = getMapCoords(e);
    if (!coords) return;

    if (placing) {
      updateLocationPin(placing, coords.x, coords.y);
      toast.success("Pin placed!");
      setPlacing(null);
      return;
    }

    // Deselect
    setSelected(null);
  }

  function handlePinMouseDown(e: React.MouseEvent, locId: string) {
    e.stopPropagation();
    e.preventDefault();
    setDragging(locId);
    setSelected(locId);

    const handleMove = (me: MouseEvent) => {
      const el = mapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((me.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((me.clientY - rect.top) / rect.height) * 100));
      setLocations(prev => prev.map(l => l.id === locId ? { ...l, mapX: x, mapY: y } : l));
    };

    const handleUp = (me: MouseEvent) => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
      const el = mapRef.current;
      if (!el) { setDragging(null); return; }
      const rect = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((me.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((me.clientY - rect.top) / rect.height) * 100));
      updateLocationPin(locId, x, y);
      setDragging(null);
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-sky-500 animate-spin" /></div>;

  const wrapperClass = fullscreen
    ? "fixed inset-0 z-50 bg-slate-950 flex flex-col"
    : "space-y-6";

  return (
    <div className={wrapperClass}>
      {/* Header */}
      <div className={cn("flex items-center justify-between", fullscreen ? "px-6 py-3 border-b border-slate-800 bg-slate-900/80 flex-shrink-0" : "")}>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Map className="w-6 h-6 text-emerald-400" /> Project Map
          </h1>
          {!fullscreen && (
            <p className="text-slate-500 text-sm mt-1">
              {placedLocations.length > 0
                ? `${placedLocations.length} of ${locations.length} locations pinned`
                : "Place locations on a site plan to visualize your jobsite"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Plan selector */}
          {sitePlans.length > 0 && (
            <div className="relative">
              <select
                value={selectedPlanId ?? ""}
                onChange={e => saveMapBackground(e.target.value)}
                className="bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white appearance-none pr-8 focus:outline-none focus:border-sky-500/50"
              >
                <option value="" disabled>Select background...</option>
                {sitePlans.filter(p => p.mimeType?.startsWith("image/")).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            </div>
          )}

          {/* Zoom */}
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
            className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-slate-500 text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(3, z + 0.25))}
            className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors">
            <ZoomIn className="w-4 h-4" />
          </button>

          {/* Labels toggle */}
          <button onClick={() => setShowLabels(!showLabels)}
            className={cn("p-2 rounded-lg border transition-colors",
              showLabels ? "bg-sky-500/20 border-sky-500/30 text-sky-300" : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white")}>
            {showLabels ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>

          {/* Fullscreen */}
          <button onClick={() => setFullscreen(!fullscreen)}
            className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors">
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className={cn("flex gap-4", fullscreen ? "flex-1 overflow-hidden px-4 pb-4" : "")}>
        {/* Map area */}
        <div className={cn("flex-1 overflow-auto rounded-2xl border bg-slate-900",
          placing ? "border-emerald-500/40" : "border-slate-700/50",
          fullscreen ? "h-full" : "min-h-[500px]")}>
          {!planUrl ? (
            <div className="flex items-center justify-center h-full min-h-[500px]">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-sky-500/10 flex items-center justify-center">
                  <ImageIcon className="w-10 h-10 text-emerald-500/60" />
                </div>
                <p className="text-white text-lg font-semibold">No Background Image</p>
                <p className="text-slate-500 text-sm mt-2 max-w-md">
                  {sitePlans.length === 0
                    ? "Upload a site plan first from the Site Plans page, then select it as the map background."
                    : "Select a site plan image from the dropdown above to use as your map background."}
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-auto h-full">
              <div
                ref={mapRef}
                onClick={handleMapClick}
                className={cn("relative inline-block", placing && "cursor-crosshair")}
                style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={planUrl}
                  alt="Site Plan"
                  className="block max-w-none select-none pointer-events-none"
                  draggable={false}
                />

                {/* Placed pins */}
                {placedLocations.map(loc => {
                  const isSelected = selected === loc.id;
                  const isDraggingThis = dragging === loc.id;
                  const hasConflicts = loc._count.conflicts > 0;
                  const pinColor = loc.color ?? "#3b82f6";

                  return (
                    <div
                      key={loc.id}
                      className={cn(
                        "absolute -translate-x-1/2 -translate-y-full",
                        isDraggingThis ? "z-50 cursor-grabbing" : "z-30 cursor-grab",
                        "transition-none"
                      )}
                      style={{ left: `${loc.mapX}%`, top: `${loc.mapY}%` }}
                      onMouseDown={e => handlePinMouseDown(e, loc.id)}
                      onClick={e => { e.stopPropagation(); setSelected(isSelected ? null : loc.id); }}
                    >
                      {/* Pin shape */}
                      <div className="relative group">
                        <svg width="28" height="36" viewBox="0 0 28 36" className="drop-shadow-lg">
                          <path
                            d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.27 21.73 0 14 0z"
                            fill={pinColor}
                            stroke={isSelected ? "#fff" : "rgba(0,0,0,0.3)"}
                            strokeWidth={isSelected ? 2 : 1}
                          />
                          <circle cx="14" cy="13" r="5" fill="white" opacity="0.9" />
                        </svg>

                        {/* Conflict indicator */}
                        {hasConflicts && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full border-2 border-slate-900 flex items-center justify-center">
                            <AlertTriangle className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}

                        {/* Activity count badge */}
                        {loc._count.activities > 0 && (
                          <div className="absolute -top-1 -left-1 w-4 h-4 bg-sky-500 rounded-full border-2 border-slate-900 flex items-center justify-center">
                            <span className="text-[8px] text-white font-bold">{loc._count.activities}</span>
                          </div>
                        )}

                        {/* Label */}
                        {showLabels && (
                          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-0.5 whitespace-nowrap">
                            <span className="px-1.5 py-0.5 bg-slate-900/90 border border-slate-700/50 rounded text-[10px] text-white font-medium shadow-lg">
                              {loc.name}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Selected popup */}
                      {isSelected && !isDraggingThis && (
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl shadow-black/50 p-3 z-50"
                          onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-white text-sm font-bold truncate">{loc.name}</p>
                            <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-white">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="space-y-1.5 text-xs text-slate-400">
                            {loc.zone && <p>Zone: <span className="text-cyan-300">{loc.zone}</span></p>}
                            {loc.floor && <p>Floor: <span className="text-white">{loc.floor}</span></p>}
                            {loc.description && <p className="text-slate-500 truncate">{loc.description}</p>}
                            <div className="flex items-center gap-3 pt-1">
                              <span className="flex items-center gap-1">
                                <Activity className="w-3 h-3 text-sky-400" /> {loc._count.activities} activities
                              </span>
                              <span className={cn("flex items-center gap-1", loc._count.conflicts > 0 ? "text-orange-400" : "")}>
                                <AlertTriangle className="w-3 h-3" /> {loc._count.conflicts} conflicts
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-700/50">
                            <button onClick={() => { setDragging(null); }}
                              className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-slate-400 bg-slate-700/50 rounded-lg hover:text-white transition-colors">
                              <GripVertical className="w-3 h-3" /> Drag to move
                            </button>
                            <button onClick={() => removePin(loc.id)}
                              className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-red-400 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors">
                              <X className="w-3 h-3" /> Remove
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Placing cursor indicator */}
                {placing && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="bg-emerald-500/20 border-2 border-dashed border-emerald-500/40 rounded-xl px-6 py-3 text-emerald-300 text-sm font-semibold flex items-center gap-2">
                      <Crosshair className="w-4 h-4" /> Click to place pin
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar: unplaced locations */}
        <div className={cn(
          "w-72 flex-shrink-0 bg-slate-800/30 rounded-2xl border border-slate-700/50 overflow-y-auto",
          fullscreen ? "h-full" : "max-h-[600px]"
        )}>
          <div className="p-4 border-b border-slate-700/50 sticky top-0 bg-slate-800/80 backdrop-blur-sm z-10">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400" /> Locations
              </h3>
              <span className="text-slate-500 text-xs">{locations.length} total</span>
            </div>

            {placing && (
              <button onClick={() => setPlacing(null)}
                className="mt-2 w-full px-3 py-2 text-xs font-semibold text-orange-300 bg-orange-500/10 border border-orange-500/20 rounded-lg hover:bg-orange-500/20 transition-colors flex items-center justify-center gap-1">
                <X className="w-3 h-3" /> Cancel Placement
              </button>
            )}
          </div>

          {/* Unplaced section */}
          {showUnplaced && unplacedLocations.length > 0 && (
            <div className="p-3">
              <button onClick={() => setShowUnplaced(!showUnplaced)}
                className="text-[10px] font-bold text-amber-400/60 uppercase tracking-widest mb-2 px-1 flex items-center gap-1">
                <Crosshair className="w-3 h-3" /> Not on map ({unplacedLocations.length})
              </button>
              <div className="space-y-1">
                {unplacedLocations.map(loc => (
                  <button
                    key={loc.id}
                    onClick={() => {
                      if (placing === loc.id) { setPlacing(null); return; }
                      setPlacing(loc.id);
                      toast("Click on the map to place this pin", { icon: "📍" });
                    }}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all text-sm",
                      placing === loc.id
                        ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-300"
                        : "bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 border border-transparent"
                    )}
                  >
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: loc.color ?? "#64748b" }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-xs">{loc.name}</p>
                      {loc.zone && <p className="text-[10px] text-slate-500 truncate">{loc.zone}</p>}
                    </div>
                    <Crosshair className="w-3 h-3 text-slate-600 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Placed section */}
          {placedLocations.length > 0 && (
            <div className="p-3 border-t border-slate-700/30">
              <p className="text-[10px] font-bold text-emerald-400/60 uppercase tracking-widest mb-2 px-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> On map ({placedLocations.length})
              </p>
              <div className="space-y-1">
                {placedLocations.map(loc => (
                  <button
                    key={loc.id}
                    onClick={() => setSelected(selected === loc.id ? null : loc.id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all text-sm",
                      selected === loc.id
                        ? "bg-sky-500/20 border border-sky-500/30 text-sky-300"
                        : "bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 border border-transparent"
                    )}
                  >
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: loc.color ?? "#64748b" }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-xs">{loc.name}</p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        {loc._count.activities > 0 && (
                          <span className="flex items-center gap-0.5 text-sky-400/70">
                            <Activity className="w-2.5 h-2.5" /> {loc._count.activities}
                          </span>
                        )}
                        {loc._count.conflicts > 0 && (
                          <span className="flex items-center gap-0.5 text-orange-400/70">
                            <AlertTriangle className="w-2.5 h-2.5" /> {loc._count.conflicts}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty */}
          {locations.length === 0 && (
            <div className="p-6 text-center">
              <MapPin className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="text-slate-500 text-xs">No locations defined yet.</p>
              <p className="text-slate-600 text-[10px] mt-1">Create locations from the Locations page first.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
