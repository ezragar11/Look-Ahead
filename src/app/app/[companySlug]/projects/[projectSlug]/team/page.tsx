"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Users, Loader2, UserPlus, Shield, Mail, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  role: string;
  status: string;
  joinedAt: string;
  user: { id: string; name: string; email: string; globalRole: string };
}

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  PROJECT_ADMIN:    { bg: "bg-violet-500/15", text: "text-violet-300" },
  PROJECT_MANAGER:  { bg: "bg-sky-500/15",    text: "text-sky-300" },
  SUPERINTENDENT:   { bg: "bg-amber-500/15",  text: "text-amber-300" },
  ENGINEER:         { bg: "bg-emerald-500/15", text: "text-emerald-300" },
  FIELD_ASSISTANT:  { bg: "bg-cyan-500/15",   text: "text-cyan-300" },
  SUBCONTRACTOR:    { bg: "bg-orange-500/15", text: "text-orange-300" },
  OWNER_VIEWER:     { bg: "bg-slate-500/15",  text: "text-slate-300" },
};

const ROLE_LABELS: Record<string, string> = {
  PROJECT_ADMIN: "Admin", PROJECT_MANAGER: "PM", SUPERINTENDENT: "Super",
  ENGINEER: "Engineer", FIELD_ASSISTANT: "Field", SUBCONTRACTOR: "Sub", OWNER_VIEWER: "Viewer",
};

export default function TeamPage() {
  const { companySlug, projectSlug } = useParams<{ companySlug: string; projectSlug: string }>();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const pRes = await fetch(`/api/companies/${companySlug}/projects/${projectSlug}`);
    if (!pRes.ok) { setLoading(false); return; }
    const proj = await pRes.json();
    const mRes = await fetch(`/api/project-users?projectId=${proj.id}`);
    if (mRes.ok) setMembers(await mRes.json());
    setLoading(false);
  }, [companySlug, projectSlug]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-sky-500 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Project Team</h1>
          <p className="text-slate-500 text-sm mt-1">{members.length} member{members.length !== 1 ? "s" : ""} assigned</p>
        </div>
        <button className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-emerald-500/20">
          <UserPlus className="w-4 h-4" /> Invite Member
        </button>
      </div>

      {members.length === 0 ? (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-16 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 flex items-center justify-center">
            <Users className="w-10 h-10 text-emerald-500/60" />
          </div>
          <p className="text-white text-lg font-semibold">No Team Members</p>
          <p className="text-slate-500 text-sm mt-2">Invite team members to collaborate on this project.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => {
            const rc = ROLE_COLORS[m.role] ?? { bg: "bg-slate-500/15", text: "text-slate-300" };
            const initials = (m.user.name ?? "U").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
            const colors = ["from-sky-500 to-violet-600", "from-emerald-500 to-cyan-600", "from-amber-500 to-orange-600", "from-fuchsia-500 to-pink-600", "from-red-500 to-orange-600"];
            const colorIndex = m.user.name ? m.user.name.charCodeAt(0) % colors.length : 0;

            return (
              <div key={m.id} className="bg-slate-800/50 rounded-2xl border border-slate-700/50 hover:border-slate-600 transition-all p-5">
                <div className="flex items-center gap-4">
                  <div className={cn("w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0", colors[colorIndex])}>
                    <span className="text-white text-lg font-bold">{initials}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-semibold truncate">{m.user.name}</p>
                    <p className="text-slate-500 text-xs truncate flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {m.user.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full border", rc.bg, rc.text, `border-${rc.text.replace("text-", "")}/20`)}>
                    {ROLE_LABELS[m.role] ?? m.role}
                  </span>
                  <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full",
                    m.status === "ACTIVE" ? "text-emerald-300 bg-emerald-500/15" : "text-amber-300 bg-amber-500/15"
                  )}>{m.status}</span>
                  <span className="text-slate-600 text-[10px] ml-auto flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" /> Joined {new Date(m.joinedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
