-- ================================================================
-- CEE PLATFORM — PHASE 2 + 3 MIGRATION
-- Vendor Purchase Orders + Payment label columns
-- Run in Supabase SQL Editor
-- ================================================================

-- ── 1. ADD label TO payments table ───────────────────────────────
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS label text;

-- ── 2. ADD label TO vendor_payments table ────────────────────────
ALTER TABLE vendor_payments
  ADD COLUMN IF NOT EXISTS label text;

-- ── 3. VENDOR PURCHASE ORDERS (SOs) ─────────────────────────────
-- Auto-generated from quotation lock, grouped by vendor
CREATE TABLE IF NOT EXISTS vendor_purchase_orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  vendor_id       uuid REFERENCES vendors(id) ON DELETE SET NULL,
  quotation_id    uuid REFERENCES quotations(id) ON DELETE SET NULL,
  po_number       text,
  items           jsonb DEFAULT '[]',   -- element rows assigned to this vendor
  subtotal        numeric DEFAULT 0,
  status          text DEFAULT 'draft'
    CHECK (status IN ('draft','sent','acknowledged','in_progress','delivered','cancelled')),
  notes           text,
  portal_token    text UNIQUE DEFAULT gen_random_uuid()::text,
  sent_at         timestamptz,
  acknowledged_at timestamptz,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE vendor_purchase_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "so_director" ON vendor_purchase_orders;
DROP POLICY IF EXISTS "so_accounts" ON vendor_purchase_orders;

CREATE POLICY "so_director" ON vendor_purchase_orders FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'director')
);
CREATE POLICY "so_accounts" ON vendor_purchase_orders FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('accounts','admin'))
);

-- ── 4. INDEXES ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_vpo_event ON vendor_purchase_orders(event_id);
CREATE INDEX IF NOT EXISTS idx_vpo_vendor ON vendor_purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vpo_status ON vendor_purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_payments_label ON payments(label) WHERE label IS NOT NULL;
