"use client";

import { useState } from "react";
import { botapiAddAction, botapiEditAction, botapiDeleteAction } from "@/app/actions/bots";

export interface ApiView {
  id: string;
  name: string;
  description: string;
  url: string;
  method: string;
  authType: string;
  token: string;
  headerName: string;
  keywords: string;
  enabled: boolean;
  alwaysInclude: boolean;
  useVisitorToken: boolean;
}

function AuthFields({ defaultAuth, defaultHeader, defaultToken }: { defaultAuth: string; defaultHeader: string; defaultToken: string }) {
  const [auth, setAuth] = useState(defaultAuth || "none");
  return (
    <div className="api-form-row">
      <label>
        Auth type
        <select name="auth_type" className="api-auth-type" value={auth} onChange={(e) => setAuth(e.target.value)}>
          <option value="none">None</option>
          <option value="bearer">Bearer token</option>
          <option value="header">Custom header</option>
        </select>
      </label>
      <label className="api-header-name" style={{ display: auth === "header" ? "" : "none" }}>
        Header name
        <input name="header_name" defaultValue={defaultHeader} placeholder="X-API-Key" />
      </label>
      <label className="api-token" style={{ display: auth === "none" ? "none" : "" }}>
        Token / API key
        <input name="token" type="password" defaultValue={defaultToken} placeholder="••••••" autoComplete="new-password" />
      </label>
    </div>
  );
}

function ApiAddForm({ botId }: { botId: string }) {
  return (
    <details className="api-form-wrap">
      <summary className="btn btn-primary">
        <i className="fa-solid fa-plus" /> Add new API
      </summary>
      <form action={botapiAddAction.bind(null, botId)} className="api-form">
        <label>Name <input name="name" required placeholder="Get orders" /></label>
        <label>
          Description (told to the AI)
          <textarea name="description" rows={2} placeholder="Returns the list of recent orders for the current user." />
        </label>
        <div className="api-form-row">
          <label>
            Method
            <select name="method">
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
          </label>
          <label className="api-url">URL <input name="url" type="url" required placeholder="https://api.example.com/orders" /></label>
        </div>
        <AuthFields defaultAuth="none" defaultHeader="" defaultToken="" />
        <label>
          Trigger keywords (comma separated)
          <input name="keywords" placeholder="orders, my orders, order list, status" />
          <small className="muted">Bot fetches this API only when one of these words appears in the user&apos;s message.</small>
        </label>
        <label className="check"><input type="checkbox" name="enabled" defaultChecked /> Enabled</label>
        <label className="check">
          <input type="checkbox" name="always_include" />
          <strong>Always inject for AI</strong> — fetch on every reply (ignore keywords).
        </label>
        <label className="check">
          <input type="checkbox" name="use_visitor_token" />
          <strong>Use visitor&apos;s login token</strong> — send the logged-in visitor&apos;s token instead of the stored one.
        </label>
        <button className="btn btn-primary" type="submit"><i className="fa-solid fa-plus" /> Add API</button>
      </form>
    </details>
  );
}

function ApiItem({ api }: { api: ApiView }) {
  const [editing, setEditing] = useState(false);
  const [test, setTest] = useState<string | null>(null);

  const runTest = async () => {
    setTest("…");
    try {
      const r = await fetch(`/api/apis/${api.id}/test`, { method: "POST" });
      const d = await r.json();
      if (d.error) {
        setTest(`<div class="api-test-err"><i class="fa-solid fa-circle-exclamation"></i> ${esc(d.error)}</div>`);
        return;
      }
      const cls = d.ok ? "api-test-ok" : "api-test-err";
      setTest(`<div class="${cls}"><strong>HTTP ${d.status}</strong> <small class="muted">${esc(d.content_type || "")}</small><pre>${esc(d.preview || "(empty body)")}</pre></div>`);
    } catch (e) {
      setTest(`<div class="api-test-err">${esc(String(e))}</div>`);
    }
  };

  return (
    <li className={`api-item${editing ? " editing" : ""}`}>
      <div className="api-row">
        <div className="api-info">
          <div className="api-title">
            <strong>{api.name}</strong>
            <span className={`api-method api-method-${api.method.toLowerCase()}`}>{api.method}</span>
            {!api.enabled && <span className="api-pill api-pill-off">disabled</span>}
            {api.alwaysInclude && <span className="api-pill api-pill-always"><i className="fa-solid fa-bolt" /> always</span>}
            {api.useVisitorToken && <span className="api-pill"><i className="fa-solid fa-user-lock" /> visitor token</span>}
            {api.authType !== "none" && <span className="api-pill"><i className="fa-solid fa-key" /> {api.authType}</span>}
          </div>
          <div className="api-url muted">{api.url}</div>
          {api.description && <div className="api-desc muted">{api.description}</div>}
          {api.keywords && <div className="api-keywords muted"><i className="fa-solid fa-tags" /> {api.keywords}</div>}
          {test !== null && (
            <div className="api-test-result">
              {test === "…" ? <span className="muted">Testing…</span> : <div dangerouslySetInnerHTML={{ __html: test }} />}
            </div>
          )}
        </div>
        <div className="api-actions">
          <button className="btn btn-icon btn-sm" type="button" title="Test" onClick={runTest}><i className="fa-solid fa-vial" /></button>
          <button className="btn btn-icon btn-sm" type="button" title="Edit" onClick={() => setEditing(true)}><i className="fa-solid fa-pen-to-square" /></button>
          <form action={botapiDeleteAction.bind(null, api.id)} className="inline">
            <button className="btn btn-icon btn-sm btn-danger" type="submit" title="Delete"><i className="fa-solid fa-trash" /></button>
          </form>
        </div>
      </div>
      <form className="api-edit-form" action={botapiEditAction.bind(null, api.id)}>
        <label>Name <input name="name" defaultValue={api.name} required /></label>
        <label>Description <textarea name="description" rows={2} defaultValue={api.description} /></label>
        <div className="api-form-row">
          <label>
            Method
            <select name="method" defaultValue={api.method}>
              {["GET", "POST", "PUT", "DELETE"].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label className="api-url">URL <input name="url" type="url" defaultValue={api.url} required /></label>
        </div>
        <AuthFields defaultAuth={api.authType} defaultHeader={api.headerName} defaultToken={api.token} />
        <label>Keywords <input name="keywords" defaultValue={api.keywords} /></label>
        <label className="check"><input type="checkbox" name="enabled" defaultChecked={api.enabled} /> Enabled</label>
        <label className="check"><input type="checkbox" name="always_include" defaultChecked={api.alwaysInclude} /> Always inject for AI (ignore keywords)</label>
        <label className="check"><input type="checkbox" name="use_visitor_token" defaultChecked={api.useVisitorToken} /> Use visitor&apos;s login token (per-user data)</label>
        <div className="actions">
          <button className="btn btn-primary btn-sm" type="submit"><i className="fa-solid fa-check" /> Save</button>
          <button className="btn btn-sm" type="button" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </form>
    </li>
  );
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export default function BotApisSection({ botId, apis }: { botId: string; apis: ApiView[] }) {
  return (
    <>
      <h2><i className="fa-solid fa-plug" /> External APIs</h2>
      <p className="muted">
        Add API endpoints so the bot can fetch live data (orders, users, status, etc.) and ground its replies on that
        response. Trigger an API by entering keywords that match user questions.
      </p>
      <ApiAddForm botId={botId} />
      {apis.length ? (
        <ul className="api-list">
          {apis.map((api) => <ApiItem key={api.id} api={api} />)}
        </ul>
      ) : (
        <p className="muted"><small>No APIs yet. Add one above and the bot will be able to fetch live data when triggered by matching keywords.</small></p>
      )}
    </>
  );
}
