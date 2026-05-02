-- ============================================================
-- CEE Platform — Complete Automation Triggers
-- Run this ONCE in Supabase SQL Editor
-- Covers: notifications + activity_log for ALL roles + ALL actions
-- ============================================================


-- ============================================================
-- HELPERS
-- ============================================================

CREATE OR REPLACE FUNCTION notify_roles(p_roles text[], p_title text, p_body text, p_link text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO notifications (user_id, title, body, link)
  SELECT id, p_title, p_body, p_link FROM profiles WHERE role = ANY(p_roles);
END;
$$;

CREATE OR REPLACE FUNCTION notify_user(p_user_id uuid, p_title text, p_body text, p_link text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_user_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, body, link) VALUES (p_user_id, p_title, p_body, p_link);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION log_activity(p_event_id uuid, p_user_id uuid, p_action text, p_detail text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO activity_log (event_id, user_id, action, detail) VALUES (p_event_id, p_user_id, p_action, p_detail);
END;
$$;


-- ============================================================
-- EVENTS
-- ============================================================

-- Event Created → notify POC + admin
CREATE OR REPLACE FUNCTION on_event_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.poc_id IS NOT NULL THEN
    PERFORM notify_user(NEW.poc_id,
      'You are POC for: ' || NEW.name,
      'You have been assigned as Point of Contact. Review your tasks.',
      '/dashboard/events/' || NEW.id);
  END IF;
  PERFORM notify_roles(ARRAY['admin'],
    'New Event: ' || NEW.name,
    'New event created. Prepare logistics and briefing.',
    '/dashboard/events/' || NEW.id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_event_insert ON events;
CREATE TRIGGER trg_event_insert AFTER INSERT ON events FOR EACH ROW EXECUTE FUNCTION on_event_insert();


-- Event Status Changed → role-specific notifications
CREATE OR REPLACE FUNCTION on_event_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  -- Always log
  PERFORM log_activity(NEW.id, NULL, 'Status Updated', OLD.status || ' → ' || NEW.status);

  -- Notify directors always
  PERFORM notify_roles(ARRAY['director'],
    NEW.name || ' → ' || INITCAP(NEW.status),
    'Event status changed to ' || NEW.status,
    '/dashboard/events/' || NEW.id);

  -- Execution started → notify POC + admin (on-ground work begins)
  IF NEW.status = 'execution' THEN
    PERFORM notify_roles(ARRAY['poc', 'admin'],
      'Execution started: ' || NEW.name,
      'Event has moved to execution phase. Be ready on ground.',
      '/dashboard/events/' || NEW.id);
  END IF;

  -- Event completed → notify all roles with specific instructions
  IF NEW.status = 'completed' THEN
    PERFORM notify_roles(ARRAY['accounts'],
      'Event Complete — Reconcile Now: ' || NEW.name,
      'Event is done. Process final vendor payments, raise final invoice, and reconcile accounts.',
      '/dashboard/events/' || NEW.id || '/payments');
    PERFORM notify_roles(ARRAY['admin'],
      'Event Complete — Archive Files: ' || NEW.name,
      'Event is done. Store all equipment, archive the event folder, close logistics.',
      '/dashboard/events/' || NEW.id);
    PERFORM notify_roles(ARRAY['design'],
      'Event Complete — Prepare Reel: ' || NEW.name,
      'Event is done. Collect media, select photos, and prepare highlight reel for social.',
      '/dashboard/social');
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_event_status ON events;
CREATE TRIGGER trg_event_status AFTER UPDATE ON events FOR EACH ROW EXECUTE FUNCTION on_event_status_change();


-- Phase Advanced → notify that phase's team
CREATE OR REPLACE FUNCTION on_phase_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role text;
  v_phase_name text;
BEGIN
  IF NEW.current_phase = OLD.current_phase THEN RETURN NEW; END IF;

  SELECT DISTINCT phase_name INTO v_phase_name
  FROM event_tasks WHERE event_id = NEW.id AND phase = NEW.current_phase LIMIT 1;

  PERFORM log_activity(NEW.id, NULL, 'Phase Advanced', COALESCE(v_phase_name, 'Phase ' || NEW.current_phase));

  -- Notify each role that has tasks in new phase
  FOR v_role IN
    SELECT DISTINCT owner_role FROM event_tasks
    WHERE event_id = NEW.id AND phase = NEW.current_phase AND status != 'done'
  LOOP
    PERFORM notify_roles(ARRAY[v_role],
      NEW.name || ': ' || COALESCE(v_phase_name, 'Phase ' || NEW.current_phase) || ' started',
      'Your tasks for this phase are now active.',
      '/dashboard/events/' || NEW.id);
  END LOOP;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_phase_change ON events;
CREATE TRIGGER trg_phase_change AFTER UPDATE ON events FOR EACH ROW EXECUTE FUNCTION on_phase_change();


-- ============================================================
-- TASKS
-- ============================================================

-- Task status changed → activity log + completion chain
CREATE OR REPLACE FUNCTION on_task_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_event_name text;
  v_event_link text;
  v_pending_role int;
  v_pending_phase int;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  SELECT name INTO v_event_name FROM events WHERE id = NEW.event_id;
  v_event_link := '/dashboard/events/' || NEW.event_id;

  -- Log every task status change
  IF NEW.completed_by IS NOT NULL THEN
    PERFORM log_activity(NEW.event_id, NEW.completed_by, 'Task ' || INITCAP(NEW.status),
      '[' || NEW.task_number || '] ' || NEW.task_name);
  END IF;

  -- When marked done: check role + phase completion
  IF NEW.status = 'done' THEN

    -- All tasks for this role in this phase done?
    SELECT COUNT(*) INTO v_pending_role FROM event_tasks
    WHERE event_id = NEW.event_id AND phase = NEW.phase
      AND owner_role = NEW.owner_role AND status != 'done' AND id != NEW.id;

    IF v_pending_role = 0 THEN
      PERFORM notify_roles(ARRAY['director'],
        INITCAP(NEW.owner_role) || ' tasks done — ' || COALESCE(v_event_name, 'Event'),
        'All ' || NEW.owner_role || ' tasks in ' || NEW.phase_name || ' are complete.',
        v_event_link);
    END IF;

    -- All tasks in entire phase done?
    SELECT COUNT(*) INTO v_pending_phase FROM event_tasks
    WHERE event_id = NEW.event_id AND phase = NEW.phase AND status != 'done' AND id != NEW.id;

    IF v_pending_phase = 0 THEN
      PERFORM notify_roles(ARRAY['director'],
        'Phase Complete: ' || NEW.phase_name || ' — ' || COALESCE(v_event_name, 'Event'),
        'All tasks in ' || NEW.phase_name || ' are done. You can advance to the next phase.',
        v_event_link);
      PERFORM log_activity(NEW.event_id, NEW.completed_by, 'Phase Complete', NEW.phase_name);
    END IF;

  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_task_update ON event_tasks;
CREATE TRIGGER trg_task_update AFTER UPDATE ON event_tasks FOR EACH ROW EXECUTE FUNCTION on_task_update();


-- ============================================================
-- APPROVALS
-- ============================================================

-- Approval Submitted → notify directors
CREATE OR REPLACE FUNCTION on_approval_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_event_name text;
  v_requester_name text;
BEGIN
  SELECT name INTO v_event_name FROM events WHERE id = NEW.event_id;
  SELECT name INTO v_requester_name FROM profiles WHERE id = NEW.requested_by;

  PERFORM notify_roles(ARRAY['director'],
    'Approval Needed: ' || NEW.type,
    COALESCE(v_requester_name, 'Team') || ' — ' || COALESCE(v_event_name, 'Event'),
    '/dashboard/approvals');

  PERFORM log_activity(NEW.event_id, NEW.requested_by, 'Approval Requested', NEW.type);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_approval_insert ON approvals;
CREATE TRIGGER trg_approval_insert AFTER INSERT ON approvals FOR EACH ROW EXECUTE FUNCTION on_approval_insert();


-- Approval Decided → notify requester + chain to next role
CREATE OR REPLACE FUNCTION on_approval_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_event_name text;
  v_event_link text;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('approved', 'rejected') THEN RETURN NEW; END IF;

  SELECT name INTO v_event_name FROM events WHERE id = NEW.event_id;
  v_event_link := '/dashboard/events/' || NEW.event_id;

  -- Notify requester
  PERFORM notify_user(NEW.requested_by,
    NEW.type || ' ' || INITCAP(NEW.status),
    COALESCE(v_event_name, 'Your request') || ' — ' || NEW.status ||
      CASE WHEN NEW.comment IS NOT NULL AND NEW.comment != '' THEN ': ' || NEW.comment ELSE '' END,
    v_event_link);

  PERFORM log_activity(NEW.event_id, NEW.decided_by, 'Approval ' || INITCAP(NEW.status), NEW.type);

  -- Chain: only when approved
  IF NEW.status = 'approved' THEN

    -- Element sheet approved → design starts artwork
    IF NEW.type ILIKE '%element sheet%' THEN
      PERFORM notify_roles(ARRAY['design'],
        'Element Sheet Approved — Start Artwork: ' || COALESCE(v_event_name, 'Event'),
        'Element sheet is locked. Begin artwork, mockups, and design files.',
        v_event_link);
    END IF;

    -- Layout / Mockup approved → design prepares print files
    IF NEW.type ILIKE '%mockup%' OR NEW.type ILIKE '%layout%' THEN
      PERFORM notify_roles(ARRAY['design'],
        'Mockup Approved — Prepare Print Files: ' || COALESCE(v_event_name, 'Event'),
        'Mockup approved. Prepare final CDR and print-ready files.',
        v_event_link);
    END IF;

    -- Artwork / Creative approved → design sends to print
    IF NEW.type ILIKE '%artwork%' OR NEW.type ILIKE '%creative%' THEN
      PERFORM notify_roles(ARRAY['design'],
        'Artwork Approved — Send to Print: ' || COALESCE(v_event_name, 'Event'),
        'Artwork approved. Share print files with vendor.',
        v_event_link);
    END IF;

    -- Print approval → admin coordinates delivery
    IF NEW.type ILIKE '%print%' THEN
      PERFORM notify_roles(ARRAY['admin'],
        'Print Approved — Coordinate Delivery: ' || COALESCE(v_event_name, 'Event'),
        'Print files approved. Coordinate with vendor for delivery and setup.',
        v_event_link);
    END IF;

    -- Additional element approved → POC + admin to execute
    IF NEW.type ILIKE '%additional element%' THEN
      PERFORM notify_roles(ARRAY['poc', 'admin'],
        'Additional Element Approved — Execute: ' || COALESCE(v_event_name, 'Event'),
        'Additional element approved. Arrange and execute immediately.',
        v_event_link);
    END IF;

    -- Advance request approved → accounts raises invoice
    IF NEW.type ILIKE '%advance%' THEN
      PERFORM notify_roles(ARRAY['accounts'],
        'Advance Approved — Raise Invoice: ' || COALESCE(v_event_name, 'Event'),
        'Advance request approved. Please raise the advance invoice now.',
        v_event_link || '/payments');
    END IF;

  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_approval_update ON approvals;
CREATE TRIGGER trg_approval_update AFTER UPDATE ON approvals FOR EACH ROW EXECUTE FUNCTION on_approval_update();


-- ============================================================
-- EXPENSES
-- ============================================================

-- Expense Submitted → notify director + accounts
CREATE OR REPLACE FUNCTION on_expense_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_event_name text;
  v_submitter_name text;
BEGIN
  SELECT name INTO v_event_name FROM events WHERE id = NEW.event_id;
  SELECT name INTO v_submitter_name FROM profiles WHERE id = NEW.submitted_by;

  PERFORM notify_roles(ARRAY['director', 'accounts'],
    'Expense: ₹' || NEW.amount || ' — ' || NEW.item,
    COALESCE(v_submitter_name, 'Team') || ' · ' || COALESCE(v_event_name, 'Event'),
    '/dashboard/expenses');

  PERFORM log_activity(NEW.event_id, NEW.submitted_by,
    'Expense Submitted', '₹' || NEW.amount || ' — ' || NEW.item);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_expense_insert ON expenses;
CREATE TRIGGER trg_expense_insert AFTER INSERT ON expenses FOR EACH ROW EXECUTE FUNCTION on_expense_insert();


-- Expense Decided → notify submitter
CREATE OR REPLACE FUNCTION on_expense_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('approved', 'rejected') THEN RETURN NEW; END IF;

  PERFORM notify_user(NEW.submitted_by,
    'Expense ' || INITCAP(NEW.status) || ': ₹' || NEW.amount,
    'Your expense for "' || NEW.item || '" has been ' || NEW.status || '.');

  PERFORM log_activity(NEW.event_id, NEW.submitted_by,
    'Expense ' || INITCAP(NEW.status), '₹' || NEW.amount || ' — ' || NEW.item);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_expense_update ON expenses;
CREATE TRIGGER trg_expense_update AFTER UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION on_expense_update();


-- ============================================================
-- CLIENT PAYMENTS
-- ============================================================

CREATE OR REPLACE FUNCTION on_payment_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_event_name text;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT name INTO v_event_name FROM events WHERE id = NEW.event_id;

  IF NEW.status = 'received' THEN
    PERFORM notify_roles(ARRAY['director', 'accounts'],
      '₹' || NEW.amount || ' Received — ' || COALESCE(v_event_name, 'Event'),
      INITCAP(NEW.type) || ' payment received. Review vendor payment releases.',
      '/dashboard/events/' || NEW.event_id || '/payments');
    PERFORM log_activity(NEW.event_id, NULL, 'Payment Received', '₹' || NEW.amount || ' (' || NEW.type || ')');
  END IF;

  IF NEW.status = 'overdue' THEN
    PERFORM notify_roles(ARRAY['director', 'accounts'],
      'Payment Overdue — ' || COALESCE(v_event_name, 'Event'),
      '₹' || NEW.amount || ' ' || NEW.type || ' is overdue. Follow up with client.',
      '/dashboard/followup');
    PERFORM log_activity(NEW.event_id, NULL, 'Payment Overdue', '₹' || NEW.amount || ' (' || NEW.type || ')');
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_payment_update ON payments;
CREATE TRIGGER trg_payment_update AFTER UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION on_payment_update();


-- ============================================================
-- VENDOR PAYMENTS
-- ============================================================

-- Vendor Payment Added → log activity
CREATE OR REPLACE FUNCTION on_vendor_payment_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_vendor_name text;
BEGIN
  SELECT name INTO v_vendor_name FROM vendors WHERE id = NEW.vendor_id;
  PERFORM log_activity(NEW.event_id, NULL,
    'Vendor Payment Added', '₹' || NEW.amount || ' — ' || COALESCE(v_vendor_name, 'Vendor'));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_vendor_payment_insert ON vendor_payments;
CREATE TRIGGER trg_vendor_payment_insert AFTER INSERT ON vendor_payments FOR EACH ROW EXECUTE FUNCTION on_vendor_payment_insert();


-- Vendor Payment Status Changed → notify + check all-paid
CREATE OR REPLACE FUNCTION on_vendor_payment_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_event_name text;
  v_vendor_name text;
  v_unpaid_count int;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  SELECT name INTO v_event_name FROM events WHERE id = NEW.event_id;
  SELECT name INTO v_vendor_name FROM vendors WHERE id = NEW.vendor_id;

  IF NEW.status = 'paid' THEN
    PERFORM log_activity(NEW.event_id, NULL,
      'Vendor Paid', '₹' || NEW.amount || ' — ' || COALESCE(v_vendor_name, 'Vendor'));

    -- Check if ALL vendor payments for this event are now paid
    SELECT COUNT(*) INTO v_unpaid_count FROM vendor_payments
    WHERE event_id = NEW.event_id AND status != 'paid' AND id != NEW.id;

    IF v_unpaid_count = 0 THEN
      PERFORM notify_roles(ARRAY['director', 'accounts'],
        'All Vendors Paid — ' || COALESCE(v_event_name, 'Event'),
        'All vendor payments for this event have been processed. Event can be closed.',
        '/dashboard/events/' || NEW.event_id || '/payments');
      PERFORM log_activity(NEW.event_id, NULL, 'All Vendors Paid', 'Event accounts fully settled');
    END IF;
  END IF;

  IF NEW.status = 'overdue' THEN
    PERFORM notify_roles(ARRAY['director', 'accounts'],
      'Vendor Payment Overdue — ' || COALESCE(v_vendor_name, 'Vendor'),
      '₹' || NEW.amount || ' overdue for ' || COALESCE(v_event_name, 'Event') || '. Release payment.',
      '/dashboard/events/' || NEW.event_id || '/payments');
    PERFORM log_activity(NEW.event_id, NULL,
      'Vendor Payment Overdue', '₹' || NEW.amount || ' — ' || COALESCE(v_vendor_name, 'Vendor'));
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_vendor_payment_update ON vendor_payments;
CREATE TRIGGER trg_vendor_payment_update AFTER UPDATE ON vendor_payments FOR EACH ROW EXECUTE FUNCTION on_vendor_payment_update();


-- ============================================================
-- SOCIAL MEDIA POSTS
-- ============================================================

CREATE OR REPLACE FUNCTION on_social_post_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_creator_name text;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  -- Design submits for approval → notify directors
  IF NEW.status = 'pending_approval' THEN
    SELECT name INTO v_creator_name FROM profiles WHERE id = NEW.created_by;
    PERFORM notify_roles(ARRAY['director'],
      'Social Post Needs Approval',
      COALESCE(v_creator_name, 'Team') || ' submitted a ' || NEW.platform || ' ' || COALESCE(NEW.content_type, 'post'),
      '/dashboard/social');
  END IF;

  -- Director approves → notify creator
  IF NEW.status = 'approved' AND NEW.created_by IS NOT NULL THEN
    PERFORM notify_user(NEW.created_by,
      'Social Post Approved — Schedule It',
      'Your ' || NEW.platform || ' ' || COALESCE(NEW.content_type, 'post') || ' is approved. Schedule or post it now.',
      '/dashboard/social');
  END IF;

  -- Director rejects → notify creator
  IF NEW.status = 'draft' AND OLD.status = 'pending_approval' AND NEW.created_by IS NOT NULL THEN
    PERFORM notify_user(NEW.created_by,
      'Social Post Sent Back for Revision',
      'Your ' || NEW.platform || ' post needs changes. Check notes and revise.',
      '/dashboard/social');
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_social_post_update ON social_posts;
CREATE TRIGGER trg_social_post_update AFTER UPDATE ON social_posts FOR EACH ROW EXECUTE FUNCTION on_social_post_update();


-- ============================================================
-- COMPLETE TRIGGER COVERAGE SUMMARY
-- ============================================================
--
-- DIRECTOR gets notified when:
--   • Approval requested (any type)
--   • Any role's tasks complete in a phase
--   • Entire phase complete → ready to advance
--   • Client payment received or overdue
--   • Vendor payment overdue
--   • ALL vendor payments done → event can close
--   • Event status changes
--   • Social post submitted for approval
--
-- ADMIN gets notified when:
--   • New event created → prepare logistics
--   • Execution phase starts → be ready on ground
--   • Print approved → coordinate delivery
--   • Additional element approved → arrange execution
--   • Event completed → archive files + store equipment
--
-- DESIGN gets notified when:
--   • Element sheet approved → start artwork
--   • Mockup approved → prepare print files
--   • Artwork approved → send to print
--   • Social post approved/sent back → act accordingly
--   • Event completed → prepare reel + social content
--
-- POC gets notified when:
--   • Assigned to new event
--   • Their phase tasks begin
--   • Additional element approved → execute
--   • Execution phase starts
--
-- ACCOUNTS gets notified when:
--   • New expense submitted → review it
--   • Expense approved/rejected → logged
--   • Advance approval → raise invoice
--   • Client payment received → release vendor payments
--   • Client payment overdue → follow up
--   • Vendor payment overdue → release payment
--   • All vendors paid → close accounts
--   • Event completed → final reconciliation
--
-- EVERYONE gets notified when relevant to their role:
--   • Their own approval is decided (approved/rejected)
--   • Their own expense is decided
--   • Their phase starts
-- ============================================================
