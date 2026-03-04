import { useState, useEffect } from "react";
import { getTechFeedback } from "./api";

function StarRating({ rating }) {
  return (
    <span style={{ color: "#f59e0b", fontSize: "1rem" }}>
      {"★".repeat(Math.round(rating))}{"☆".repeat(5 - Math.round(rating))}
      <span style={{ color: "#6b7280", fontSize: "0.8rem", marginLeft: 6 }}>
        {rating.toFixed(1)}
      </span>
    </span>
  );
}

// Drop this component into the technician portal
// Usage: <MyRatings techId="TECH-001" />
export default function MyRatings({ techId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!techId) return;
    getTechFeedback(techId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [techId]);

  if (loading) return <div style={{ padding: 20, color: "#9ca3af" }}>Loading your ratings...</div>;
  if (!data) return <div style={{ padding: 20, color: "#dc2626" }}>Could not load ratings.</div>;

  const card = {
    background: "#fff", border: "1px solid #e5e7eb",
    borderRadius: 16, padding: 24,
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)", marginBottom: 16
  };

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>

      {/* Summary card */}
      <div style={{ ...card, display: "flex", gap: 32, alignItems: "center", marginBottom: 24 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3rem", fontWeight: 800, color: "#111827", lineHeight: 1 }}>
            {data.average_rating}
          </div>
          <StarRating rating={data.average_rating} />
          <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: 4 }}>
            {data.total_reviews} review{data.total_reviews !== 1 ? "s" : ""}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          {/* Mini rating breakdown */}
          {[5, 4, 3, 2, 1].map(star => {
            const count = data.feedbacks.filter(f => f.rating === star).length;
            const pct = data.total_reviews > 0 ? (count / data.total_reviews) * 100 : 0;
            return (
              <div key={star} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: "0.78rem", color: "#6b7280", width: 12 }}>{star}</span>
                <span style={{ color: "#f59e0b", fontSize: "0.8rem" }}>★</span>
                <div style={{ flex: 1, background: "#f3f4f6", borderRadius: 99, height: 8 }}>
                  <div style={{
                    width: `${pct}%`, background: "#f59e0b",
                    height: "100%", borderRadius: 99, transition: "width 0.6s ease"
                  }} />
                </div>
                <span style={{ fontSize: "0.75rem", color: "#9ca3af", width: 20 }}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Individual feedback */}
      <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#374151", marginBottom: 12 }}>
        Customer Comments
      </div>
      {data.feedbacks.length === 0 && (
        <div style={{ color: "#9ca3af", fontSize: "0.85rem", padding: "16px 0" }}>
          No feedback yet. Complete more jobs to get reviews!
        </div>
      )}
      {data.feedbacks.map((f) => (
        <div key={f.feedback_id} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <StarRating rating={f.rating} />
            <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
              {f.ticket_id} · {f.created_at ? new Date(f.created_at).toLocaleDateString("en-MY") : ""}
            </span>
          </div>
          {/* Tags */}
          {f.tags?.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {f.tags.map((tag, i) => (
                <span key={i} style={{
                  background: "#dbeafe", color: "#1d4ed8",
                  fontSize: "0.72rem", fontWeight: 600,
                  padding: "2px 8px", borderRadius: 99
                }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
          {f.comment && (
            <div style={{ fontSize: "0.85rem", color: "#374151", fontStyle: "italic" }}>
              "{f.comment}"
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
