import { useState, useEffect } from "react";
import { getAdminFeedback, getPartsAnalytics } from "./api";

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
    green:  { bg: "var(--brand-light)", text: "var(--brand)" },
    red:    { bg: "var(--accent-light)", text: "var(--accent)" },
    orange: { bg: "#fdf0eb", text: "#e05c2a" },
    blue:   { bg: "var(--brand-light)", text: "var(--brand)" },
    gray:   { bg: "var(--bg-subtle)", text: "var(--text-muted)" },
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
  if (!data || data.length === 0) return <div style={{ color: "var(--text-muted)", padding: 20 }}>No data yet</div>;
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

// ── Main Component ────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [tab, setTab] = useState("feedback");
  const [feedbackData, setFeedbackData] = useState(null);
  const [partsData, setPartsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [fbData, partsData] = await Promise.all([
          getAdminFeedback(),
          getPartsAnalytics()
        ]);
        setFeedbackData(fbData);
        setPartsData(partsData);
      } catch (e) {
        setError("Failed to load dashboard data. Check your API connection.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Styles ──
  const styles = {
    page: {
      minHeight: "100vh",
      background: "var(--bg)",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
    },
    nav: {
      background: "rgba(255,255,255,0.9)",
      backdropFilter: "blur(12px)",
      borderBottom: "1px solid var(--border)",
      padding: "0 40px",
      display: "flex", alignItems: "center", gap: 32,
      height: 64,
    },
    logo: {
      display: "flex", alignItems: "center", gap: 10,
      fontWeight: 800, fontSize: "1.1rem", color: "var(--text-primary)"
    },
    logoIcon: {
      width: 34, height: 34, background: "var(--brand)",
      borderRadius: 10, display: "flex", alignItems: "center",
      justifyContent: "center", color: "#fff", fontSize: "1rem"
    },
    adminBadge: {
      background: "var(--accent-light)", color: "var(--accent)",
      fontSize: "0.7rem", fontWeight: 700,
      padding: "2px 8px", borderRadius: 99
    },
    navTab: (active) => ({
      padding: "20px 4px",
      borderBottom: active ? "2px solid var(--brand)" : "2px solid transparent",
      color: active ? "var(--brand)" : "var(--text-secondary)",
      fontWeight: active ? 700 : 500,
      fontSize: "0.9rem", cursor: "pointer",
      transition: "all 0.2s"
    }),
    body: { padding: "32px 40px", maxWidth: 1200, margin: "0 auto" },
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

  return (
    <div style={styles.page}>
      {/* ── Nav ── */}
      <nav style={styles.nav}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>🔧</div>
          AirHome
          <span style={styles.adminBadge}>ADMIN</span>
        </div>
        <div style={{ flex: 1 }} />
        <div
          style={styles.navTab(tab === "feedback")}
          onClick={() => setTab("feedback")}
        >
          Customer Feedback
        </div>
        <div
          style={styles.navTab(tab === "parts")}
          onClick={() => setTab("parts")}
        >
          Parts Analytics
        </div>
        <div style={{
          marginLeft: 24, width: 36, height: 36,
          background: "#f3f4f6", borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.85rem", color: "#374151", fontWeight: 700, cursor: "pointer"
        }}>
          A
        </div>
      </nav>

      <div style={styles.body}>

        {/* ════════════════════════════════════════════
            TAB 1 — CUSTOMER FEEDBACK
        ════════════════════════════════════════════ */}
        {tab === "feedback" && (
          <>
            <div style={styles.heading}>Customer Feedback</div>
            <div style={styles.subheading}>All service ratings and comments from customers</div>

            {/* Stats */}
            <div style={styles.statsRow}>
              <StatCard
                label="Total Reviews"
                value={fb.total_feedback || 0}
                sub="All time"
              />
              <StatCard
                label="Average Rating"
                value={`${fb.average_rating || 0} ★`}
                sub="Across all tickets"
                accent="var(--accent)"
              />
              <StatCard
                label="Technicians Reviewed"
                value={fb.technician_summary?.length || 0}
                sub="With at least 1 review"
                accent="var(--brand)"
              />
              <StatCard
                label="5-Star Reviews"
                value={fb.feedbacks?.filter(f => f.rating === 5).length || 0}
                sub="Perfect scores"
                accent="var(--brand)"
              />
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
            TAB 2 — PARTS ANALYTICS
        ════════════════════════════════════════════ */}
        {tab === "parts" && (
          <>
            <div style={styles.heading}>Parts Analytics</div>
            <div style={styles.subheading}>Most requested spare parts across all service jobs</div>

            {/* Stats */}
            <div style={styles.statsRow}>
              <StatCard label="Total Requests" value={parts.total_requests || 0} sub="All time" />
              <StatCard label="Approved" value={parts.approved_count || 0} sub="Parts approved" accent="var(--brand)" />
              <StatCard label="Pending" value={parts.pending_count || 0} sub="Awaiting approval" accent="var(--accent)" />
              <StatCard label="Rejected" value={parts.rejected_count || 0} sub="Rejected requests" accent="var(--accent)" />
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

      </div>
    </div>
  );
}
