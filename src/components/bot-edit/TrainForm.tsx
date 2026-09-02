"use client";

import { useState } from "react";

interface Opt {
  id: string;
  question: string;
  parentId: string | null;
}
interface Pair {
  question: string;
  answer: string;
}

const EXAMPLE = `[
  {
    "question": "What are your pricing plans?",
    "answer": "We offer Free, Pro, and Enterprise plans.",
    "keywords": "price,pricing,plan"
  },
  {
    "question": "I have an issue with my bill",
    "answer": "Please choose what you need help with:",
    "keywords": "bill,billing",
    "children": [
      { "question": "Payment due", "answer": "Your latest bill is due on the 25th." },
      { "question": "Payment failed", "answer": "Failed transactions reverse in 3-5 days." }
    ]
  }
]`;

export default function TrainForm({
  botId,
  trainedFromUrl,
  options,
}: {
  botId: string;
  trainedFromUrl: string;
  options: Opt[];
}) {
  const [tab, setTab] = useState<"url" | "json">("url");
  const [parentId, setParentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ message: string; category: string } | null>(null);
  const [result, setResult] = useState<Pair[] | null>(null);
  const [preview, setPreview] = useState<Pair[] | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>, mode: "url" | "json") => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("mode", mode);
    fd.set("parent_id", parentId);
    setBusy(true);
    setFlash(null);
    setPreview(null);
    try {
      const r = await fetch(`/api/bots/${botId}/train`, { method: "POST", body: fd });
      const d = await r.json();
      setFlash({ message: d.message || (d.error ?? "Done"), category: d.category || (d.ok ? "success" : "error") });
      if (d.ok && d.preview && Array.isArray(d.result)) {
        setPreview(d.result as Pair[]);
        setResult(null);
      } else {
        setResult(d.result || null);
      }
    } catch {
      setFlash({ message: "Network error", category: "error" });
    } finally {
      setBusy(false);
    }
  };

  const savePreview = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!preview || !preview.length) return;
    const fd = new FormData();
    fd.set("mode", "pdf-save");
    fd.set("parent_id", parentId);
    fd.set("pairs", JSON.stringify(preview));
    setBusy(true);
    setFlash(null);
    try {
      const r = await fetch(`/api/bots/${botId}/train`, { method: "POST", body: fd });
      const d = await r.json();
      setFlash({ message: d.message || (d.error ?? "Done"), category: d.category || (d.ok ? "success" : "error") });
      setResult(d.ok ? d.result || null : null);
      setPreview(null);
    } catch {
      setFlash({ message: "Network error", category: "error" });
    } finally {
      setBusy(false);
    }
  };

  const parentLabel = parentId ? options.find((o) => o.id === parentId)?.question.slice(0, 60) || "—" : "— Top level —";

  return (
    <>
      {flash && <div className={`flash flash-${flash.category}`}>{flash.message}</div>}

      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="train-parent-row">
          <strong>Place all extracted Q&amp;A under:</strong>
          <select value={parentId} onChange={(e) => setParentId(e.target.value)} style={{ width: "auto", minWidth: 220, margin: 0 }}>
            <option value="">— Top level —</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.parentId ? "↳ " : ""}
                {o.question.slice(0, 60)}
              </option>
            ))}
          </select>
          <small className="muted">
            URL mode: all pairs get this parent. JSON mode: top-level items get this parent; nested children stay nested.
          </small>
        </div>
      </div>

      <div className="panel">
        <div className="tabs">
          <button type="button" className={`tab-btn${tab === "url" ? " active" : ""}`} onClick={() => setTab("url")}>
            <i className="fa-solid fa-link" /> From URL
          </button>
          <button type="button" className={`tab-btn${tab === "json" ? " active" : ""}`} onClick={() => setTab("json")}>
            <i className="fa-solid fa-file-import" /> From PDF / JSON
          </button>
        </div>

        {tab === "url" && (
          <div className="tab-pane active">
            <p className="muted">
              Paste a public URL — your FAQ page, product page, About page — and the AI will read it and generate Q&amp;A pairs
              for your bot&apos;s knowledge base automatically.
            </p>
            <form className="train-form" onSubmit={(e) => submit(e, "url")}>
              <label>URL <input name="url" type="url" required defaultValue={trainedFromUrl} placeholder="https://example.com/faq" /></label>
              <label>Max Q&amp;A pairs to extract <input name="max_pairs" type="number" min={1} max={20} defaultValue={8} /></label>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? <><i className="fa-solid fa-circle-notch fa-spin" /> Extracting…</> : <><i className="fa-solid fa-wand-magic-sparkles" /> Extract &amp; add to knowledge base</>}
              </button>
            </form>
            {trainedFromUrl && (
              <p className="muted"><small>Last trained from: <a href={trainedFromUrl} target="_blank" rel="noopener">{trainedFromUrl}</a></small></p>
            )}
          </div>
        )}

        {tab === "json" && (
          <div className="tab-pane active">
            <p className="muted">
              Fine-tune your bot from a <strong>PDF</strong> or <strong>JSON</strong> file. Upload a <code>.pdf</code> to
              auto-extract Q&amp;A pairs, or a <code>.json</code> file / paste JSON below for exact flat or nested Q&amp;A.
            </p>
            <details className="qa-list" style={{ marginBottom: 12 }}>
              <summary className="muted"><strong>Show example JSON</strong></summary>
              <pre><code>{EXAMPLE}</code></pre>
              <p className="muted"><small>Also accepts shorthand keys (<code>q</code>, <code>a</code>, <code>kw</code>) and a wrapper object like <code>{`{"data": [...]}`}</code>.</small></p>
            </details>
            <form className="train-form" onSubmit={(e) => submit(e, "json")}>
              <label>Upload PDF or JSON file <input name="file" type="file" accept=".pdf,.json,application/pdf,application/json" /></label>
              <small className="muted">Accepted formats: PDF, JSON</small>
              <label>…or paste JSON here
                <textarea name="data" rows={10} placeholder='[{"question":"...","answer":"..."}]' style={{ fontFamily: "ui-monospace, Consolas, monospace", fontSize: 13 }} />
              </label>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? <><i className="fa-solid fa-circle-notch fa-spin" /> Importing…</> : <><i className="fa-solid fa-file-import" /> Fine-tune from PDF / JSON</>}
              </button>
            </form>
            {preview && preview.length > 0 && (
              <div className="qa-list" style={{ marginTop: 16 }}>
                <h3><i className="fa-solid fa-file-pdf" /> Extracted {preview.length} Q&amp;A pair{preview.length !== 1 ? "s" : ""} from your PDF</h3>
                <ul>
                  {preview.map((p, i) => (
                    <li key={i}><strong>Q:</strong> {p.question}<br /><strong>A:</strong> {p.answer}</li>
                  ))}
                </ul>
                <form className="train-form" onSubmit={savePreview} style={{ marginTop: 12 }}>
                  <button className="btn btn-primary" type="submit" disabled={busy}>
                    {busy ? <><i className="fa-solid fa-circle-notch fa-spin" /> Saving…</> : <><i className="fa-solid fa-check" /> Save to knowledge base</>}
                  </button>
                  <button className="btn btn-sm" type="button" style={{ marginLeft: 8 }} onClick={() => setPreview(null)} disabled={busy}>Discard</button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="muted" style={{ marginTop: 8 }}><small>Target location: <strong>{parentLabel}</strong></small></p>

      {result && result.length > 0 && (
        <div className="panel">
          <h2><i className="fa-solid fa-check-circle" /> Added to knowledge base</h2>
          <ul className="qa-list">
            {result.map((p, i) => (
              <li key={i}><strong>Q:</strong> {p.question}<br /><strong>A:</strong> {p.answer}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
