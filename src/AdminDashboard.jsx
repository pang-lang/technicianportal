import { useState, useEffect, useCallback } from "react";
import { getAdminFeedback, getPartsAnalytics, fetchPendingApprovals, approveOrRejectParts, fetchApprovalHistory, fetchKPISummary } from "./api";
import { TicketDocumentsReview } from "./ServiceReportSubmit";

// ── Helpers ──────────────────────────────────────────────────────────────────

function StarRating({ rating }) {
  return (
    <span style={{ color: "var(--accent)", fontSize: "1rem", letterSpacing: "1px" }}>
      {"★".repeat(Math.round(rating))}{"☆".repeat(5 - Math.round(rating))}
      <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginLeft: 6 }}>
        {rating.toFixed(1)}
      </span>
    </span>
  );
}

function Badge({ label, color }) {
  const colors = {
    green: { bg: "var(--brand-light)", text: "var(--brand)" },
    red: { bg: "var(--accent-light)", text: "var(--accent)" },
    orange: { bg: "#fdf0eb", text: "#e05c2a" },
    blue: { bg: "var(--brand-light)", text: "var(--brand)" },
    gray: { bg: "var(--bg-subtle)", text: "var(--text-muted)" },
  };
  const c = colors[color] || colors.gray;
  return (
    <span className="badge" style={{ background: c.bg, color: c.text }}>
      {label}
    </span>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 160 }}>
      <div className="stat-label" style={{ marginTop: 0, marginBottom: 6 }}>
        {label}
      </div>
      <div className="stat-value" style={{ color: accent || "var(--text-primary)" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// Simple bar chart — no library needed
function BarChart({ data }) {
  if (!data || data.length === 0) return (
    <div style={{ color: "var(--text-muted)", padding: 20, fontSize: 13 }}>
      No repair history yet — chart will populate after technicians log faults on jobs.
    </div>
  );
  const max = Math.max(...data.map(d => d.count));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data.slice(0, 8).map((item, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 140, fontSize: "0.8rem", color: "var(--text-secondary)", textAlign: "right", flexShrink: 0 }}>
            {item.part_name}
          </div>
          <div style={{ flex: 1, background: "var(--bg-subtle)", borderRadius: 99, height: 22, overflow: "hidden" }}>
            <div style={{
              width: `${(item.count / max) * 100}%`,
              background: "var(--brand)",
              height: "100%", borderRadius: 99,
              transition: "width 0.8s ease",
              display: "flex", alignItems: "center", paddingLeft: 10
            }}>
              <span style={{ color: "#fff", fontSize: "0.72rem", fontWeight: 700 }}>{item.count}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────
const Icon = {
  tool: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>,
  refresh: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>,
  mail: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>,
  check: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 16, height: 16 }}><polyline points="20 6 9 17 4 12" /></svg>,
  back: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}><polyline points="15 18 9 12 15 6" /></svg>,
};

// ── Stock Config ─────────────────────────────────────────────────────────────
const STOCK_CFG = {
  AVAILABLE: { label: "AVAILABLE", color: "#16a34a", bg: "#dcfce7" },
  LOW: { label: "LOW STOCK", color: "#e05c2a", bg: "#fdf0eb" },
  OUT: { label: "OUT OF STOCK", color: "#e11d48", bg: "#ffe4e6" },
  UNKNOWN: { label: "UNKNOWN", color: "#9c9590", bg: "#f3f1ee" },
};

// ── Divider Component ────────────────────────────────────────────────────────
function Divider({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
      <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
      <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)" }}>{label}</span>
      <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
    </div>
  );
}

// ── Parts Approval Tab Component ─────────────────────────────────────────────
function PartsApprovalTab({ partsData: stats }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acting, setActing] = useState({});
  const [toasts, setToasts] = useState([]);

  const addToast = (msg, ok = true) => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, ok }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await fetchPendingApprovals()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDecision(ticketId, approved) {
    setActing(a => ({ ...a, [ticketId]: approved ? "approving" : "rejecting" }));
    try {
      await approveOrRejectParts(ticketId, approved);
      addToast(
        approved
          ? `✅ Parts approved — technician can now proceed with the repair.`
          : `❌ Parts rejected — ticket has been cancelled.`,
        approved
      );
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setActing(a => { const n = { ...a }; delete n[ticketId]; return n; });
    }
  }

  if (loading) return (
    <div className="card animate-in" style={{ textAlign: "center", padding: "60px 20px" }}>
      <div style={{ width: 40, height: 40, border: "3px solid var(--border)", borderTopColor: "var(--brand)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
      <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading pending approvals...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error) return (
    <div className="card animate-in" style={{ background: "var(--accent-light)", border: "1px solid rgba(224,92,42,0.2)", padding: "20px" }}>
      <div style={{ fontWeight: 700, color: "var(--accent)", marginBottom: 8 }}>Something went wrong</div>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>{error}</p>
      <button className="btn btn-outline" onClick={load}>Retry</button>
    </div>
  );

  if (!data) return null;

  const { approvals } = data;

  function ApprovalCard({ a }) {
    const isActing = !!acting[a.ticketId];
    const warrantyOk = a.warrantyStatus === "UNDER_WARRANTY";
    const costHigh = a.totalCost > 500;

    // ── Reason banner logic ──
    // v1: always shows a billing note line + "all requests require manual auth"
    // v2: 3-way conditional (no warranty / high cost / safe)
    // Merged: use v2's 3-way logic for the primary message, append v1's
    // "manual authorization required" note for full clarity.
    let bannerBg, bannerColor, bannerMsg;
    if (!warrantyOk) {
      bannerBg = "var(--accent-light)";
      bannerColor = "var(--accent)";
      bannerMsg = `⚠️ Warranty expired — customer will be billed RM ${a.totalCost.toFixed(2)} for parts and labour.`;
    } else if (costHigh) {
      bannerBg = "var(--accent-light)";
      bannerColor = "var(--accent)";
      bannerMsg = `⚠️ Cost RM ${a.totalCost.toFixed(2)} exceeds RM 500 auto-approval limit.`;
    } else {
      bannerBg = "var(--brand-light)";
      bannerColor = "var(--brand)";
      bannerMsg = `✅ Under warranty and within cost limit — safe to approve at no charge to customer.`;
    }

    return (
      <div className="card mb-16 animate-in" style={{ borderLeft: `4px solid ${!warrantyOk || costHigh ? "var(--accent)" : "var(--brand)"}` }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div className="mono" style={{ fontSize: 12, color: "var(--brand)", marginBottom: 4 }}>{a.ticketId}</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>{a.customerName}</h3>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{a.subject}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
            <span className="badge" style={{ color: warrantyOk ? "var(--brand)" : "var(--accent)", background: warrantyOk ? "var(--brand-light)" : "var(--accent-light)" }}>
              {warrantyOk ? "Under Warranty" : "Warranty Expired"}
            </span>
            <span className="badge" style={{ color: costHigh ? "var(--accent)" : "var(--brand)", background: costHigh ? "var(--accent-light)" : "var(--brand-light)", fontSize: 13, fontWeight: 800 }}>
              RM {a.totalCost.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Fault */}
        {a.faultType && (
          <div style={{ padding: "10px 14px", background: "var(--bg-subtle)", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
            <span style={{ color: "var(--text-muted)", marginRight: 8 }}>Fault Diagnosed:</span>
            <strong>{a.faultType}</strong>
          </div>
        )}

        {/* Parts table */}
        <div style={{ border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden", marginBottom: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-subtle)" }}>
                <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, fontSize: 11, color: "var(--text-secondary)" }}>PART</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, fontSize: 11, color: "var(--text-secondary)" }}>STOCK</th>
                <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, fontSize: 11, color: "var(--text-secondary)" }}>QTY</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, fontSize: 11, color: "var(--text-secondary)" }}>UNIT (RM)</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, fontSize: 11, color: "var(--text-secondary)" }}>TOTAL (RM)</th>
              </tr>
            </thead>
            <tbody>
              {a.predictedParts.map((p, i) => {
                const stock = STOCK_CFG[p.stock] || STOCK_CFG.UNKNOWN;
                const qty = parseInt(p.quantity) || 1;
                const unitCost = warrantyOk ? 0 : Number(p.cost || 0);
                const lineTotal = unitCost * qty;
                return (
                  <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.partId}</div>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span className="badge" style={{ color: stock.color, background: stock.bg, fontSize: 10 }}>{stock.label}</span>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600 }}>{qty}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", color: "var(--text-secondary)" }}>{unitCost.toFixed(2)}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>{lineTotal.toFixed(2)}</td>
                  </tr>
                );
              })}
              <tr style={{ background: "var(--bg-subtle)", borderTop: "1.5px solid var(--border)" }}>
                <td colSpan={4} style={{ padding: "10px 14px", fontWeight: 700, textAlign: "right" }}>
                  {warrantyOk ? "Total (Under Warranty — No Charge)" : "Total Chargeable"}
                </td>
                <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 800, color: warrantyOk ? "#0369a1" : "var(--accent)", fontSize: 14 }}>
                  {warrantyOk ? "0.00" : a.totalCost.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Reason banner — merged: 3-way logic (v2) + manual auth note (v1) */}
        <div style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 12, background: bannerBg, color: bannerColor }}>
          {bannerMsg}
          <span style={{ display: "block", marginTop: 4, opacity: 0.75 }}>
            All parts requests require manual manager authorization.
          </span>
        </div>

        {/* Email note */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
          <Icon.mail />
          Approval sets ticket to PROCEED_JOB. The customer quotation email (if applicable) was already sent when the technician submitted it.
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} disabled={isActing} onClick={() => handleDecision(a.ticketId, true)}>
            {acting[a.ticketId] === "approving" ? "Approving..." : "✓ Approve Parts"}
          </button>
          <button className="btn btn-outline" style={{ flex: 1, color: "var(--accent)", borderColor: "var(--accent)" }} disabled={isActing} onClick={() => handleDecision(a.ticketId, false)}>
            {acting[a.ticketId] === "rejecting" ? "Rejecting..." : "✗ Reject & Cancel"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in">
      {/* Toast notifications */}
      <div style={{ position: "fixed", top: 80, right: 24, zIndex: 999, display: "flex", flexDirection: "column", gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{ padding: "12px 20px", borderRadius: 10, background: t.ok ? "var(--brand)" : "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 600, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", animation: "fadeIn 0.2s ease" }}>
            {t.msg}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h1 className="display-font" style={{ fontSize: 32, marginBottom: 4 }}>Parts Approval</h1>
          <p style={{ color: "var(--text-secondary)" }}>Review and authorize spare part requests — customers are notified by email automatically.</p>
        </div>
        <button className="btn btn-outline" style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={load}>
          <Icon.refresh /> Refresh
        </button>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
        <StatCard label="Parts in Catalogue" value={stats?.total_catalogue_parts || 0} sub="All tracked parts" />
        <StatCard label="Available" value={stats?.stock_summary?.available || 0} sub="In stock" accent="#16a34a" />
        <StatCard label="Low Stock" value={stats?.stock_summary?.low || 0} sub="Needs reorder" accent="#f59e0b" />
        <StatCard label="Out of Stock" value={stats?.stock_summary?.out || 0} sub="Urgent restock" accent="#dc2626" />
      </div>

      <Divider label="Awaiting Authorization" />

      {approvals.length > 0
        ? approvals.map(a => <ApprovalCard key={a.ticketId} a={a} />)
        : <div className="card" style={{ textAlign: "center", padding: "48px", color: "var(--text-muted)" }}>No pending approvals. All parts requests are resolved. ✅</div>}

      {/* ── Approval History — embedded below pending list ── */}
      <ApprovalHistorySection />
    </div>
  );
}


// ── Approval History Section (embedded inside Parts Approval tab) ─────────────
function ApprovalHistorySection() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [expanded, setExpanded] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await fetchApprovalHistory()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function timeAgo(iso) {
    if (!iso) return "—";
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (days > 0) return `${days}d ${h}h ago`;
    if (h > 0) return `${h}h ${m}m ago`;
    return `${m}m ago`;
  }

  const filtered = data ? data.history.filter(h => filter === "ALL" || h.decision === filter) : [];

  return (
    <div style={{ marginTop: 40 }}>
      {/* Section header — collapsible */}
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, cursor: "pointer", userSelect: "none" }}
        onClick={() => setExpanded(e => !e)}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ height: 1, width: 32, background: "var(--border)" }} />
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              Approval History
            </span>
            {data && (
              <span style={{ fontSize: 11, background: "var(--bg-subtle)", color: "var(--text-muted)", padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>
                {data.count} decisions
              </span>
            )}
            <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, marginLeft: 40 }}>Full record of approved and rejected parts requests</p>
        </div>
        <span style={{ fontSize: 18, color: "var(--text-muted)", marginLeft: 16 }}>{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div className="animate-in">
          {loading && (
            <div className="card" style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)", fontSize: 13 }}>
              Loading history...
            </div>
          )}
          {error && (
            <div className="card" style={{ background: "var(--accent-light)", color: "var(--accent)", padding: "16px", fontSize: 13 }}>
              {error} <button className="btn btn-outline" onClick={load} style={{ marginLeft: 12, padding: "4px 10px", fontSize: 11 }}>Retry</button>
            </div>
          )}
          {data && (
            <>
              {/* Filter pills */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {["ALL", "APPROVED", "REJECTED"].map(f => (
                  <button key={f} onClick={() => setFilter(f)} style={{
                    padding: "5px 14px", borderRadius: 20, border: "none", cursor: "pointer",
                    fontSize: 11, fontWeight: 700,
                    background: filter === f ? (f === "REJECTED" ? "var(--accent)" : "var(--brand)") : "var(--bg-subtle)",
                    color: filter === f ? "#fff" : "var(--text-secondary)",
                    transition: "all 0.15s",
                  }}>
                    {f === "ALL" ? `All (${data.count})` : f === "APPROVED" ? `Approved (${data.approvedCount})` : `Rejected (${data.rejectedCount})`}
                  </button>
                ))}
              </div>

              {filtered.length === 0 ? (
                <div className="card" style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)", fontSize: 13 }}>
                  No {filter !== "ALL" ? filter.toLowerCase() + " " : ""}decisions recorded yet.
                </div>
              ) : (
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "var(--bg-subtle)" }}>
                        {["TICKET", "CUSTOMER", "FAULT", "PARTS", "TOTAL", "WARRANTY", "DECISION", "DECIDED"].map(h => (
                          <th key={h} style={{ padding: "10px 14px", textAlign: h === "TOTAL" || h === "DECIDED" ? "right" : h === "DECISION" ? "center" : "left", fontWeight: 700, fontSize: 10, color: "var(--text-secondary)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((h, i) => {
                        const isApproved = h.decision === "APPROVED";
                        const warrantyOk = h.warrantyStatus === "UNDER_WARRANTY";
                        return (
                          <tr key={h.ticketId} style={{ borderTop: "1px solid var(--border)", background: i % 2 === 0 ? "#fff" : "var(--bg-subtle)" }}>
                            <td style={{ padding: "10px 14px" }}>
                              <div className="mono" style={{ fontSize: 11, color: "var(--brand)", fontWeight: 700 }}>{h.ticketId}</div>
                              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{h.finalStatus}</div>
                            </td>
                            <td style={{ padding: "10px 14px" }}>
                              <div style={{ fontWeight: 600, fontSize: 12 }}>{h.customerName}</div>
                              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{h.subject}</div>
                            </td>
                            <td style={{ padding: "10px 14px", color: "var(--text-secondary)", fontSize: 12 }}>{h.faultType || "—"}</td>
                            <td style={{ padding: "10px 14px" }}>
                              {h.predictedParts.map((p, pi) => (
                                <div key={pi} style={{ fontSize: 10, color: "var(--text-secondary)", lineHeight: 1.9 }}>• {p.name}</div>
                              ))}
                            </td>
                            <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, fontSize: 12, color: isApproved ? "var(--brand)" : "var(--text-muted)" }}>
                              {warrantyOk ? "0.00" : `RM ${h.totalCost.toFixed(2)}`}
                            </td>
                            <td style={{ padding: "10px 14px" }}>
                              <span className="badge" style={{ color: warrantyOk ? "var(--brand)" : "var(--accent)", background: warrantyOk ? "var(--brand-light)" : "var(--accent-light)", fontSize: 9 }}>
                                {warrantyOk ? "Under Warranty" : "Expired"}
                              </span>
                            </td>
                            <td style={{ padding: "10px 14px", textAlign: "center" }}>
                              <span style={{ display: "inline-block", padding: "3px 8px", borderRadius: 20, fontSize: 10, fontWeight: 800, background: isApproved ? "#dcfce7" : "#ffe4e6", color: isApproved ? "#16a34a" : "#e11d48" }}>
                                {isApproved ? "✓ APPROVED" : "✗ REJECTED"}
                              </span>
                            </td>
                            <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 10, color: "var(--text-muted)" }}>{timeAgo(h.decidedAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}


// ── Service Reports Tab ───────────────────────────────────────────────────────
// From v1 — not present in v2, added in full.
// Lets admin search by ticket ID and view the archived quotation + service report.
function ServiceReportsTab() {
  const [ticketInput, setTicketInput] = useState("");
  const [activeTicketId, setActiveTicketId] = useState(null);

  function handleSearch() {
    const trimmed = ticketInput.trim();
    if (trimmed) setActiveTicketId(trimmed);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") handleSearch();
  }

  return (
    <div className="animate-in">
      <div style={{ marginBottom: 24 }}>
        <h1 className="display-font" style={{ fontSize: 32, marginBottom: 4 }}>Service Reports</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Review archived technician service reports and customer quotations by ticket ID.
        </p>
      </div>

      {/* Ticket ID search */}
      <div className="card mb-24">
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "var(--text-primary)" }}>
          Look Up Ticket Documents
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <input
            className="form-control"
            style={{ flex: 1 }}
            placeholder="Enter Ticket ID (e.g. TKT-001234)"
            value={ticketInput}
            onChange={e => setTicketInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            className="btn btn-primary"
            onClick={handleSearch}
            disabled={!ticketInput.trim()}
            style={{ whiteSpace: "nowrap" }}
          >
            View Documents
          </button>
          {activeTicketId && (
            <button
              className="btn btn-outline"
              onClick={() => { setActiveTicketId(null); setTicketInput(""); }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Documents panel */}
      {activeTicketId ? (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 2 }}>
                Ticket
              </div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: "var(--brand)" }}>
                {activeTicketId}
              </div>
            </div>
            <button
              className="btn btn-outline"
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", fontSize: 12 }}
              onClick={() => setActiveTicketId(activeTicketId + " ")} // force re-render
            >
              <Icon.refresh /> Reload
            </button>
          </div>
          <TicketDocumentsReview ticketId={activeTicketId} />
        </div>
      ) : (
        <div style={{
          padding: "48px 24px",
          textAlign: "center",
          background: "var(--bg-subtle)",
          borderRadius: 16,
          border: "1px dashed var(--border)",
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
            Enter a Ticket ID to view its documents
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 360, margin: "0 auto" }}>
            Once a technician submits a service report or quotation, they will appear here for review and job closure.
          </p>
        </div>
      )}
    </div>
  );
}


// ── KPI Tab ───────────────────────────────────────────────────────────────────
function KPITab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null); // which phase row is open

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await fetchKPISummary()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function timeLeft(isoDeadline) {
    if (!isoDeadline) return { label: "—", over: false };
    const diff = new Date(isoDeadline).getTime() - Date.now();
    if (diff <= 0) return { label: "OVERDUE", over: true };
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    if (d > 0) return { label: `${d}d ${h}h left`, over: false };
    return { label: `${h}h left`, over: false };
  }

  function timeAgo(iso) {
    if (!iso) return "—";
    const diff = Date.now() - new Date(iso).getTime();
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (d > 0) return `${d}d ${h}h ago`;
    if (h > 0) return `${h}h ${m}m ago`;
    return `${m}m ago`;
  }

  const PHASE_KEYS = ["kpi1_appointment", "kpi2_attendance", "kpi3_completion"];
  const PHASE_ICONS = { kpi1_appointment: "📞", kpi2_attendance: "🔧", kpi3_completion: "✅" };
  const PHASE_WINDOW = { kpi1_appointment: "≤ 2 days", kpi2_attendance: "≤ 7 days", kpi3_completion: "≤ 14 days" };

  if (loading) return (
    <div className="card animate-in" style={{ textAlign: "center", padding: "60px 20px" }}>
      <div style={{ width: 40, height: 40, border: "3px solid var(--border)", borderTopColor: "var(--brand)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
      <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading KPI data...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error) return (
    <div className="card animate-in" style={{ background: "var(--accent-light)", padding: 20 }}>
      <div style={{ fontWeight: 700, color: "var(--accent)", marginBottom: 8 }}>Failed to load KPI data</div>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>{error}</p>
      <button className="btn btn-outline" onClick={load}>Retry</button>
    </div>
  );

  if (!data) return null;

  return (
    <div className="animate-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 className="display-font" style={{ fontSize: 32, marginBottom: 4 }}>KPI Tracker</h1>
          <p style={{ color: "var(--text-secondary)" }}>
            Service phase compliance across {data.total_tickets} active tickets
          </p>
        </div>
        <button className="btn btn-outline" style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={load}>
          <Icon.refresh /> Refresh
        </button>
      </div>

      {/* Phase summary cards */}
      <div style={{ display: "flex", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
        {PHASE_KEYS.map(pk => {
          const p = data.phases[pk];
          const rate = p.compliance_rate;
          const rateColor = rate === null ? "var(--text-muted)" : rate >= 80 ? "#16a34a" : rate >= 60 ? "#e05c2a" : "#e11d48";
          // Total measured = on_time + breached (pending are not yet resolved)
          const measured = (p.on_time || 0) + (p.breached || 0);
          const progressPct = measured > 0 ? Math.round(((p.on_time || 0) / measured) * 100) : (rate !== null ? rate : 0);
          return (
            <div key={pk} className="card" style={{ flex: 1, minWidth: 200, borderTop: `4px solid ${rateColor}` }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{PHASE_ICONS[pk]}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                {p.label}
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: rateColor, marginBottom: 2 }}>
                {rate !== null ? `${rate}%` : "—"}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>compliance rate</div>

              {/* Progress bar */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ height: 7, background: "var(--bg-subtle)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 99,
                    width: `${Math.min(100, progressPct)}%`,
                    background: rateColor,
                    transition: "width 0.8s ease",
                  }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>
                  <span>0%</span>
                  <span style={{ fontWeight: 700, color: rateColor }}>{progressPct}%</span>
                  <span>100%</span>
                </div>
              </div>

              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 10 }}>{p.description}</div>
              <div style={{ marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 12, background: "#dcfce7", color: "#16a34a", fontWeight: 700 }}>✓ {p.on_time} on time</span>
                {p.breached > 0 && <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 12, background: "#ffe4e6", color: "#e11d48", fontWeight: 700 }}>✗ {p.breached} breached</span>}
                {p.pending > 0 && <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 12, background: "var(--bg-subtle)", color: "var(--text-muted)", fontWeight: 700 }}>⏳ {p.pending} pending</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Per-ticket breakdown */}
      <Divider label="Ticket Phase Breakdown" />
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--bg-subtle)" }}>
              <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, fontSize: 11, color: "var(--text-secondary)" }}>TICKET</th>
              <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, fontSize: 11, color: "var(--text-secondary)" }}>CUSTOMER</th>
              <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, fontSize: 11, color: "var(--text-secondary)" }}>
                📞 KPI 1<br/><span style={{ fontWeight: 400, opacity: 0.7 }}>Book Appt ≤2d</span>
              </th>
              <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, fontSize: 11, color: "var(--text-secondary)" }}>
                🔧 KPI 2<br/><span style={{ fontWeight: 400, opacity: 0.7 }}>Attend ≤7d</span>
              </th>
              <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, fontSize: 11, color: "var(--text-secondary)" }}>
                ✅ KPI 3<br/><span style={{ fontWeight: 400, opacity: 0.7 }}>Complete ≤14d</span>
              </th>
              <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, fontSize: 11, color: "var(--text-secondary)" }}>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {data.tickets.map((t, i) => {
              const phases = t.phases;
              function PhaseCell({ pk }) {
                const p = phases[pk];
                if (!p) return <td style={{ padding: "10px 14px", textAlign: "center" }}>—</td>;
                const tl = timeLeft(p.deadline_at);
                let bg, color, icon, detail;
                if (p.outcome === "on_time") {
                  bg = "#dcfce7"; color = "#16a34a"; icon = "✓";
                  detail = p.achieved_at ? timeAgo(p.achieved_at) : "done";
                } else if (p.outcome === "breached") {
                  bg = "#ffe4e6"; color = "#e11d48"; icon = "✗";
                  detail = p.achieved ? "late" : "overdue";
                } else {
                  bg = "var(--bg-subtle)"; color = "var(--text-muted)"; icon = "⏳";
                  detail = tl.label;
                }
                return (
                  <td style={{ padding: "10px 14px", textAlign: "center" }}>
                    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                      <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 12, background: bg, color, fontWeight: 700 }}>
                        {icon} {p.outcome === "pending" ? `${p.pct_elapsed}%` : p.outcome}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{detail}</span>
                    </div>
                  </td>
                );
              }

              const STATUS_COLOR = {
                COMPLETED: { color: "#16a34a", bg: "#dcfce7" },
                AWAITING_PARTS: { color: "#7c3aed", bg: "#f3e8ff" },
                PROCEED_JOB: { color: "#0891b2", bg: "#e0f7fa" },
                JOB_STARTED: { color: "#e05c2a", bg: "#fdf0eb" },
                APPOINTMENT_BOOKED: { color: "#0d9488", bg: "#ccfbf1" },
                ACCEPTED: { color: "#0369a1", bg: "#e0f2fe" },
              };
              const sc = STATUS_COLOR[t.status] || { color: "var(--text-muted)", bg: "var(--bg-subtle)" };

              return (
                <tr key={t.ticket_id} style={{ borderTop: "1px solid var(--border)", background: i % 2 === 0 ? "#fff" : "var(--bg-subtle)" }}>
                  <td style={{ padding: "10px 14px" }}>
                    <div className="mono" style={{ fontSize: 11, color: "var(--brand)", fontWeight: 700 }}>{t.ticket_id}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{timeAgo(t.created_at)}</div>
                  </td>
                  <td style={{ padding: "10px 14px", fontWeight: 600, fontSize: 12 }}>{t.customer_name}</td>
                  <PhaseCell pk="kpi1_appointment" />
                  <PhaseCell pk="kpi2_attendance" />
                  <PhaseCell pk="kpi3_completion" />
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 12, background: sc.bg, color: sc.color, fontWeight: 700 }}>
                      {t.status.replace(/_/g, " ")}
                    </span>
                  </td>
                </tr>
              );
            })}
            {data.tickets.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "48px", textAlign: "center", color: "var(--text-muted)" }}>
                  No active tickets to show.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// ── Main Component ────────────────────────────────────────────────────────────
// — onLogout prop from v2 (wired to Logout button instead of window.location.href)
// — ServiceReportsTab from v1 added back to nav + tab loading logic
// — "reports" tab added to the loading skip list (from v1)

export default function AdminDashboard({ onLogout }) {
  const [tab, setTab] = useState("approvals");
  const [feedbackData, setFeedbackData] = useState(null);
  const [partsData, setPartsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      // approvals and reports tabs manage their own data fetching internally
      if (tab === "approvals" || tab === "reports" || tab === "kpi") {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [fbData, partsAnalytics] = await Promise.all([
          getAdminFeedback(),
          getPartsAnalytics()
        ]);
        setFeedbackData(fbData);
        setPartsData(partsAnalytics);
      } catch (e) {
        setError("Failed to load dashboard data. Check your API connection.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tab]);

  // ── Styles ──
  const styles = {
    page: {
      minHeight: "100vh",
      background: "var(--bg)",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      display: "flex",
      flexDirection: "column",
    },
    header: {
      position: "sticky",
      top: 0,
      zIndex: 100,
      background: "rgba(255,255,255,0.9)",
      backdropFilter: "blur(12px)",
      borderBottom: "1px solid var(--border)",
    },
    nav: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      height: 68,
      gap: 32,
      maxWidth: 1000,
      margin: "0 auto",
      padding: "0 24px",
    },
    navLogo: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      cursor: "pointer",
    },
    navTab: (active) => ({
      background: "none",
      border: "none",
      padding: "20px 0",
      cursor: "pointer",
      fontSize: 14,
      fontWeight: 700,
      color: active ? "var(--brand)" : "var(--text-secondary)",
      borderBottom: active ? "2px solid var(--brand)" : "2px solid transparent",
      transition: "all 0.2s",
      display: "flex",
      alignItems: "center",
      gap: 6,
    }),
    main: {
      flex: 1,
      maxWidth: 1000,
      margin: "0 auto",
      padding: "32px 24px",
      width: "100%",
    },
    heading: { fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: 4, fontFamily: "'Fraunces', serif" },
    subheading: { fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: 28 },
    statsRow: { display: "flex", gap: 16, marginBottom: 32, flexWrap: "wrap" },
    cardTitle: { fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 20 },
    table: { width: "100%", borderCollapse: "collapse" },
    th: {
      textAlign: "left", fontSize: "0.72rem", fontWeight: 700,
      color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em",
      padding: "8px 12px", borderBottom: "1px solid var(--border)"
    },
    td: {
      padding: "14px 12px", fontSize: "0.85rem", color: "var(--text-secondary)",
      borderBottom: "1px solid var(--bg-subtle)", verticalAlign: "top"
    },
  };

  if (loading) return (
    <div style={{ ...styles.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="card animate-in" style={{ textAlign: "center", padding: "60px 40px" }}>
        <div style={{ width: 40, height: 40, border: "3px solid var(--border)", borderTopColor: "var(--brand)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading dashboard...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ ...styles.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="card animate-in" style={{ background: "var(--accent-light)", border: "1px solid rgba(224,92,42,0.2)", padding: "32px", textAlign: "center", maxWidth: 400 }}>
        <div style={{ fontWeight: 700, color: "var(--accent)", marginBottom: 12, fontSize: "1.1rem" }}>Connection Error</div>
        <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 12 }}>{error}</div>
        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
          Make sure <code className="mono">API_BASE</code> is set to your deployed API URL
        </div>
      </div>
    </div>
  );

  const fb = feedbackData || {};
  const parts = partsData || {};

  function NavBtn({ id, label }) {
    const active = tab === id;
    return (
      <button onClick={() => setTab(id)} style={styles.navTab(active)}>
        {label}
      </button>
    );
  }

  return (
    <div style={styles.page}>
      {/* ── Header ── */}
      <header style={styles.header}>
        <div style={styles.nav}>
          <div style={styles.navLogo} onClick={() => setTab("approvals")}>
            <img src="/fiamma_logo.png" alt="Fiamma" style={{ height: 36 }} />
          </div>

          {/* 4 tabs — approvals + reports from v1, parts + feedback present in both */}
          <nav style={{ display: "flex", gap: 32, marginLeft: 48, flex: 1 }}>
            <NavBtn id="approvals" label="Parts Approval" />
            <NavBtn id="reports" label="Service Reports" />
            <NavBtn id="kpi" label="KPI Tracker" />
            <NavBtn id="parts" label="Parts Analytics" />
            <NavBtn id="feedback" label="Customer Feedback" />
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div className="badge" style={{ background: "var(--brand-light)", color: "var(--brand)", textTransform: "none", borderRadius: 8 }}>
              <span style={{ opacity: 0.6, marginRight: 4 }}>ID:</span> ADMIN
            </div>
            {/* onLogout from v2 — proper prop instead of window.location.href */}
            <button className="btn btn-outline" style={{ padding: "6px 12px", fontSize: 12 }} onClick={onLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main style={styles.main}>

        {/* ════════════════════════════════════════════
            TAB: PARTS APPROVAL
        ════════════════════════════════════════════ */}
        {tab === "approvals" && <PartsApprovalTab partsData={parts} />}

        {/* ════════════════════════════════════════════
            TAB: SERVICE REPORTS (from v1)
        ════════════════════════════════════════════ */}
        {tab === "reports" && <ServiceReportsTab />}

        {/* ════════════════════════════════════════════
            TAB: KPI TRACKER
        ════════════════════════════════════════════ */}
        {tab === "kpi" && <KPITab />}

        {/* ════════════════════════════════════════════
            TAB: CUSTOMER FEEDBACK
        ════════════════════════════════════════════ */}
        {tab === "feedback" && (
          <>
            <div style={styles.heading}>Customer Feedback</div>
            <div style={styles.subheading}>All service ratings and comments from customers</div>

            {/* Stats */}
            <div style={styles.statsRow}>
              <StatCard label="Total Reviews" value={fb.total_feedback || 0} sub="All time" />
              <StatCard label="Average Rating" value={`${fb.average_rating || 0} ★`} sub="Across all tickets" accent="var(--accent)" />
              <StatCard label="Technicians Reviewed" value={fb.technician_summary?.length || 0} sub="With at least 1 review" accent="var(--brand)" />
              <StatCard label="5-Star Reviews" value={fb.feedbacks?.filter(f => f.rating === 5).length || 0} sub="Perfect scores" accent="var(--brand)" />
            </div>

            {/* Technician Leaderboard */}
            <div className="card mb-16">
              <div style={styles.cardTitle}>🏆 Technician Performance</div>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>#</th>
                    <th style={styles.th}>Technician ID</th>
                    <th style={styles.th}>Avg Rating</th>
                    <th style={styles.th}>Reviews</th>
                    <th style={styles.th}>Performance</th>
                  </tr>
                </thead>
                <tbody>
                  {(fb.technician_summary || [])
                    .sort((a, b) => b.average_rating - a.average_rating)
                    .map((tech, i) => (
                      <tr key={tech.tech_id}>
                        <td style={styles.td}>
                          <span style={{ fontWeight: 700, color: i === 0 ? "var(--accent)" : "var(--text-muted)" }}>
                            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span className="mono" style={{ fontWeight: 600, color: "var(--brand)" }}>{tech.tech_id}</span>
                        </td>
                        <td style={styles.td}><StarRating rating={tech.average_rating} /></td>
                        <td style={styles.td}>{tech.feedback_count} reviews</td>
                        <td style={styles.td}>
                          <Badge
                            label={tech.average_rating >= 4.5 ? "Excellent" : tech.average_rating >= 3.5 ? "Good" : "Needs Improvement"}
                            color={tech.average_rating >= 4.5 ? "green" : tech.average_rating >= 3.5 ? "blue" : "red"}
                          />
                        </td>
                      </tr>
                    ))}
                  {(!fb.technician_summary || fb.technician_summary.length === 0) && (
                    <tr>
                      <td colSpan={5} style={{ ...styles.td, textAlign: "center", color: "var(--text-muted)" }}>
                        No technician data yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* All Feedback Comments */}
            <div className="card mb-16">
              <div style={styles.cardTitle}>💬 All Customer Comments</div>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Ticket ID</th>
                    <th style={styles.th}>Rating</th>
                    <th style={styles.th}>Tags</th>
                    <th style={styles.th}>Comment</th>
                    <th style={styles.th}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(fb.feedbacks || []).map((f) => (
                    <tr key={f.feedback_id}>
                      <td style={styles.td}>
                        <span className="mono" style={{ fontWeight: 600, color: "var(--brand)", fontSize: "0.8rem" }}>
                          {f.ticket_id}
                        </span>
                      </td>
                      <td style={styles.td}><StarRating rating={f.rating} /></td>
                      <td style={styles.td}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {(f.tags || []).map((tag, i) => (
                            <Badge key={i} label={tag} color="blue" />
                          ))}
                        </div>
                      </td>
                      <td style={{ ...styles.td, maxWidth: 300, color: "var(--text-secondary)", fontSize: "0.82rem" }}>
                        {f.comment || <span style={{ color: "var(--border)" }}>No comment</span>}
                      </td>
                      <td style={{ ...styles.td, color: "var(--text-muted)", fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                        {f.created_at ? new Date(f.created_at).toLocaleDateString("en-MY", {
                          day: "numeric", month: "short", year: "numeric"
                        }) : "—"}
                      </td>
                    </tr>
                  ))}
                  {(!fb.feedbacks || fb.feedbacks.length === 0) && (
                    <tr>
                      <td colSpan={5} style={{ ...styles.td, textAlign: "center", color: "var(--text-muted)" }}>
                        No feedback submitted yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════
            TAB: PARTS ANALYTICS
        ════════════════════════════════════════════ */}
        {tab === "parts" && (
          <>
            <div style={styles.heading}>Parts Analytics</div>
            <div style={styles.subheading}>Most requested spare parts across all service jobs</div>

            {/* Summary stats */}
            <div className="stats-grid" style={{ marginBottom: 16 }}>
              <div className="card" style={{ padding: "14px 16px" }}>
                <div className="stat-label" style={{ fontSize: 10 }}>Total</div>
                <div className="stat-value" style={{ fontSize: 22 }}>{parts.total_requests || 0}</div>
              </div>
              <div className="card" style={{ padding: "14px 16px" }}>
                <div className="stat-label" style={{ fontSize: 10 }}>Approved</div>
                <div className="stat-value" style={{ fontSize: 22, color: "var(--brand)" }}>{parts.approved_count || 0}</div>
              </div>
              <div className="card" style={{ padding: "14px 16px" }}>
                <div className="stat-label" style={{ fontSize: 10 }}>Rejected</div>
                <div className="stat-value" style={{ fontSize: 22, color: "var(--accent)" }}>{parts.rejected_count || 0}</div>
              </div>
              <div className="card" style={{ padding: "14px 16px" }}>
                <div className="stat-label" style={{ fontSize: 10 }}>Pending</div>
                <div className="stat-value" style={{ fontSize: 22, color: "var(--accent)" }}>{parts.pending_count || 0}</div>
              </div>
            </div>

            {/* Bar Chart */}
            <div className="card mb-16">
              <div style={styles.cardTitle}>📊 Most Requested Parts (Top 8)</div>
              <BarChart data={parts.parts_ranking || []} />
            </div>

            {/* Full Table */}
            <div className="card mb-16">
              <div style={styles.cardTitle}>📋 Full Parts Ranking</div>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Rank</th>
                    <th style={styles.th}>Part Name</th>
                    <th style={styles.th}>Times Requested</th>
                    <th style={styles.th}>Demand Level</th>
                  </tr>
                </thead>
                <tbody>
                  {(parts.parts_ranking || []).map((item, i) => (
                    <tr key={i}>
                      <td style={styles.td}>
                        <span style={{ fontWeight: 700, color: "var(--text-muted)" }}>#{i + 1}</span>
                      </td>
                      <td style={{ ...styles.td, fontWeight: 600 }}>{item.part_name}</td>
                      <td style={styles.td}>{item.count}×</td>
                      <td style={styles.td}>
                        <Badge
                          label={item.count >= 5 ? "High Demand" : item.count >= 3 ? "Medium" : "Low"}
                          color={item.count >= 5 ? "red" : item.count >= 3 ? "orange" : "gray"}
                        />
                      </td>
                    </tr>
                  ))}
                  {(!parts.parts_ranking || parts.parts_ranking.length === 0) && (
                    <tr>
                      <td colSpan={4} style={{ ...styles.td, textAlign: "center", color: "var(--text-muted)" }}>
                        No parts requests yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

      </main>

      {/* ── Footer ── */}
      <footer style={{ marginTop: 60, textAlign: "center" }}>
        <div style={{ height: 1, background: "var(--border)", marginBottom: 40 }} />
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 24px" }}>
          <img src="/footer_fiamma.png" alt="Fiamma Field Operations" style={{ maxWidth: "100%", height: "auto" }} />
        </div>
      </footer>
    </div>
  );
}