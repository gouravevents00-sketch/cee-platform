-- ================================================================
-- CEE PLATFORM — SEED DATA FOR TESTING
-- Creates fake team, clients, vendors, and 3 events
-- Password for ALL test users: Test@1234
-- Run in Supabase SQL Editor
-- ================================================================

-- ── 1. TEAM AUTH USERS ───────────────────────────────────────────
-- Creates login accounts for each team member

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
) VALUES
  (
    'seed0001-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'priya@creativeeraevents.com',
    crypt('Test@1234', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), 'authenticated', 'authenticated'
  ),
  (
    'seed0001-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'rohit@creativeeraevents.com',
    crypt('Test@1234', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), 'authenticated', 'authenticated'
  ),
  (
    'seed0001-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'karan@creativeeraevents.com',
    crypt('Test@1234', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), 'authenticated', 'authenticated'
  ),
  (
    'seed0001-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'sanjay@creativeeraevents.com',
    crypt('Test@1234', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), 'authenticated', 'authenticated'
  )
ON CONFLICT (id) DO NOTHING;

-- ── 2. TEAM PROFILES ─────────────────────────────────────────────
INSERT INTO profiles (id, name, role, email) VALUES
  ('seed0001-0000-0000-0000-000000000001', 'Priya Sharma',  'accounts', 'priya@creativeeraevents.com'),
  ('seed0001-0000-0000-0000-000000000002', 'Rohit Verma',   'poc',      'rohit@creativeeraevents.com'),
  ('seed0001-0000-0000-0000-000000000003', 'Karan Patel',   'design',   'karan@creativeeraevents.com'),
  ('seed0001-0000-0000-0000-000000000004', 'Sanjay Mehta',  'admin',    'sanjay@creativeeraevents.com')
ON CONFLICT (id) DO UPDATE SET
  name  = EXCLUDED.name,
  role  = EXCLUDED.role,
  email = EXCLUDED.email;

-- ── 3. CLIENTS ───────────────────────────────────────────────────
INSERT INTO clients (id, name, type, contact_name, contact_phone, contact_email, credit_period_days, advance_percent, notes)
VALUES
  (
    'clnt1111-0000-0000-0000-000000000001',
    'Reliance Industries Ltd', 'corporate',
    'Amit Kapoor', '9876543210', 'amit.kapoor@reliance.com',
    45, 30,
    'Large enterprise client. Formal WO required before work starts. Senior POC only. Long payment cycle.'
  ),
  (
    'clnt1111-0000-0000-0000-000000000002',
    'Starmark Creative Agency', 'agency',
    'Neha Joshi', '9123456789', 'neha@starmark.in',
    15, 50,
    'Agency client for Pepsi, Honda activations. Fast turnaround. Tight budgets — negotiate vendor costs first.'
  )
ON CONFLICT (id) DO NOTHING;

-- ── 4. VENDORS ───────────────────────────────────────────────────
INSERT INTO vendors (id, name, category, contact_name, contact_phone, reliability_score, notes)
VALUES
  ('vndr1111-0000-0000-0000-000000000001', 'Print Perfect',   'Printing & Branding',    'Ramesh Kumar',  '9988776655', 5, 'Best flex print quality in Mumbai. Always delivers 1 day early.'),
  ('vndr1111-0000-0000-0000-000000000002', 'LightWorks AV',   'AV & Lighting',          'Suresh Nair',   '9977665544', 4, 'Good LED wall setup. Ensure backup equipment is listed in SO.'),
  ('vndr1111-0000-0000-0000-000000000003', 'Green Décor',     'Decoration & Florals',   'Anita Patel',   '9966554433', 4, 'Pune-based. Add 2 days for logistics. Good floral pricing.'),
  ('vndr1111-0000-0000-0000-000000000004', 'Stage Masters',   'Stage & Fabrication',    'Vikram Singh',  '9955443322', 3, 'Cost-effective stage builds. Needs close supervision during execution.')
ON CONFLICT (id) DO NOTHING;

-- ── 5. EVENTS ────────────────────────────────────────────────────
INSERT INTO events (id, name, client_id, event_date, venue, city, type, status, poc_id, notes)
VALUES
  (
    'evnt1111-0000-0000-0000-000000000001',
    'Reliance Annual Day 2026',
    'clnt1111-0000-0000-0000-000000000001',
    '2026-06-15',
    'NSCI Dome, Worli', 'Mumbai',
    'Corporate Gala', 'active',
    'seed0001-0000-0000-0000-000000000002',
    '2000 pax gala dinner + awards ceremony. Stage 60×30 ft. Full AV, LED backdrop, branded décor.'
  ),
  (
    'evnt1111-0000-0000-0000-000000000002',
    'Starmark × Pepsi Launch',
    'clnt1111-0000-0000-0000-000000000002',
    '2026-07-04',
    'Phoenix Palladium, Lower Parel', 'Mumbai',
    'Brand Activation', 'enquiry',
    'seed0001-0000-0000-0000-000000000002',
    'Influencer launch event for new Pepsi flavour. Media wall, activation zones, photo booth required.'
  ),
  (
    'evnt1111-0000-0000-0000-000000000003',
    'CEE Leadership Offsite',
    NULL,
    '2026-03-10',
    'Della Adventure Resorts, Lonavala', 'Pune',
    'Internal', 'completed',
    NULL,
    'Internal team offsite. 15 pax. Team building activities. Completed successfully.'
  )
ON CONFLICT (id) DO NOTHING;

-- ── 6. ELEMENTS — Reliance Annual Day ────────────────────────────
INSERT INTO elements (event_id, name, specs, quantity, size, vendor_id, vendor_rate, client_rate, status)
VALUES
  ('evnt1111-0000-0000-0000-000000000001', 'Main Stage',         '60×30 ft, 4 ft height, wood top',                     1, '60×30 ft',  'vndr1111-0000-0000-0000-000000000004', 180000, 250000, 'approved'),
  ('evnt1111-0000-0000-0000-000000000001', 'LED Backdrop',       'P3.9 indoor LED wall',                                1, '40×20 ft',  'vndr1111-0000-0000-0000-000000000002', 120000, 175000, 'approved'),
  ('evnt1111-0000-0000-0000-000000000001', 'Stage Lighting',     'Moving heads + wash + followspot',                    1, NULL,        'vndr1111-0000-0000-0000-000000000002',  85000, 125000, 'approved'),
  ('evnt1111-0000-0000-0000-000000000001', 'Welcome Backdrop',   'Frontlit flex print, branded',                        1, '20×10 ft',  'vndr1111-0000-0000-0000-000000000001',   8000,  15000, 'approved'),
  ('evnt1111-0000-0000-0000-000000000001', 'Standing Standees',  'Sunboard print, branded',                             6, '2×4 ft',    'vndr1111-0000-0000-0000-000000000001',    600,   1200, 'approved'),
  ('evnt1111-0000-0000-0000-000000000001', 'Table Centrepieces', 'Fresh floral, premium white + gold',                200, NULL,        'vndr1111-0000-0000-0000-000000000003',    450,    800, 'approved'),
  ('evnt1111-0000-0000-0000-000000000001', 'Sound System',       'L-acoustics line array, 4-zone coverage',             1, NULL,        'vndr1111-0000-0000-0000-000000000002',  95000, 140000, 'approved'),
  ('evnt1111-0000-0000-0000-000000000001', 'Entrance Floral',    'Grand arch, seasonal flowers',                        1, NULL,        'vndr1111-0000-0000-0000-000000000003',  18000,  30000, 'approved')
ON CONFLICT DO NOTHING;

-- ── 7. ELEMENTS — Pepsi Launch ───────────────────────────────────
INSERT INTO elements (event_id, name, specs, quantity, size, vendor_id, vendor_rate, client_rate, status)
VALUES
  ('evnt1111-0000-0000-0000-000000000002', 'Media Wall',         'Backlit fabric, branded Pepsi',                       1, '16×8 ft',   'vndr1111-0000-0000-0000-000000000001',  18000,  30000, 'pending'),
  ('evnt1111-0000-0000-0000-000000000002', 'Photo Booth',        'Custom frame, digital props, printer',                1, '6×6 ft',    'vndr1111-0000-0000-0000-000000000001',  12000,  22000, 'pending'),
  ('evnt1111-0000-0000-0000-000000000002', 'LED Truss Setup',    'Goal post truss, wash lights',                        1, NULL,        'vndr1111-0000-0000-0000-000000000002',  25000,  40000, 'pending'),
  ('evnt1111-0000-0000-0000-000000000002', 'Activation Stall',   'Branded kiosk, product sampling counter',             2, '8×6 ft',    NULL,                                    15000,  28000, 'pending')
ON CONFLICT DO NOTHING;

-- ── 8. PAYMENTS — Reliance Annual Day ────────────────────────────
INSERT INTO payments (event_id, type, amount, due_date, status, label)
VALUES
  ('evnt1111-0000-0000-0000-000000000001', 'advance',   250000, '2026-05-01', 'received', 'Advance — 25%'),
  ('evnt1111-0000-0000-0000-000000000001', 'milestone', 500000, '2026-06-01', 'pending',  'Pre-event — 50%'),
  ('evnt1111-0000-0000-0000-000000000001', 'final',     250000, '2026-06-20', 'pending',  'Final — 25% post event')
ON CONFLICT DO NOTHING;

-- ── 9. PAYMENTS — Pepsi Launch ───────────────────────────────────
INSERT INTO payments (event_id, type, amount, due_date, status, label)
VALUES
  ('evnt1111-0000-0000-0000-000000000002', 'advance',   60000, '2026-06-15', 'pending', 'Advance — 50%'),
  ('evnt1111-0000-0000-0000-000000000002', 'final',     60000, '2026-07-08', 'pending', 'Final — 50%')
ON CONFLICT DO NOTHING;

-- ── 10. PAYMENTS — CEE Offsite (completed) ───────────────────────
INSERT INTO payments (event_id, type, amount, due_date, received_date, status, label)
VALUES
  ('evnt1111-0000-0000-0000-000000000003', 'advance',  25000, '2026-02-20', '2026-02-20', 'received', 'Full payment'),
  ('evnt1111-0000-0000-0000-000000000003', 'final',    15000, '2026-03-15', '2026-03-16', 'received', 'Extras — food + transport')
ON CONFLICT DO NOTHING;

-- ── 11. VENDOR PAYMENTS — Reliance (advance released) ────────────
INSERT INTO vendor_payments (event_id, vendor_id, amount, status, paid_date, label)
VALUES
  ('evnt1111-0000-0000-0000-000000000001', 'vndr1111-0000-0000-0000-000000000004', 90000, 'paid', '2026-05-10', 'Stage Masters — mobilization advance'),
  ('evnt1111-0000-0000-0000-000000000001', 'vndr1111-0000-0000-0000-000000000002', 50000, 'paid', '2026-05-12', 'LightWorks — AV booking advance'),
  ('evnt1111-0000-0000-0000-000000000001', 'vndr1111-0000-0000-0000-000000000001', 30000, 'pending', NULL, 'Print Perfect — on delivery'),
  ('evnt1111-0000-0000-0000-000000000001', 'vndr1111-0000-0000-0000-000000000003', 40000, 'pending', NULL, 'Green Décor — florals on event day')
ON CONFLICT DO NOTHING;

-- ── DONE ─────────────────────────────────────────────────────────
-- Team logins (password: Test@1234):
--   priya@creativeeraevents.com   → Accounts
--   rohit@creativeeraevents.com   → POC
--   karan@creativeeraevents.com   → Design
--   sanjay@creativeeraevents.com  → Admin
--
-- Events created:
--   1. Reliance Annual Day 2026   → active  (elements + payments + vendor payments)
--   2. Starmark × Pepsi Launch    → enquiry (elements + payments)
--   3. CEE Leadership Offsite     → completed (all received)
