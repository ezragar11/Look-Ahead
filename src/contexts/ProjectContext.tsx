"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface Project {
  id: string;
  projectName: string;
  description?: string | null;
  _count?: { activities: number; lookaheads: number };
}

interface ProjectContextValue {
  projects:       Project[];
  activeProject:  Project | null;
  setActiveProject: (p: Project) => void;
  refreshProjects:  () => Promise<void>;
  loading:        boolean;
}

const ProjectContext = createContext<ProjectContextValue>({
  projects:         [],
  activeProject:    null,
  setActiveProject: () => {},
  refreshProjects:  async () => {},
  loading:          true,
});

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects]             = useState<Project[]>([]);
  const [activeProject, setActiveProjectRaw] = useState<Project | null>(null);
  const [loading, setLoading]               = useState(true);

  const refreshProjects = useCallback(async () => {
    try {
      const res  = await fetch("/api/projects");
      if (!res.ok) return;
      const data: Project[] = await res.json();
      setProjects(data);

      // Restore saved project or fall back to first
      const savedId = typeof window !== "undefined"
        ? localStorage.getItem("lookAhead_activeProjectId")
        : null;
      const saved = savedId ? data.find((p) => p.id === savedId) : null;
      const next  = saved ?? data[0] ?? null;
      setActiveProjectRaw(next);
    } catch {
      // silently ignore network errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  const setActiveProject = useCallback((p: Project) => {
    setActiveProjectRaw(p);
    if (typeof window !== "undefined") {
      localStorage.setItem("lookAhead_activeProjectId", p.id);
    }
  }, []);

  return (
    <ProjectContext.Provider value={{ projects, activeProject, setActiveProject, refreshProjects, loading }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  return useContext(ProjectContext);
}
