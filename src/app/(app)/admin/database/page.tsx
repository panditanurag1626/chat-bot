import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth";
import { dbStats } from "@/lib/sqlite";
import { importDbAction } from "@/app/actions/admin";
import Flash from "@/components/Flash";

export const metadata: Metadata = { title: "Database" };

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default async function DatabasePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const stats = dbStats();
  const totalRows = stats.tables.reduce((s, t) => s + t.rows, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Database</h1>
          <p className="muted">Back up, export and restore your entire platform database.</p>
        </div>
      </div>
      <Flash searchParams={sp} />

      <div className="metric-grid">
        <div className="metric"><div className="metric-icon" style={{ ["--c" as string]: "#3b82f6" }}><i className="fa-solid fa-database" /></div><div className="metric-body"><div className="metric-value">{fmtSize(stats.sizeBytes)}</div><div className="metric-label">Database size</div></div></div>
        <div className="metric"><div className="metric-icon" style={{ ["--c" as string]: "#8b5cf6" }}><i className="fa-solid fa-table" /></div><div className="metric-body"><div className="metric-value">{stats.tables.length}</div><div className="metric-label">Tables</div></div></div>
        <div className="metric"><div className="metric-icon" style={{ ["--c" as string]: "#10b981" }}><i className="fa-solid fa-list-ol" /></div><div className="metric-body"><div className="metric-value">{totalRows.toLocaleString()}</div><div className="metric-label">Total rows</div></div></div>
      </div>

      <div className="two-col">
        {/* Export */}
        <section className="panel">
          <h2><i className="fa-solid fa-download" /> Export / Backup</h2>
          <p className="muted">Download a full <strong>JSON</strong> snapshot of every table. Keep this file safe — it can restore the whole platform.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
            <a className="btn btn-primary" href="/api/admin/db/export" download><i className="fa-solid fa-file-code" /> Download JSON export</a>
          </div>
        </section>

        {/* Import */}
        <section className="panel">
          <h2><i className="fa-solid fa-upload" /> Import / Restore</h2>
          <div className="alert-banner" style={{ marginBottom: 14 }}>
            <i className="fa-solid fa-triangle-exclamation" />
            <span>Importing <strong>replaces all current data</strong> with the uploaded JSON. A safety JSON backup of your current data is saved automatically first.</span>
          </div>
          <form action={importDbAction}>
            <label>Choose a JSON export file
              <input type="file" name="file" accept=".json,application/json" required />
            </label>
            <div className="form-actions">
              <button className="btn btn-danger" type="submit"><i className="fa-solid fa-upload" /> Import &amp; restore</button>
            </div>
          </form>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head"><h2><i className="fa-solid fa-table-list" /> Tables</h2></div>
        <div className="table-wrap">
          <table className="table table-pro">
            <thead><tr><th>Table</th><th style={{ textAlign: "right" }}>Rows</th></tr></thead>
            <tbody>
              {stats.tables.map((t) => (
                <tr key={t.name}>
                  <td><i className="fa-solid fa-table muted" style={{ marginRight: 8 }} />{t.name}</td>
                  <td style={{ textAlign: "right" }}>{t.rows.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
