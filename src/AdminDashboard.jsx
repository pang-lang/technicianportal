import { useState, useEffect } from "react";
import { getAdminFeedback, getPartsAnalytics } from "./api";

// ── Helpers ──────────────────────────────────────────────────────────────────

function StarRating({ rating }) {
  return (
    <span style={{ color: "#f59e0b", fontSize: "1rem", letterSpacing: "1px" }}>
      {"★".repeat(Math.round(rating))}{"☆".repeat(5 - Math.round(rating))}
      <span style={{ color: "#6b7280", fontSize: "0.8rem", marginLeft: 6 }}>
        {rating.toFixed(1)}
      </span>
    </span>
  );
}

function Badge({ label, color }) {
  const colors = {
    green:  { bg: "#dcfce7", text: "#16a34a" },
    red:    { bg: "#fee2e2", text: "#dc2626" },
    orange: { bg: "#ffedd5", text: "#ea580c" },
    blue:   { bg: "#dbeafe", text: "#2563eb" },
    gray:   { bg: "#f3f4f6", text: "#6b7280" },
  };
  const c = colors[color] || colors.gray;
  return (
    <span style={{
      background: c.bg, color: c.text,
      padding: "2px 10px", borderRadius: 99,
      fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.05em"
    }}>
      {label}
    </span>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #e5e7eb",
      borderRadius: 16, padding: "24px 28px", flex: 1, minWidth: 160,
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)"
    }}>
      <div style={{ fontSize: "0.75rem", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: "2rem", fontWeight: 800, color: accent || "#111827" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: "0.78rem", color: "#6b7280", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// Simple bar chart — no library needed
function BarChart({ data }) {
  if (!data || data.length === 0) return <div style={{ color: "#9ca3af", padding: 20 }}>No data yet</div>;
  const max = Math.max(...data.map(d => d.count));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data.slice(0, 8).map((item, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 140, fontSize: "0.8rem", color: "#374151", textAlign: "right", flexShrink: 0 }}>
            {item.part_name}
          </div>
          <div style={{ flex: 1, background: "#f3f4f6", borderRadius: 99, height: 22, overflow: "hidden" }}>
            <div style={{
              width: `${(item.count / max) * 100}%`,
              background: "linear-gradient(90deg, #1d4ed8, #3b82f6)",
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
      background: "#f9fafb",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    },
    nav: {
      background: "#fff",
      borderBottom: "1px solid #e5e7eb",
      padding: "0 40px",
      display: "flex", alignItems: "center", gap: 32,
      height: 64,
    },
    logo: {
      display: "flex", alignItems: "center", gap: 10,
      fontWeight: 800, fontSize: "1.1rem", color: "#111827"
    },
    logoIcon: {
      width: 34, height: 34, background: "#1d4ed8",
      borderRadius: 10, display: "flex", alignItems: "center",
      justifyContent: "center", color: "#fff", fontSize: "1rem"
    },
    adminBadge: {
      background: "#fef3c7", color: "#92400e",
      fontSize: "0.7rem", fontWeight: 700,
      padding: "2px 8px", borderRadius: 99
    },
    navTab: (active) => ({
      padding: "20px 4px",
      borderBottom: active ? "2px solid #1d4ed8" : "2px solid transparent",
      color: active ? "#1d4ed8" : "#6b7280",
      fontWeight: active ? 700 : 500,
      fontSize: "0.9rem", cursor: "pointer",
      transition: "all 0.2s"
    }),
    body: { padding: "32px 40px", maxWidth: 1200, margin: "0 auto" },
    heading: { fontSize: "1.6rem", fontWeight: 800, color: "#111827", marginBottom: 4 },
    subheading: { fontSize: "0.9rem", color: "#6b7280", marginBottom: 28 },
    statsRow: { display: "flex", gap: 16, marginBottom: 32, flexWrap: "wrap" },
    card: {
      background: "#fff", border: "1px solid #e5e7eb",
      borderRadius: 16, padding: 28,
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)", marginBottom: 24
    },
    cardTitle: { fontSize: "1rem", fontWeight: 700, color: "#111827", marginBottom: 20 },
    table: { width: "100%", borderCollapse: "collapse" },
    th: {
      textAlign: "left", fontSize: "0.72rem", fontWeight: 700,
      color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em",
      padding: "8px 12px", borderBottom: "1px solid #f3f4f6"
    },
    td: {
      padding: "14px 12px", fontSize: "0.85rem", color: "#374151",
      borderBottom: "1px solid #f9fafb", verticalAlign: "top"
    },
  };

  if (loading) return (
    <div style={{ ...styles.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", color: "#6b7280" }}>
        <div style={{ fontSize: "2rem", marginBottom: 12 }}>⏳</div>
        Loading dashboard...
      </div>
    </div>
  );

  if (error) return (
    <div style={{ ...styles.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", color: "#dc2626", maxWidth: 400 }}>
        <div style={{ fontSize: "2rem", marginBottom: 12 }}>⚠️</div>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Connection Error</div>
        <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>{error}</div>
        <div style={{ marginTop: 12, fontSize: "0.8rem", color: "#9ca3af" }}>
          Make sure <code>API_BASE</code> is set to your deployed API URL
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
                accent="#f59e0b"
              />
              <StatCard
                label="Technicians Reviewed"
                value={fb.technician_summary?.length || 0}
                sub="With at least 1 review"
                accent="#1d4ed8"
              />
              <StatCard
                label="5-Star Reviews"
                value={fb.feedbacks?.filter(f => f.rating === 5).length || 0}
                sub="Perfect scores"
                accent="#16a34a"
              />
            </div>

            {/* Technician Leaderboard */}
            <div style={styles.card}>
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
                          <span style={{ fontWeight: 700, color: i === 0 ? "#f59e0b" : "#9ca3af" }}>
                            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span style={{ fontWeight: 600, color: "#1d4ed8" }}>{tech.tech_id}</span>
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
                      <td colSpan={5} style={{ ...styles.td, textAlign: "center", color: "#9ca3af" }}>
                        No technician data yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* All Feedback Comments */}
            <div style={styles.card}>
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
                        <span style={{ fontWeight: 600, color: "#1d4ed8", fontSize: "0.8rem" }}>
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
                      <td style={{ ...styles.td, maxWidth: 300, color: "#374151", fontSize: "0.82rem" }}>
                        {f.comment || <span style={{ color: "#d1d5db" }}>No comment</span>}
                      </td>
                      <td style={{ ...styles.td, color: "#9ca3af", fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                        {f.created_at ? new Date(f.created_at).toLocaleDateString("en-MY", {
                          day: "numeric", month: "short", year: "numeric"
                        }) : "—"}
                      </td>
                    </tr>
                  ))}
                  {(!fb.feedbacks || fb.feedbacks.length === 0) && (
                    <tr>
                      <td colSpan={5} style={{ ...styles.td, textAlign: "center", color: "#9ca3af" }}>
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
              <StatCard label="Approved" value={parts.approved_count || 0} sub="Parts approved" accent="#16a34a" />
              <StatCard label="Pending" value={parts.pending_count || 0} sub="Awaiting approval" accent="#f59e0b" />
              <StatCard label="Rejected" value={parts.rejected_count || 0} sub="Rejected requests" accent="#dc2626" />
            </div>

            {/* Bar Chart */}
            <div style={styles.card}>
              <div style={styles.cardTitle}>📊 Most Requested Parts (Top 8)</div>
              <BarChart data={parts.parts_ranking || []} />
            </div>

            {/* Full Table */}
            <div style={styles.card}>
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
                        <span style={{ fontWeight: 700, color: "#9ca3af" }}>#{i + 1}</span>
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
                      <td colSpan={4} style={{ ...styles.td, textAlign: "center", color: "#9ca3af" }}>
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
