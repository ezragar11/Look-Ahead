"use client";
import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Users, Plus, Loader2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompanyMember {
  id: string;
  role: string;
  status: string;
  user: { id: string; name: string; email: string; globalRole: string };
}

export default function CompanyUsersPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/companies/${companySlug}/users`);
      if (res.ok) setMembers(await res.json());
    } catch {}
    setLoading(false);
  }, [companySlug]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Company Users</h1>
      </div>
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {members.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-sm">No users found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-700">
              <th className="px-5 py-3 text-left">Name</th>
              <th className="px-5 py-3 text-left">Email</th>
              <th className="px-5 py-3 text-left">Company Role</th>
              <th className="px-5 py-3 text-left">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-700">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-slate-700/30">
                  <td className="px-5 py-3 text-white">{m.user.name}</td>
                  <td className="px-5 py-3 text-slate-400">{m.user.email}</td>
                  <td className="px-5 py-3"><span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{m.role}</span></td>
                  <td className="px-5 py-3"><span className={cn("text-xs", m.status === "ACTIVE" ? "text-green-400" : "text-slate-500")}>{m.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
