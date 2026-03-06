// ── Centralized API Client for Technician Portal ────────────────────────────
// Connects to the FastAPI backend and normalizes snake_case → camelCase

const API_BASE = "https://backend-sales-support-evepbqhwfjcdeqaz.canadacentral-01.azurewebsites.net";

// ── Generic fetch wrapper ────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
    const url = `${API_BASE}${path}`;
    try {
        const res = await fetch(url, {
            headers: { "Content-Type": "application/json", ...options.headers },
            ...options,
        });

        if (!res.ok) {
            let detail = `API error ${res.status}`;
            try {
                const body = await res.json();
                const d = body.detail || detail;
                detail = typeof d === 'string' ? d : JSON.stringify(d);
            } catch (_) { /* ignore */ }
            throw new Error(detail);
        }

        return res.json();
    } catch (err) {
        if (err.message === "Failed to fetch" || err.message === "Load failed") {
            throw new Error("Network error — check that the backend is running and CORS is configured.");
        }
        throw err;
    }
}

// ── Data Normalizers ─────────────────────────────────────────────────────────

function normalizeJob(j) {
    return {
        id: j.ticket_id,
        customerName: j.customer_name,
        productModel: j.product_name,
        subject: j.subject,
        complaintType: j.subject,
        complaintText: j.subject,
        warrantyStatus: j.warranty_status,
        urgencyLevel: mapPriorityToUrgency(j.priority),
        status: mapStatus(j.status),
        slaDeadlineAt: j.sla_deadline,
        createdAt: j.created_at,
        slaPercentage: j.sla_percentage,
        slaBreached: j.sla_breached,
        elapsedMinutes: j.elapsed_minutes,
        slaLimitMinutes: j.sla_limit_minutes,
        // detail-only fields (placeholder)
        address: "", serialNumber: "", faultType: null, faultNotes: null,
        predictedParts: [], partsApproved: false, completedAt: null, compensationCode: null,
    };
}

function normalizeJobDetail(d) {
    return {
        id: d.ticket_id,
        orderId: d.order_id,
        customerName: d.customer_name,
        customerEmail: d.customer_email,
        productId: d.product_id,
        productModel: d.product_name,
        productCategory: d.product_category,
        subject: d.subject,
        complaintType: d.subject,
        complaintText: d.description,
        warrantyStatus: d.warranty_status,
        chargeApplicable: d.charge_applicable,
        urgencyLevel: mapPriorityToUrgency(d.priority),
        status: mapStatus(d.status),
        slaDeadlineAt: d.sla_deadline,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
        slaPercentage: d.sla_percentage,
        slaBreached: d.sla_breached,
        elapsedMinutes: d.elapsed_minutes,
        slaLimitMinutes: d.sla_limit_minutes,
        faultType: d.fault_type,
        faultNotes: d.fault_notes,
        predictedParts: (d.predicted_parts || []).map(normalizePart),
        partsApproved: d.parts_approved || false,
        completedAt: d.completed_at,
        compensationCode: d.compensation_code,
        notes: d.notes || [],
        address: "",
        serialNumber: d.product_id,
        // Added for service report review
        quotation: d.quotation || null,
        report: d.report || null,
        appointmentDate: d.appointment_date || null,
        customerPhone: d.customer_phone || "",
    };
}

function normalizePart(p) {
    return {
        partId: p.part_id,
        name: p.name,
        stock: (p.stock || "UNKNOWN").toUpperCase(),
        cost: p.cost || 0,
    };
}

function normalizeEscalation(e) {
    return {
        id: e.escalation_id,
        ticketId: e.ticket_id,
        customerName: e.customer_name,
        type: e.type === "SLA_BREACH" ? "BREACH" : e.type,
        message: e.message,
        triggeredAt: e.triggered_at,
    };
}

// ── Mapping helpers ──────────────────────────────────────────────────────────

function mapPriorityToUrgency(priority) {
    return { High: "CRITICAL", Medium: "STANDARD", Low: "LOW" }[priority] || "STANDARD";
}

function mapStatus(status) {
    return {
        "Open": "ASSIGNED",
        "In Progress": "JOB_STARTED",
        "JOB_STARTED": "JOB_STARTED",
        "ASSIGNED": "ASSIGNED",
        "AWAITING_PARTS": "AWAITING_PARTS",
        "PROCEED_JOB": "PROCEED_JOB",
        "COMPLETED": "COMPLETED",
        "CANCELLED": "CANCELLED",
    }[status] || status;
}

// ── API Functions ────────────────────────────────────────────────────────────

/** Fetch all jobs for a technician */
export async function fetchJobs(techId = "TECH-001") {
    const data = await apiFetch(`/portal/jobs/${techId}`);
    return {
        jobs: (data.jobs || []).map(normalizeJob),
        total: data.total,
        active: data.active,
        breached: data.breached,
        completed: data.completed,
    };
}

/** Fetch full ticket detail */
export async function fetchJobDetail(ticketId) {
    return normalizeJobDetail(await apiFetch(`/portal/tickets/${ticketId}`));
}

/** Update job status */
export async function updateJobStatus(ticketId, newStatus, updatedBy = "TECH-001", notes = null) {
    return apiFetch(`/portal/tickets/${ticketId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ new_status: newStatus, updated_by: updatedBy, notes }),
    });
}

/** Log a fault and receive predicted parts */
export async function logFault(ticketId, faultType, faultNotes = "") {
    const data = await apiFetch(`/portal/tickets/${ticketId}/fault`, {
        method: "POST",
        body: JSON.stringify({ fault_type: faultType, fault_notes: faultNotes }),
    });
    return {
        ticketId: data.ticket_id,
        faultType: data.fault_type,
        predictedParts: (data.predicted_parts || []).map(normalizePart),
        partsApproved: data.parts_approved,
        totalCost: data.total_cost,
        approvalReason: data.approval_reason,
    };
}

/** Technician requests parts approval (sets status → AWAITING_PARTS) */
export async function approveParts(ticketId, approved = true) {
    return apiFetch(`/portal/tickets/${ticketId}/approve-parts?approved=${approved}`, {
        method: "PATCH",
    });
}

/** Complete a job */
export async function completeJob(ticketId, actualPartsUsed = [], workDoneNotes = "Completed") {
    const data = await apiFetch(`/portal/tickets/${ticketId}/complete`, {
        method: "POST",
        body: JSON.stringify({ actual_parts_used: actualPartsUsed, work_done_notes: workDoneNotes }),
    });
    return {
        ticketId: data.ticket_id,
        status: data.status,
        completedAt: data.completed_at,
        slaBreached: data.sla_breached,
        compensationCode: data.compensation_code,
        message: data.message,
    };
}

/** Fetch all escalation events */
export async function fetchEscalations() {
    const data = await apiFetch(`/portal/escalations`);
    return {
        escalations: (data.escalations || []).map(normalizeEscalation),
        breachCount: data.breach_count,
        reminderCount: data.reminder_count,
    };
}

// ── Manager Approval API ─────────────────────────────────────────────────────

/**
 * Fetch all tickets currently awaiting manager parts approval.
 * Used by ManagerApprovalPage to populate the list.
 */
export async function fetchPendingApprovals() {
    const d = await apiFetch("/portal/pending-approvals");
    return {
        approvals: (d.pending_approvals || []).map(a => ({
            ticketId: a.ticket_id,
            customerName: a.customer_name,
            subject: a.subject,
            faultType: a.fault_type,
            warrantyStatus: a.warranty_status,
            totalCost: a.total_cost,
            createdAt: a.created_at,
            predictedParts: (a.predicted_parts || []).map(p => ({
                partId: p.part_id,
                name: p.name,
                stock: (p.stock || "UNKNOWN").toUpperCase(),
                cost: p.cost || 0,
            })),
        })),
        count: d.count,
    };
}

/**
 * Manager approves or rejects a parts request.
 * Backend will also send invoice email to customer.
 *
 * @param {string}  ticketId  - ticket to approve / reject
 * @param {boolean} approved  - true = approve, false = reject & cancel
 */
export async function approveOrRejectParts(ticketId, approved) {
    return apiFetch(`/portal/tickets/${ticketId}/approve-parts?approved=${approved}`, {
        method: "PATCH",
    });
}

/**
 * Submit quotation with customer signature.
 * This will email the quotation to customer and send to admin for approval.
 *
 * @param {Object} quotationData - contains jobId, customer info, parts, quantities, signature, etc.
 */
export async function submitQuotation(quotationData) {
    return apiFetch("/portal/quotation/submit", {
        method: "POST",
        body: JSON.stringify(quotationData),
    });
}

// Admin — all feedback + technician ratings
export async function getAdminFeedback() {
    const res = await fetch(`${API_BASE}/admin/feedback`);
    if (!res.ok) throw new Error("Failed to fetch feedback");
    return res.json();
}

// Admin — parts analytics chart data
export async function getPartsAnalytics() {
    const res = await fetch(`${API_BASE}/admin/parts-analytics`);
    if (!res.ok) throw new Error("Failed to fetch parts analytics");
    return res.json();
}

// Technician — their own ratings only
export async function getTechFeedback(techId) {
    const res = await fetch(`${API_BASE}/portal/technician/${techId}/feedback`);
    if (!res.ok) throw new Error("Failed to fetch technician feedback");
    return res.json();
}

/**
 * Submit a technician service report after job completion.
 * Saves the report under the ticket and notifies admin to close the job.
 *
 * @param {string} ticketId
 * @param {Object} reportData - { techId, faultType, faultNotes, workDoneNotes,
 *                               partsUsed, totalPartsCost, completedAt, signature }
 */
export async function submitServiceReport(ticketId, reportData) {
    return apiFetch(`/portal/tickets/${ticketId}/service-report`, {
        method: "POST",
        body: JSON.stringify({
            tech_id: reportData.techId,
            fault_type: reportData.faultType,
            fault_notes: reportData.faultNotes,
            work_done_notes: reportData.workDoneNotes,
            parts_used: reportData.partsUsed,
            total_parts_cost: reportData.totalPartsCost,
            completed_at: reportData.completedAt,
        }),
    });
}

/**
 * Fetch all archived documents (quotation + service report) for a ticket.
 * Used by the review panel in both the technician detail page and admin dashboard.
 *
 * @param {string} ticketId
 * @returns {{ quotation: Object|null, serviceReport: Object|null }}
 */
export async function fetchTicketDocuments(ticketId) {
    const data = await apiFetch(`/portal/tickets/${ticketId}/documents`);
    return {
        quotation: data.quotation
            ? {
                ticketId: data.quotation.ticket_id,
                customerName: data.quotation.customer_name,
                customerEmail: data.quotation.customer_email,
                parts: data.quotation.parts || [],
                totalAmount: data.quotation.total_amount,
                signature: data.quotation.signature,
                createdAt: data.quotation.created_at,
                emailSentAt: data.quotation.email_sent_at,
            }
            : null,
        serviceReport: data.service_report
            ? {
                ticketId: data.service_report.ticket_id,
                techId: data.service_report.tech_id,
                faultType: data.service_report.fault_type,
                faultNotes: data.service_report.fault_notes,
                workDoneNotes: data.service_report.work_done_notes,
                partsUsed: data.service_report.parts_used || [],
                totalPartsCost: data.service_report.total_parts_cost,
                completedAt: data.service_report.completed_at,
                techSignature: data.service_report.tech_signature,
                submittedAt: data.service_report.submitted_at,
            }
            : null,
    };
}
/**
 * Fetch full history of parts approval decisions (approved + rejected).
 * Used by ApprovalHistorySection embedded in the Parts Approval tab.
 */
export async function fetchApprovalHistory() {
    const d = await apiFetch("/portal/approval-history");
    return {
        history: (d.history || []).map(a => ({
            ticketId: a.ticket_id,
            customerName: a.customer_name,
            subject: a.subject,
            faultType: a.fault_type,
            warrantyStatus: a.warranty_status,
            totalCost: a.total_cost,
            decision: a.decision,
            finalStatus: a.final_status,
            decidedAt: a.decided_at,
            createdAt: a.created_at,
            predictedParts: (a.predicted_parts || []).map(p => ({
                partId: p.part_id,
                name: p.name,
                stock: (p.stock || "UNKNOWN").toUpperCase(),
                cost: p.cost || 0,
            })),
        })),
        count: d.count,
        approvedCount: d.approved_count,
        rejectedCount: d.rejected_count,
    };
}
// ── New Ticket Assignment Flow ───────────────────────────────────────────────

/** Fetch all unassigned / pending tickets (admin queue) */
export async function fetchUnassignedTickets() {
    const d = await apiFetch("/portal/unassigned-tickets");
    return { tickets: d.tickets || [], count: d.count };
}

/** Admin assigns a ticket to Hafiz (TECH-001) → status: PENDING_ACCEPTANCE */
export async function assignTicket(ticketId, techId = "TECH-001") {
    return apiFetch(`/portal/tickets/${ticketId}/assign?tech_id=${techId}`, { method: "PATCH" });
}

/** Hafiz accepts or rejects a PENDING_ACCEPTANCE ticket */
export async function acceptOrRejectTicket(ticketId, accepted, rejectReason = "") {
    return apiFetch(`/portal/tickets/${ticketId}/accept`, {
        method: "PATCH",
        body: JSON.stringify({ accepted, tech_id: "TECH-001", reject_reason: rejectReason }),
    });
}

/** Hafiz books appointment after contacting customer → status: APPOINTMENT_BOOKED */
export async function bookAppointment(ticketId, appointmentDate, notes = "") {
    return apiFetch(`/portal/tickets/${ticketId}/book-appointment`, {
        method: "PATCH",
        body: JSON.stringify({ appointment_date: appointmentDate, notes }),
    });
}
/** For warranty jobs — request parts approval directly without quotation */
export async function requestPartsApproval(ticketId) {
    return apiFetch(`/portal/tickets/${ticketId}/request-parts-approval`, { method: "POST" });
}