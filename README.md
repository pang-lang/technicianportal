# Fiamma Technician Portal & Admin Dashboard

A comprehensive field operations management system designed for appliance service technicians and administrative supervisors. This portal streamlines the end-to-end service lifecycle—from ticket assignment and appointment booking to AI-led diagnostics, parts procurement, and final service reporting.

## 🛠 Features

### 🔧 For Technicians
- **Daily Operations**: Manage assigned service tickets with priority and SLA tracking.
- **Appointment Calendar**: Month-view calendar with automated 2-hour clash detection for bookings.
- **AI-Led Fault Logging**: System-assisted fault diagnostics with predictive spare parts suggestions.
- **Service Workflows**: Integrated flow for Quotation → Manager Approval → Repair → Service Report.
- **Digital Signatures**: Capture customer authorization and work completion signatures on-device.
- **WhatsApp Integration**: One-click communication with customers for bookings and reminders.

### 📊 For Administrators
- **KPI Tracker**: Real-time compliance monitoring across three critical phases:
    1. **KPI 1: Appointment** (Booking within 2 days)
    2. **KPI 2: Attendance** (On-site within 7 days)
    3. **KPI 3: Completion** (Job closed within 14 days)
- **Parts Approval Queue**: Centralized hub for authorizing field part requests with stock visibility.
- **Service Report Archive**: Review technical work notes, parts used, and verified customer signatures.
- **Parts Analytics**: Strategic insights into high-demand components and stock health summary.

## 🔄 The Job Lifecycle

Service tickets flow through 7 distinct operational stages:
1. **Pending Acceptance**: Ticket assigned to technician for review.
2. **Accepted**: Technician acknowledges the job.
3. **Appointment Booked**: Schedule confirmed with customer (KPI 1 window).
4. **Job Started**: Technician on-site and diagnostics logged (KPI 2 window).
5. **Awaiting Parts**: Parts request sent for manager authorization.
6. **Proceed Job**: Manager approved parts; technician ready to install.
7. **Completed**: Job closed, report submitted, and archived (KPI 3 window).

## 💻 Tech Stack

- **Frontend**: React 18, Vite
- **Styling**: Vanilla CSS with modern Glassmorphism and responsive layout.
- **Communication**: RESTful API integration with "silent" background data reloads for UI persistence.
- **Tools**: Lucide-inspired SVG icon system, Signature Pad integration.

## 🚀 Getting Started

1. **Install Dependencies**: `npm install`
2. **Run Dev Server**: `npm run dev`
3. **Build Profile**: `npm run build`


