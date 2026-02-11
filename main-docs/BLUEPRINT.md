# Project Blueprint: Solve Print (Smart Printing Queue)

## 1. Project Overview
"Solve Print" is a web-based platform designed to solve the excessive crowding at college printing shops. It streamlines the printing process through high automation, real-time tracking, and automated document analysis.

---

## 2. Stakeholder Profiles
| Stakeholder | UI Perspective | Key Responsibilities |
| :--- | :--- | :--- |
| **Customer** | Mobile-First Web Portal | Upload docs, pay via UPI, track live status, provide 3-digit code for pickup. |
| **Shop Owner** | Desktop Dashboard | Manage bulk queue, print documents, update batch statuses, manage ₹ rates. |
| **Developer** | System Dashboard | Monitor system health, oversee all transactions, and adjust system configs. |

---

## 3. The Technical Architecture (Phase-by-Phase)

### Phase 1: Foundation (COMPLETED)
- **Framework**: Next.js 14 (App Router) for high performance.
- **Styling**: Tailwind CSS for a modern, responsive design.
- **State/Animations**: Framer Motion for smooth UI transitions (premium feel).
- **Core Setup**: Utility functions for pickup codes, currency formatting, and Supabase client initialization.

### Phase 2: Database & Security (IN-PROGRESS)
- **Supabase PostgreSQL**:
    - `profiles`: Stores roles (Owner/Customer/Developer) and VPA (UPI ID).
    - `orders`: Central table for tracking status (Queued, Printing, Ready).
    - `pricing_config`: Dynamic table where Owners set ₹ rates for B/W vs Color.
    - `documents`: Stores file references and inspected metadata.
- **Security**: Row Level Security (RLS) ensures Customers *only* see their own files, while Owners see the entire shop queue.
- **Storage**: Temporary storage buckets for PDFs (Auto-deleted after 24h or handover).

### Phase 3: The "Busy Shop" Workflow (The Core Engine)
- **Smart File Inspector**: Using **Advanced Algorithms** to automatically count pages and detect color/text balance. This prevents user errors.
- **Real-time Queue**: Using **Supabase Realtime** to sync the Owner's "Printing" status to the Customer's phone instantly (No page refreshes).
- **Pickup System**: A unique 3-digit code (e.g., #402) generated for every order.
- **Step-by-Step Flow**:
    1. Customer uploads PDF.
    2. System provides price preview based on Owner's rates.
    3. Customer pays via UPI (Money goes to VPA in `.env`).
    4. Order appears in Owner's Dashboard.
    5. Owner selects multiple orders -> Clicks "Start Printing" -> Files open -> Customers notified.
    6. Owner clicks "Hand Over" -> Status turns Green (Ready) -> Customer picks up -> Files deleted.

### Phase 4: Payment Strategy (Smart Verification)
- **Primary Method**: **UPI (Unified Payments Interface)**.
- **Why?**: 0% transaction fees (keeping it free for you/the shop), extremely secure, and instant bank-to-bank transfer.
- **Verification Logic**: 
    1. Student pays the exact amount using a dynamic UPI QR code.
    2. Student uploads a screenshot of the payment success screen.
    3. **System** analyzes the screenshot to extract the UTR (Transaction ID), Amount, and Timestamp.
    4. If system confirms the amount matches the order, the status moves to **`Paid`** instantly.
    5. This provides a "Gate-way like" experience with **₹0 fees**.

### Phase 5: Polishing & Support
- **Support Bot**: A simple support bot to answer student questions (e.g., "Where is my print?" or "What are the rates?").
- **UI Aesthetics**: Dark mode support, glassmorphism effects, and micro-animations for clicks and transitions.

---

## 4. Key Automation Features
1. **Auto-Status**: Moving one batch to "Ready" automatically triggers when the owner starts the next batch.
2. **Auto-Clean**: Server storage is never filled; old or completed files are wiped automatically.
3. **Smart Price Validator**: The shop owner doesn't need to manually check page counts anymore.
4. **Live UPI Management**: The owner can update their UPI ID (VPA) directly through the UI at any time. This allows switching banks or accounts instantly if there are network issues.

---

## 5. Deployment Plan
- **Backend/DB**: Supabase (Free Tier handles ~500MB storage and millions of rows).
- **Frontend**: Vercel (Free Tier for fast web hosting).
- **Analytics**: Google Analytics (for usage tracking).

**Status Update**: We are currently building the authentication and role-based portal logic.
