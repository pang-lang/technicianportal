import { useState, useEffect } from "react";

// ── Mock Data ─────────────────────────────────────────────────────────────────
const MOCK_JOBS = [
  {
    id: "TKT-1709001001",
    customerName: "Ahmad bin Razif",
    address: "No. 12, Jalan Damai 3, Taman Damai, 50480 Kuala Lumpur",
    productModel: "Air Conditioner AC-3000X",
    serialNumber: "AC3000X-20240815-009",
    complaintType: "Not Cooling",
    complaintText: "Unit not cooling after 3 months of use. House feels warm even when set to 18°C.",
    warrantyStatus: "UNDER_WARRANTY",
    urgencyLevel: "STANDARD",
    status: "ASSIGNED",
    assignedTechId: "TECH-001",
    faultType: null,
    faultNotes: null,
    predictedParts: [],
    partsApproved: false,
    slaDeadlineAt: new Date(Date.now() + 28 * 60 * 60 * 1000).toISOString(),
    completedAt: null,
    compensationCode: null,
    createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "TKT-1709001002",
    customerName: "Siti Norzahra bt Kamal",
    address: "Unit 5-12, Residensi Putra, Jalan PJU 8/3, 47820 Petaling Jaya",
    productModel: "Water Heater WH-5000P",
    serialNumber: "WH5000P-20230301-042",
    complaintType: "Leaking",
    complaintText: "Water dripping from the bottom of the heater. Getting worse over 2 days.",
    warrantyStatus: "EXPIRED",
    urgencyLevel: "CRITICAL",
    status: "JOB_STARTED",
    assignedTechId: "TECH-001",
    faultType: "Leaking Water",
    faultNotes: "Visible crack on drain valve housing",
    predictedParts: [
      { partId: "PART-005", name: "Drain Pump", stock: "OUT", cost: 95 },
      { partId: "PART-002", name: "Refrigerant Gas R32", stock: "AVAILABLE", cost: 120 },
    ],
    partsApproved: false,
    slaDeadlineAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    completedAt: null,
    compensationCode: null,
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "TKT-1709001003",
    customerName: "HomeCool Sdn Bhd",
    address: "Lot 7, Jalan Industri 5/2, Kawasan Perindustrian Puchong, 47100 Puchong",
    productModel: "Refrigerator RF-2200Q",
    serialNumber: "RF2200Q-20241201-007",
    complaintType: "Noisy",
    complaintText: "Loud rattling noise from compressor area, especially at night.",
    warrantyStatus: "UNDER_WARRANTY",
    urgencyLevel: "LOW",
    status: "COMPLETED",
    assignedTechId: "TECH-001",
    faultType: "Noisy",
    faultNotes: "Loose compressor mounting bracket",
    predictedParts: [
      { partId: "PART-003", name: "Fan Motor PCB", stock: "LOW", cost: 210 },
    ],
    partsApproved: true,
    slaDeadlineAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    compensationCode: null,
    createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
  },
];

const MOCK_ESCALATIONS = [
  {
    id: "ESC-001",
    ticketId: "TKT-1709001002",
    customerName: "Siti Norzahra bt Kamal",
    type: "BREACH",
    message: "SLA deadline passed 4 hours ago. CRITICAL ticket — immediate action required.",
    triggeredAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "ESC-002",
    ticketId: "TKT-1709001001",
    customerName: "Ahmad bin Razif",
    type: "REMINDER",
    message: "70% of SLA time elapsed. Technician reminder sent.",
    triggeredAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "ESC-003",
    ticketId: "TKT-DEMO-002",
    customerName: "Tan Wei Loong",
    type: "BREACH",
    message: "No movement on ticket for 50 hours. Customer dissatisfaction signal detected.",
    triggeredAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
];

const PARTS_LOOKUP = {
  "Not Cooling": [{ partId: "PART-001", name: "Compressor Capacitor", stock: "AVAILABLE", cost: 85 },
  { partId: "PART-002", name: "Refrigerant Gas R32", stock: "AVAILABLE", cost: 120 }],
  "Weak Cooling": [{ partId: "PART-001", name: "Compressor Capacitor", stock: "AVAILABLE", cost: 85 },
  { partId: "PART-002", name: "Refrigerant Gas R32", stock: "AVAILABLE", cost: 120 }],
  "Noisy": [{ partId: "PART-003", name: "Fan Motor PCB", stock: "LOW", cost: 210 },
  { partId: "PART-004", name: "Thermostat Sensor", stock: "AVAILABLE", cost: 45 }],
  "Leaking": [{ partId: "PART-005", name: "Drain Pump", stock: "OUT", cost: 95 },
  { partId: "PART-002", name: "Refrigerant Gas R32", stock: "AVAILABLE", cost: 120 }],
  "Leaking Water": [{ partId: "PART-005", name: "Drain Pump", stock: "OUT", cost: 95 },
  { partId: "PART-002", name: "Refrigerant Gas R32", stock: "AVAILABLE", cost: 120 }],
  "Not Running": [{ partId: "PART-003", name: "Fan Motor PCB", stock: "LOW", cost: 210 },
  { partId: "PART-004", name: "Thermostat Sensor", stock: "AVAILABLE", cost: 45 }],
  "No Power": [{ partId: "PART-003", name: "Fan Motor PCB", stock: "LOW", cost: 210 },
  { partId: "PART-004", name: "Thermostat Sensor", stock: "AVAILABLE", cost: 45 }],
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m ago`;
  return `${m}m ago`;
}

function timeLeft(iso) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return { label: "OVERDUE", over: true };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return { label: `${h}h ${m}m left`, over: false };
}

function slaPercent(createdAt, deadlineAt) {
  const total = new Date(deadlineAt) - new Date(createdAt);
  const elapsed = Date.now() - new Date(createdAt);
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}

function genVoucher() {
  return "DEMO-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG = {
  ASSIGNED: { label: "Assigned", color: "#1d5fb3", bg: "#e8f0fc" },
  JOB_STARTED: { label: "Job Started", color: "#e05c2a", bg: "#fdf0eb" },
  AWAITING_PARTS: { label: "Awaiting Parts", color: "#7c3aed", bg: "#f3e8ff" },
  COMPLETED: { label: "Completed", color: "#16a34a", bg: "#dcfce7" },
  CANCELLED: { label: "Cancelled", color: "#9c9590", bg: "#f3f1ee" },
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
};

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
  gift: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></svg>,
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
          <div className="display-font" style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 8, opacity: 0.8 }}>AirHome · Field Ops</div>
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
function MyJobsPage({ jobs, onSelectJob }) {
  const active = jobs.filter(j => j.status !== "COMPLETED" && j.status !== "CANCELLED");
  const done = jobs.filter(j => j.status === "COMPLETED");

  function JobItem({ job }) {
    const urg = URGENCY_CFG[job.urgencyLevel] || URGENCY_CFG.STANDARD;
    const stat = STATUS_CFG[job.status] || STATUS_CFG.ASSIGNED;
    const sla = timeLeft(job.slaDeadlineAt);
    const pct = slaPercent(job.createdAt, job.slaDeadlineAt);
    const fillColor = pct >= 100 ? "var(--accent)" : "var(--brand)";

    return (
      <div className="card card-hover mb-16" onClick={() => onSelectJob(job)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "20px" }}>
        <div style={{ padding: "12px", background: "var(--bg-subtle)", borderRadius: "12px", display: "flex", alignItems: "center", justifyCenter: "center" }}>
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
              <Icon.map style={{ width: 14 }} /> {job.address.split(',')[0]}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const open = active.filter(j => j.status !== "COMPLETED");
  const breached = active.filter(j => slaPercent(j.createdAt, j.slaDeadlineAt) >= 100).length;

  return (
    <div className="animate-in">
      <div className="mb-16">
        <h1 className="display-font" style={{ fontSize: 32, marginBottom: 4 }}>Daily Operations</h1>
        <p style={{ color: "var(--text-secondary)" }}>Manage your service tickets and track performance</p>
      </div>

      <div className="stats-grid">
        <div className="card">
          <div className="stat-label">Total Assigned</div>
          <div className="stat-value">{active.length}</div>
        </div>
        <div className="card">
          <div className="stat-label">SLA Breached</div>
          <div className="stat-value" style={{ color: breached > 0 ? "var(--accent)" : "inherit" }}>{breached}</div>
        </div>
        <div className="card">
          <div className="stat-label">Completed</div>
          <div className="stat-value" style={{ color: "var(--brand)" }}>{done.length}</div>
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
          return order[a.urgencyLevel] - order[b.urgencyLevel];
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
// JOB DETAIL PAGE
// ══════════════════════════════════════════════════════════════════════════════
function JobDetailPage({ job: initialJob, onBack, onUpdate }) {
  const [job, setJob] = useState(initialJob);
  const [view, setView] = useState("detail"); // detail | fault | parts | complete

  function updateJob(patch) {
    const updated = { ...job, ...patch };
    setJob(updated);
    onUpdate(updated);
  }

  const urg = URGENCY_CFG[job.urgencyLevel] || URGENCY_CFG.STANDARD;
  const stat = STATUS_CFG[job.status] || STATUS_CFG.ASSIGNED;
  const sla = timeLeft(job.slaDeadlineAt);
  const pct = slaPercent(job.createdAt, job.slaDeadlineAt);

  // Timeline steps
  const STEPS = [
    { key: "NEW", label: "Ticket Created", icon: <Icon.user /> },
    { key: "ASSIGNED", label: "Technician Assigned", icon: <Icon.tool /> },
    { key: "JOB_STARTED", label: "Job Started", icon: <Icon.tool /> },
    { key: "AWAITING_PARTS", label: "Awaiting Parts", icon: <Icon.package /> },
    { key: "COMPLETED", label: "Completed", icon: <Icon.check /> },
  ];
  const ORDER = ["NEW", "ASSIGNED", "JOB_STARTED", "AWAITING_PARTS", "COMPLETED"];
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
            <div className="stat-label" style={{ marginTop: 0 }}>Serial Number</div>
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

          {job.status === "ASSIGNED" && (
            <div style={{ display: "flex", gap: 12 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { updateJob({ status: "JOB_STARTED" }); setView("fault"); }}>
                Start Service Job
              </button>
              <button className="btn btn-outline">
                <Icon.phone style={{ width: 16 }} /> Contact
              </button>
            </div>
          )}

          {job.status === "JOB_STARTED" && view === "detail" && (
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

          {view === "fault" && <LogFaultView job={job} updateJob={updateJob} setView={setView} />}
          {view === "parts" && <PartsView job={job} updateJob={updateJob} setView={setView} />}
          {view === "complete" && <CompleteJobView job={job} updateJob={updateJob} setView={setView} onBack={onBack} />}
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
                  <div className={`timeline-dot-wrap`}>
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

// ── Log Fault sub-view ─────────────────────────────────────────────────────────
function LogFaultView({ job, updateJob, setView }) {
  const [faultType, setFaultType] = useState(job.faultType || "");
  const [notes, setNotes] = useState(job.faultNotes || "");
  const [submitted, setSubmitted] = useState(false);

  function submit() {
    if (!faultType) return;
    const predicted = PARTS_LOOKUP[faultType] || PARTS_LOOKUP["Not Cooling"];
    updateJob({ faultType, faultNotes: notes, predictedParts: predicted });
    setSubmitted(true);
  }

  if (submitted) {
    const parts = PARTS_LOOKUP[faultType] || [];
    const total = parts.reduce((s, p) => s + p.cost, 0);
    const autoApprove = job.warrantyStatus === "UNDER_WARRANTY" && total <= 500;

    return (
      <div className="animate-in" style={{ marginTop: 24 }}>
        <div style={{ padding: "20px", background: "var(--brand-light)", borderRadius: "12px", border: "1px solid var(--brand-mid)" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ padding: "8px", background: "var(--brand)", color: "#fff", borderRadius: "8px" }}>
              <Icon.check style={{ width: 16 }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: "var(--brand)", marginBottom: 4 }}>Fault Analysis Recorded</div>
              <p style={{ fontSize: 13, color: "var(--brand-mid)", marginBottom: 16 }}>Diagnostic: <strong>{faultType}</strong>. {autoApprove ? "Components auto-approved under warranty." : "Submitted for manager authorization."}</p>
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
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={submit} disabled={!faultType}>
          Update Service Record
        </button>
        <button className="btn btn-outline" onClick={() => setView("detail")}>Cancel</button>
      </div>
    </div>
  );
}

// ── Parts View sub-view ───────────────────────────────────────────────────────
function PartsView({ job, updateJob, setView }) {
  const parts = job.predictedParts || [];
  const total = parts.reduce((s, p) => s + p.cost, 0);
  const autoApprove = job.warrantyStatus === "UNDER_WARRANTY" && total <= 500;
  const [approved, setApproved] = useState(job.partsApproved);

  function requestParts() {
    if (autoApprove) {
      updateJob({ partsApproved: true, status: "AWAITING_PARTS" });
      setApproved(true);
    } else {
      updateJob({ status: "AWAITING_PARTS" });
    }
  }

  return (
    <div className="animate-in" style={{ marginTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 className="display-font" style={{ fontSize: 20 }}>Required Components</h3>
        <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>AI-Predicted List</span>
      </div>

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
              const stock = STOCK_CFG[p.stock] || STOCK_CFG.AVAILABLE;
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

      <div style={{ padding: "16px", background: autoApprove ? "var(--brand-light)" : "var(--accent-light)", borderRadius: "12px", marginBottom: 24, border: "1px solid", borderColor: autoApprove ? "var(--brand-mid)" : "var(--accent)" }}>
        <div style={{ fontWeight: 700, color: autoApprove ? "var(--brand)" : "var(--accent)", marginBottom: 4 }}>
          {autoApprove ? "Warranty Coverage Applicable" : "Approval Required"}
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          {autoApprove
            ? "This service is eligible for automatic part approval under standard warranty terms."
            : "The estimated cost exceeds the auto-approval threshold. Manager authorization is required."}
        </p>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        {!approved ? (
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={requestParts}>
            {autoApprove ? "Auto-Approve & Request Parts" : "Submit for Approval"}
          </button>
        ) : (
          <div style={{ flex: 1, padding: "10px", background: "var(--brand)", color: "#fff", borderRadius: "8px", textAlign: "center", fontWeight: 600 }}>
            Parts Requested & Approved
          </div>
        )}
        <button className="btn btn-outline" onClick={() => setView("detail")}>Back to Details</button>
      </div>
    </div>
  );
}

// ── Complete Job sub-view ─────────────────────────────────────────────────────
function CompleteJobView({ job, updateJob, setView, onBack }) {
  const [code, setCode] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  function finish() {
    const voucher = genVoucher();
    updateJob({ status: "COMPLETED", completedAt: new Date().toISOString(), compensationCode: voucher });
    setConfirmed(true);
  }

  if (confirmed) {
    return (
      <div className="animate-in" style={{ marginTop: 24, textAlign: "center" }}>
        <div style={{ padding: "32px", background: "var(--brand-light)", borderRadius: "20px", border: "1px dashed var(--brand-mid)" }}>
          <div style={{ width: 64, height: 64, background: "var(--brand)", color: "#fff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <Icon.check style={{ width: 32 }} />
          </div>
          <h2 className="display-font" style={{ fontSize: 24, marginBottom: 8 }}>Service Completed</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>The ticket has been closed successfully. A satisfaction survey has been sent to the customer.</p>

          <div style={{ padding: "20px", background: "#fff", borderRadius: "12px", border: "1px solid var(--border)", marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--brand)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Customer Compensation Code</div>
            <div className="mono" style={{ fontSize: 24, fontWeight: 800, letterSpacing: "0.1em", color: "var(--text-primary)" }}>{job.compensationCode}</div>
          </div>

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

      <div className="form-group">
        <label className="form-label">Service Completion Code (Optional)</label>
        <input className="form-control" placeholder="Enter code if provided by customer..." value={code} onChange={e => setCode(e.target.value)} />
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={finish}>
          Confirm & Close Ticket
        </button>
        <button className="btn btn-outline" onClick={() => setView("detail")}>Cancel</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ESCALATION MONITOR PAGE
// ══════════════════════════════════════════════════════════════════════════════
function EscalationPage({ jobs }) {
  const breaches = MOCK_ESCALATIONS.filter(e => e.type === "BREACH");
  const reminders = MOCK_ESCALATIONS.filter(e => e.type === "REMINDER");

  function EscItem({ e }) {
    const isBreach = e.type === "BREACH";
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

  return (
    <div className="animate-in">
      <div className="mb-16">
        <h1 className="display-font" style={{ fontSize: 32, marginBottom: 4 }}>Operations Watch</h1>
        <p style={{ color: "var(--text-secondary)" }}>Live monitoring of ticket SLAs and team alerts</p>
      </div>

      <div className="stats-grid">
        <div className="card">
          <div className="stat-label">Critical Breaches</div>
          <div className="stat-value" style={{ color: breaches.length > 0 ? "var(--accent)" : "inherit" }}>{breaches.length}</div>
        </div>
        <div className="card">
          <div className="stat-label">Active Reminders</div>
          <div className="stat-value" style={{ color: "var(--brand)" }}>{reminders.length}</div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, marginTop: 32 }}>
        <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)" }}>Active Escalations</span>
        <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
      </div>

      {[...breaches, ...reminders].length > 0 ? (
        [...breaches, ...reminders].map(e => <EscItem key={e.id} e={e} />)
      ) : (
        <div className="card" style={{ textAlign: "center", padding: "48px", color: "var(--text-muted)" }}>
          The operations queue is currently healthy.
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ROOT APP
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [jobs, setJobs] = useState(MOCK_JOBS);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [view, setView] = useState("jobs"); // jobs | alerts

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  function updateJob(updated) {
    setJobs(jobs.map(j => j.id === updated.id ? updated : j));
  }

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
              Alerts <span style={{ background: "var(--accent)", color: "#fff", fontSize: 10, padding: "1px 6px", borderRadius: 10 }}>3</span>
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
            job={selectedJob}
            onBack={() => setSelectedJobId(null)}
            onUpdate={updateJob}
          />
        ) : view === "alerts" ? (
          <EscalationPage jobs={jobs} />
        ) : (
          <MyJobsPage
            jobs={jobs}
            onSelectJob={j => setSelectedJobId(j.id)}
          />
        )}
      </main>

      <footer style={{ marginTop: 60, padding: "40px 0", borderTop: "1px solid var(--border)", textAlign: "center" }}>
        <div className="container">
          <div className="display-font" style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>AirHome Field Operations</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>© 2026 AirHome Services. Internal Technician Use Only.</div>
        </div>
      </footer>
    </div>
  );
}
