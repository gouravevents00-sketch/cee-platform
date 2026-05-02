-- ============================================================
-- CEE Platform — Client & Vendor Portal Tokens
-- Run in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS portal_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  type text NOT NULL CHECK (type IN ('client', 'vendor')),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  -- for client tokens
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  -- for vendor tokens
  vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE,
  created_by uuid REFERENCES profiles(id),
  expires_at timestamptz DEFAULT now() + interval '90 days',
  created_at timestamptz DEFAULT now()
);

-- No RLS needed — these are public token-based routes (no auth)
-- Access is controlled by token validity check in the API route
