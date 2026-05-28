"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { StickyNote, Loader2, Plus, Trash2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface NoteItem {
  id: string;
  noteText: string;
  author: string | null;
  isPublic: boolean;
  createdAt: string;
}

export default function NotesPage() {
  const { companySlug, projectSlug } = useParams<{ companySlug: string; projectSlug: string }>();
  const [notes, setNotes]       = useState<NoteItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [newNote, setNewNote]   = useState("");
  const [posting, setPosting]   = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const pRes = await fetch(`/api/companies/${companySlug}/projects/${projectSlug}`);
    if (!pRes.ok) { setLoading(false); return; }
    const proj = await pRes.json();
    setProjectId(proj.id);
    const nRes = await fetch(`/api/notes?projectId=${proj.id}`);
    if (nRes.ok) setNotes(await nRes.json());
    setLoading(false);
  }, [companySlug, projectSlug]);

  useEffect(() => { load(); }, [load]);

  async function handlePost() {
    if (!projectId || !newNote.trim()) return;
    setPosting(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, noteText: newNote.trim() }),
      });
      if (res.ok) { toast.success("Note added"); setNewNote(""); load(); }
      else toast.error("Failed to add note");
    } catch { toast.error("Failed to add note"); }
    finally { setPosting(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this note?")) return;
    const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Deleted"); setNotes((n) => n.filter((x) => x.id !== id)); }
    else toast.error("Delete failed");
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-sky-500 animate-spin" /></div>;

  const now = new Date();

  function timeAgo(date: string) {
    const diff = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Notes</h1>
        <p className="text-slate-500 text-sm mt-1">Project notes, memos, and observations</p>
      </div>

      {/* New note composer */}
      <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-4">
        <textarea
          ref={textRef}
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Write a note... (site observations, reminders, meeting notes)"
          className="w-full bg-transparent text-white placeholder:text-slate-600 text-sm resize-none outline-none min-h-[80px]"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handlePost(); }}
        />
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700/50">
          <span className="text-slate-600 text-xs">Ctrl+Enter to post</span>
          <button
            onClick={handlePost}
            disabled={posting || !newNote.trim()}
            className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white rounded-lg text-sm font-semibold disabled:opacity-40 transition-all"
          >
            {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Post
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-16 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-sky-500/10 flex items-center justify-center">
            <StickyNote className="w-10 h-10 text-cyan-500/60" />
          </div>
          <p className="text-white text-lg font-semibold">No Notes Yet</p>
          <p className="text-slate-500 text-sm mt-2">Add your first note above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <div key={n.id} className="bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-cyan-500/20 transition-all p-4 group">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-sky-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <StickyNote className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm whitespace-pre-wrap">{n.noteText}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                    {n.author && <span className="font-medium text-slate-400">{n.author}</span>}
                    <span>{timeAgo(n.createdAt)}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(n.id)}
                  className="p-1.5 text-slate-700 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
