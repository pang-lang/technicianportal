// ── Centralized API Client for Technician Portal ────────────────────────────
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
                detail = body.detail || detail;
            } catch (_) { /* ignore */ }
            throw new Error(detail);
        }

        return res.json();
    } catch (err) {
        if (err.message === "Failed to fetch" || err.message === "Load failed") {
            const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
            const msg = isLocal
                ? "Network error (possibly CORS). Ensure you are running on http://localhost:5173."
                : `Network error (possibly CORS). Ensure the backend allows requests from ${window.location.origin}`;
            throw new Error(msg);
        }
        throw err;
    }
}

// ── Data Normalizers ─────────────────────────────────────────────────────────
// Map API snake_case fields to the camelCase shape expected by our components.

function normalizeJob(apiJob) {
    // The API returns sla_deadline as ISO string. We derive SLA-related display
    // fields locally so that the existing UI helpers (timeLeft, slaPercent) still work.
    return {
        id: apiJob.ticket_id,
        customerName: apiJob.customer_name,
        productModel: apiJob.product_name,
        subject: apiJob.subject,
        complaintType: apiJob.subject,       // closest mapping
        complaintText: apiJob.subject,
        warrantyStatus: apiJob.warranty_status,
        urgencyLevel: mapPriorityToUrgency(apiJob.priority),
        status: mapStatus(apiJob.status),
        slaDeadlineAt: apiJob.sla_deadline,
        createdAt: apiJob.created_at,
        slaPercentage: apiJob.sla_percentage,
        slaBreached: apiJob.sla_breached,
        elapsedMinutes: apiJob.elapsed_minutes,
        slaLimitMinutes: apiJob.sla_limit_minutes,
        // These are populated only on the detail view
        address: "",
        serialNumber: "",
        faultType: null,
        faultNotes: null,
        predictedParts: [],
        partsApproved: false,
        completedAt: null,
        compensationCode: null,
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
        address: "",        // API doesn't return address yet
        serialNumber: d.product_id,
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
    const map = { High: "CRITICAL", Medium: "STANDARD", Low: "LOW" };
    return map[priority] || "STANDARD";
}

function mapStatus(status) {
    // Normalize various API status strings to our frontend keys
    const map = {
        "Open": "ASSIGNED",
        "In Progress": "JOB_STARTED",
        "JOB_STARTED": "JOB_STARTED",
        "ASSIGNED": "ASSIGNED",
        "AWAITING_PARTS": "AWAITING_PARTS",
        "COMPLETED": "COMPLETED",
        "CANCELLED": "CANCELLED",
    };
    return map[status] || status;
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
    const data = await apiFetch(`/portal/tickets/${ticketId}`);
    return normalizeJobDetail(data);
}

/** Update job status (Start Job / Awaiting Parts) */
export async function updateJobStatus(ticketId, newStatus, updatedBy = "TECH-001", notes = null) {
    return apiFetch(`/portal/tickets/${ticketId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ new_status: newStatus, updated_by: updatedBy, notes }),
    });
}

/** Log a fault for a ticket and get predicted parts */
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

/** Approve or reject parts for a ticket */
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
