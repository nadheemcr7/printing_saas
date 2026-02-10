# Solve Print: System Features & Technical Documentation

This document serves as the comprehensive "Source of Truth" for the Solve Print SaaS platform. It details existing features, technical implementations, and critical logic to ensure stability during future development.

---

## 🏗️ Core Architecture

### Technology Stack
- **Frontend**: Next.js 14+ (App Router), Tailwind CSS, Framer Motion (Animations), Lucide React (Icons).
- **Backend**: Supabase (Postgres Database, Auth, Storage, Edge Functions, Realtime).
- **State Management**: Custom `useAuth` hook for persistent user & profile state.

### Role-Based Access Control (RBAC)
The system supports three distinct roles, managed via the `public.profiles` table:
1. **Customer**: Can upload documents, pay for prints, and track order status.
2. **Owner**: Manages a specific shop's queue, changes shop status, and views business analytics.
3. **Developer**: Administrative access to platform-wide statistics and revenue.

---

## 📂 Feature Modules

### 👤 Customer Experience
- **Smart Upload**: Supports `.pdf`, `.doc`, and `.docx`. 
    - *How it works*: Uses `pdf-lib` and `jszip` (client-side) to detect page counts instantly, even on mobile.
- **Dynamic Pricing**: Automatic cost calculation based on:
    - B&W vs. Color.
    - Single vs. Double sided.
    - Custom Page Ranges (e.g., "1-5, 10").
- **Payment System**: Dual approach:
    1. **UPI/Manual**: Displays Shop VPA, allows QR generation, and manual screenshot upload for verification.
    2. **Real-time Status**: Orders stay in `pending_payment` until confirmed.
- **Live Queue Tracking**: Dashboard shows exactly how many orders are ahead in the shop queue using a global RPC `get_queue_status`.

### 🏪 Owner Dashboard
- **Live Queue Management**: Real-time view of incoming orders.
    - *Action Flow*: `Queued` -> `Printing` -> `Ready` -> `Completed`.
- **Direct Printing**: Allows owners to open the document and trigger browser print in one click.
- **Batch Operations**: Multiple orders can be selected to change status or delete simultaneously.
- **Shop Controls**:
    - **Open/Close Toggle**: Prevents/Allows new uploads.
    - **VPA Management**: Dynamic switching between Primary and Backup UPI IDs.
- **Today's Revenue Stat**: Real-time ticker showing confirmed earnings for the current date.

### 📊 Analytics & Insights
- **Revenue Overview**: Tracking Today's Revenue, Weekly Revenue, and Pending Value.
- **Print Velocity**: A visual bar chart (Logic in `get_print_velocity` RPC) showing peak hours of operation over the last 24 hours.
- **Analytics Persistence**: 
    - *How it works*: A database trigger `before_order_delete` captures revenue data into the `analytics_daily` table before an order is deleted. This prevents stats from "resetting" when common cleanup is performed.
- **Automated Cleanup**: 
    - *Policy*: Completed orders > 7 days and unpaid orders > 24 hours are automatically removed via `pg_cron`.

---

## ⚡ Technical Workflows ("How it Works")

### 1. Real-time Synchronization
- **System**: Uses Supabase Realtime (Postgres Changes).
- **Owner Dashboard**: Subscribes to the `orders` table. When a customer uploads a file, the Owner Dashboard receives a broadcast and plays an (optional) notification/event.
- **Fallback**: If Realtime fails (e.g., `CHANNEL_ERROR`), the system switches to **Polling Mode**, refreshing data every 30 seconds automatically.

### 2. Order Deletion & Storage Cleanup
- **Logic**: Deleting an order involves two steps:
    1. The storage file is deleted using `supabase.storage.from('documents').remove()`.
    2. The database record is deleted.
- **Safety**: The database trigger `trigger_cleanup_storage_on_delete` was removed because direct SQL deletion of storage files is forbidden. Deletion must always be handled via the frontend SDK or an Edge Function.

### 3. Middleware & Security
- **File**: `src/middleware.ts`.
- **Function**: Protects `/dashboard/*` routes. It verifies the user session and checks the `role` to prevent unauthorized access (e.g., a Customer trying to access `/dashboard/owner`).
- **Optimization**: It ignores landing pages and static assets to ensure high-speed page loads.

---

## 🛠️ Maintenance & Troubleshooting

### Common Fixes

| Issue | Potential Cause | Fix |
| :--- | :--- | :--- |
| **Blank Dashboard / Loading Spinner** | Middleware or `useAuth` infinite loop. | Ensure `supabase` client is memoized (`useMemo`) and middleware is not intercepting static files. |
| **Realtime Errors (`CHANNEL_ERROR`)** | Tables not added to publication. | Run SQL: `ALTER PUBLICATION supabase_realtime ADD TABLE orders, shop_settings;` |
| **Deletion Fails (403)** | Broken DB Trigger. | Drop the trigger `trigger_cleanup_storage_on_delete` from the `orders` table. |
| **Revenue Stats Drop to ₹0** | History Cleanup. | Ensure the `analytics_daily` table exists and the `snapshot_order_analytics` function is active. |

### Database Functions (RPCs) to Keep Intact
- `get_queue_status()`: Global count for customers.
- `get_owner_analytics()`: Combined live + archived stats.
- `get_print_velocity()`: Hourly activity tracking.
- `verify_razorpay_payment()`: Automated payment cleanup.

---
**Last Updated**: Feb 10, 2026
**Created by**: Solve Print Dev Team
