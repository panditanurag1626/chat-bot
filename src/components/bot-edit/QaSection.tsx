"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Sortable from "sortablejs";
import { useRouter } from "next/navigation";
import { qaAddAction, qaBulkToggleAction, qaBulkDeleteAction, qaDeleteAction } from "@/app/actions/bots";

export interface QaNode {
  id: string;
  question: string;
  answer: string;
  keywords: string;
  source: string;
  parentId: string | null;
  showInMenu: boolean;
  children: QaNode[];
}
export interface FlatOpt {
  id: string;
  question: string;
  parentId: string | null;
}
interface Pagination {
  page: number;
  pages: number;
  total: number;
  perPage: number;
  offset: number;
}

export default function QaSection({
  botId,
  roots: initialRoots,
  flatOptions,
  pagination,
}: {
  botId: string;
  roots: QaNode[];
  flatOptions: FlatOpt[];
  pagination: Pagination;
}) {
  const router = useRouter();
  const [roots, setRoots] = useState<QaNode[]>(initialRoots);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: string } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sortablesRef = useRef<Sortable[]>([]);

  useEffect(() => setRoots(initialRoots), [initialRoots]);

  // Collapse state persisted per-bot.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`qa-collapsed-${botId}`);
      if (raw) setCollapsed(new Set(JSON.parse(raw)));
    } catch {}
  }, [botId]);

  const showToast = useCallback((msg: string, kind: "success" | "error" | "info" = "info") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 1800);
  }, []);

  // ---- tree helpers (immutable) ----
  const findAndDetach = (nodes: QaNode[], id: string): QaNode | null => {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].id === id) {
        const [n] = nodes.splice(i, 1);
        return n;
      }
      const found = findAndDetach(nodes[i].children, id);
      if (found) return found;
    }
    return null;
  };
  const findChildrenArray = (nodes: QaNode[], parentId: string | null): QaNode[] | null => {
    if (parentId === null) return nodes;
    for (const n of nodes) {
      if (n.id === parentId) return n.children;
      const r = findChildrenArray(n.children, parentId);
      if (r) return r;
    }
    return null;
  };
  const patchNode = (nodes: QaNode[], id: string, patch: Partial<QaNode>): QaNode[] =>
    nodes.map((n) => (n.id === id ? { ...n, ...patch } : { ...n, children: patchNode(n.children, id, patch) }));

  const moveNode = (id: string, newParentId: string | null, index: number) => {
    setRoots((prev) => {
      const clone: QaNode[] = JSON.parse(JSON.stringify(prev));
      const node = findAndDetach(clone, id);
      if (!node) return prev;
      node.parentId = newParentId;
      const target = findChildrenArray(clone, newParentId);
      if (!target) return prev;
      const idx = Math.max(0, Math.min(index, target.length));
      target.splice(idx, 0, node);
      return clone;
    });
  };

  // ---- SortableJS (re-init on every structural render) ----
  useEffect(() => {
    if (!containerRef.current) return;
    const lists = containerRef.current.querySelectorAll<HTMLElement>(".qa-sortable");
    lists.forEach((list) => {
      sortablesRef.current.push(
        Sortable.create(list, {
          group: "qa-tree",
          handle: ".qa-drag-handle",
          animation: 150,
          fallbackOnBody: true,
          invertSwap: true,
          onEnd: (evt) => {
            const item = evt.item;
            const id = item.dataset.qaId!;
            const toUl = evt.to as HTMLElement;
            const fromUl = evt.from as HTMLElement;
            const oldIndex = evt.oldIndex ?? 0;
            const newIndex = evt.newIndex ?? 0;
            if (fromUl === toUl && oldIndex === newIndex) return;
            // Revert SortableJS's DOM mutation so React stays the source of truth.
            const ref = fromUl.children[oldIndex] || null;
            fromUl.insertBefore(item, ref);
            const toParent = toUl.dataset.parentId || "0";
            const newParentId = toParent === "0" ? null : toParent;
            const offset = parseInt(toUl.dataset.offset || "0", 10);
            moveNode(id, newParentId, newIndex);
            fetch(`/api/qa/${id}/move`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
              body: JSON.stringify({ parent_id: newParentId, position: offset + newIndex }),
            })
              .then((r) => (r.ok ? showToast("Moved", "success") : showToast("Move failed — please refresh", "error")))
              .catch(() => showToast("Move failed — network error", "error"));
          },
        })
      );
    });
    return () => {
      sortablesRef.current.forEach((s) => s.destroy());
      sortablesRef.current = [];
    };
  }, [roots, moveNode, showToast]);

  // ---- collapse ----
  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(`qa-collapsed-${botId}`, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  // ---- bulk select ----
  const allIdsOnPage = useCallback((): string[] => {
    const ids: string[] = [];
    const walk = (n: QaNode[]) => n.forEach((x) => { ids.push(x.id); walk(x.children); });
    walk(roots);
    return ids;
  }, [roots]);

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allIds = allIdsOnPage();
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const toggleSelectAll = () => setSelected(allSelected ? new Set() : new Set(allIds));
  const selectedCsv = [...selected].join(",");

  // ---- show toggle (AJAX) ----
  const onShowToggle = async (id: string, show: boolean) => {
    setRoots((prev) => patchNode(prev, id, { showInMenu: show }));
    try {
      const r = await fetch(`/api/qa/${id}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({ show_in_menu: show }),
      });
      if (!r.ok) throw new Error();
      showToast(show ? "Showing in menu" : "Hidden from menu", "success");
    } catch {
      setRoots((prev) => patchNode(prev, id, { showInMenu: !show }));
      showToast("Could not update — try again", "error");
    }
  };

  // ---- inline edit (AJAX) ----
  const onEditSubmit = async (id: string, form: HTMLFormElement) => {
    const fd = new FormData(form);
    const payload = {
      question: String(fd.get("question") || ""),
      answer: String(fd.get("answer") || ""),
      keywords: String(fd.get("keywords") || ""),
      parent_id: String(fd.get("parent_id") || ""),
    };
    const node = findInTree(roots, id);
    const currentParent = node?.parentId || "";
    const parentChanged = currentParent !== payload.parent_id;
    try {
      const r = await fetch(`/api/qa/${id}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error();
      const json = await r.json();
      if (!json.ok) throw new Error();
      setRoots((prev) => patchNode(prev, id, { question: json.qa.question, answer: json.qa.answer, keywords: json.qa.keywords }));
      setEditingId(null);
      showToast("Saved", "success");
      if (parentChanged) setTimeout(() => router.refresh(), 350);
    } catch {
      showToast("Save failed — try again", "error");
    }
  };

  const parentOptions = (excludeId?: string) =>
    flatOptions
      .filter((o) => o.id !== excludeId)
      .map((o) => (
        <option key={o.id} value={o.id}>
          {o.parentId ? "↳ " : ""}
          {o.question.slice(0, 60)}
        </option>
      ));

  const renderNode = (q: QaNode) => {
    const hasChildren = q.children.length > 0;
    const isCollapsed = collapsed.has(q.id);
    const isEditing = editingId === q.id;
    return (
      <li key={q.id} id={`qa-${q.id}`} data-qa-id={q.id} className={`qa-item${hasChildren ? " has-children" : ""}${isEditing ? " editing" : ""}`}>
        <div className="qa-row">
          <span className="qa-drag-handle" title="Drag to reorder or change parent"><i className="fa-solid fa-grip-vertical" /></span>
          <input type="checkbox" className="qa-bulk-check" checked={selected.has(q.id)} onChange={() => toggleSelect(q.id)} title="Select for bulk action" />
          {hasChildren ? (
            <button type="button" className={`qa-collapse-btn${isCollapsed ? " collapsed" : ""}`} title="Expand/collapse children" onClick={() => toggleCollapse(q.id)}>
              <i className="fa-solid fa-chevron-down" />
            </button>
          ) : (
            <span className="qa-collapse-spacer" />
          )}
          <div className="qa-text">
            <strong>Q:</strong> <span>{q.question}</span><br />
            <strong>A:</strong> <span>{q.answer}</span><br />
            {q.keywords && (<><small className="muted">keywords: <span>{q.keywords}</span></small><br /></>)}
            <small className="muted">source: {q.source}{q.parentId ? ` · child of #${q.parentId.slice(-4)}` : ""}</small>
          </div>
          <div className="qa-actions">
            <label className="qa-show-toggle" title="Show this question in chatbot menu">
              <input type="checkbox" checked={q.showInMenu} onChange={(e) => onShowToggle(q.id, e.target.checked)} />
              <span>Show</span>
            </label>
            <button className="btn btn-icon btn-sm" type="button" title="Edit" onClick={() => setEditingId(q.id)}><i className="fa-solid fa-pen-to-square" /></button>
            <form action={qaDeleteAction.bind(null, q.id)} className="inline">
              <button className="btn btn-icon btn-sm btn-danger" type="submit" title="Delete"><i className="fa-solid fa-trash" /></button>
            </form>
          </div>
        </div>
        <form
          className="qa-edit-form"
          onSubmit={(e) => { e.preventDefault(); onEditSubmit(q.id, e.currentTarget); }}
        >
          <input name="question" defaultValue={q.question} required placeholder="Question" />
          <textarea name="answer" rows={2} required placeholder="Answer" defaultValue={q.answer} />
          <input name="keywords" defaultValue={q.keywords} placeholder="keywords" />
          <select name="parent_id" className="parent-picker" defaultValue={q.parentId || ""}>
            <option value="">— Top level —</option>
            {parentOptions(q.id)}
          </select>
          <div className="actions">
            <button className="btn btn-primary btn-sm" type="submit"><i className="fa-solid fa-check" /> Save</button>
            <button className="btn btn-sm" type="button" onClick={() => setEditingId(null)}>Cancel</button>
          </div>
        </form>
        {hasChildren && (
          <ul className={`qa-children qa-sortable${isCollapsed ? " collapsed" : ""}`} data-parent-id={q.id}>
            {q.children.map(renderNode)}
          </ul>
        )}
      </li>
    );
  };

  const { page, pages, total, perPage, offset } = pagination;

  return (
    <div ref={containerRef}>
      <h3>Knowledge base (Q&amp;A)</h3>
      <p className="muted">
        Exact answers used when the user&apos;s message matches keywords. The LLM is the fallback. Add child questions to
        build an Airtel-style decision tree.
      </p>

      <form action={qaAddAction.bind(null, botId)} className="qa-form">
        <input name="question" placeholder="Question" required />
        <input name="answer" placeholder="Answer" required />
        <input name="keywords" placeholder="keywords (comma sep.)" />
        <select name="parent_id" className="parent-picker" defaultValue="">
          <option value="">— Top level —</option>
          {parentOptions()}
        </select>
        <button className="btn btn-primary" type="submit"><i className="fa-solid fa-plus" /> Add</button>
      </form>

      {total > 0 && (
        <div className="qa-meta muted">
          Showing {offset + 1}–{offset + roots.length} of {total} top-level question{total !== 1 ? "s" : ""}
        </div>
      )}

      <div className="qa-bulk-toolbar">
        <label className="qa-bulk-all">
          <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} /> Select all on this page
        </label>
        <span className="qa-bulk-count muted">{selected.size} selected</span>
        <form action={qaBulkToggleAction.bind(null, botId)}>
          <input type="hidden" name="ids" value={selectedCsv} />
          <input type="hidden" name="show_in_menu" value="1" />
          <button className="btn btn-sm" type="submit" disabled={selected.size === 0}><i className="fa-solid fa-eye" /> Show selected</button>
        </form>
        <form action={qaBulkToggleAction.bind(null, botId)}>
          <input type="hidden" name="ids" value={selectedCsv} />
          <button className="btn btn-sm" type="submit" disabled={selected.size === 0}><i className="fa-solid fa-eye-slash" /> Hide selected</button>
        </form>
        <form action={qaBulkDeleteAction.bind(null, botId)}>
          <input type="hidden" name="ids" value={selectedCsv} />
          <button className="btn btn-sm btn-danger" type="submit" disabled={selected.size === 0}><i className="fa-solid fa-trash" /> Delete selected</button>
        </form>
      </div>

      <ul className="qa-list qa-sortable" data-parent-id="0" data-offset={offset}>
        {roots.length ? roots.map(renderNode) : <li className="muted">No Q&amp;A yet. Try Auto-train above, or add chained questions for an Airtel-style menu.</li>}
      </ul>

      {total > 0 && pages > 1 && (
        <nav className="qa-pagination">
          <Link className={`btn btn-sm${page <= 1 ? " disabled" : ""}`} href={page <= 1 ? "#" : `/bots/${botId}/knowledge?page=${page - 1}`}>
            <i className="fa-solid fa-chevron-left" /> Prev
          </Link>
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) =>
            p === page ? (
              <span key={p} className="btn btn-sm qa-page-current">{p}</span>
            ) : (
              <Link key={p} className="btn btn-sm" href={`/bots/${botId}/knowledge?page=${p}`}>{p}</Link>
            )
          )}
          <Link className={`btn btn-sm${page >= pages ? " disabled" : ""}`} href={page >= pages ? "#" : `/bots/${botId}/knowledge?page=${page + 1}`}>
            Next <i className="fa-solid fa-chevron-right" />
          </Link>
        </nav>
      )}

      {toast && (
        <div
          style={{
            position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)",
            padding: "10px 16px", borderRadius: 8, color: "#fff", fontSize: 13, zIndex: 9999,
            background: toast.kind === "error" ? "#b91c1c" : toast.kind === "success" ? "#047857" : "#1f2937",
            boxShadow: "0 8px 24px rgba(0,0,0,.18)",
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function findInTree(nodes: QaNode[], id: string): QaNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const r = findInTree(n.children, id);
    if (r) return r;
  }
  return null;
}
