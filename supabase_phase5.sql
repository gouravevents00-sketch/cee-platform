-- ================================================================
-- CEE PLATFORM — PHASE 5 MIGRATION
-- P&L Auto-Complete + Goldmine Realtime
-- Run in Supabase SQL Editor
-- ================================================================

-- ── 1. GOLDMINE ACCESS FLAG on profiles ──────────────────────────
-- Restricts Goldmine Insights to the founding director only
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS goldmine_access boolean DEFAULT false;

-- Set goldmine_access for the founding director (Gourav)
-- Update this with Gourav's actual email if needed
UPDATE profiles SET goldmine_access = true
WHERE role = 'director'
  AND email = 'gourav@creativeeraevents.com';

-- Fallback: if email differs, run manually:
-- UPDATE profiles SET goldmine_access = true WHERE id = 'YOUR_GOURAV_UUID';

-- ── 2. VENDOR RELIABILITY SCORES ─────────────────────────────────
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS total_events int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS on_time_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quality_rating numeric DEFAULT 3.0
    CHECK (quality_rating BETWEEN 1.0 AND 5.0),
  ADD COLUMN IF NOT EXISTS last_event_date date,
  ADD COLUMN IF NOT EXISTS notes_internal text;

-- ── 3. INDEXES ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_goldmine ON profiles(goldmine_access) WHERE goldmine_access = true;
CREATE INDEX IF NOT EXISTS idx_invoices_status ON client_invoices(status);
CREATE INDEX IF NOT EXISTS idx_receipts_date ON client_receipts(receipt_date);
