import { useState, useEffect, useRef, useCallback } from "react";
import { submitServiceReport, fetchTicketDocuments } from "./api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-MY", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
    return (
        <div style={{
            fontSize: 10, fontWeight: 800, letterSpacing: "0.12em",
            textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6,
        }}>
            {children}
        </div>
    );
}

function InfoRow({ label, value, mono, accent }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</span>
            <span style={{
                fontSize: 13, fontWeight: 600,
                fontFamily: mono ? "monospace" : "inherit",
                color: accent || "var(--text-primary)",
            }}>
                {value || "—"}
            </span>
        </div>
    );
}

// Reusable inline signature pad (touch + mouse)
function SignaturePad({ onSave, height = 140 }) {
    const canvasRef = useRef(null);
    const drawing = useRef(false);

    useEffect(() => {
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;
        ctx.strokeStyle = "#1a1714";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
    }, []);

    function pos(e) {
        const r = canvasRef.current.getBoundingClientRect();
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: cx - r.left, y: cy - r.top };
    }

    function start(e) { e.preventDefault(); drawing.current = true; const ctx = canvasRef.current.getContext("2d"); const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
    function move(e) { e.preventDefault(); if (!drawing.current) return; const ctx = canvasRef.current.getContext("2d"); const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); }
    function stop() { drawing.current = false; }
    function clear() { const c = canvasRef.current; c.getContext("2d").clearRect(0, 0, c.width, c.height); }
    function save() { onSave(canvasRef.current.toDataURL("image/png")); }

    return (
        <div>
            <div style={{ border: "1.5px solid var(--border)", borderRadius: 8, background: "#fff", overflow: "hidden", marginBottom: 8 }}>
                <canvas
                    ref={canvasRef}
                    width={520}
                    height={height}
                    onMouseDown={start} onMouseMove={move} onMouseUp={stop} onMouseLeave={stop}
                    onTouchStart={start} onTouchMove={move} onTouchEnd={stop}
                    style={{ display: "block", cursor: "crosshair", touchAction: "none", width: "100%", height: height }}
                />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-outline" onClick={clear} style={{ padding: "5px 14px", fontSize: 12 }}>Clear</button>
                <button className="btn btn-primary" onClick={save} style={{ padding: "5px 14px", fontSize: 12 }}>Confirm Signature</button>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENT 1 — ServiceReportSubmitView
//
// Renders a form for the technician to fill out and submit a service report
// after completing the job. Captures their signature and submits to backend.
//
// Props:
//   job              {Object}   — the full normalized job object from fetchJobDetail()
//   onReportSubmitted {Function} — called with the API response after success
//
// Usage in CompleteJobView (result phase) inside App.jsx:
//   Replace or augment the "Service Completed" success block with:
//
//   {!reportSubmitted
//     ? <ServiceReportSubmitView job={job} onReportSubmitted={() => setReportSubmitted(true)} />
//     : <div>✓ Report submitted</div>
//   }
// ══════════════════════════════════════════════════════════════════════════════
export function ServiceReportSubmitView({ job, onReportSubmitted }) {
    const [phase, setPhase] = useState("form"); // form | preview | submitting | done
    const [workNotes, setWorkNotes] = useState(job.faultNotes || "");
    const [signature, setSignature] = useState(null);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);

    const partsUsed = job.predictedParts || [];
    const totalCost = partsUsed.reduce((s, p) => s + (p.cost || 0), 0);

    async function handleSubmit() {
        if (!workNotes.trim()) { setError("Please describe the technical work done."); return; }
        if (!signature) { setError("Technician signature is required to submit the report."); return; }
        setError(null);
        setPhase("submitting");
        try {
            const res = await submitServiceReport(job.id, {
                techId:         "TECH-001",
                faultType:      job.faultType,
                faultNotes:     job.faultNotes,
                workDoneNotes:  workNotes,
                partsUsed:      partsUsed.map(p => ({ partId: p.partId, name: p.name, cost: p.cost })),
                totalPartsCost: totalCost,
                completedAt:    job.completedAt || new Date().toISOString(),
                signature:      signature,
            });
            setResult(res);
            setPhase("done");
            onReportSubmitted?.(res);
        } catch (e) {
            setError(e.message);
            setPhase("preview");
        }
    }

    // ── Done state ────────────────────────────────────────────────────────────
    if (phase === "done") {
        return (
            <div className="animate-in" style={{ marginTop: 24, padding: "28px", background: "var(--brand-light)", borderRadius: 16, border: "1px solid var(--brand-mid)", textAlign: "center" }}>
                <div style={{ width: 52, height: 52, background: "var(--brand)", color: "#fff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 24 }}>
                    ✓
                </div>
                <h3 className="display-font" style={{ fontSize: 20, marginBottom: 8 }}>Service Report Submitted</h3>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                    The report has been saved under ticket <strong>{job.id}</strong> and sent to admin for job closure.
                </p>
                <div style={{ background: "#fff", borderRadius: 10, padding: "12px 16px", border: "1px solid var(--border)", textAlign: "left", fontSize: 13 }}>
                    <div style={{ display: "flex", gap: 16 }}>
                        <span style={{ color: "var(--brand)", fontWeight: 700 }}>📄 Service Report</span>
                        {job.quotation && <span style={{ color: "var(--brand)", fontWeight: 700 }}>💰 Quotation Archive</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>Both documents are accessible from the ticket detail page.</div>
                </div>
            </div>
        );
    }

    // ── Submitting state ──────────────────────────────────────────────────────
    if (phase === "submitting") {
        return (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ width: 36, height: 36, border: "3px solid var(--border)", borderTopColor: "var(--brand)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
                <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Submitting service report to admin...</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    // ── Preview state ─────────────────────────────────────────────────────────
    if (phase === "preview") {
        return (
            <div className="animate-in" style={{ marginTop: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <h3 className="display-font" style={{ fontSize: 22, margin: 0 }}>Review Service Report</h3>
                    <span className="badge" style={{ background: "var(--brand-light)", color: "var(--brand)" }}>PREVIEW</span>
                </div>

                {error && (
                    <div style={{ background: "#ffe4e6", border: "1px solid #fecdd3", padding: "12px 16px", borderRadius: 8, marginBottom: 16, fontSize: 13, color: "#e11d48" }}>
                        {error}
                    </div>
                )}

                {/* Job summary */}
                <div className="card mb-16" style={{ background: "var(--bg-subtle)", borderStyle: "dashed" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
                        <InfoRow label="Customer" value={job.customerName} />
                        <InfoRow label="Ticket ID" value={job.id} mono accent="var(--brand)" />
                        <InfoRow label="Product" value={job.productModel} />
                        <InfoRow label="Fault Diagnosed" value={job.faultType || "Not specified"} accent="var(--accent)" />
                    </div>
                </div>

                {/* Field observations */}
                <div className="card mb-16">
                    <SectionLabel>Field Observations</SectionLabel>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", fontStyle: "italic", marginBottom: 16 }}>
                        "{job.faultNotes || "No diagnostic notes recorded."}"
                    </p>

                    <SectionLabel>Technical Work Performed</SectionLabel>
                    <p style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.7, marginBottom: 16 }}>
                        {workNotes}
                    </p>

                    {partsUsed.length > 0 && (
                        <>
                            <SectionLabel>Spare Parts Installed</SectionLabel>
                            <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", marginBottom: 0 }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                                    <thead style={{ background: "var(--bg-subtle)" }}>
                                        <tr>
                                            <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, fontSize: 11, color: "var(--text-secondary)" }}>PART</th>
                                            <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, fontSize: 11, color: "var(--text-secondary)" }}>PART ID</th>
                                            <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, fontSize: 11, color: "var(--text-secondary)" }}>COST</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {partsUsed.map(p => (
                                            <tr key={p.partId} style={{ borderTop: "1px solid var(--border)" }}>
                                                <td style={{ padding: "8px 12px", fontWeight: 600 }}>{p.name}</td>
                                                <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)" }}>{p.partId}</td>
                                                <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>RM {(p.cost || 0).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                        <tr style={{ background: "var(--bg-subtle)", borderTop: "1.5px solid var(--border)" }}>
                                            <td colSpan={2} style={{ padding: "8px 12px", fontWeight: 700 }}>Total Parts Material</td>
                                            <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 800, color: "var(--brand)" }}>RM {totalCost.toFixed(2)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>

                {/* Technician signature preview */}
                <div className="card mb-16">
                    <SectionLabel>Technician Signature</SectionLabel>
                    <img src={signature} alt="Technician signature" style={{ border: "1px solid var(--border)", borderRadius: 8, maxWidth: "100%", display: "block" }} />
                </div>

                {/* Warning */}
                <div style={{ padding: "14px 16px", background: "var(--accent-light)", borderRadius: 10, border: "1px solid rgba(224,92,42,0.2)", marginBottom: 20 }}>
                    <p style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600, margin: 0 }}>
                        ⚠️ Submitting this report is final. It will be sent to admin to officially close the job.
                    </p>
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSubmit}>
                        Submit Report to Admin
                    </button>
                    <button className="btn btn-outline" onClick={() => setPhase("form")}>Edit Report</button>
                </div>
            </div>
        );
    }

    // ── Form state (default) ──────────────────────────────────────────────────
    return (
        <div className="animate-in" style={{ marginTop: 24 }}>
            <div style={{ marginBottom: 20 }}>
                <h3 className="display-font" style={{ fontSize: 22, marginBottom: 4 }}>Submit Technician Service Report</h3>
                <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    Document the work performed and sign to send this report to admin for job closure.
                </p>
            </div>

            {/* Auto-filled context */}
            <div className="card mb-16" style={{ background: "var(--brand-light)", borderColor: "var(--brand-mid)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
                    <InfoRow label="Customer" value={job.customerName} />
                    <InfoRow label="Ticket" value={job.id} mono accent="var(--brand)" />
                    <InfoRow label="Fault Type" value={job.faultType || "Not logged"} accent="var(--accent)" />
                    <InfoRow label="Parts Used" value={`${partsUsed.length} item(s) · RM ${totalCost.toFixed(2)}`} />
                </div>
            </div>

            {/* Work notes */}
            <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">Technical Work Performed <span style={{ color: "var(--accent)" }}>*</span></label>
                <textarea
                    className="form-control"
                    style={{ minHeight: 110, lineHeight: 1.6 }}
                    placeholder="Describe the repairs, replacements, tests, and final condition of the appliance..."
                    value={workNotes}
                    onChange={e => setWorkNotes(e.target.value)}
                />
            </div>

            {/* Technician signature */}
            <div className="card mb-16">
                <SectionLabel>Technician Signature <span style={{ color: "var(--accent)" }}>*</span></SectionLabel>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
                    Sign below to certify accuracy of this service report.
                </p>
                {signature ? (
                    <div>
                        <div style={{ fontSize: 12, color: "var(--brand)", fontWeight: 600, marginBottom: 8 }}>✓ Signature captured</div>
                        <img src={signature} alt="Technician signature" style={{ border: "1px solid var(--border)", borderRadius: 8, maxWidth: "100%", display: "block" }} />
                        <button className="btn btn-outline" onClick={() => setSignature(null)} style={{ marginTop: 8, padding: "5px 12px", fontSize: 12 }}>
                            Redraw
                        </button>
                    </div>
                ) : (
                    <SignaturePad onSave={setSignature} />
                )}
            </div>

            {error && (
                <div style={{ background: "#ffe4e6", border: "1px solid #fecdd3", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13, color: "#e11d48" }}>
                    {error}
                </div>
            )}

            <div style={{ display: "flex", gap: 12 }}>
                <button
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    disabled={!workNotes.trim() || !signature}
                    onClick={() => { setError(null); setPhase("preview"); }}
                >
                    Review & Preview Report
                </button>
            </div>
        </div>
    );
}


// ══════════════════════════════════════════════════════════════════════════════
// COMPONENT 2 — TicketDocumentsReview
//
// Fetches and displays archived documents (quotation + service report) for a
// completed ticket. Read-only review panel for both technicians and admins.
//
// Props:
//   ticketId  {string}  — the ticket ID to load documents for
//
// Usage in App.jsx JobDetailPage — inside the "Job Archives" section:
//   <TicketDocumentsReview ticketId={job.id} />
//
// Usage in AdminDashboard — add a "Reports" tab with a ticket selector, then:
//   <TicketDocumentsReview ticketId={selectedTicketId} />
// ══════════════════════════════════════════════════════════════════════════════
export function TicketDocumentsReview({ ticketId }) {
    const [docs, setDocs] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState("report"); // report | quotation

    const load = useCallback(async () => {
        setLoading(true); setError(null);
        try { setDocs(await fetchTicketDocuments(ticketId)); }
        catch (e) { setError(e.message); }
        finally { setLoading(false); }
    }, [ticketId]);

    useEffect(() => { load(); }, [load]);

    if (loading) {
        return (
            <div style={{ textAlign: "center", padding: "32px 20px" }}>
                <div style={{ width: 28, height: 28, border: "2px solid var(--border)", borderTopColor: "var(--brand)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 10px" }} />
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading documents...</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: "16px", background: "#ffe4e6", border: "1px solid #fecdd3", borderRadius: 10, fontSize: 13, color: "#e11d48" }}>
                <strong>Could not load documents:</strong> {error}
                <button className="btn btn-outline" onClick={load} style={{ marginLeft: 12, padding: "4px 10px", fontSize: 11 }}>Retry</button>
            </div>
        );
    }

    if (!docs) return null;

    const hasReport = !!docs.serviceReport;
    const hasQuotation = !!docs.quotation;

    if (!hasReport && !hasQuotation) {
        return (
            <div style={{ padding: "24px", background: "var(--bg-subtle)", borderRadius: 12, textAlign: "center", border: "1px dashed var(--border)" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No documents have been archived for this ticket yet.</p>
            </div>
        );
    }

    // Tab strip — only show tabs that have content
    const tabs = [
        hasReport    && { key: "report",    label: "📄 Service Report" },
        hasQuotation && { key: "quotation", label: "💰 Quotation" },
    ].filter(Boolean);

    return (
        <div className="animate-in">
            {/* Tab bar */}
            {tabs.length > 1 && (
                <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--bg-subtle)", padding: 4, borderRadius: 10 }}>
                    {tabs.map(t => (
                        <button
                            key={t.key}
                            onClick={() => setActiveTab(t.key)}
                            style={{
                                flex: 1, padding: "8px 12px", border: "none", cursor: "pointer",
                                borderRadius: 8, fontSize: 13, fontWeight: 600,
                                background: activeTab === t.key ? "#fff" : "transparent",
                                color: activeTab === t.key ? "var(--brand)" : "var(--text-muted)",
                                boxShadow: activeTab === t.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                                transition: "all 0.2s",
                            }}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            )}

            {/* ── SERVICE REPORT PANEL ── */}
            {(activeTab === "report" || tabs.length === 1 && hasReport) && hasReport && (
                <ServiceReportPanel report={docs.serviceReport} />
            )}

            {/* ── QUOTATION PANEL ── */}
            {(activeTab === "quotation" || tabs.length === 1 && hasQuotation) && hasQuotation && (
                <QuotationPanel quotation={docs.quotation} />
            )}
        </div>
    );
}


// ── Service Report display panel ──────────────────────────────────────────────
function ServiceReportPanel({ report }) {
    const totalCost = (report.partsUsed || []).reduce((s, p) => s + (p.cost || 0), 0);

    return (
        <div>
            {/* Header bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: "var(--text-muted)", textTransform: "uppercase" }}>Service Report</div>
                    <div style={{ fontFamily: "monospace", fontSize: 13, color: "var(--brand)", fontWeight: 700 }}>{report.ticketId}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Submitted</div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{fmt(report.submittedAt)}</div>
                </div>
            </div>

            {/* Fault & observations */}
            <div className="card mb-16" style={{ background: "var(--bg-subtle)" }}>
                <SectionLabel>Fault Diagnosed</SectionLabel>
                <div style={{ fontWeight: 700, color: "var(--accent)", fontSize: 14, marginBottom: 16 }}>
                    {report.faultType || "Not specified"}
                </div>
                <SectionLabel>Field Observations</SectionLabel>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", fontStyle: "italic", lineHeight: 1.6, marginBottom: 16 }}>
                    "{report.faultNotes || "No diagnostic notes."}"
                </p>
                <SectionLabel>Technical Work Performed</SectionLabel>
                <p style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.7 }}>
                    {report.workDoneNotes}
                </p>
            </div>

            {/* Parts */}
            {report.partsUsed && report.partsUsed.length > 0 && (
                <div className="card mb-16">
                    <SectionLabel>Spare Parts Installed</SectionLabel>
                    <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead style={{ background: "var(--bg-subtle)" }}>
                                <tr>
                                    <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>PART</th>
                                    <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>COST</th>
                                </tr>
                            </thead>
                            <tbody>
                                {report.partsUsed.map((p, i) => (
                                    <tr key={p.partId || i} style={{ borderTop: "1px solid var(--border)" }}>
                                        <td style={{ padding: "8px 12px" }}>
                                            <span style={{ fontWeight: 600 }}>{p.name}</span>
                                            <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>({p.partId})</span>
                                        </td>
                                        <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>RM {(p.cost || 0).toFixed(2)}</td>
                                    </tr>
                                ))}
                                <tr style={{ background: "var(--bg-subtle)", borderTop: "1.5px solid var(--border)" }}>
                                    <td style={{ padding: "8px 12px", fontWeight: 700 }}>Total Parts Material</td>
                                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 800, color: "var(--brand)" }}>RM {totalCost.toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Technician signature */}
            {report.techSignature && (
                <div className="card mb-0">
                    <SectionLabel>Technician Signature</SectionLabel>
                    <div style={{ background: "var(--bg-subtle)", padding: 8, borderRadius: 8, border: "1px solid var(--border)" }}>
                        <img src={report.techSignature} alt="Technician signature" style={{ maxWidth: "100%", display: "block", maxHeight: 100 }} />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                        Technician: <strong>{report.techId}</strong> · Completed: {fmt(report.completedAt)}
                    </div>
                </div>
            )}
        </div>
    );
}


// ── Quotation display panel ───────────────────────────────────────────────────
function QuotationPanel({ quotation }) {
    const total = (quotation.parts || []).reduce((s, p) => s + (p.totalCost || p.unitCost || 0), 0);

    return (
        <div>
            {/* Header bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: "var(--text-muted)", textTransform: "uppercase" }}>Customer Quotation</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{quotation.customerName}</div>
                    <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--brand)" }}>{quotation.ticketId}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                    <span className="badge" style={{ background: "var(--brand)", color: "#fff", fontSize: 11, marginBottom: 6, display: "block" }}>APPROVED</span>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{fmt(quotation.createdAt)}</div>
                </div>
            </div>

            {/* Customer details */}
            <div className="card mb-16" style={{ background: "var(--brand-light)", borderColor: "var(--brand-mid)" }}>
                <InfoRow label="Customer Name" value={quotation.customerName} />
                <InfoRow label="Email" value={quotation.customerEmail} mono />
                {quotation.emailSentAt && <InfoRow label="Invoice Emailed" value={fmt(quotation.emailSentAt)} />}
            </div>

            {/* Parts table */}
            <div className="card mb-16">
                <SectionLabel>Quotation Items</SectionLabel>
                <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead style={{ background: "var(--bg-subtle)" }}>
                            <tr>
                                <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>ITEM</th>
                                <th style={{ padding: "8px 12px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>QTY</th>
                                <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>UNIT</th>
                                <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>TOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(quotation.parts || []).map((p, i) => (
                                <tr key={p.partId || i} style={{ borderTop: "1px solid var(--border)" }}>
                                    <td style={{ padding: "8px 12px" }}>
                                        <span style={{ fontWeight: 600 }}>{p.name}</span>
                                        <span style={{ fontFamily: "monospace", fontSize: 10, color: "var(--text-muted)", marginLeft: 6 }}>({p.partId})</span>
                                    </td>
                                    <td style={{ padding: "8px 12px", textAlign: "center" }}>{p.quantity || 1}</td>
                                    <td style={{ padding: "8px 12px", textAlign: "right" }}>RM {(p.unitCost || 0).toFixed(2)}</td>
                                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>RM {(p.totalCost || p.unitCost || 0).toFixed(2)}</td>
                                </tr>
                            ))}
                            <tr style={{ background: "var(--bg-subtle)", borderTop: "1.5px solid var(--border)" }}>
                                <td colSpan={3} style={{ padding: "8px 12px", fontWeight: 700 }}>Total Amount</td>
                                <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 800, color: "var(--brand)", fontSize: 15 }}>
                                    RM {(quotation.totalAmount ?? total).toFixed(2)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Customer signature */}
            {quotation.signature && (
                <div className="card mb-0">
                    <SectionLabel>Customer Signature (Acceptance)</SectionLabel>
                    <div style={{ background: "var(--bg-subtle)", padding: 8, borderRadius: 8, border: "1px solid var(--border)" }}>
                        <img src={quotation.signature} alt="Customer signature" style={{ maxWidth: "100%", display: "block", maxHeight: 100 }} />
                    </div>
                </div>
            )}
        </div>
    );
}