-- The door shares the existing short-lived, single-delivery command journal.
-- Operator gates in both runtimes remain disabled by default.
ALTER TABLE homeauto_online.commands DROP CONSTRAINT commands_action_check;
ALTER TABLE homeauto_online.commands ADD CONSTRAINT commands_action_check CHECK(action IN('on','off','lock','unlock'));
ALTER TABLE homeauto_online.commands DROP CONSTRAINT commands_device_id_check;
ALTER TABLE homeauto_online.commands ADD CONSTRAINT commands_device_id_check CHECK(device_id IN('light-1','light-2','light-3','light-4','door-1'));
