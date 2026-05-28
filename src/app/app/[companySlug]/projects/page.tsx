"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { FolderKanban, Plus, Loader2, MapPin, X } from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface ProjectInfo {
  id: string;
  projectName: string;
  slug: string | null;
  status: string;
  location: string | null;
}

export default function ProjectsListPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const searchParams    = useSearchParams();
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showNew, setShowNew]   = useState(searchParams.get("new") === "1");

  // New project form
  const [formName, setFormName]     = useState("");
  const [formSlug, setFormSlug]     = useState("");
  const [formClient, setFormClient] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formDesc, setFormDesc]     = useState("");
  const [formStart, setFormStart]   = useState("");
  const [formEnd, setFormEnd]       = useState("");
  const [creating, setCreating]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/companies/${companySlug}/projects`);
    if (res.ok) setProjects(await res.json());
    setLoading(false);
  }, [companySlug]);

  useEffect(() => { load(); }, [load]);

  // Auto-generate slug from name
  useEffect(() => {
    if (!formSlug || formSlug === autoSlug(formName.slice(0, -1))) {
      setFormSlug(autoSlug(formName));
    }
  }, [formName]);

  function autoSlug(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await fetch(`/api/companies/${companySlug}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectName: formName, projectSlug: formSlug,
        client: formClient, location: formLocation, description: formDesc,
        startDate: formStart || undefined, endDate: formEnd || undefined,
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) { toast.error(data.error ?? "Failed"); return; }
    toast.success("Project created!");
    setShowNew(false);
    setFormName(""); setFormSlug(""); setFormClient("");
    setFormLocation(""); setFormDesc(""); setFormStart(""); setFormEnd("");
    load();
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Projects</h1>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      {/* New project form */}
      {showNew && (
        <form onSubmit={createProject} className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold">Create New Project</h3>
            <button type="button" onClick={() => setShowNew(false)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Project Name *</label>
              <input value={formName} onChange={(e) => setFormName(e.target.value)} required
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" placeholder="Project Name" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">URL Slug</label>
              <input value={formSlug} onChange={(e) => setFormSlug(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" placeholder="project-name" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Client</label>
              <input value={formClient} onChange={(e) => setFormClient(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" placeholder="Client Name" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Location</label>
              <input value={formLocation} onChange={(e) => setFormLocation(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" placeholder="City, State" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Description</label>
              <input value={formDesc} onChange={(e) => setFormDesc(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" placeholder="Brief description" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Start Date</label>
              <input type="date" value={formStart} onChange={(e) => setFormStart(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">End Date</label>
              <input type="date" value={formEnd} onChange={(e) => setFormEnd(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
          </div>
          <button type="submit" disabled={creating}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors">
            {creating ? "Creating…" : "Create Project"}
          </button>
        </form>
      )}

      {/* Projects list */}
      {projects.length === 0 ? (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-16 text-center">
          <FolderKanban className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 mb-2">No projects yet.</p>
          <button onClick={() => setShowNew(true)} className="text-blue-400 hover:text-blue-300 text-sm font-medium">
            Create your first project →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/app/${companySlug}/projects/${p.slug ?? p.id}`}
              className="block bg-slate-800 rounded-xl border border-slate-700 p-5 hover:border-blue-600/50 transition-colors group"
            >
              <p className="text-white font-semibold text-sm group-hover:text-blue-400 transition-colors">{p.projectName}</p>
              {p.location && (
                <p className="text-slate-500 text-xs mt-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {p.location}
                </p>
              )}
              <span className={cn(
                "inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                p.status === "ACTIVE"    ? "text-green-400 border-green-700 bg-green-900/30" :
                p.status === "ON_HOLD"   ? "text-yellow-400 border-yellow-700 bg-yellow-900/30" :
                p.status === "COMPLETED" ? "text-blue-400 border-blue-700 bg-blue-900/30" :
                "text-slate-400 border-slate-700 bg-slate-800"
              )}>
                {p.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
