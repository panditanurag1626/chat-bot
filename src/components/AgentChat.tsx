"use client";

import { useEffect, useRef, useState } from "react";

interface Msg {
  id: number;
  role: string;
  content: string;
  image_url?: string;
  created_at?: string;
}

interface Canned {
  shortcut: string;
  title: string;
  content: string;
}

function fmtTime(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });
  } catch {
    return "";
  }
}

export default function AgentChat({ convoId, initial, canned = [] }: { convoId: string; initial: Msg[]; canned?: Canned[] }) {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [text, setText] = useState("");
  const [showCanned, setShowCanned] = useState(false);
  const [mounted, setMounted] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const msgsRef = useRef<Msg[]>(initial);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    msgsRef.current = msgs;
  }, [msgs]);

  const scrollDown = () => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    scrollDown();
    const poll = async () => {
      const lastId = msgsRef.current.reduce((max, m) => Math.max(max, m.id), 0);
      try {
        const r = await fetch(`/api/agent/${convoId}/messages?after_id=${lastId}`);
        const data = await r.json();
        if (data.messages?.length) {
          setMsgs((prev) => {
            const seen = new Set(prev.map((m) => m.id));
            const add = (data.messages as Msg[]).filter((m) => !seen.has(m.id));
            return add.length ? [...prev, ...add] : prev;
          });
          setTimeout(scrollDown, 0);
        }
      } catch {}
    };
    const t = setInterval(poll, 3000);
    return () => clearInterval(t);
  }, [convoId]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    const fd = new FormData();
    fd.append("content", t);
    try {
      const r = await fetch(`/api/agent/${convoId}/send`, { method: "POST", body: fd });
      const data = await r.json();
      if (data.message_id) {
        setMsgs((prev) =>
          prev.some((m) => m.id === data.message_id) ? prev : [...prev, { id: data.message_id, role: "agent", content: data.content, created_at: data.created_at || new Date().toISOString() }]
        );
        setTimeout(scrollDown, 0);
      }
    } catch {}
  };

  // Live shortcut filter: when the agent types "!" or "/" prefix, match canned shortcuts.
  const trigger = text.match(/[!/]\S*$/)?.[0] ?? "";
  const filtered = canned.filter((c) => {
    if (showCanned && !trigger) return true;
    if (!trigger) return false;
    const q = trigger.slice(1).toLowerCase();
    return (c.shortcut.toLowerCase().includes(q) || c.title.toLowerCase().includes(q));
  });
  const pickerOpen = (showCanned || !!trigger) && filtered.length > 0;

  const insertCanned = (c: Canned) => {
    setText((prev) => (trigger ? prev.replace(/[!/]\S*$/, c.content) : (prev ? prev + " " : "") + c.content));
    setShowCanned(false);
  };

  return (
    <div className="agent-chat panel">
      <div ref={listRef} className="agent-msgs">
        {msgs.map((m) => (
          <div key={m.id} className={`agent-msg agent-msg-${m.role}`} data-id={m.id}>
            <span className="role">{m.role}</span> <span className="content">{m.content}</span>
            {m.image_url && <img src={m.image_url} alt="" />}
            {mounted && <span className="agent-msg-time">{fmtTime(m.created_at)}</span>}
          </div>
        ))}
      </div>

      <form className="agent-form" onSubmit={send} style={{ position: "relative" }}>
        {pickerOpen && (
          <div className="canned-picker" style={{ position: "absolute", bottom: "100%", left: 0, right: 0, maxHeight: 220, overflowY: "auto", background: "#fff", border: "1px solid #ddd", borderRadius: 8, boxShadow: "0 -4px 16px rgba(0,0,0,.08)", marginBottom: 6, zIndex: 5 }}>
            {filtered.map((c, i) => (
              <button key={i} type="button" onClick={() => insertCanned(c)} style={{ all: "unset", cursor: "pointer", display: "block", width: "100%", boxSizing: "border-box", padding: "8px 12px", borderBottom: "1px solid #f0f0f0" }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{c.shortcut && <code>{c.shortcut}</code>} {c.title}</div>
                <div className="muted" style={{ fontSize: 12 }}>{c.content.slice(0, 80)}</div>
              </button>
            ))}
          </div>
        )}
        <textarea
          rows={2}
          placeholder="Type your reply…  (type ! or / for canned replies)"
          required
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowCanned(false);
            if (e.key === "Enter" && !e.shiftKey && !pickerOpen) {
              e.preventDefault();
              send(e);
            }
          }}
        />
        {canned.length > 0 && (
          <button type="button" className="btn" title="Canned replies" onClick={() => setShowCanned((o) => !o)}>
            <i className="fa-solid fa-bolt" />
          </button>
        )}
        <button className="btn btn-primary" type="submit"><i className="fa-solid fa-paper-plane" /> Send</button>
      </form>
    </div>
  );
}
