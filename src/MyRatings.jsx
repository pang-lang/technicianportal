import { useState, useEffect } from "react";
import { getTechFeedback } from "./api";

function StarRating({ rating }) {
  return (
    <span style={{ color: "var(--accent)", fontSize: "1rem" }}>
      {"★".repeat(Math.round(rating))}{"☆".repeat(5 - Math.round(rating))}
      <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginLeft: 6 }}>
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

  if (loading) return (
    <div className="card animate-in" style={{ textAlign: "center", padding: "60px 20px" }}>
      <div style={{ width: 40, height: 40, border: "3px solid var(--border)", borderTopColor: "var(--brand)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
      <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading your ratings...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
  
  if (!data) return (
    <div className="card animate-in" style={{ background: "var(--accent-light)", border: "1px solid rgba(224,92,42,0.2)", padding: "20px" }}>
      <div style={{ color: "var(--accent)", fontWeight: 600 }}>Could not load ratings.</div>
    </div>
  );

  return (
    <div className="animate-in">
      {/* Summary card */}
      <div className="card mb-16" style={{ display: "flex", gap: 32, alignItems: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div className="stat-value" style={{ lineHeight: 1 }}>
            {data.average_rating}
          </div>
          <StarRating rating={data.average_rating} />
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4 }}>
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
                <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", width: 12 }}>{star}</span>
                <span style={{ color: "var(--accent)", fontSize: "0.8rem" }}>★</span>
                <div style={{ flex: 1, background: "var(--bg-subtle)", borderRadius: 99, height: 8 }}>
                  <div style={{
                    width: `${pct}%`, background: "var(--accent)",
                    height: "100%", borderRadius: 99, transition: "width 0.6s ease"
                  }} />
                </div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", width: 20 }}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Individual feedback */}
      <h3 className="display-font mb-16" style={{ fontSize: 20 }}>Customer Comments</h3>
      {data.feedbacks.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "48px", color: "var(--text-muted)" }}>
          No feedback yet. Complete more jobs to get reviews!
        </div>
      )}
      {data.feedbacks.map((f) => (
        <div key={f.feedback_id} className="card mb-16">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <StarRating rating={f.rating} />
            <span className="mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              {f.ticket_id} · {f.created_at ? new Date(f.created_at).toLocaleDateString("en-MY") : ""}
            </span>
          </div>
          {/* Tags */}
          {f.tags?.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {f.tags.map((tag, i) => (
                <span key={i} className="badge" style={{
                  background: "var(--brand-light)", color: "var(--brand)"
                }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
          {f.comment && (
            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontStyle: "italic" }}>
              "{f.comment}"
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
