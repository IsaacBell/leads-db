"use client";

import { useEffect, useState, useCallback } from "react";
import SettingsHeader from "./header";

// ---- Types ----

type SettingRow = {
  key: string;
  int_value: number | null;
  text_value: string | null;
  float_value: number | null;
  bool_value: boolean | null;
  is_secret: boolean;
  value_status: "set" | "not_set" | null;
  label: string | null;
  description: string | null;
  category: string | null;
};

type GroupedSettings = Record<string, SettingRow[]>;

// ---- Helpers ----

function settingValue(row: SettingRow): string {
  if (row.is_secret) return "";
  return (
    row.text_value ??
    row.int_value?.toString() ??
    row.float_value?.toString() ??
    (row.bool_value !== null ? row.bool_value.toString() : "")
  );
}

function setValue(row: SettingRow, val: string | boolean): Record<string, unknown> {
  if (typeof val === "boolean") return { bool_value: val };
  if (val === "") return { text_value: val };
  const num = Number(val);
  if (!Number.isNaN(num) && val.trim() !== "") {
    if (Number.isInteger(num)) return { int_value: num };
    return { float_value: num };
  }
  return { text_value: val };
}

// ---- Component ----

export default function SettingsPage() {
  const [settings, setSettings] = useState<GroupedSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "info" | "error"; message: string } | null>(null);
  const [editing, setEditing] = useState<Record<string, string | undefined>>({});

  // Admin token — read from a cookie or prompt
  const [adminToken, setAdminToken] = useState<string>("");

  useEffect(() => {
    const stored = localStorage.getItem("leadsdb_admin_token") || "";
    setAdminToken(stored);
  }, []);

  const showToast = useCallback((type: "info" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const apiHeaders = useCallback(() => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (adminToken) headers["x-admin-token"] = adminToken;
    return headers;
  }, [adminToken]);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/settings", { headers: apiHeaders() });
      if (res.status === 401) {
        setError("Unauthorized — set your admin token above.");
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSettings(data.settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [apiHeaders]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async (key: string, value: string, isSecret: boolean) => {
    setSaving(key);
    try {
      if (isSecret) {
        const res = await fetch("/api/v1/settings/secrets", {
          method: "POST",
          headers: apiHeaders(),
          body: JSON.stringify({ key, value: value || null }),
        });
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error || `HTTP ${res.status}`);
        }
      } else {
        const typed = setValue({} as SettingRow, value);
        const res = await fetch("/api/v1/settings", {
          method: "POST",
          headers: apiHeaders(),
          body: JSON.stringify({ key, ...typed }),
        });
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error || `HTTP ${res.status}`);
        }
      }
      showToast("info", `${key} saved`);
      setEditing((e) => ({ ...e, [key]: undefined }));
      fetchSettings();
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(null);
    }
  };

  const handleClear = async (key: string) => {
    setSaving(key);
    try {
      const res = await fetch("/api/v1/settings/secrets", {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ key, value: null }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast("info", `${key} cleared`);
      fetchSettings();
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Clear failed");
    } finally {
      setSaving(null);
    }
  };

  const categoryLabel: Record<string, string> = {
    scorer: "LLM Scoring (BYOK)",
    enricher: "Domain Enricher",
    promoter: "Lead Promoter",
    outreach: "Outreach Dispatch",
  };

  const categoryOrder = ["scorer", "enricher", "promoter", "outreach"];

  if (!adminToken) {
    return (
      <>
        <SettingsHeader />
        <div className="shell">
          <div className="notice">
            Settings require an admin token. Save it in your browser so you don't
            have to enter it every time.
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="text"
              placeholder="Enter admin token..."
              value={adminToken}
              onChange={(e) => {
                const v = e.target.value;
                setAdminToken(v);
                localStorage.setItem("leadsdb_admin_token", v);
              }}
              style={{
                flex: 1,
                maxWidth: 360,
                padding: "8px 10px",
                border: "1px solid var(--line)",
                font: "13px monospace",
                background: "var(--white)",
              }}
            />
            <button className="btn" onClick={() => fetchSettings()} disabled={!adminToken}>
              Connect
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SettingsHeader />
      <div className="shell">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, letterSpacing: "-.03em" }}>Settings</h1>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13 }}>
              Pipeline tuning and BYOK credentials — all stored in the database, re-read each cycle.
            </p>
          </div>
          <button className="btn btn-ghost" onClick={fetchSettings} disabled={loading}>
            Refresh
          </button>
        </div>

        {toast && (
          <div className={toast.type === "info" ? "toast-info" : "toast-error"} style={{ marginBottom: 16 }}>
            {toast.message}
          </div>
        )}

        {error && (
          <div className="notice" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        {loading && <div className="empty-state">Loading settings…</div>}

        {settings &&
          categoryOrder
            .filter((cat) => settings[cat]?.length > 0)
            .map((cat) => (
              <div className="section" key={cat}>
                <h2>{categoryLabel[cat] || cat}</h2>
                <p className="section-note">
                  {cat === "scorer" &&
                    "Configure your LLM endpoint. The scorer idles until scorer_api_url and scorer_model are set."}
                  {cat === "enricher" && "Tune DNS resolution, HTTP fetching, and batch processing."}
                  {cat === "promoter" && "Controls how scored domains become CRM records."}
                  {cat === "outreach" &&
                    "Email dispatch settings. Default transport is noop (log-only) — no email sent until you configure a real transport."}
                </p>

                <div className="setting-grid">
                  {settings[cat].map((row) => {
                    const isSecret = row.is_secret;
                    const currentValue = editing[row.key] ?? settingValue(row);

                    return (
                      <div className="setting-row" key={row.key}>
                        <div className="setting-label">
                          <strong>{row.label || row.key}</strong>
                          {row.description && <p>{row.description}</p>}
                          <code style={{ fontSize: 11, color: "var(--muted)" }}>{row.key}</code>
                        </div>
                        <div className="setting-control">
                          {isSecret ? (
                            <>
                              <input
                                type="password"
                                placeholder={
                                  row.value_status === "set"
                                    ? "•••••••• (replace)"
                                    : "(not set)"
                                }
                                value={currentValue}
                                onChange={(e) =>
                                  setEditing((ed) => ({
                                    ...ed,
                                    [row.key]: e.target.value,
                                  }))
                                }
                              />
                              <span
                                className={`status-badge ${row.value_status === "set" ? "status-set" : "status-not-set"}`}
                              >
                                {row.value_status === "set" ? "set" : "not set"}
                              </span>
                              <button
                                className="btn"
                                disabled={saving === row.key}
                                onClick={() =>
                                  handleSave(row.key, currentValue, true)
                                }
                              >
                                {saving === row.key ? "…" : "Save"}
                              </button>
                              {row.value_status === "set" && (
                                <button
                                  className="btn btn-ghost-danger"
                                  disabled={saving === row.key}
                                  onClick={() => handleClear(row.key)}
                                >
                                  Clear
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              {row.key === "outreach_transport" ? (
                                <select
                                  value={currentValue}
                                  onChange={(e) =>
                                    setEditing((ed) => ({
                                      ...ed,
                                      [row.key]: e.target.value,
                                    }))
                                  }
                                >
                                  <option value="noop">noop (log-only)</option>
                                  <option value="resend">resend</option>
                                </select>
                              ) : row.key === "scorer_threshold" ? (
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="1"
                                  value={currentValue}
                                  onChange={(e) =>
                                    setEditing((ed) => ({
                                      ...ed,
                                      [row.key]: e.target.value,
                                    }))
                                  }
                                />
                              ) : ["scorer_concurrency", "scorer_timeout", "enricher_batch_size", "enricher_concurrency", "enricher_http_timeout", "enricher_dns_timeout", "scorer_max_scored", "promoter_interval", "promoter_batch", "outreach_interval"].includes(row.key) ? (
                                <input
                                  type="number"
                                  value={currentValue}
                                  onChange={(e) =>
                                    setEditing((ed) => ({
                                      ...ed,
                                      [row.key]: e.target.value,
                                    }))
                                  }
                                />
                              ) : (
                                <input
                                  type="text"
                                  value={currentValue}
                                  onChange={(e) =>
                                    setEditing((ed) => ({
                                      ...ed,
                                      [row.key]: e.target.value,
                                    }))
                                  }
                                />
                              )}
                              <button
                                className="btn"
                                disabled={saving === row.key}
                                onClick={() =>
                                  handleSave(row.key, currentValue, false)
                                }
                              >
                                {saving === row.key ? "…" : "Save"}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

        {settings && !loading && !error && (
          <div className="notice" style={{ marginTop: 24 }}>
            <strong>DRY-RUN:</strong> The default outreach transport is{" "}
            <code>noop</code> — no email will be sent until you change
            outreach_transport to a real adapter and configure its API key.
          </div>
        )}
      </div>
    </>
  );
}
