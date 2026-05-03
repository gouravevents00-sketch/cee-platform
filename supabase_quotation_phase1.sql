-- ================================================================
-- CEE PLATFORM — QUOTATION PHASE 1 MIGRATION
-- Run in Supabase SQL Editor
-- ================================================================

-- ── 1. ENHANCE QUOTATIONS TABLE ─────────────────────────────────

ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS gst_mode text DEFAULT 'none'
    CHECK (gst_mode IN ('none','exclusive','inclusive')),
  ADD COLUMN IF NOT EXISTS discount_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_milestones jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS compliance jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS company text DEFAULT 'cee' CHECK (company IN ('cee','cex'));

-- ── 2. CLIENT INVOICES TABLE ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS client_invoices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  quotation_id uuid REFERENCES quotations(id) ON DELETE SET NULL,
  invoice_number text,
  invoice_date date DEFAULT CURRENT_DATE,
  due_date    date,
  items       jsonb DEFAULT '[]',
  subtotal    numeric DEFAULT 0,
  gst_mode    text DEFAULT 'none' CHECK (gst_mode IN ('none','exclusive','inclusive')),
  gst_amount  numeric DEFAULT 0,
  total       numeric DEFAULT 0,
  amount_paid numeric DEFAULT 0,
  status      text DEFAULT 'draft'
    CHECK (status IN ('draft','sent','partial','paid','overdue','cancelled')),
  notes       text,
  created_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE client_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_director" ON client_invoices;
DROP POLICY IF EXISTS "invoices_accounts" ON client_invoices;
DROP POLICY IF EXISTS "invoices_team_select" ON client_invoices;

CREATE POLICY "invoices_director" ON client_invoices FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'director')
);
CREATE POLICY "invoices_accounts" ON client_invoices FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('accounts','admin'))
);
CREATE POLICY "invoices_team_select" ON client_invoices FOR SELECT USING (
  auth.role() = 'authenticated'
);

-- ── 3. VENDOR POLICY FIX — allow admin + poc to read vendors ────
-- (needed for vendor dropdown in quotation builder)
DROP POLICY IF EXISTS "Vendors all roles select" ON vendors;
CREATE POLICY "Vendors all roles select" ON vendors FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('director','accounts','admin','poc'))
);

-- ── 4. INDEXES ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_quotations_locked ON quotations(locked_at) WHERE locked_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_client_invoices_event ON client_invoices(event_id);
CREATE INDEX IF NOT EXISTS idx_client_invoices_status ON client_invoices(status);
