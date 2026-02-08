# Printing SaaS Dashboard & Automation V2

## Overview
The "Dashboard V2" upgrade was implemented to transform the printing shop operations from a basic queue into a professional, automated, and real-time management system.
- **Pain Point**: Owners lacked search, real-time feedback for new orders, and manual control over their shop availability. Analytics were static, and database/storage bloat was a concern.
- **Goal**: Create a "Cockpit" for the owner and a dynamic "Live Shop" for the student.

## Architecture
- **Real-time Sync**: Leverages Supabase Realtime (PostgreSQL Changes) across `orders` and `shop_settings` tables.
- **Layered Cost Resolution**: 
    1. `getPdfPageCount`: Reliable client-side PDF parsing.
    2. `parsePageRange`: Custom utility to extract page counts from string ranges (e.g., "1-5, 8").
    3. `calculatePrintCost`: Centralized logic in `src/lib/utils.ts`.
- **Scheduled Maintenance**: `pg_cron` handles database pruning, while `PostgreSQL Triggers` handle physical storage cleanup (orphaned PDF removal).

## Database Schema (Migrations)
- **10_analytics_rpc.sql**: Stats for revenue and orders.
- **12_print_velocity.sql**: Hourly order density for efficiency tracking.
- **13_auto_cleanup.sql**: The automation hub (cron + storage triggers).
- **Column Addition**: `page_range` (TEXT) added to `orders` table.

## Configuration & Safety
- **Retention Policy**:
    - **Completed Orders**: 7 Days.
    - **Abandoned Orders**: 24 Hours.
- **Storage Safety**: Manual deletion of order records automatically triggers an Edge Job to delete the associated `.pdf` file from the `documents` bucket.
- **Pop-up Handling**: Direct printing uses `window.open` as a fallback for cross-origin PDF print restrictions in modern browsers.

## Usage
### Real-time Shop Toggle
```typescript
// Example update from Owner Dashboard
await supabase
    .from("shop_settings")
    .update({ is_open: false })
    .eq("owner_id", profile.id);
```
### Page Range Parsing
```typescript
const pages = parsePageRange("2-5, 10", 20); // Result: 5 pages
```
