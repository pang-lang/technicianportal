import { useState, useEffect, useCallback, useRef } from "react";
import AdminDashboard from "./AdminDashboard";
import MyRatings from "./MyRatings";
import { ServiceReportSubmitView, TicketDocumentsReview } from "./ServiceReportSubmit";
import {
  fetchJobs,
  fetchJobDetail,
  updateJobStatus,
  logFault as apiLogFault,
  approveParts as apiApproveParts,
  completeJob as apiCompleteJob,
  fetchEscalations,
  submitQuotation as apiSubmitQuotation,
  submitServiceReport,
  acceptOrRejectTicket as apiAcceptOrReject,
  bookAppointment as apiBookAppointment,
} from "./api";

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}d ${h}h ago`;
  if (h > 0) return `${h}h ${m}m ago`;
  return `${m}m ago`;
}

function timeLeft(iso) {
  if (!iso) return { label: "N/A", over: false };
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return { label: "OVERDUE", over: true };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return { label: `${h}h ${m}m left`, over: false };
}

function slaPercent(createdAt, deadlineAt) {
  if (!createdAt || !deadlineAt) return 0;
  const total = new Date(deadlineAt) - new Date(createdAt);
  const elapsed = Date.now() - new Date(createdAt);
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}

// ── Status / urgency / stock configs ─────────────────────────────────────────
const STATUS_CFG = {
  PENDING_ACCEPTANCE: { label: "Pending Acceptance", color: "#b45309", bg: "#fef3c7" },
  ACCEPTED:           { label: "Accepted",            color: "#0369a1", bg: "#e0f2fe" },
  APPOINTMENT_BOOKED: { label: "Appointment Booked",  color: "#0d9488", bg: "#ccfbf1" },
  ASSIGNED:           { label: "Pending Acceptance",  color: "#b45309", bg: "#fef3c7" }, // legacy
  JOB_STARTED:        { label: "Job Started",         color: "#e05c2a", bg: "#fdf0eb" },
  AWAITING_PARTS:     { label: "Awaiting Parts",      color: "#7c3aed", bg: "#f3e8ff" },
  PROCEED_JOB:        { label: "Proceed Job",         color: "#0891b2", bg: "#e0f7fa" },
  COMPLETED:          { label: "Completed",           color: "#16a34a", bg: "#dcfce7" },
  CANCELLED:          { label: "Cancelled",           color: "#9c9590", bg: "#f3f1ee" },
  Open:               { label: "Open",                color: "#1d5fb3", bg: "#e8f0fc" },
};

const URGENCY_CFG = {
  CRITICAL: { label: "CRITICAL", color: "#e11d48", bg: "#ffe4e6" },
  STANDARD: { label: "STANDARD", color: "#e05c2a", bg: "#fdf0eb" },
  LOW:      { label: "LOW",      color: "#16a34a", bg: "#dcfce7" },
};

const STOCK_CFG = {
  AVAILABLE: { label: "AVAILABLE",   color: "#16a34a", bg: "#dcfce7" },
  LOW:       { label: "LOW STOCK",   color: "#e05c2a", bg: "#fdf0eb" },
  OUT:       { label: "OUT OF STOCK",color: "#e11d48", bg: "#ffe4e6" },
  UNKNOWN:   { label: "UNKNOWN",     color: "#9c9590", bg: "#f3f1ee" },
};

// ── Shared UI atoms ──────────────────────────────────────────────────────────
function Spinner({ message = "Loading..." }) {
  return (
    <div className="card animate-in" style={{ textAlign: "center", padding: "60px 20px" }}>
      <div style={{ width: 40, height: 40, border: "3px solid var(--border)", borderTopColor: "var(--brand)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
      <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{message}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ErrorBanner({ message, onRetry }) {
  return (
    <div className="card animate-in" style={{ background: "#ffe4e6", border: "1px solid #fecdd3", padding: "20px" }}>
      <div style={{ fontWeight: 700, color: "#e11d48", marginBottom: 8 }}>Something went wrong</div>
      <p style={{ fontSize: 13, color: "#9f1239", marginBottom: 16 }}>{message}</p>
      {onRetry && <button className="btn btn-outline" onClick={onRetry}>Retry</button>}
    </div>
  );
}

function Divider({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
      <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
      <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)" }}>{label}</span>
      <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const Icon = {
  jobs:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg>,
  alert:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
  approve: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>,
  refresh: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>,
  back:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>,
  tool:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>,
  package: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21" /><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>,
  check:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>,
  clock:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  phone:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.53 2 2 0 0 1 3.6 1.37h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.1a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 15.5l.19 1.42z" /></svg>,
  user:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  mail:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>,
};


// ══════════════════════════════════════════════════════════════════════════════
// LOGIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
function LoginPage({ onLogin }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");

  function handleLogin() {
    if (user === "hafiz" && pass === "demo123") {
      onLogin("technician");
    } else if (user === "admin" && pass === "demo123") {
      onLogin("admin");
    } else {
      setError("Invalid credentials. Use hafiz/demo123 (Technician) or admin/demo123 (Admin)");
    }
  }

  return (
    <div className="login-wrap">
      <div className="card login-card animate-in">
        <div className="login-header">
          <div className="display-font" style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 8, opacity: 0.8 }}>Fiamma · Field Ops</div>
          <h2 className="display-font">Technician Portal</h2>
          <p>Sign in to view your assigned jobs</p>
        </div>
        <div className="login-body">
          {error && (
            <div style={{ background: "#ffe4e6", border: "1px solid #fecdd3", color: "#e11d48", padding: "12px", borderRadius: "8px", fontSize: "14px", marginBottom: "20px" }}>
              {error}
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Username</label>
            <input className="form-control" placeholder="hafiz or admin" value={user}
              onChange={e => setUser(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-control" type="password" placeholder="demo123" value={pass}
              onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} />
          </div>
          <button className="btn btn-primary btn-full mt-8" onClick={handleLogin}>Sign In</button>
          <div style={{ marginTop: 16, padding: 12, background: "var(--bg-subtle)", borderRadius: 8, fontSize: 12, color: "var(--text-muted)" }}>
            <strong>Demo Credentials:</strong><br />
            Technician: hafiz / demo123<br />
            Admin: admin / demo123
          </div>
        </div>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// MY JOBS PAGE
// ══════════════════════════════════════════════════════════════════════════════
function MyJobsPage({ jobs, stats, loading, error, onSelectJob, onRetry }) {
  const active = jobs.filter(j => !["COMPLETED", "CANCELLED", "REJECTED"].includes(j.status));
  const done = jobs.filter(j => j.status === "COMPLETED");
  const cancelled = jobs.filter(j => j.status === "CANCELLED" || j.status === "REJECTED");

  function JobItem({ job }) {
    const urg = URGENCY_CFG[job.urgencyLevel] || URGENCY_CFG.STANDARD;
    const stat = STATUS_CFG[job.status] || STATUS_CFG.ASSIGNED;
    const sla = timeLeft(job.slaDeadlineAt);
    const pct = job.slaPercentage != null ? Math.round(job.slaPercentage) : slaPercent(job.createdAt, job.slaDeadlineAt);

    return (
      <div className="card card-hover mb-16" onClick={() => onSelectJob(job)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "20px" }}>
        <div style={{ padding: "12px", background: "var(--bg-subtle)", borderRadius: "12px" }}>
          <div style={{ width: 48, height: 48, background: stat.bg, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: stat.color }}>
            <Icon.tool />
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{job.customerName}</h3>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
                <span className="mono" style={{ fontSize: 11, background: "var(--bg-subtle)", padding: "2px 6px", borderRadius: 4 }}>{job.id}</span>
                <span>•</span><span>{job.productModel}</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <span className="badge" style={{ color: stat.color, background: stat.bg, marginBottom: 4 }}>{stat.label}</span>
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <span className="badge" style={{ color: urg.color, background: urg.bg, fontSize: 10 }}>{urg.label}</span>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: "20px" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4, color: "var(--text-muted)" }}>
                <span>SLA Progress</span>
                <span style={{ color: sla.over ? "var(--accent)" : "var(--text-secondary)", fontWeight: 600 }}>{sla.label}</span>
              </div>
              <div style={{ height: 6, background: "var(--bg-subtle)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: pct >= 100 ? "var(--accent)" : "var(--brand)", transition: "width 0.5s ease" }} />
              </div>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
              <Icon.clock style={{ width: 14 }} /> {job.slaBreached ? "BREACHED" : sla.label}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return <Spinner message="Fetching your assignments..." />;
  if (error) return <ErrorBanner message={error} onRetry={onRetry} />;

  return (
    <div className="animate-in">
      <div className="mb-16">
        <h1 className="display-font" style={{ fontSize: 32, marginBottom: 4 }}>Daily Operations</h1>
        <p style={{ color: "var(--text-secondary)" }}>Manage your service tickets and track performance</p>
      </div>

      <div className="stats-grid mb-32">
        <div className="card"><div className="stat-label">Total Jobs</div><div className="stat-value">{stats.total}</div></div>
        <div className="card"><div className="stat-label">Active</div><div className="stat-value" style={{ color: "var(--brand)" }}>{stats.active}</div></div>
        <div className="card"><div className="stat-label">SLA Breached</div><div className="stat-value" style={{ color: stats.breached > 0 ? "var(--accent)" : "inherit" }}>{stats.breached}</div></div>
        <div className="card"><div className="stat-label">Completed</div><div className="stat-value" style={{ color: "#16a34a" }}>{stats.completed}</div></div>
      </div>

      {active.length > 0 && (
        <>
          <Divider label="Active Jobs" />
          {active
            .sort((a, b) => ({ CRITICAL: 0, STANDARD: 1, LOW: 2 }[a.urgencyLevel] ?? 1) - ({ CRITICAL: 0, STANDARD: 1, LOW: 2 }[b.urgencyLevel] ?? 1))
            .map(j => <JobItem key={j.id} job={j} />)}
        </>
      )}
      {active.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "48px", color: "var(--text-muted)" }}>
          No active jobs assigned.
        </div>
      )}
      {done.length > 0 && (
        <>
          <Divider label="Completed" />
          {done.map(j => <JobItem key={j.id} job={j} />)}
        </>
      )}
      {cancelled.length > 0 && (
        <>
          <Divider label="Cancelled / Rejected" />
          <div style={{ opacity: 0.75 }}>
            {cancelled.map(j => <JobItem key={j.id} job={j} />)}
          </div>
        </>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// JOB DETAIL PAGE
// ══════════════════════════════════════════════════════════════════════════════
function JobDetailPage({ jobId, onBack, onJobMutated }) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState("detail");

  const loadDetail = useCallback(async (options = {}) => {
    const isSilent = options.silent === true;
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      const data = await fetchJobDetail(jobId);
      setJob(data);
    } catch (e) { setError(e.message); }
    finally { if (!isSilent) setLoading(false); }
  }, [jobId]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  async function reloadAfterMutation() { await loadDetail({ silent: true }); onJobMutated(); }

  if (loading) return <Spinner message="Loading job details..." />;
  if (error) return <ErrorBanner message={error} onRetry={loadDetail} />;
  if (!job) return null;

  const urg = URGENCY_CFG[job.urgencyLevel] || URGENCY_CFG.STANDARD;
  const stat = STATUS_CFG[job.status] || STATUS_CFG.ASSIGNED;
  const sla = timeLeft(job.slaDeadlineAt);
  const pct = job.slaPercentage != null ? Math.round(job.slaPercentage) : slaPercent(job.createdAt, job.slaDeadlineAt);

  // Full 7-step timeline
  const STEPS = [
    { key: "PENDING_ACCEPTANCE", label: "New Ticket",         icon: <Icon.user /> },
    { key: "ACCEPTED",           label: "Accepted",           icon: <Icon.check /> },
    { key: "APPOINTMENT_BOOKED", label: "Appointment Booked", icon: <Icon.clock /> },
    { key: "JOB_STARTED",        label: "Job Started",        icon: <Icon.tool /> },
    { key: "AWAITING_PARTS",     label: "Awaiting Parts",     icon: <Icon.package /> },
    { key: "PROCEED_JOB",        label: "Parts Approved",     icon: <Icon.approve /> },
    { key: "COMPLETED",          label: "Completed",          icon: <Icon.check /> },
  ];
  const ORDER = ["PENDING_ACCEPTANCE", "ACCEPTED", "APPOINTMENT_BOOKED", "JOB_STARTED", "AWAITING_PARTS", "PROCEED_JOB", "COMPLETED"];
  // Normalise legacy ASSIGNED to PENDING_ACCEPTANCE position
  const curIdx = ORDER.indexOf(job.status === "ASSIGNED" ? "PENDING_ACCEPTANCE" : job.status);

  return (
    <div className="animate-in">
      <button className="btn btn-outline mb-16" onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Icon.back style={{ width: 16 }} /> Back to Jobs
      </button>

      {/* Header Card */}
      <div className="card mb-24">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div className="mono" style={{ color: "var(--brand)", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{job.id}</div>
            <h2 className="display-font" style={{ fontSize: 26, marginBottom: 4 }}>{job.customerName}</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="badge" style={{ color: stat.color, background: stat.bg }}>{stat.label}</span>
              <span className="badge" style={{ color: urg.color, background: urg.bg }}>{urg.label}</span>
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 13, color: "var(--text-muted)" }}>
            <div>{job.productModel}</div>
            <div style={{ marginTop: 4 }}>Created {timeAgo(job.createdAt)}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div>
            <div className="stat-label" style={{ marginTop: 0 }}>Customer Email</div>
            <div style={{ fontSize: 13 }}>{job.customerEmail || "—"}</div>
          </div>
          <div>
            <div className="stat-label" style={{ marginTop: 0 }}>Warranty</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: job.warrantyStatus === "UNDER_WARRANTY" ? "#16a34a" : "var(--accent)" }}>
              {job.warrantyStatus === "UNDER_WARRANTY" ? "Under Warranty" : "Expired"}
            </div>
          </div>
          <div>
            <div className="stat-label" style={{ marginTop: 0 }}>Charge Applicable</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: job.chargeApplicable ? "var(--accent)" : "#16a34a" }}>
              {job.chargeApplicable ? "Yes — Customer Billed" : "No — Free Repair"}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 4, padding: "20px", background: "var(--bg-subtle)", borderRadius: "12px" }}>
          <div className="stat-label" style={{ marginTop: 0, marginBottom: 8 }}>Complaint Details</div>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            <span style={{ fontWeight: 700, color: "var(--text-primary)", marginRight: 8 }}>[{job.complaintType}]</span>
            {job.complaintText}
          </p>
        </div>

        <div style={{ marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8, fontWeight: 700 }}>
            <span className="text-brand">SLA STATUS</span>
            <span style={{ color: sla.over ? "var(--accent)" : "inherit" }}>{sla.label} ({pct}%)</span>
          </div>
          <div style={{ height: 8, background: "var(--bg-subtle)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: pct >= 100 ? "var(--accent)" : "var(--brand)", transition: "width 0.5s ease" }} />
          </div>
        </div>

        {/* ── KPI Phase Indicators ── */}
        {job.kpiStatus && (() => {
          const phases = [
            { key: "kpi1_appointment", icon: "📞", short: "KPI 1 — Book Appt" },
            { key: "kpi2_attendance",  icon: "🔧", short: "KPI 2 — Attend"    },
            { key: "kpi3_completion",  icon: "✅", short: "KPI 3 — Complete"  },
          ];
          return (
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>
                KPI Phases
              </div>
              {phases.map(({ key, icon, short }) => {
                const p = job.kpiStatus[key];
                if (!p) return null;
                const achieved  = p.achieved;
                const overdue   = p.overdue;
                const barColor  = achieved ? "#16a34a" : overdue ? "#e11d48" : "var(--brand)";
                const label     = achieved ? `✓ done` : overdue ? "OVERDUE" : `${Math.round(p.pct_elapsed)}%`;
                const labelColor = achieved ? "#16a34a" : overdue ? "#e11d48" : "var(--text-secondary)";
                return (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 120, fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <span>{icon}</span> <span>{short}</span>
                    </div>
                    <div style={{ flex: 1, height: 6, background: "var(--bg-subtle)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${p.pct_elapsed}%`, height: "100%", background: barColor, borderRadius: 3, transition: "width 0.5s ease" }} />
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: labelColor, width: 52, textAlign: "right", flexShrink: 0 }}>{label}</div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "24px", alignItems: "start" }}>
        <div className="card">
          <h3 className="display-font mb-16" style={{ fontSize: 20 }}>Actions</h3>

          {/* ── STEP 1: PENDING_ACCEPTANCE — Accept or Reject ── */}
          {(job.status === "PENDING_ACCEPTANCE" || job.status === "ASSIGNED") && view === "detail" && (
            <AcceptRejectView job={job} onDone={reloadAfterMutation} />
          )}

          {/* ── STEP 2: ACCEPTED — Contact & Book Appointment ── */}
          {job.status === "ACCEPTED" && view === "detail" && (
            <BookAppointmentView job={job} onDone={reloadAfterMutation} />
          )}

          {/* ── STEP 3: APPOINTMENT_BOOKED — Send reminder & Start Job ── */}
          {job.status === "APPOINTMENT_BOOKED" && view === "detail" && (
            <AppointmentBookedView job={job} onDone={reloadAfterMutation} />
          )}

          {/* ── STEP 4a: JOB_STARTED — no fault logged yet ── */}
          {job.status === "JOB_STARTED" && view === "detail" && !job.faultType && (
            <button className="btn btn-primary btn-full" onClick={() => setView("fault")}>
              Log Diagnostic Fault
            </button>
          )}

          {/* ── STEP 4b: JOB_STARTED — fault logged, parts predicted ── */}
          {job.status === "JOB_STARTED" && view === "detail" && job.faultType && (
            <div style={{ display: "flex", gap: 12 }}>
              {job.predictedParts?.length > 0 ? (
                <>
                  <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => setView("parts")}>
                    📋 Review Parts &amp; {job.chargeApplicable ? "Get Quotation Signed" : "Request Approval"}
                  </button>
                  <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setView("complete")}>
                    Complete
                  </button>
                </>
              ) : (
                <button className="btn btn-primary btn-full" onClick={() => setView("complete")}>
                  Complete Service
                </button>
              )}
            </div>
          )}

          {/* ── STEP 5: AWAITING_PARTS ── */}
          {job.status === "AWAITING_PARTS" && view === "detail" && (
            <div>
              <div style={{ padding: "16px 20px", background: "#f3e8ff", borderRadius: "12px", border: "1px solid #e9d5ff", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 32, height: 32, background: "#7c3aed", color: "#fff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon.package style={{ width: 16 }} />
                  </div>
                  <div style={{ fontWeight: 700, color: "#7c3aed", fontSize: 15 }}>Awaiting Parts Approval</div>
                </div>
                <p style={{ fontSize: 13, color: "#6b21a8", margin: 0 }}>
                  Your spare part request has been sent to the manager for authorization.
                  You will be notified once approved and can then proceed with the repair.
                </p>
              </div>
              <button className="btn btn-outline btn-full" onClick={() => setView("parts")}>
                View Submitted Quotation
              </button>
            </div>
          )}

          {/* ── STEP 6: PROCEED_JOB — parts approved ── */}
          {job.status === "PROCEED_JOB" && view === "detail" && (
            <div>
              <div style={{ padding: "16px 20px", background: "#e0f7fa", borderRadius: "12px", border: "1px solid #b2ebf2", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 32, height: 32, background: "#0891b2", color: "#fff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon.check style={{ width: 16 }} />
                  </div>
                  <div style={{ fontWeight: 700, color: "#0891b2", fontSize: 15 }}>Parts Approved — Ready to Proceed</div>
                </div>
                <p style={{ fontSize: 13, color: "#0e7490", margin: 0 }}>
                  The manager has approved the spare parts. Parts have been issued to you.
                  Complete the repair and submit your service report.
                </p>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setView("parts")}>
                  View Parts
                </button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setView("complete")}>
                  Complete Service
                </button>
              </div>
            </div>
          )}

          {/* ── Sub-views ── */}
          {view === "fault"    && <LogFaultView    job={job} onDone={reloadAfterMutation} setView={setView} />}
          {view === "parts"    && <PartsView       job={job} onDone={reloadAfterMutation} setView={setView} />}
          {view === "complete" && <CompleteJobView  job={job} onDone={reloadAfterMutation} setView={setView} onBack={onBack} />}

          {/* ── STEP 7: COMPLETED — archived documents ── */}
          {job.status === "COMPLETED" && view === "detail" && (
            <div style={{ marginTop: 8 }}>
              <div style={{ padding: "12px 16px", background: "#dcfce7", borderRadius: 10, border: "1px solid #bbf7d0", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 28, height: 28, background: "#16a34a", color: "#fff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon.check style={{ width: 14 }} />
                </div>
                <div style={{ fontWeight: 700, color: "#15803d", fontSize: 14 }}>Job Completed</div>
              </div>
              <Divider label="Archived Documents" />
              <TicketDocumentsReview ticketId={job.id} />
            </div>
          )}
        </div>

        {/* ── Timeline sidebar ── */}
        <div className="card">
          <h3 className="display-font mb-16" style={{ fontSize: 20 }}>Job History</h3>
          <div className="timeline">
            {STEPS.map((step, i) => {
              const stepIdx = ORDER.indexOf(step.key);
              const isDone   = stepIdx < curIdx;
              const isActive = stepIdx === curIdx;
              return (
                <div key={step.key} className="timeline-item">
                  <div className="timeline-dot-wrap">
                    <div className={`timeline-dot ${isDone ? "done" : isActive ? "active" : ""}`}>
                      {isDone ? <Icon.check style={{ width: 14 }} /> : step.icon}
                    </div>
                    {i < STEPS.length - 1 && <div className={`timeline-line ${isDone ? "done" : ""}`} />}
                  </div>
                  <div className="timeline-content">
                    <div className="timeline-title" style={{ color: isActive ? "var(--brand)" : isDone ? "var(--text-primary)" : "var(--text-muted)" }}>{step.label}</div>
                    {isDone   && <div className="timeline-meta">{timeAgo(job.createdAt)}</div>}
                    {isActive && <div className="timeline-meta" style={{ color: "var(--brand)", fontWeight: 600 }}>Active Phase</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// ACCEPT / REJECT VIEW  (V1)
// ══════════════════════════════════════════════════════════════════════════════
function AcceptRejectView({ job, onDone }) {
  const [acting, setActing] = useState(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState(null);

  async function handleAccept() {
    setActing("accepting"); setError(null);
    try { await apiAcceptOrReject(job.id, true); await onDone(); }
    catch (e) { setError(e.message); setActing(null); }
  }

  async function handleReject() {
    if (!rejectReason.trim()) { setError("Please provide a reason for rejection."); return; }
    setActing("rejecting"); setError(null);
    try { await apiAcceptOrReject(job.id, false, rejectReason); await onDone(); }
    catch (e) { setError(e.message); setActing(null); }
  }

  return (
    <div className="animate-in">
      <div style={{ padding: "16px 20px", background: "#fef3c7", borderRadius: 12, border: "1px solid #fde68a", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ width: 32, height: 32, background: "#b45309", color: "#fff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>📋</div>
          <div style={{ fontWeight: 700, color: "#92400e", fontSize: 15 }}>New Ticket — Pending Your Acceptance</div>
        </div>
        <p style={{ fontSize: 13, color: "#78350f", margin: 0 }}>
          Review the job details and accept or reject this ticket. If accepted, you will contact the customer to book an appointment.
        </p>
      </div>
      {error && <ErrorBanner message={error} />}
      {!showRejectForm ? (
        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} disabled={!!acting} onClick={handleAccept}>
            {acting === "accepting" ? "Accepting..." : "✓ Accept Ticket"}
          </button>
          <button className="btn btn-outline" style={{ flex: 1, color: "var(--accent)", borderColor: "var(--accent)" }} disabled={!!acting} onClick={() => setShowRejectForm(true)}>
            ✗ Reject Ticket
          </button>
        </div>
      ) : (
        <div className="card" style={{ border: "1px solid rgba(224,92,42,0.3)", background: "var(--accent-light)" }}>
          <div style={{ fontWeight: 700, color: "var(--accent)", marginBottom: 12 }}>Reason for Rejection</div>
          <textarea className="form-control" style={{ minHeight: 80, marginBottom: 12 }}
            placeholder="e.g. Outside service area, scheduling conflict..."
            value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-outline" style={{ flex: 1, color: "var(--accent)", borderColor: "var(--accent)" }}
              disabled={acting === "rejecting"} onClick={handleReject}>
              {acting === "rejecting" ? "Rejecting..." : "Confirm Reject"}
            </button>
            <button className="btn btn-outline" onClick={() => { setShowRejectForm(false); setError(null); }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// BOOK APPOINTMENT VIEW  (V1)
// ══════════════════════════════════════════════════════════════════════════════
function BookAppointmentView({ job, onDone }) {
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("09:00");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const waMessage = encodeURIComponent(
    `Hi ${job.customerName}, this is Hafiz from Fiamma service team. ` +
    `I'm reaching out regarding your service ticket ${job.id} for your ${job.productModel}. ` +
    `I'd like to schedule an appointment — when would be convenient for you?`
  );
  const customerPhone = job.customerPhone ? job.customerPhone.replace(/\D/g, "") : "";
  const waLink = customerPhone ? `https://wa.me/60${customerPhone}?text=${waMessage}` : `https://wa.me/?text=${waMessage}`;
  const today = new Date().toISOString().split("T")[0];

  async function handleBook() {
    if (!appointmentDate) { setError("Please select an appointment date."); return; }
    setSubmitting(true); setError(null);
    try {
      await apiBookAppointment(job.id, `${appointmentDate}T${appointmentTime}:00`, notes);
      await onDone();
    } catch (e) { setError(e.message); setSubmitting(false); }
  }

  return (
    <div className="animate-in">
      <div style={{ padding: "16px 20px", background: "#e0f2fe", borderRadius: 12, border: "1px solid #bae6fd", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ width: 32, height: 32, background: "#0369a1", color: "#fff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✓</div>
          <div style={{ fontWeight: 700, color: "#0c4a6e", fontSize: 15 }}>Ticket Accepted — Book Appointment</div>
        </div>
        <p style={{ fontSize: 13, color: "#075985", margin: 0 }}>
          Contact the customer via WhatsApp or phone to confirm a suitable date, then book the appointment below.
        </p>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <a href={waLink} target="_blank" rel="noreferrer"
          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 16px", borderRadius: 10, background: "#25D366", color: "#fff", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
          <span style={{ fontSize: 18 }}>💬</span> WhatsApp Customer
        </a>
        {customerPhone && (
          <a href={`tel:+60${customerPhone}`}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 16px", borderRadius: 10, background: "var(--bg-subtle)", color: "var(--text-primary)", fontWeight: 700, fontSize: 13, textDecoration: "none", border: "1px solid var(--border)" }}>
            📞 Call Customer
          </a>
        )}
      </div>

      <div className="card mb-16" style={{ background: "var(--bg-subtle)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
          <div><span style={{ color: "var(--text-muted)", fontSize: 11 }}>CUSTOMER</span><div style={{ fontWeight: 600 }}>{job.customerName}</div></div>
          <div><span style={{ color: "var(--text-muted)", fontSize: 11 }}>EMAIL</span><div style={{ fontWeight: 600 }}>{job.customerEmail}</div></div>
          <div><span style={{ color: "var(--text-muted)", fontSize: 11 }}>PRODUCT</span><div style={{ fontWeight: 600 }}>{job.productModel}</div></div>
          <div><span style={{ color: "var(--text-muted)", fontSize: 11 }}>ISSUE</span><div style={{ fontWeight: 600 }}>{job.subject}</div></div>
        </div>
      </div>

      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>📅 Book Appointment</div>
        {error && <ErrorBanner message={error} />}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Date <span style={{ color: "var(--accent)" }}>*</span></label>
            <input type="date" className="form-control" min={today} value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Time</label>
            <select className="form-control" value={appointmentTime} onChange={e => setAppointmentTime(e.target.value)}>
              {["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00"].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label className="form-label">Notes (optional)</label>
          <input className="form-control" placeholder="e.g. Customer prefers morning, side gate entry..." value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-full" disabled={!appointmentDate || submitting} onClick={handleBook}>
          {submitting ? "Booking..." : "Confirm Appointment"}
        </button>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// APPOINTMENT BOOKED VIEW  (V1)
// ══════════════════════════════════════════════════════════════════════════════
function AppointmentBookedView({ job, onDone }) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);

  const apptDate = job.appointmentDate
    ? new Date(job.appointmentDate).toLocaleString("en-MY", { weekday: "long", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
  const canStart = !job.appointmentDate || new Date() >= new Date(job.appointmentDate);

  const waMessage = encodeURIComponent(
    `Hi ${job.customerName}, this is a reminder from Fiamma that your appliance service appointment is scheduled for ${apptDate}. Our technician will arrive at your location. Thank you!`
  );
  const customerPhone = job.customerPhone ? job.customerPhone.replace(/\D/g, "") : "";
  const waLink = customerPhone ? `https://wa.me/60${customerPhone}?text=${waMessage}` : `https://wa.me/?text=${waMessage}`;

  async function handleStartJob() {
    setStarting(true); setError(null);
    try {
      await updateJobStatus(job.id, "JOB_STARTED", "TECH-001", "Technician arrived on-site. Job started.");
      await onDone();
    } catch (e) { setError(e.message); setStarting(false); }
  }

  return (
    <div className="animate-in">
      <div style={{ padding: "16px 20px", background: "#ccfbf1", borderRadius: 12, border: "1px solid #99f6e4", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ width: 32, height: 32, background: "#0d9488", color: "#fff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>📅</div>
          <div style={{ fontWeight: 700, color: "#134e4a", fontSize: 15 }}>Appointment Confirmed</div>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#0f766e", marginBottom: 4 }}>{apptDate}</div>
        <p style={{ fontSize: 13, color: "#115e59", margin: 0 }}>
          {canStart ? "It's time! You can now start the job." : "On the appointment day, tap 'Start Job' to begin the service."}
        </p>
      </div>
      {error && <ErrorBanner message={error} />}
      <a href={waLink} target="_blank" rel="noreferrer"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 16px", borderRadius: 10, background: "#25D366", color: "#fff", fontWeight: 700, fontSize: 13, textDecoration: "none", marginBottom: 12 }}>
        <span style={{ fontSize: 16 }}>💬</span> Send Appointment Reminder via WhatsApp
      </a>
      <button className="btn btn-primary btn-full" disabled={starting} onClick={handleStartJob} style={{ opacity: canStart ? 1 : 0.65 }}>
        {starting ? "Starting..." : "🔧 Start Job"}
      </button>
      {!canStart && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", marginTop: 8 }}>
          Button will activate on appointment date, but you can start early if needed.
        </p>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// LOG FAULT VIEW
// After submit: auto-redirects to PartsView if parts predicted, else shows
// "no parts" confirmation and lets technician proceed to Complete.
// ══════════════════════════════════════════════════════════════════════════════
function LogFaultView({ job, onDone, setView }) {
  const [faultType, setFaultType] = useState(job.faultType || "");
  const [notes, setNotes] = useState(job.faultNotes || "");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function submit() {
    if (!faultType) return;
    setSubmitting(true); setError(null);
    try {
      const res = await apiLogFault(job.id, faultType, notes);
      setResult(res);
      await onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Auto-redirect to parts view when parts are predicted
  if (result) {
    const hasParts = result.predictedParts?.length > 0;
    if (hasParts) {
      setView("parts");
      return null;
    }
    // No parts — allow proceeding to complete
    return (
      <div className="animate-in" style={{ marginTop: 24 }}>
        <div style={{ padding: "20px", background: "var(--brand-light)", borderRadius: "12px", border: "1px solid var(--brand-mid)" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ padding: "8px", background: "var(--brand)", color: "#fff", borderRadius: "8px" }}>
              <Icon.check style={{ width: 16 }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: "var(--brand)", marginBottom: 4 }}>Fault Logged — No Parts Required</div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
                Diagnostic: <strong>{result.faultType}</strong>
              </p>
              <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => setView("complete")}>
                Proceed to Complete Job
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in" style={{ marginTop: 24 }}>
      <h3 className="display-font mb-16" style={{ fontSize: 20 }}>Diagnostic Log</h3>
      {error && <ErrorBanner message={error} />}
      <div className="form-group">
        <label className="form-label">Primary Fault Type</label>
        <select className="form-control" value={faultType} onChange={e => setFaultType(e.target.value)}>
          <option value="">Select diagnostic result...</option>
          <option>Not Cooling</option><option>Weak Cooling</option><option>Noisy</option>
          <option>Leaking</option><option>Leaking Water</option><option>Not Running</option>
          <option>No Power</option><option>Remote / Display Issue</option><option>Other</option>
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Field Observations</label>
        <textarea className="form-control" placeholder="Describe the technical findings on-site..." value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={submit} disabled={!faultType || submitting}>
          {submitting ? "Submitting..." : "Log Fault & Check Parts"}
        </button>
        <button className="btn btn-outline" onClick={() => setView("detail")}>Cancel</button>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// SIGNATURE PAD
// ══════════════════════════════════════════════════════════════════════════════
function SignaturePad({ onSave, width = 400, height = 150 }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = "#1a1714";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  function getPos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function startDrawing(e) { e.preventDefault(); setIsDrawing(true); const ctx = canvasRef.current.getContext("2d"); const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
  function draw(e)          { e.preventDefault(); if (!isDrawing) return; const ctx = canvasRef.current.getContext("2d"); const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); }
  function stopDrawing()    { setIsDrawing(false); }
  function clear()          { const c = canvasRef.current; c.getContext("2d").clearRect(0, 0, c.width, c.height); }
  function save()           { onSave(canvasRef.current.toDataURL("image/png")); }

  return (
    <div>
      <div style={{ border: "2px solid var(--border)", borderRadius: 8, background: "#fff", marginBottom: 12 }}>
        <canvas ref={canvasRef} width={width} height={height}
          onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
          onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}
          style={{ display: "block", cursor: "crosshair", touchAction: "none" }} />
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <button className="btn btn-outline" onClick={clear} style={{ padding: "6px 12px", fontSize: 12 }}>Clear</button>
        <button className="btn btn-primary" onClick={save}  style={{ padding: "6px 12px", fontSize: 12 }}>Confirm Signature</button>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// QUOTATION FORM
// Collects customer signature + email for BOTH chargeable and warranty jobs.
// Warranty jobs show a "Covered under warranty" notice instead of a total charge.
// On submit: calls onSubmit(quotationData) and shows a spinner while in-flight.
// ══════════════════════════════════════════════════════════════════════════════
function QuotationForm({ job, currentParts, onSubmit, onCancel }) {
  const [signature, setSignature]   = useState(null);
  const [email, setEmail]           = useState(job.customerEmail || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState(null);

  const isWarranty = !job.chargeApplicable;
  const total = currentParts.reduce((s, p) => s + p.cost * (p.quantity || 1), 0);

  async function handleSubmit() {
    if (!signature) return;
    setSubmitting(true); setError(null);
    try {
      await onSubmit({
        jobId: job.id,
        customerName: job.customerName,
        customerEmail: email,
        isWarranty,
        parts: currentParts.map(p => ({
          partId: p.partId,
          name: p.name,
          quantity: p.quantity || 1,
          unitCost: p.cost,
          totalCost: p.cost * (p.quantity || 1),
        })),
        totalAmount: total,
        signature,
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      setError(e.message || "Failed to submit quotation. Please try again.");
      setSubmitting(false);
    }
  }

  if (submitting) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px", marginTop: 24 }}>
        <div style={{ width: 36, height: 36, border: "3px solid var(--border)", borderTopColor: "var(--brand)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Submitting quotation and emailing customer...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="animate-in" style={{ marginTop: 24 }}>
      <h3 className="display-font mb-16" style={{ fontSize: 20 }}>
        {isWarranty ? "Warranty Parts — Get Customer Signature" : "Customer Quotation"}
      </h3>

      {/* Warranty notice */}
      {isWarranty && (
        <div style={{ padding: "12px 16px", background: "#e0f2fe", borderRadius: 10, border: "1px solid #bae6fd", marginBottom: 16, fontSize: 13 }}>
          <div style={{ fontWeight: 700, color: "#0369a1", marginBottom: 2 }}>✅ Under Warranty — No Customer Charge</div>
          <div style={{ color: "#075985" }}>Parts cost (RM {total.toFixed(2)}) is fully covered. Signature is required to confirm the work scope.</div>
        </div>
      )}

      {error && (
        <div style={{ background: "#ffe4e6", border: "1px solid #fecdd3", padding: "12px 16px", borderRadius: 8, marginBottom: 16, fontSize: 13, color: "#e11d48" }}>
          {error}
        </div>
      )}

      {/* Parts table */}
      <div className="card mb-16" style={{ background: "var(--bg-subtle)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--bg-subtle)" }}>
              <th style={{ padding: "8px 12px", textAlign: "left",   fontWeight: 700, fontSize: 11, color: "var(--text-secondary)" }}>PART</th>
              <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, fontSize: 11, color: "var(--text-secondary)" }}>QTY</th>
              <th style={{ padding: "8px 12px", textAlign: "right",  fontWeight: 700, fontSize: 11, color: "var(--text-secondary)" }}>UNIT (RM)</th>
              <th style={{ padding: "8px 12px", textAlign: "right",  fontWeight: 700, fontSize: 11, color: "var(--text-secondary)" }}>
                {isWarranty ? "COST (RM)" : "TOTAL (RM)"}
              </th>
            </tr>
          </thead>
          <tbody>
            {currentParts.map(p => (
              <tr key={p.partId} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "8px 12px", fontWeight: 600 }}>{p.name}</td>
                <td style={{ padding: "8px 12px", textAlign: "center" }}>{p.quantity || 1}</td>
                <td style={{ padding: "8px 12px", textAlign: "right" }}>{p.cost.toFixed(2)}</td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>{(p.cost * (p.quantity || 1)).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "1.5px solid var(--border)", background: "var(--bg-subtle)" }}>
              <td colSpan={3} style={{ padding: "8px 12px", fontWeight: 700 }}>
                {isWarranty ? "Total Parts Cost (Warranty)" : "Total"}
              </td>
              <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 800, color: isWarranty ? "#0369a1" : "var(--brand)", fontSize: 15 }}>
                {isWarranty ? <span style={{ textDecoration: "line-through", opacity: 0.5, marginRight: 6 }}>RM {total.toFixed(2)}</span> : null}
                {isWarranty ? <span style={{ color: "#16a34a" }}>RM 0.00</span> : `RM ${total.toFixed(2)}`}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Signature pad */}
      <div className="card mb-16">
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
          {isWarranty ? "Customer Signature (Work Acknowledgement)" : "Customer Signature"}
        </div>
        {signature ? (
          <div>
            <div style={{ fontSize: 12, color: "var(--brand)", fontWeight: 600, marginBottom: 8 }}>✓ Signature captured</div>
            <img src={signature} alt="Customer signature" style={{ border: "1px solid var(--border)", borderRadius: 8, maxWidth: "100%" }} />
            <button className="btn btn-outline" onClick={() => setSignature(null)} style={{ marginTop: 8, padding: "5px 12px", fontSize: 12 }}>Redraw</button>
          </div>
        ) : (
          <SignaturePad onSave={setSignature} />
        )}
      </div>

      {/* Email */}
      <div className="card mb-16" style={{ background: "var(--bg-subtle)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Confirm Customer Email</div>
        <input className="form-control" type="email" placeholder="Enter recipient email..." value={email}
          onChange={e => setEmail(e.target.value)} style={{ background: "#fff" }} />
        {!email && <div style={{ color: "var(--accent)", fontSize: 11, marginTop: 4, fontWeight: 600 }}>⚠ Required — document will be saved but cannot be emailed.</div>}
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={!signature} onClick={handleSubmit}>
          {isWarranty ? "Submit & Request Parts Approval" : "Submit Quotation & Email Customer"}
        </button>
        <button className="btn btn-outline" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// PARTS VIEW
// Unified flow for both chargeable and warranty jobs:
//   (1) Editable parts list  →  (2) QuotationForm (signature + email)
//   →  (3) Submit  →  stays in view showing read-only summary + awaiting banner
//
// isReadOnly when status is AWAITING_PARTS, PROCEED_JOB, or COMPLETED.
// ══════════════════════════════════════════════════════════════════════════════
function PartsView({ job, onDone, setView }) {
  const [currentParts, setCurrentParts] = useState(() =>
    (job.predictedParts || []).map(p => ({ ...p, quantity: 1, isPredicted: true }))
  );
  const [newPartName, setNewPartName]     = useState("");
  const [newPartPrice, setNewPartPrice]   = useState("");
  const [showQuotation, setShowQuotation] = useState(false);
  const [submitted, setSubmitted]         = useState(false);
  const [submitMsg, setSubmitMsg]         = useState("");

  const isReadOnly = ["AWAITING_PARTS", "PROCEED_JOB", "COMPLETED"].includes(job.status);
  const total = currentParts.reduce((s, p) => s + p.cost * (p.quantity || 1), 0);

  function updateQuantity(partId, qty) {
    setCurrentParts(prev => prev.map(p => p.partId === partId ? { ...p, quantity: Math.max(1, parseInt(qty) || 1) } : p));
  }
  function removePart(partId) { setCurrentParts(prev => prev.filter(p => p.partId !== partId)); }
  function addPart() {
    if (!newPartName || !newPartPrice) return;
    const priceNum = parseFloat(newPartPrice);
    if (isNaN(priceNum)) return;
    setCurrentParts(prev => [...prev, { partId: `MANUAL-${Date.now()}`, name: newPartName, cost: priceNum, quantity: 1, isPredicted: false }]);
    setNewPartName(""); setNewPartPrice("");
  }
  function resetToAI() { setCurrentParts((job.predictedParts || []).map(p => ({ ...p, quantity: 1, isPredicted: true }))); }

  async function handleQuotationSubmit(quotationData) {
    // Backend sets status to AWAITING_PARTS and creates escalation
    const res = await apiSubmitQuotation(quotationData);
    setSubmitMsg(res?.message || "Quotation saved and submitted.");
    setSubmitted(true);
    setShowQuotation(false);
    await onDone(); // silently refreshes job in parent
  }

  // ── Quotation form sub-view ──────────────────────────────────────────────
  if (showQuotation) {
    return (
      <QuotationForm
        job={job}
        currentParts={currentParts}
        onSubmit={handleQuotationSubmit}
        onCancel={() => setShowQuotation(false)}
      />
    );
  }

  // ── Post-submit: read-only summary + awaiting banner ─────────────────────
  if (submitted || isReadOnly) {
    const isApproved = job.status === "PROCEED_JOB" || job.status === "COMPLETED";
    return (
      <div className="animate-in" style={{ marginTop: 24 }}>
        <h3 className="display-font mb-16" style={{ fontSize: 20 }}>Parts &amp; Quotation</h3>

        {/* Status banner */}
        {isApproved ? (
          <div style={{ padding: "14px 16px", background: "var(--brand-light)", borderRadius: 12, border: "1px solid var(--brand-mid)", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 32, height: 32, background: "var(--brand)", color: "#fff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon.check style={{ width: 16 }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: "var(--brand)", fontSize: 14 }}>Parts Approved by Manager</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>Parts have been issued — proceed to complete the repair.</div>
            </div>
          </div>
        ) : (
          <div style={{ padding: "14px 16px", background: "#f3e8ff", borderRadius: 12, border: "1px solid #e9d5ff", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 32, height: 32, background: "#7c3aed", color: "#fff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon.package style={{ width: 16 }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: "#7c3aed", fontSize: 14 }}>Awaiting Manager Approval</div>
              <div style={{ fontSize: 12, color: "#6b21a8", marginTop: 2 }}>
                {submitMsg || "Your spare part request has been sent to the manager for authorization."}
              </div>
            </div>
          </div>
        )}

        {/* Read-only parts table */}
        <div className="card mb-16">
          <div style={{ border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "var(--bg-subtle)", textAlign: "left" }}>
                  <th style={{ padding: "12px 16px", fontWeight: 700, fontSize: 12, color: "var(--text-secondary)" }}>PART NAME</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, fontSize: 12, color: "var(--text-secondary)" }}>STOCK</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, fontSize: 12, color: "var(--text-secondary)", textAlign: "center" }}>QTY</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, fontSize: 12, color: "var(--text-secondary)", textAlign: "right" }}>COST (RM)</th>
                </tr>
              </thead>
              <tbody>
                {currentParts.map(p => {
                  const stock = STOCK_CFG[p.stock] || STOCK_CFG.UNKNOWN;
                  return (
                    <tr key={p.partId} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.partId}</div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span className="badge" style={{ color: stock.color, background: stock.bg, fontSize: 10 }}>{stock.label}</span>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: 600 }}>{p.quantity || 1}</td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600 }}>{(p.cost * (p.quantity || 1)).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: "var(--bg-subtle)", borderTop: "1px solid var(--border)" }}>
                  <td colSpan="3" style={{ padding: "12px 16px", fontWeight: 700, textAlign: "right" }}>Total</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: "var(--brand)", fontSize: 16 }}>{total.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Warranty badge if applicable */}
        {!job.chargeApplicable && (
          <div style={{ padding: "10px 14px", background: "#e0f2fe", borderRadius: 8, border: "1px solid #bae6fd", marginBottom: 16, fontSize: 12, fontWeight: 600, color: "#0369a1" }}>
            ✅ Under Warranty — Customer charged RM 0.00
          </div>
        )}

        <button className="btn btn-outline btn-full" onClick={() => setView("detail")}>Back to Details</button>
      </div>
    );
  }

  // ── Default: editable parts list ─────────────────────────────────────────
  return (
    <div className="animate-in" style={{ marginTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 className="display-font" style={{ fontSize: 20 }}>Predicted Parts</h3>
        <button className="btn btn-outline" style={{ padding: "4px 10px", fontSize: 11 }} onClick={resetToAI}>
          <Icon.refresh style={{ width: 12, marginRight: 4 }} /> Reset to AI Predictions
        </button>
      </div>

      {/* Warranty notice on edit view */}
      {!job.chargeApplicable && (
        <div style={{ padding: "10px 14px", background: "#e0f2fe", borderRadius: 8, border: "1px solid #bae6fd", marginBottom: 16, fontSize: 12, fontWeight: 600, color: "#0369a1" }}>
          ✅ Under Warranty — Customer will not be charged. Signature confirms work scope only.
        </div>
      )}

      <div className="card mb-16">
        <div style={{ border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "var(--bg-subtle)", textAlign: "left" }}>
                <th style={{ padding: "12px 16px", fontWeight: 700, fontSize: 12, color: "var(--text-secondary)" }}>PART NAME</th>
                <th style={{ padding: "12px 16px", fontWeight: 700, fontSize: 12, color: "var(--text-secondary)" }}>STOCK</th>
                <th style={{ padding: "12px 16px", fontWeight: 700, fontSize: 12, color: "var(--text-secondary)", textAlign: "center", width: 80 }}>QTY</th>
                <th style={{ padding: "12px 16px", fontWeight: 700, fontSize: 12, color: "var(--text-secondary)", textAlign: "right" }}>COST (RM)</th>
                <th style={{ padding: "12px 16px", width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {currentParts.length === 0 ? (
                <tr><td colSpan="5" style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)" }}>No parts added.</td></tr>
              ) : currentParts.map(p => {
                const stock = STOCK_CFG[p.stock] || STOCK_CFG.UNKNOWN;
                return (
                  <tr key={p.partId} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: 600 }}>
                        {p.name}
                        {!p.isPredicted && <span style={{ fontSize: 10, background: "var(--bg-subtle)", padding: "2px 6px", borderRadius: 4, marginLeft: 6 }}>MANUAL</span>}
                      </div>
                      <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.partId}</div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span className="badge" style={{ color: stock.color, background: stock.bg, fontSize: 10 }}>{stock.label}</span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <input type="number" min="1" value={p.quantity || 1}
                        onChange={e => updateQuantity(p.partId, e.target.value)}
                        style={{ width: 50, textAlign: "center", padding: "4px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13 }} />
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600 }}>{(p.cost * (p.quantity || 1)).toFixed(2)}</td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <button onClick={() => removePart(p.partId)} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 16 }}>✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: "var(--bg-subtle)", borderTop: "1px solid var(--border)" }}>
                <td colSpan="3" style={{ padding: "12px 16px", fontWeight: 700, textAlign: "right" }}>Total Estimated Cost</td>
                <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: "var(--brand)", fontSize: 16 }}>{total.toFixed(2)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Add manual part */}
      <div className="card mb-20" style={{ borderStyle: "dashed", background: "var(--bg-subtle)" }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Add Additional Spare Part</div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
          <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
            <label className="form-label">Part Name</label>
            <input className="form-control" placeholder="e.g. Copper Pipe" value={newPartName} onChange={e => setNewPartName(e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="form-label">Unit Price (RM)</label>
            <input className="form-control" type="number" placeholder="0.00" value={newPartPrice} onChange={e => setNewPartPrice(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={addPart} disabled={!newPartName || !newPartPrice} style={{ height: 42 }}>Add Item</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexDirection: "column" }}>
        <button className="btn btn-primary btn-full" disabled={currentParts.length === 0}
          onClick={() => setShowQuotation(true)}>
          {job.chargeApplicable
            ? "📋 Get Customer Signature & Generate Quotation"
            : "📋 Get Customer Signature & Generate Quotation"}
        </button>
        <button className="btn btn-outline btn-full" onClick={() => setView("detail")}>Back to Details</button>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// COMPLETE JOB VIEW  (V1 phase flow)
// ══════════════════════════════════════════════════════════════════════════════
function CompleteJobView({ job, onDone, setView, onBack }) {
  const [phase, setPhase] = useState("report"); // report | confirm | completing | done
  const [draftReport, setDraftReport] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const partsUsed = job.predictedParts || [];

  async function finish() {
    if (!draftReport) return;
    setPhase("completing"); setError(null);
    try {
      const partIds = partsUsed.map(p => p.partId);
      try {
        const res = await apiCompleteJob(job.id, partIds, draftReport.workDoneNotes || "Service completed");
        setResult(res);
      } catch (e) {
        if (e.message.toLowerCase().includes("completed") || e.message.toLowerCase().includes("status")) {
          console.warn("Job already completed, proceeding to report submission.");
        } else { throw e; }
      }
      await submitServiceReport(job.id, draftReport);
      setPhase("done");
      await onDone();
    } catch (e) {
      setError(e.message);
      setPhase("confirm");
    }
  }

  if (phase === "completing") {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px", marginTop: 24 }}>
        <div style={{ width: 36, height: 36, border: "3px solid var(--border)", borderTopColor: "var(--brand)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Completing job, please wait...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="animate-in" style={{ marginTop: 24, textAlign: "center" }}>
        <div style={{ padding: "40px 32px", background: "var(--brand-light)", borderRadius: 20, border: "1px dashed var(--brand-mid)" }}>
          <div style={{ width: 64, height: 64, background: "var(--brand)", color: "#fff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <Icon.check style={{ width: 32 }} />
          </div>
          <h2 className="display-font" style={{ fontSize: 24, marginBottom: 8 }}>Job Fully Closed</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: 8, fontSize: 14 }}>
            Service report submitted and ticket <strong>{job.id}</strong> is now officially closed.
          </p>
          {result?.compensationCode && (
            <div style={{ padding: "16px", background: "#fff", borderRadius: 12, border: "1px solid var(--border)", margin: "16px auto", maxWidth: 300 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--brand)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Compensation Code Issued</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 800, letterSpacing: "0.1em" }}>{result.compensationCode}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>SLA was breached — voucher auto-generated for customer.</div>
            </div>
          )}
          <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={onBack}>Return to Dashboard</button>
        </div>
      </div>
    );
  }

  if (phase === "report") {
    return (
      <ServiceReportSubmitView
        job={job}
        onDraftComplete={(data) => { setDraftReport(data); setPhase("confirm"); }}
      />
    );
  }

  // confirm phase
  return (
    <div className="animate-in" style={{ marginTop: 24 }}>
      <h3 className="display-font mb-16" style={{ fontSize: 20 }}>Final Confirmation</h3>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>
        Review the job summary below and confirm to officially close this ticket.
      </p>
      {error && <ErrorBanner message={error} />}

      <div className="card mb-16" style={{ background: "var(--bg-subtle)", borderStyle: "dashed" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div><div className="stat-label" style={{ marginTop: 0 }}>Customer</div><div style={{ fontWeight: 700 }}>{job.customerName}</div></div>
          <div><div className="stat-label" style={{ marginTop: 0 }}>Ticket ID</div><div className="mono" style={{ fontWeight: 700, color: "var(--brand)" }}>{job.id}</div></div>
          <div><div className="stat-label" style={{ marginTop: 0 }}>Product</div><div style={{ fontWeight: 600 }}>{job.productModel}</div></div>
          <div><div className="stat-label" style={{ marginTop: 0 }}>Fault</div><div style={{ fontWeight: 600, color: "var(--accent)" }}>{job.faultType || "Not specified"}</div></div>
        </div>
      </div>

      {partsUsed.length > 0 && (
        <div className="card mb-16">
          <div className="stat-label" style={{ marginTop: 0, marginBottom: 8 }}>Parts to Install</div>
          <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <tbody>
                {partsUsed.map(p => (
                  <tr key={p.partId} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 12px" }}>{p.name} <span className="mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>({p.partId})</span></td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>RM {(p.cost || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ padding: "14px 16px", background: "var(--brand-light)", borderRadius: 10, border: "1px solid var(--brand-mid)", marginBottom: 12 }}>
        <p style={{ fontSize: 13, color: "var(--brand)", fontWeight: 600, margin: 0 }}>✓ Service Report Ready</p>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
          Notes: "{draftReport ? draftReport.workDoneNotes.substring(0, 100) : ""}{draftReport && draftReport.workDoneNotes.length > 100 ? "..." : ""}"
        </p>
      </div>

      <div style={{ padding: "14px 16px", background: "var(--accent-light)", borderRadius: 10, border: "1px solid rgba(224,92,42,0.2)", marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600, margin: 0 }}>
          ⚠️ Confirming will officially close ticket {job.id}.
        </p>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={finish}>Confirm &amp; Close Ticket</button>
        <button className="btn btn-outline" onClick={() => setPhase("report")}>Edit Report</button>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// ESCALATION MONITOR PAGE
// ══════════════════════════════════════════════════════════════════════════════
function EscalationPage() {
  const [data, setData] = useState({ escalations: [], breachCount: 0, reminderCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await fetchEscalations()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function EscItem({ e }) {
    const isBreach  = e.type === "BREACH" || e.type === "SLA_BREACH";
    const isPending = e.type === "PENDING_APPROVAL";
    const color = isBreach ? "var(--accent)" : isPending ? "#7c3aed" : "var(--brand)";
    const bg    = isBreach ? "var(--accent-light)" : isPending ? "#f3e8ff" : "var(--brand-light)";
    const label = isBreach ? "SLA BREACH" : isPending ? "PARTS PENDING" : "SLA WARNING";

    return (
      <div className="card card-hover mb-16 animate-in" style={{ borderLeft: `4px solid ${color}`, display: "flex", gap: "20px", alignItems: "center" }}>
        <div style={{ background: bg, color, padding: "12px", borderRadius: "12px" }}>
          <Icon.alert style={{ width: 24 }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <h4 className="display-font" style={{ fontSize: 16, color }}>{label}</h4>
            <span className="mono" style={{ fontSize: 12, opacity: 0.6 }}>{timeAgo(e.triggeredAt)}</span>
          </div>
          <p style={{ fontSize: 14, marginBottom: 8 }}>{e.message}</p>
          <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--text-muted)" }}>
            <span className="mono" style={{ background: "var(--bg-subtle)", padding: "2px 6px", borderRadius: 4 }}>{e.ticketId}</span>
            <span>{e.customerName}</span>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return <Spinner message="Loading alerts..." />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;

  return (
    <div className="animate-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 className="display-font" style={{ fontSize: 32, marginBottom: 4 }}>Escalation Monitor</h1>
          <p style={{ color: "var(--text-secondary)" }}>SLA breaches, warnings, and parts pending approval.</p>
        </div>
        <button className="btn btn-outline" onClick={load} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Icon.refresh /> Refresh
        </button>
      </div>

      <div className="stats-grid mb-24">
        <div className="card"><div className="stat-label">SLA Breaches</div><div className="stat-value" style={{ color: data.breachCount > 0 ? "var(--accent)" : "inherit" }}>{data.breachCount}</div></div>
        <div className="card"><div className="stat-label">Warnings</div><div className="stat-value">{data.reminderCount}</div></div>
        <div className="card"><div className="stat-label">Total Events</div><div className="stat-value">{data.escalations.length}</div></div>
      </div>

      <Divider label="All Events" />
      {data.escalations.length > 0
        ? data.escalations.map(e => <EscItem key={e.id} e={e} />)
        : <div className="card" style={{ textAlign: "center", padding: "48px", color: "var(--text-muted)" }}>The operations queue is currently healthy. ✅</div>}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// ROOT APP
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [userRole, setUserRole] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, breached: 0, completed: 0 });
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [view, setView] = useState("jobs");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [alertBadge, setAlertBadge] = useState(0);

  const loadJobs = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await fetchJobs("TECH-001");
      setJobs(data.jobs);
      setStats({ total: data.total, active: data.active, breached: data.breached, completed: data.completed });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  const loadBadges = useCallback(async () => {
    try { const esc = await fetchEscalations(); setAlertBadge(esc.breachCount + esc.reminderCount); }
    catch (_) { /* silent */ }
  }, []);

  useEffect(() => {
    if (userRole === "technician") { loadJobs(); loadBadges(); }
  }, [userRole, loadJobs, loadBadges]);

  const handleLogin = (role) => {
    setUserRole(role);
    window.history.replaceState({}, "", role === "admin" ? "/admin" : "/");
  };

  const handleLogout = () => {
    setUserRole(null);
    window.history.replaceState({}, "", "/");
  };

  if (userRole === "admin")  return <AdminDashboard onLogout={handleLogout} />;
  if (!userRole)             return <LoginPage onLogin={handleLogin} />;

  function NavBtn({ id, label, badge }) {
    const active = view === id && !selectedJobId;
    return (
      <button onClick={() => { setView(id); setSelectedJobId(null); }} style={{
        background: "none", border: "none", padding: "20px 0", cursor: "pointer",
        fontSize: 14, fontWeight: 700,
        color: active ? "var(--brand)" : "var(--text-secondary)",
        borderBottom: active ? "2px solid var(--brand)" : "2px solid transparent",
        transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6,
      }}>
        {label}
        {badge > 0 && (
          <span style={{ background: "var(--accent)", color: "#fff", fontSize: 10, padding: "1px 6px", borderRadius: 10, fontWeight: 700 }}>
            {badge}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="app">
      <header style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--border)" }}>
        <div className="container nav">
          <div className="nav-logo" onClick={() => { setSelectedJobId(null); setView("jobs"); }} style={{ cursor: "pointer" }}>
            <img src="/fiamma_logo.png" alt="Fiamma" style={{ height: 36 }} />
          </div>
          <nav style={{ display: "flex", gap: 32, marginLeft: 48, flex: 1 }}>
            <NavBtn id="jobs"    label="My Jobs"     badge={0} />
            <NavBtn id="alerts"  label="Alerts"      badge={alertBadge} />
            <NavBtn id="ratings" label="My Ratings"  badge={0} />
          </nav>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div className="badge" style={{ background: "var(--brand-light)", color: "var(--brand)", textTransform: "none", borderRadius: 8 }}>
              <span style={{ opacity: 0.6, marginRight: 4 }}>ID:</span> TECH-001
            </div>
            <button className="btn btn-outline" style={{ padding: "6px 12px", fontSize: 12 }} onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="container mt-32">
        {selectedJobId ? (
          <JobDetailPage jobId={selectedJobId} onBack={() => setSelectedJobId(null)} onJobMutated={loadJobs} />
        ) : view === "alerts" ? (
          <EscalationPage />
        ) : view === "ratings" ? (
          <MyRatings techId="TECH-001" />
        ) : (
          <MyJobsPage jobs={jobs} stats={stats} loading={loading} error={error}
            onSelectJob={j => setSelectedJobId(j.id)} onRetry={loadJobs} />
        )}
      </main>

      <footer style={{ marginTop: 60, textAlign: "center" }}>
        <div style={{ height: 1, background: "var(--border)", marginBottom: 40 }} />
        <div className="container">
          <img src="/footer_fiamma.png" alt="Fiamma Field Operations" style={{ maxWidth: "100%", height: "auto" }} />
        </div>
      </footer>
    </div>
  );
}