"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Bell, Loader2, CheckCheck, AlertTriangle, Info, Clock, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  title: string;
  message: string | null;
  type: string;
  readAt: string | null;
  createdAt: string;
}

const TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  INFO:    { icon: Info,           color: "text-sky-400",    bg: "bg-sky-500/10" },
  WARNING: { icon: AlertTriangle,  color: "text-amber-400",  bg: "bg-amber-500/10" },
  URGENT:  { icon: Zap,            color: "text-red-400",    bg: "bg-red-500/10" },
  SUCCESS: { icon: CheckCheck,     color: "text-emerald-400", bg: "bg-emerald-500/10" },
};

export default function NotificationsPage() {
  const { companySlug, projectSlug } = useParams<{ companySlug: string; projectSlug: string }>();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const pRes = await fetch(`/api/companies/${companySlug}/projects/${projectSlug}`);
    if (!pRes.ok) { setLoading(false); return; }
    const proj = await pRes.json();
    const nRes = await fetch(`/api/notifications?projectId=${proj.id}`);
    if (nRes.ok) setNotifications(await nRes.json());
    setLoading(false);
  }, [companySlug, projectSlug]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-sky-500 animate-spin" /></div>;

  const unread = notifications.filter((n) => !n.readAt);
  const read = notifications.filter((n) => n.readAt);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Notifications</h1>
          <p className="text-slate-500 text-sm mt-1">
            {unread.length > 0 ? `${unread.length} unread` : "All caught up"}
          </p>
        </div>
        {unread.length > 0 && (
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-sm font-medium transition-all">
            <CheckCheck className="w-4 h-4" /> Mark All Read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-16 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-sky-500/10 to-emerald-500/10 flex items-center justify-center">
            <Bell className="w-10 h-10 text-sky-500/60" />
          </div>
          <p className="text-white text-lg font-semibold">No Notifications</p>
          <p className="text-slate-500 text-sm mt-2">Notifications about schedule changes, conflicts, and deadlines will appear here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {unread.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-sky-400 uppercase tracking-wider px-1">New</h2>
              {unread.map((n) => {
                const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.INFO;
                const Icon = cfg.icon;
                return (
                  <div key={n.id} className={cn("rounded-xl border border-slate-700/50 p-4 flex items-start gap-4", cfg.bg)}>
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-slate-800/50")}>
                      <Icon className={cn("w-5 h-5", cfg.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm">{n.title}</p>
                      {n.message && <p className="text-slate-400 text-sm mt-0.5">{n.message}</p>}
                      <p className="text-slate-600 text-xs mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500 flex-shrink-0 mt-1 animate-pulse" />
                  </div>
                );
              })}
            </div>
          )}

          {read.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider px-1">Earlier</h2>
              {read.map((n) => {
                const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.INFO;
                const Icon = cfg.icon;
                return (
                  <div key={n.id} className="bg-slate-800/30 rounded-xl border border-slate-800 p-4 flex items-start gap-4 opacity-60">
                    <div className="w-10 h-10 rounded-xl bg-slate-800/50 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-300 font-medium text-sm">{n.title}</p>
                      {n.message && <p className="text-slate-500 text-sm mt-0.5">{n.message}</p>}
                      <p className="text-slate-600 text-xs mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
