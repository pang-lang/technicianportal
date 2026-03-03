import { useState, useEffect, useCallback } from "react";
import {
  fetchJobs,
  fetchJobDetail,
  updateJobStatus,
  logFault as apiLogFault,
  approveParts as apiApproveParts,
  completeJob as apiCompleteJob,
  fetchEscalations,
} from "./api";

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
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

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG = {
  ASSIGNED: { label: "Assigned", color: "#1d5fb3", bg: "#e8f0fc" },
  JOB_STARTED: { label: "Job Started", color: "#e05c2a", bg: "#fdf0eb" },
  AWAITING_PARTS: { label: "Awaiting Parts", color: "#7c3aed", bg: "#f3e8ff" },
  COMPLETED: { label: "Completed", color: "#16a34a", bg: "#dcfce7" },
  CANCELLED: { label: "Cancelled", color: "#9c9590", bg: "#f3f1ee" },
  Open: { label: "Open", color: "#1d5fb3", bg: "#e8f0fc" },
};

const URGENCY_CFG = {
  CRITICAL: { label: "CRITICAL", color: "#e11d48", bg: "#ffe4e6" },
  STANDARD: { label: "STANDARD", color: "#e05c2a", bg: "#fdf0eb" },
  LOW: { label: "LOW", color: "#16a34a", bg: "#dcfce7" },
};

const STOCK_CFG = {
  AVAILABLE: { label: "AVAILABLE", color: "#16a34a", bg: "#dcfce7" },
  LOW: { label: "LOW STOCK", color: "#e05c2a", bg: "#fdf0eb" },
  OUT: { label: "OUT OF STOCK", color: "#e11d48", bg: "#ffe4e6" },
  UNKNOWN: { label: "UNKNOWN", color: "#9c9590", bg: "#f3f1ee" },
};

// ── Loading Spinner ──────────────────────────────────────────────────────────
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

// ── Icons (inline SVG as components) ─────────────────────────────────────────
const Icon = {
  jobs: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg>,
  alert: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
  logout: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>,
  back: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>,
  map: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>,
  tool: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>,
  package: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21" /><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>,
  check: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>,
  clock: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  phone: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.53 2 2 0 0 1 3.6 1.37h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.1a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 15.5l.19 1.42z" /></svg>,
  user: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
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
      onLogin();
    } else {
      setError("Invalid credentials. Use hafiz / demo123");
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
          {error && <div style={{ background: "#ffe4e6", border: "1px solid #fecdd3", color: "#e11d48", padding: "12px", borderRadius: "8px", fontSize: "14px", marginBottom: "20px" }}>{error}</div>}
          <div className="form-group">
            <label className="form-label">Username</label>
            <input className="form-control" placeholder="hafiz" value={user}
              onChange={e => setUser(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()} />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-control" type="password" placeholder="demo123" value={pass}
              onChange={e => setPass(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()} />
          </div>
          <button className="btn btn-primary btn-full mt-8" onClick={handleLogin}>
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MY JOBS PAGE
// ══════════════════════════════════════════════════════════════════════════════
function MyJobsPage({ jobs, stats, loading, error, onSelectJob, onRetry }) {
  const active = jobs.filter(j => j.status !== "COMPLETED" && j.status !== "CANCELLED");
  const done = jobs.filter(j => j.status === "COMPLETED");

  function JobItem({ job }) {
    const urg = URGENCY_CFG[job.urgencyLevel] || URGENCY_CFG.STANDARD;
    const stat = STATUS_CFG[job.status] || STATUS_CFG.ASSIGNED;
    const sla = timeLeft(job.slaDeadlineAt);
    const pct = job.slaPercentage != null ? Math.round(job.slaPercentage) : slaPercent(job.createdAt, job.slaDeadlineAt);
    const fillColor = pct >= 100 ? "var(--accent)" : "var(--brand)";

    return (
      <div className="card card-hover mb-16" onClick={() => onSelectJob(job)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "20px" }}>
        <div style={{ padding: "12px", background: "var(--bg-subtle)", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
                <span>•</span>
                <span>{job.productModel}</span>
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
                <div style={{ width: `${pct}%`, height: "100%", background: fillColor, transition: "width 0.5s ease" }} />
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

      <div className="stats-grid">
        <div className="card">
          <div className="stat-label">Total Assigned</div>
          <div className="stat-value">{stats.active}</div>
        </div>
        <div className="card">
          <div className="stat-label">SLA Breached</div>
          <div className="stat-value" style={{ color: stats.breached > 0 ? "var(--accent)" : "inherit" }}>{stats.breached}</div>
        </div>
        <div className="card">
          <div className="stat-label">Completed</div>
          <div className="stat-value" style={{ color: "var(--brand)" }}>{stats.completed}</div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)" }}>Active Jobs</span>
        <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
      </div>

      {active.length > 0 ? (
        active.sort((a, b) => {
          const order = { CRITICAL: 0, STANDARD: 1, LOW: 2 };
          return (order[a.urgencyLevel] ?? 1) - (order[b.urgencyLevel] ?? 1);
        }).map(j => <JobItem key={j.id} job={j} />)
      ) : (
        <div className="card" style={{ textAlign: "center", padding: "48px", color: "var(--text-muted)" }}>
          No active jobs assigned.
        </div>
      )}

      {done.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, marginTop: 40 }}>
            <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)" }}>Completed</span>
            <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
          </div>
          {done.map(j => <JobItem key={j.id} job={j} />)}
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// JOB DETAIL PAGE — fetches full detail from API on mount
// ══════════════════════════════════════════════════════════════════════════════
function JobDetailPage({ jobId, onBack, onJobMutated }) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState("detail"); // detail | fault | parts | complete

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const detail = await fetchJobDetail(jobId);
      setJob(detail);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  // After any mutation, reload both the detail and the parent job list
  async function reloadAfterMutation() {
    await loadDetail();
    onJobMutated();
  }

  if (loading) return <Spinner message="Loading job details..." />;
  if (error) return <ErrorBanner message={error} onRetry={loadDetail} />;
  if (!job) return null;

  const urg = URGENCY_CFG[job.urgencyLevel] || URGENCY_CFG.STANDARD;
  const stat = STATUS_CFG[job.status] || STATUS_CFG.ASSIGNED;
  const sla = timeLeft(job.slaDeadlineAt);
  const pct = job.slaPercentage != null ? Math.round(job.slaPercentage) : slaPercent(job.createdAt, job.slaDeadlineAt);

  const STEPS = [
    { key: "ASSIGNED", label: "Ticket Assigned", icon: <Icon.user /> },
    { key: "JOB_STARTED", label: "Job Started", icon: <Icon.tool /> },
    { key: "AWAITING_PARTS", label: "Awaiting Parts", icon: <Icon.package /> },
    { key: "COMPLETED", label: "Completed", icon: <Icon.check /> },
  ];
  const ORDER = ["ASSIGNED", "JOB_STARTED", "AWAITING_PARTS", "COMPLETED"];
  const curIdx = ORDER.indexOf(job.status);

  return (
    <div className="animate-in">
      <button className="btn btn-outline mb-16" onClick={onBack} style={{ border: "none", paddingLeft: 0 }}>
        <Icon.back style={{ width: 16 }} /> Back to Dashboard
      </button>

      <div className="card mb-16">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <div className="mono" style={{ color: "var(--brand)", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{job.id}</div>
            <h1 className="display-font" style={{ fontSize: 28 }}>{job.customerName}</h1>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span className="badge" style={{ color: stat.color, background: stat.bg }}>{stat.label}</span>
            <span className="badge" style={{ color: urg.color, background: urg.bg }}>{urg.label}</span>
          </div>
        </div>

        <div className="stats-grid" style={{ marginBottom: 0, gap: "1px", background: "var(--border)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ background: "#fff", padding: "16px" }}>
            <div className="stat-label" style={{ marginTop: 0 }}>Product</div>
            <div style={{ fontWeight: 600 }}>{job.productModel}</div>
          </div>
          <div style={{ background: "#fff", padding: "16px" }}>
            <div className="stat-label" style={{ marginTop: 0 }}>Serial / Product ID</div>
            <div className="mono">{job.serialNumber}</div>
          </div>
          <div style={{ background: "#fff", padding: "16px" }}>
            <div className="stat-label" style={{ marginTop: 0 }}>Warranty</div>
            <div style={{ color: job.warrantyStatus === "UNDER_WARRANTY" ? "var(--brand)" : "var(--accent)", fontWeight: 600 }}>
              {job.warrantyStatus === "UNDER_WARRANTY" ? "Under Warranty" : "Expired"}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 24, padding: "20px", background: "var(--bg-subtle)", borderRadius: "12px" }}>
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
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "24px", alignItems: "start" }}>
        <div className="card">
          <h3 className="display-font mb-16" style={{ fontSize: 20 }}>Actions</h3>

          {job.status === "ASSIGNED" && view === "detail" && (
            <div style={{ display: "flex", gap: 12 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={async () => {
                await updateJobStatus(job.id, "JOB_STARTED");
                await reloadAfterMutation();
                setView("fault");
              }}>
                Start Service Job
              </button>
              <button className="btn btn-outline">
                <Icon.phone style={{ width: 16 }} /> Contact
              </button>
            </div>
          )}

          {job.status === "JOB_STARTED" && view === "detail" && !job.faultType && (
            <button className="btn btn-primary btn-full" onClick={() => setView("fault")}>
              Log Diagnostic Fault
            </button>
          )}

          {job.status === "AWAITING_PARTS" && view === "detail" && (
            <div style={{ padding: "16px", background: "var(--brand-light)", borderRadius: "12px", border: "1px solid var(--brand-mid)" }}>
              <div style={{ fontWeight: 700, color: "var(--brand)", marginBottom: 4 }}>Pending Part Approval</div>
              <p style={{ fontSize: 13, color: "var(--brand-mid)" }}>The required components are currently under review for warranty coverage.</p>
            </div>
          )}

          {job.faultType && view === "detail" && job.status === "JOB_STARTED" && (
            <div style={{ display: "flex", gap: 12 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setView("parts")}>
                Replaceable Parts
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setView("complete")}>
                Complete Service
              </button>
            </div>
          )}

          {view === "fault" && <LogFaultView job={job} onDone={reloadAfterMutation} setView={setView} />}
          {view === "parts" && <PartsView job={job} onDone={reloadAfterMutation} setView={setView} />}
          {view === "complete" && <CompleteJobView job={job} onDone={reloadAfterMutation} setView={setView} onBack={onBack} />}
        </div>

        <div className="card">
          <h3 className="display-font mb-16" style={{ fontSize: 20 }}>Job History</h3>
          <div className="timeline">
            {STEPS.map((step, i) => {
              const stepIdx = ORDER.indexOf(step.key);
              const isDone = stepIdx < curIdx;
              const isActive = stepIdx === curIdx;

              return (
                <div key={step.key} className="timeline-item">
                  <div className="timeline-dot-wrap">
                    <div className={`timeline-dot ${isDone ? 'done' : isActive ? 'active' : ''}`}>
                      {isDone ? <Icon.check style={{ width: 14 }} /> : step.icon}
                    </div>
                    {i < STEPS.length - 1 && <div className={`timeline-line ${isDone ? 'done' : ''}`} />}
                  </div>
                  <div className="timeline-content">
                    <div className="timeline-title" style={{ color: isActive ? 'var(--brand)' : isDone ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {step.label}
                    </div>
                    {isDone && <div className="timeline-meta">{timeAgo(job.createdAt)}</div>}
                    {isActive && <div className="timeline-meta" style={{ color: 'var(--brand)', fontWeight: 600 }}>Active Phase</div>}
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

// ── Log Fault sub-view — calls POST /portal/tickets/{id}/fault ───────────────
function LogFaultView({ job, onDone, setView }) {
  const [faultType, setFaultType] = useState(job.faultType || "");
  const [notes, setNotes] = useState(job.faultNotes || "");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function submit() {
    if (!faultType) return;
    setSubmitting(true);
    setError(null);
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

  if (result) {
    return (
      <div className="animate-in" style={{ marginTop: 24 }}>
        <div style={{ padding: "20px", background: "var(--brand-light)", borderRadius: "12px", border: "1px solid var(--brand-mid)" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ padding: "8px", background: "var(--brand)", color: "#fff", borderRadius: "8px" }}>
              <Icon.check style={{ width: 16 }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: "var(--brand)", marginBottom: 4 }}>Fault Analysis Recorded</div>
              <p style={{ fontSize: 13, color: "var(--brand-mid)", marginBottom: 4 }}>
                Diagnostic: <strong>{result.faultType}</strong> — {result.predictedParts.length} parts predicted (RM {result.totalCost.toFixed(2)})
              </p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>{result.approvalReason}</p>
              <button className="btn btn-primary" onClick={() => setView("parts")}>
                View Required Parts
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
          <option>Not Cooling</option>
          <option>Weak Cooling</option>
          <option>Noisy</option>
          <option>Leaking</option>
          <option>Leaking Water</option>
          <option>Not Running</option>
          <option>No Power</option>
          <option>Remote / Display Issue</option>
          <option>Other</option>
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Field Observations</label>
        <textarea className="form-control" placeholder="Describe the technical findings on-site..." value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={submit} disabled={!faultType || submitting}>
          {submitting ? "Submitting..." : "Update Service Record"}
        </button>
        <button className="btn btn-outline" onClick={() => setView("detail")}>Cancel</button>
      </div>
    </div>
  );
}

// ── Parts View — uses predicted parts from API, calls approve-parts ──────────
function PartsView({ job, onDone, setView }) {
  const parts = job.predictedParts || [];
  const total = parts.reduce((s, p) => s + p.cost, 0);
  const [approved, setApproved] = useState(job.partsApproved);
  const [submitting, setSubmitting] = useState(false);

  async function requestParts() {
    setSubmitting(true);
    try {
      await apiApproveParts(job.id, true);
      setApproved(true);
      await onDone();
    } catch (e) {
      alert(`Failed: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="animate-in" style={{ marginTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 className="display-font" style={{ fontSize: 20 }}>Required Components</h3>
        <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>AI-Predicted List</span>
      </div>

      {parts.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>
          No parts predicted. Please log a fault first.
        </div>
      ) : (
        <>
          <div style={{ border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden", marginBottom: 20 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "var(--bg-subtle)", textAlign: "left" }}>
                  <th style={{ padding: "12px 16px", fontWeight: 700, fontSize: 12, color: "var(--text-secondary)" }}>PART NAME</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, fontSize: 12, color: "var(--text-secondary)" }}>STATUS</th>
                  <th style={{ padding: "12px 16px", fontWeight: 700, fontSize: 12, color: "var(--text-secondary)", textAlign: "right" }}>COST</th>
                </tr>
              </thead>
              <tbody>
                {parts.map(p => {
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
                      <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600 }}>
                        RM {p.cost.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: "var(--bg-subtle)", borderTop: "1px solid var(--border)" }}>
                  <td colSpan="2" style={{ padding: "12px 16px", fontWeight: 700 }}>Total Estimated Cost</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: "var(--brand)", fontSize: 16 }}>RM {total.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            {!approved ? (
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={requestParts} disabled={submitting}>
                {submitting ? "Submitting..." : "Request Parts Approval"}
              </button>
            ) : (
              <div style={{ flex: 1, padding: "10px", background: "var(--brand)", color: "#fff", borderRadius: "8px", textAlign: "center", fontWeight: 600 }}>
                Parts Requested & Approved
              </div>
            )}
            <button className="btn btn-outline" onClick={() => setView("detail")}>Back to Details</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Complete Job — calls POST /portal/tickets/{id}/complete ──────────────────
function CompleteJobView({ job, onDone, setView, onBack }) {
  const [workNotes, setWorkNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function finish() {
    setSubmitting(true);
    setError(null);
    try {
      const partIds = (job.predictedParts || []).map(p => p.partId);
      const res = await apiCompleteJob(job.id, partIds, workNotes || "Service completed");
      setResult(res);
      await onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="animate-in" style={{ marginTop: 24, textAlign: "center" }}>
        <div style={{ padding: "32px", background: "var(--brand-light)", borderRadius: "20px", border: "1px dashed var(--brand-mid)" }}>
          <div style={{ width: 64, height: 64, background: "var(--brand)", color: "#fff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <Icon.check style={{ width: 32 }} />
          </div>
          <h2 className="display-font" style={{ fontSize: 24, marginBottom: 8 }}>Service Completed</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>{result.message}</p>

          {result.compensationCode && (
            <div style={{ padding: "20px", background: "#fff", borderRadius: "12px", border: "1px solid var(--border)", marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--brand)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Customer Compensation Code</div>
              <div className="mono" style={{ fontSize: 24, fontWeight: 800, letterSpacing: "0.1em", color: "var(--text-primary)" }}>{result.compensationCode}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>SLA was breached — compensation voucher auto-generated.</div>
            </div>
          )}

          <button className="btn btn-primary btn-full" onClick={onBack}>
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in" style={{ marginTop: 24 }}>
      <h3 className="display-font mb-16" style={{ fontSize: 20 }}>Finalize Service</h3>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>Please confirm all repairs are tested and the customer is satisfied before closing this ticket.</p>

      {error && <ErrorBanner message={error} />}

      <div className="form-group">
        <label className="form-label">Work Done Notes</label>
        <textarea className="form-control" style={{ minHeight: 100 }} placeholder="Describe the repairs performed..." value={workNotes} onChange={e => setWorkNotes(e.target.value)} />
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={finish} disabled={submitting}>
          {submitting ? "Closing..." : "Confirm & Close Ticket"}
        </button>
        <button className="btn btn-outline" onClick={() => setView("detail")}>Cancel</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ESCALATION MONITOR PAGE — fetches from GET /portal/escalations
// ══════════════════════════════════════════════════════════════════════════════
function EscalationPage() {
  const [data, setData] = useState({ escalations: [], breachCount: 0, reminderCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchEscalations();
      setData(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const breaches = data.escalations.filter(e => e.type === "BREACH" || e.type === "SLA_BREACH");
  const reminders = data.escalations.filter(e => e.type !== "BREACH" && e.type !== "SLA_BREACH");

  function EscItem({ e }) {
    const isBreach = e.type === "BREACH" || e.type === "SLA_BREACH";
    return (
      <div className="card card-hover mb-16 animate-in" style={{ borderLeft: `4px solid ${isBreach ? 'var(--accent)' : 'var(--brand)'}`, display: "flex", gap: "20px", alignItems: "center" }}>
        <div style={{ background: isBreach ? "var(--accent-light)" : "var(--brand-light)", color: isBreach ? "var(--accent)" : "var(--brand)", padding: "12px", borderRadius: "12px" }}>
          <Icon.alert style={{ width: 24 }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <h4 className="display-font" style={{ fontSize: 16, color: isBreach ? "var(--accent)" : "var(--brand)" }}>
              {isBreach ? "SLA BREACH" : "SLA WARNING"}
            </h4>
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

  if (loading) return <Spinner message="Loading escalation data..." />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;

  return (
    <div className="animate-in">
      <div className="mb-16">
        <h1 className="display-font" style={{ fontSize: 32, marginBottom: 4 }}>Operations Watch</h1>
        <p style={{ color: "var(--text-secondary)" }}>Live monitoring of ticket SLAs and team alerts</p>
      </div>

      <div className="stats-grid">
        <div className="card">
          <div className="stat-label">Critical Breaches</div>
          <div className="stat-value" style={{ color: data.breachCount > 0 ? "var(--accent)" : "inherit" }}>{data.breachCount}</div>
        </div>
        <div className="card">
          <div className="stat-label">Active Reminders</div>
          <div className="stat-value" style={{ color: "var(--brand)" }}>{data.reminderCount}</div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, marginTop: 32 }}>
        <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)" }}>Active Escalations</span>
        <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
      </div>

      {data.escalations.length > 0 ? (
        data.escalations.map(e => <EscItem key={e.id} e={e} />)
      ) : (
        <div className="card" style={{ textAlign: "center", padding: "48px", color: "var(--text-muted)" }}>
          The operations queue is currently healthy.
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ROOT APP — Fetches jobs from API on login
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, breached: 0, completed: 0 });
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [view, setView] = useState("jobs"); // jobs | alerts
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [alertBadge, setAlertBadge] = useState(0);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJobs("TECH-001");
      setJobs(data.jobs);
      setStats({ total: data.total, active: data.active, breached: data.breached, completed: data.completed });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load alert badge count
  const loadAlertCount = useCallback(async () => {
    try {
      const esc = await fetchEscalations();
      setAlertBadge(esc.breachCount + esc.reminderCount);
    } catch (_) { /* silent */ }
  }, []);

  // Load jobs when logged in
  useEffect(() => {
    if (isLoggedIn) {
      loadJobs();
      loadAlertCount();
    }
  }, [isLoggedIn, loadJobs, loadAlertCount]);

  if (!isLoggedIn) return <LoginPage onLogin={() => setIsLoggedIn(true)} />;

  return (
    <div className="app">
      <header className="header" style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(255,255,255,0.8)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--border)" }}>
        <div className="container nav">
          <div className="nav-logo" onClick={() => { setSelectedJobId(null); setView("jobs"); }} style={{ cursor: "pointer" }}>
            <div className="nav-logo-icon">
              <Icon.tool />
            </div>
            <div className="nav-logo-text">
              Air<span>Home</span> <span style={{ fontWeight: 400, opacity: 0.6, fontSize: 14, marginLeft: 8 }}>Ops</span>
            </div>
          </div>

          <nav style={{ display: "flex", gap: 32, marginLeft: 48, flex: 1 }}>
            <button onClick={() => { setView("jobs"); setSelectedJobId(null); }} style={{ background: "none", border: "none", padding: "20px 0", cursor: "pointer", fontSize: 14, fontWeight: 700, color: view === "jobs" ? "var(--brand)" : "var(--text-secondary)", borderBottom: view === "jobs" ? "2px solid var(--brand)" : "2px solid transparent", transition: "all 0.2s" }}>
              My Jobs
            </button>
            <button onClick={() => { setView("alerts"); setSelectedJobId(null); }} style={{ background: "none", border: "none", padding: "20px 0", cursor: "pointer", fontSize: 14, fontWeight: 700, color: view === "alerts" ? "var(--brand)" : "var(--text-secondary)", borderBottom: view === "alerts" ? "2px solid var(--brand)" : "2px solid transparent", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6 }}>
              Alerts {alertBadge > 0 && <span style={{ background: "var(--accent)", color: "#fff", fontSize: 10, padding: "1px 6px", borderRadius: 10 }}>{alertBadge}</span>}
            </button>
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div className="badge" style={{ background: "var(--brand-light)", color: "var(--brand)", textTransform: "none", borderRadius: 8 }}>
              <span style={{ opacity: 0.6, marginRight: 4 }}>ID:</span> TECH-001
            </div>
            <button className="btn btn-outline" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => setIsLoggedIn(false)}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="container mt-32">
        {selectedJobId ? (
          <JobDetailPage
            jobId={selectedJobId}
            onBack={() => setSelectedJobId(null)}
            onJobMutated={loadJobs}
          />
        ) : view === "alerts" ? (
          <EscalationPage />
        ) : (
          <MyJobsPage
            jobs={jobs}
            stats={stats}
            loading={loading}
            error={error}
            onSelectJob={j => setSelectedJobId(j.id)}
            onRetry={loadJobs}
          />
        )}
      </main>

      <footer style={{ marginTop: 60, padding: "40px 0", borderTop: "1px solid var(--border)", textAlign: "center" }}>
        <div className="container">
          <div className="display-font" style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Fiamma Field Operations</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>© 2026 Fiamma Services. Internal Technician Use Only.</div>
        </div>
      </footer>
    </div>
  );
}
