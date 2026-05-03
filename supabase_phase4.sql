-- ================================================================
-- CEE PLATFORM — PHASE 4 MIGRATION
-- Client Invoice + Receipt
-- Run in Supabase SQL Editor
-- ================================================================

-- ── 1. ADD payment detail columns to payments ────────────────────
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_mode text DEFAULT 'bank_transfer'
    CHECK (payment_mode IN ('cash','cheque','bank_transfer','upi','neft','rtgs','other')),
  ADD COLUMN IF NOT EXISTS reference_no text;   -- UTR, cheque no, etc.

-- ── 2. CLIENT RECEIPTS TABLE ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_receipts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  invoice_id      uuid REFERENCES client_invoices(id) ON DELETE SET NULL,
  payment_id      uuid REFERENCES payments(id) ON DELETE SET NULL,
  receipt_number  text,
  receipt_date    date DEFAULT CURRENT_DATE,
  amount          numeric NOT NULL,
  payment_mode    text DEFAULT 'bank_transfer'
    CHECK (payment_mode IN ('cash','cheque','bank_transfer','upi','neft','rtgs','other')),
  reference_no    text,
  notes           text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE client_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "receipts_director" ON client_receipts;
DROP POLICY IF EXISTS "receipts_accounts" ON client_receipts;
DROP POLICY IF EXISTS "receipts_select_all" ON client_receipts;

CREATE POLICY "receipts_director" ON client_receipts FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'director')
);
CREATE POLICY "receipts_accounts" ON client_receipts FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('accounts','admin'))
);
CREATE POLICY "receipts_select_all" ON client_receipts FOR SELECT USING (
  auth.role() = 'authenticated'
);

-- ── 3. INDEXES ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_receipts_event ON client_receipts(event_id);
CREATE INDEX IF NOT EXISTS idx_receipts_payment ON client_receipts(payment_id);
CREATE INDEX IF NOT EXISTS idx_invoices_event ON client_invoices(event_id);
