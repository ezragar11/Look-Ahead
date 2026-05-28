"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProject } from "@/contexts/ProjectContext";
import { FolderOpen, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const HIDE_ON = ["/login"];

export function ProjectBar() {
  const pathname = usePathname();
  const { projects, activeProject, setActiveProject } = useProject();

  if (HIDE_ON.includes(pathname)) return null;
  if (projects.length === 0) return null;

  return (
    <div className="flex items-center gap-1 px-6 py-2 border-b border-slate-800 bg-slate-900/50 overflow-x-auto">
      <FolderOpen className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mr-1" />

      {projects.map((project, i) => {
        const isActive = activeProject?.id === project.id;
        return (
          <button
            key={project.id}
            onClick={() => setActiveProject(project)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors",
              isActive
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:text-white hover:bg-slate-700"
            )}
          >
            {project.projectName}
            {isActive && (
              <Link
                href={`/projects/${project.id}`}
                onClick={(e) => e.stopPropagation()}
                className="opacity-60 hover:opacity-100"
                title="Open project hub"
              >
                <ChevronRight className="w-3 h-3" />
              </Link>
            )}
          </button>
        );
      })}
    </div>
  );
}
