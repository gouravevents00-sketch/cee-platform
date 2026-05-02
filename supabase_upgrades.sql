-- ============================================================
-- CEE Platform — Upgrade SQL  (run in Supabase SQL editor)
-- ============================================================

-- ── 0. GUARD COLUMNS (add if missing from earlier schema runs) ──
ALTER TABLE vendor_payments
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending'
    CHECK (status IN ('pending','paid','overdue'));

ALTER TABLE vendor_payments
  ADD COLUMN IF NOT EXISTS paid_date date;


-- ── 1. INVENTORY AUTO-DEDUCT ────────────────────────────────
-- Link elements to inventory items
ALTER TABLE elements
  ADD COLUMN IF NOT EXISTS inventory_item_id uuid REFERENCES inventory_items(id) ON DELETE SET NULL;

-- Deduct qty_available when an element is inserted with inventory_item_id
CREATE OR REPLACE FUNCTION deduct_inventory_on_element()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.inventory_item_id IS NOT NULL THEN
    UPDATE inventory_items
    SET qty_available = GREATEST(0, qty_available - NEW.quantity)
    WHERE id = NEW.inventory_item_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deduct_inventory ON elements;
CREATE TRIGGER trg_deduct_inventory
  AFTER INSERT ON elements
  FOR EACH ROW EXECUTE FUNCTION deduct_inventory_on_element();

-- Restore qty_available when element is deleted
CREATE OR REPLACE FUNCTION restore_inventory_on_element_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.inventory_item_id IS NOT NULL THEN
    UPDATE inventory_items
    SET qty_available = LEAST(qty_total, qty_available + OLD.quantity)
    WHERE id = OLD.inventory_item_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_restore_inventory ON elements;
CREATE TRIGGER trg_restore_inventory
  AFTER DELETE ON elements
  FOR EACH ROW EXECUTE FUNCTION restore_inventory_on_element_delete();

-- Handle quantity / item changes on update
CREATE OR REPLACE FUNCTION adjust_inventory_on_element_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  diff int;
BEGIN
  IF OLD.inventory_item_id IS NOT NULL AND OLD.inventory_item_id = NEW.inventory_item_id THEN
    diff := NEW.quantity - OLD.quantity;
    UPDATE inventory_items
    SET qty_available = LEAST(qty_total, GREATEST(0, qty_available - diff))
    WHERE id = NEW.inventory_item_id;

  ELSIF OLD.inventory_item_id IS NOT NULL AND OLD.inventory_item_id IS DISTINCT FROM NEW.inventory_item_id THEN
    UPDATE inventory_items
    SET qty_available = LEAST(qty_total, qty_available + OLD.quantity)
    WHERE id = OLD.inventory_item_id;
    IF NEW.inventory_item_id IS NOT NULL THEN
      UPDATE inventory_items
      SET qty_available = GREATEST(0, qty_available - NEW.quantity)
      WHERE id = NEW.inventory_item_id;
    END IF;

  ELSIF OLD.inventory_item_id IS NULL AND NEW.inventory_item_id IS NOT NULL THEN
    UPDATE inventory_items
    SET qty_available = GREATEST(0, qty_available - NEW.quantity)
    WHERE id = NEW.inventory_item_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_adjust_inventory ON elements;
CREATE TRIGGER trg_adjust_inventory
  AFTER UPDATE OF inventory_item_id, quantity ON elements
  FOR EACH ROW EXECUTE FUNCTION adjust_inventory_on_element_update();


-- ── 2. DIRECTOR MORNING DIGEST NOTIFICATION ──────────────────
-- notifications table columns: user_id, title, body, link, read
CREATE OR REPLACE FUNCTION send_director_morning_digest()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  director_id uuid;
  pending_approvals int;
  pending_expenses int;
  overdue_vendor int;
  phase_ready int;
  msg text;
BEGIN
  SELECT id INTO director_id FROM profiles WHERE role = 'director' LIMIT 1;
  IF director_id IS NULL THEN RETURN; END IF;

  SELECT COUNT(*) INTO pending_approvals FROM approvals WHERE status = 'pending';
  SELECT COUNT(*) INTO pending_expenses  FROM expenses  WHERE status = 'pending';
  SELECT COUNT(*) INTO overdue_vendor    FROM vendor_payments WHERE status = 'overdue';

  SELECT COUNT(DISTINCT e.id) INTO phase_ready
  FROM events e
  WHERE e.status NOT IN ('completed', 'cancelled')
    AND e.current_phase < 7
    AND EXISTS (
      SELECT 1 FROM event_tasks t
      WHERE t.event_id = e.id AND t.phase = e.current_phase
    )
    AND NOT EXISTS (
      SELECT 1 FROM event_tasks t
      WHERE t.event_id = e.id AND t.phase = e.current_phase AND t.status != 'done'
    );

  IF (pending_approvals + pending_expenses + overdue_vendor + phase_ready) = 0 THEN
    RETURN;
  END IF;

  msg := 'Morning digest: ';
  IF phase_ready > 0        THEN msg := msg || phase_ready       || ' event(s) ready to advance phase. '; END IF;
  IF pending_approvals > 0  THEN msg := msg || pending_approvals || ' approval(s) pending. '; END IF;
  IF pending_expenses > 0   THEN msg := msg || pending_expenses  || ' expense(s) to approve. '; END IF;
  IF overdue_vendor > 0     THEN msg := msg || overdue_vendor    || ' vendor payment(s) overdue. '; END IF;

  INSERT INTO notifications (user_id, title, body, link)
  VALUES (director_id, 'Morning Digest', trim(msg), '/dashboard');
END;
$$;

-- Schedule: 8 AM IST = 2:30 AM UTC
-- Enable pg_cron in Supabase Dashboard → Extensions first, then uncomment:
-- SELECT cron.schedule('director-morning-digest', '30 2 * * *', 'SELECT send_director_morning_digest()');

-- Test manually:
-- SELECT send_director_morning_digest();


-- ── 3. AUTO PHASE ADVANCEMENT VIA DB TRIGGER ─────────────────
-- Fires when a task is marked done; if all phase tasks complete → advance event
CREATE OR REPLACE FUNCTION auto_advance_event_phase()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  ev_phase int;
  total_in_phase int;
  done_in_phase  int;
  ev_name text;
  dir_id uuid;
BEGIN
  IF NEW.status = 'done' AND (OLD.status IS NULL OR OLD.status != 'done') THEN
    SELECT current_phase, name INTO ev_phase, ev_name
    FROM events WHERE id = NEW.event_id;

    IF NEW.phase = ev_phase AND ev_phase < 7 THEN
      SELECT COUNT(*) INTO total_in_phase
      FROM event_tasks WHERE event_id = NEW.event_id AND phase = ev_phase;

      SELECT COUNT(*) INTO done_in_phase
      FROM event_tasks WHERE event_id = NEW.event_id AND phase = ev_phase AND status = 'done';

      IF total_in_phase > 0 AND done_in_phase = total_in_phase THEN
        UPDATE events SET current_phase = ev_phase + 1 WHERE id = NEW.event_id;

        SELECT id INTO dir_id FROM profiles WHERE role = 'director' LIMIT 1;
        IF dir_id IS NOT NULL THEN
          INSERT INTO notifications (user_id, title, body, link)
          VALUES (
            dir_id,
            'Phase Advanced',
            ev_name || ' moved to Phase ' || (ev_phase + 1),
            '/dashboard/events/' || NEW.event_id
          );
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_advance_phase ON event_tasks;
CREATE TRIGGER trg_auto_advance_phase
  AFTER UPDATE OF status ON event_tasks
  FOR EACH ROW EXECUTE FUNCTION auto_advance_event_phase();


-- ── 4. PERFORMANCE INDEXES ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_vendor_payments_status
  ON vendor_payments(status);

CREATE INDEX IF NOT EXISTS idx_event_tasks_phase_status
  ON event_tasks(event_id, phase, status);

CREATE INDEX IF NOT EXISTS idx_elements_inventory
  ON elements(inventory_item_id)
  WHERE inventory_item_id IS NOT NULL;
