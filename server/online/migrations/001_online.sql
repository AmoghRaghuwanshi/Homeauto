CREATE SCHEMA homeauto_online;
REVOKE ALL ON SCHEMA homeauto_online FROM PUBLIC;
CREATE TABLE homeauto_online.users(
 user_id uuid PRIMARY KEY,username text NOT NULL UNIQUE,display_name text NOT NULL,password_hash text NOT NULL,
 disabled boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE homeauto_online.households(household_id uuid PRIMARY KEY,name text NOT NULL,version integer NOT NULL DEFAULT 1 CHECK(version>0),event_highwater bigint NOT NULL DEFAULT 0 CHECK(event_highwater>=0),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE homeauto_online.memberships(
 household_id uuid NOT NULL REFERENCES homeauto_online.households,user_id uuid NOT NULL REFERENCES homeauto_online.users,
 role text NOT NULL CHECK(role IN('owner','resident','viewer')),active boolean NOT NULL DEFAULT true,PRIMARY KEY(household_id,user_id)
);
CREATE TABLE homeauto_online.gateways(
 household_id uuid PRIMARY KEY REFERENCES homeauto_online.households,gateway_id uuid NOT NULL UNIQUE,
 epoch uuid,last_sequence bigint NOT NULL DEFAULT 0 CHECK(last_sequence>=0 AND last_sequence<=9007199254740991),
 last_seen_at timestamptz,mqtt_connected boolean NOT NULL DEFAULT false,boards jsonb NOT NULL DEFAULT '{}',catalog_digest text,revoked_at timestamptz,
 UNIQUE(household_id,gateway_id)
);
CREATE TABLE homeauto_online.gateway_keys(
 key_id uuid PRIMARY KEY,household_id uuid NOT NULL,gateway_id uuid NOT NULL,token_hash text NOT NULL UNIQUE CHECK(token_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,revoked_at timestamptz,
 FOREIGN KEY(household_id,gateway_id) REFERENCES homeauto_online.gateways(household_id,gateway_id),CHECK(expires_at>created_at AND expires_at<=created_at+interval '31 days')
);
CREATE TABLE homeauto_online.sessions(
 token_hash text PRIMARY KEY CHECK(token_hash ~ '^[a-f0-9]{64}$'),user_id uuid NOT NULL REFERENCES homeauto_online.users,family_id uuid NOT NULL DEFAULT gen_random_uuid(),revoked_at timestamptz,
 household_id uuid NOT NULL,created_at timestamptz NOT NULL,expires_at timestamptz NOT NULL,last_active_at timestamptz NOT NULL DEFAULT now(),reauth_at timestamptz,
 FOREIGN KEY(household_id,user_id) REFERENCES homeauto_online.memberships(household_id,user_id),CHECK(expires_at>created_at AND expires_at<=created_at+interval '8 hours')
);
CREATE INDEX sessions_expiry_idx ON homeauto_online.sessions(expires_at);
CREATE INDEX sessions_family_idx ON homeauto_online.sessions(family_id);
CREATE TABLE homeauto_online.rooms(
 household_id uuid NOT NULL REFERENCES homeauto_online.households,room_id text NOT NULL,name text NOT NULL,name_key text NOT NULL,sort_order integer NOT NULL DEFAULT 0 CHECK(sort_order>=0),version integer NOT NULL CHECK(version>0),
 PRIMARY KEY(household_id,room_id),UNIQUE(household_id,name_key)
);
CREATE TABLE homeauto_online.devices(
 household_id uuid NOT NULL REFERENCES homeauto_online.households,device_id text NOT NULL,name text NOT NULL,type text NOT NULL,room_id text NOT NULL,version integer NOT NULL CHECK(version>0),
 PRIMARY KEY(household_id,device_id),FOREIGN KEY(household_id,room_id) REFERENCES homeauto_online.rooms(household_id,room_id),
 CHECK((device_id IN('light-1','light-2','light-3','light-4') AND type='light') OR (device_id='door-1' AND type='door') OR (device_id IN('sensor-gas','sensor-motion') AND type='sensor'))
);
CREATE TABLE homeauto_online.observations(
 household_id uuid NOT NULL,device_id text NOT NULL,gateway_id uuid NOT NULL,epoch uuid NOT NULL,sequence bigint NOT NULL,
 reported_status text,reported_at timestamptz,current_report boolean NOT NULL,retained boolean NOT NULL,board_online boolean NOT NULL,payload jsonb,
 received_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(household_id,device_id),
 FOREIGN KEY(household_id,device_id) REFERENCES homeauto_online.devices(household_id,device_id),FOREIGN KEY(household_id,gateway_id) REFERENCES homeauto_online.gateways(household_id,gateway_id)
);
CREATE TABLE homeauto_online.observation_history(
 history_id bigserial PRIMARY KEY,household_id uuid NOT NULL,device_id text NOT NULL,sequence bigint NOT NULL,
 reported_status text,reported_at timestamptz,payload jsonb,received_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(household_id,device_id) REFERENCES homeauto_online.devices(household_id,device_id)
);
CREATE INDEX observation_history_retention_idx ON homeauto_online.observation_history(household_id,received_at);
CREATE TABLE homeauto_online.commands(
 command_id uuid PRIMARY KEY,household_id uuid NOT NULL,device_id text NOT NULL,actor_id uuid NOT NULL,session_hash text NOT NULL,
 action text NOT NULL CHECK(action IN('on','off')),state text NOT NULL CHECK(state IN('queued','delivered','pending_observation','observed','rejected','failed','expired','uncertain')),
 idempotency_key uuid NOT NULL,request_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,
 gateway_id uuid,lease_id uuid,delivered_at timestamptz,redeemed_at timestamptz,observed_at timestamptz,finished_at timestamptz,error_code text,
 UNIQUE(household_id,actor_id,idempotency_key),FOREIGN KEY(household_id,device_id) REFERENCES homeauto_online.devices(household_id,device_id),
 FOREIGN KEY(household_id,actor_id) REFERENCES homeauto_online.memberships(household_id,user_id),CHECK(device_id IN('light-1','light-2','light-3','light-4')),
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '20 seconds'),FOREIGN KEY(household_id,gateway_id) REFERENCES homeauto_online.gateways(household_id,gateway_id)
);
CREATE UNIQUE INDEX commands_one_pending_idx ON homeauto_online.commands(household_id,device_id) WHERE state IN('queued','delivered','pending_observation');
CREATE INDEX commands_queue_idx ON homeauto_online.commands(household_id,state,expires_at);
CREATE TABLE homeauto_online.alerts(
 household_id uuid NOT NULL,alert_id uuid NOT NULL,device_id text NOT NULL,kind text NOT NULL CHECK(kind IN('gas','motion')),severity text NOT NULL CHECK(severity IN('info','warning','critical')),
 state text NOT NULL CHECK(state IN('active','resolved')),opened_at timestamptz NOT NULL,last_seen_at timestamptz NOT NULL,resolved_at timestamptz,version integer NOT NULL CHECK(version>0),
 PRIMARY KEY(household_id,alert_id),FOREIGN KEY(household_id,device_id) REFERENCES homeauto_online.devices(household_id,device_id)
);
CREATE TABLE homeauto_online.alert_receipts(
 household_id uuid NOT NULL,alert_id uuid NOT NULL,user_id uuid NOT NULL,read_at timestamptz,acknowledged_at timestamptz,
 PRIMARY KEY(household_id,alert_id,user_id),FOREIGN KEY(household_id,alert_id) REFERENCES homeauto_online.alerts(household_id,alert_id),FOREIGN KEY(household_id,user_id) REFERENCES homeauto_online.memberships(household_id,user_id)
);
CREATE TABLE homeauto_online.preferences(
 household_id uuid NOT NULL,user_id uuid NOT NULL,value jsonb NOT NULL DEFAULT '{}',version integer NOT NULL DEFAULT 0 CHECK(version>=0),PRIMARY KEY(household_id,user_id),
 FOREIGN KEY(household_id,user_id) REFERENCES homeauto_online.memberships(household_id,user_id)
);
CREATE TABLE homeauto_online.gateway_inbox(
 household_id uuid NOT NULL,gateway_id uuid NOT NULL,event_id uuid NOT NULL,sequence bigint NOT NULL CHECK(sequence>0 AND sequence<=9007199254740991),digest text NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(gateway_id,event_id),UNIQUE(gateway_id,sequence),
 FOREIGN KEY(household_id,gateway_id) REFERENCES homeauto_online.gateways(household_id,gateway_id)
);
CREATE TABLE homeauto_online.gateway_tickets(
 ticket_id uuid PRIMARY KEY,household_id uuid NOT NULL,gateway_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,consumed boolean NOT NULL DEFAULT false,
 FOREIGN KEY(household_id,gateway_id) REFERENCES homeauto_online.gateways(household_id,gateway_id),CHECK(expires_at>created_at AND expires_at<=created_at+interval '10 seconds')
);
CREATE TABLE homeauto_online.events(
 sequence bigserial PRIMARY KEY,event_id uuid NOT NULL UNIQUE,household_id uuid NOT NULL REFERENCES homeauto_online.households,
 type text NOT NULL,device_id text,payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX events_household_cursor_idx ON homeauto_online.events(household_id,sequence);
CREATE INDEX events_retention_idx ON homeauto_online.events(created_at);
CREATE TABLE homeauto_online.intents(
 intent_id uuid PRIMARY KEY,household_id uuid NOT NULL,user_id uuid NOT NULL,session_hash text NOT NULL,intent jsonb NOT NULL,expires_at timestamptz NOT NULL,
 execution_key uuid,result jsonb,FOREIGN KEY(household_id,user_id) REFERENCES homeauto_online.memberships(household_id,user_id)
);
CREATE TABLE homeauto_online.rate_limits(bucket text PRIMARY KEY,count integer NOT NULL,window_until timestamptz NOT NULL);
CREATE TABLE homeauto_online.audit_events(
 audit_id bigserial PRIMARY KEY,household_id uuid,user_id uuid,action text NOT NULL,success boolean NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_retention_idx ON homeauto_online.audit_events(created_at);

-- Global credentials are private: the runtime gets functions, never table access.
CREATE FUNCTION homeauto_online.login_user(p_name text) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('user_id',user_id,'password_hash',password_hash,'disabled',disabled) FROM homeauto_online.users WHERE username=p_name;
$$;
CREATE FUNCTION homeauto_online.session_actor(p_hash text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s homeauto_online.sessions; result jsonb;
BEGIN
 SELECT * INTO s FROM homeauto_online.sessions WHERE token_hash=p_hash AND revoked_at IS NULL AND expires_at>now() AND last_active_at>now()-interval '30 minutes';
 IF NOT FOUND THEN RETURN NULL; END IF;
 PERFORM set_config('homeauto.user_id',s.user_id::text,true),set_config('homeauto.household_id',s.household_id::text,true),set_config('homeauto.gateway_id','',true);
 SELECT jsonb_build_object('user_id',u.user_id,'username',u.username,'display_name',u.display_name,'household_id',s.household_id,'role',m.role,'created_at',s.created_at,'expires_at',s.expires_at,'reauth_at',s.reauth_at)
 INTO result FROM homeauto_online.users u JOIN homeauto_online.memberships m ON m.user_id=u.user_id AND m.household_id=s.household_id WHERE u.user_id=s.user_id AND NOT u.disabled AND m.active;
 RETURN result;
END; $$;
CREATE FUNCTION homeauto_online.user_households(p_user uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM set_config('homeauto.user_id',p_user::text,true),set_config('homeauto.gateway_id','',true);
 -- Only this function may enumerate memberships before a session has a household.
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('household_id',m.household_id,'role',m.role,'name',h.name) ORDER BY m.household_id),'[]') FROM homeauto_online.memberships m JOIN homeauto_online.households h USING(household_id) WHERE m.user_id=p_user AND m.active);
END; $$;
CREATE FUNCTION homeauto_online.issue_session(p_user uuid,p_house uuid,p_hash text,p_created timestamptz,p_expires timestamptz,p_reauth timestamptz,p_verified_hash text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM 1 FROM homeauto_online.users WHERE user_id=p_user FOR UPDATE;
 PERFORM set_config('homeauto.user_id',p_user::text,true),set_config('homeauto.household_id',p_house::text,true),set_config('homeauto.gateway_id','',true);
 IF NOT EXISTS(SELECT 1 FROM homeauto_online.memberships m JOIN homeauto_online.users u USING(user_id) WHERE m.user_id=p_user AND m.household_id=p_house AND m.active AND NOT u.disabled AND u.password_hash=p_verified_hash) THEN RETURN false; END IF;
 INSERT INTO homeauto_online.sessions(token_hash,user_id,household_id,created_at,expires_at,reauth_at) VALUES(p_hash,p_user,p_house,p_created,p_expires,p_reauth);
 RETURN true;
END; $$;
CREATE FUNCTION homeauto_online.rotate_session(p_old text,p_next text,p_house uuid,p_reauth boolean,p_verified_hash text DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s homeauto_online.sessions; u uuid;
BEGIN
 SELECT user_id INTO u FROM homeauto_online.sessions WHERE token_hash=p_old;
 IF u IS NULL THEN RETURN false; END IF;
 PERFORM 1 FROM homeauto_online.users WHERE user_id=u FOR UPDATE;
 SELECT * INTO s FROM homeauto_online.sessions WHERE token_hash=p_old AND revoked_at IS NULL AND expires_at>now() AND last_active_at>now()-interval '30 minutes';
 IF NOT FOUND THEN RETURN false; END IF;
 PERFORM set_config('homeauto.user_id',u::text,true),set_config('homeauto.household_id',p_house::text,true),set_config('homeauto.gateway_id','',true);
 IF NOT EXISTS(SELECT 1 FROM homeauto_online.memberships m JOIN homeauto_online.users a USING(user_id) WHERE m.household_id=p_house AND m.user_id=u AND m.active AND NOT a.disabled AND (NOT p_reauth OR a.password_hash=p_verified_hash)) THEN RETURN false; END IF;
 UPDATE homeauto_online.sessions SET revoked_at=now() WHERE token_hash=p_old;
 INSERT INTO homeauto_online.sessions(token_hash,user_id,household_id,family_id,created_at,expires_at,reauth_at) VALUES(p_next,u,p_house,s.family_id,s.created_at,s.expires_at,CASE WHEN p_reauth THEN now() ELSE NULL END);
 RETURN true;
END; $$;
CREATE FUNCTION homeauto_online.revoke_session(p_hash text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s homeauto_online.sessions;
BEGIN
 SELECT * INTO s FROM homeauto_online.sessions WHERE token_hash=p_hash;
 IF NOT FOUND THEN RETURN; END IF;
 PERFORM 1 FROM homeauto_online.users WHERE user_id=s.user_id FOR UPDATE;
 UPDATE homeauto_online.sessions SET revoked_at=now() WHERE family_id=s.family_id;
END; $$;
CREATE FUNCTION homeauto_online.touch_session(p_hash text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$ UPDATE homeauto_online.sessions SET last_active_at=now() WHERE token_hash=p_hash AND revoked_at IS NULL AND expires_at>now() AND last_active_at>now()-interval '30 minutes' AND last_active_at<now()-interval '1 minute'; $$;
CREATE FUNCTION homeauto_online.gateway_actor(p_hash text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE k homeauto_online.gateway_keys; result jsonb;
BEGIN
 SELECT * INTO k FROM homeauto_online.gateway_keys WHERE token_hash=p_hash AND expires_at>now() AND revoked_at IS NULL;
 IF NOT FOUND THEN RETURN NULL; END IF;
 PERFORM set_config('homeauto.household_id',k.household_id::text,true),set_config('homeauto.gateway_id',k.gateway_id::text,true),set_config('homeauto.user_id','',true);
 SELECT jsonb_build_object('household_id',household_id,'gateway_id',gateway_id) INTO result FROM homeauto_online.gateways WHERE gateway_id=k.gateway_id AND revoked_at IS NULL;
 RETURN result;
END; $$;
CREATE FUNCTION homeauto_online.valid_controller(p_user uuid,p_house uuid,p_session text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE previous_user text; allowed boolean;
BEGIN
 previous_user:=current_setting('homeauto.user_id',true);PERFORM set_config('homeauto.user_id',p_user::text,true);
 SELECT EXISTS(SELECT 1 FROM homeauto_online.sessions s JOIN homeauto_online.users u USING(user_id) JOIN homeauto_online.memberships m ON m.user_id=s.user_id AND m.household_id=s.household_id WHERE s.token_hash=p_session AND s.revoked_at IS NULL AND s.user_id=p_user AND s.household_id=p_house AND s.expires_at>now() AND s.last_active_at>now()-interval '30 minutes' AND NOT u.disabled AND m.active AND m.role IN('owner','resident')) INTO allowed;
 PERFORM set_config('homeauto.user_id',coalesce(previous_user,''),true);RETURN allowed;
END;
$$;
CREATE FUNCTION homeauto_online.take_limit(p_bucket text,p_limit integer,p_seconds integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE n integer;
BEGIN
 DELETE FROM homeauto_online.rate_limits WHERE window_until<now()-interval '1 day';
 INSERT INTO homeauto_online.rate_limits(bucket,count,window_until) VALUES(p_bucket,1,now()+make_interval(secs=>p_seconds))
 ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN homeauto_online.rate_limits.window_until<=now() THEN 1 ELSE homeauto_online.rate_limits.count+1 END,window_until=CASE WHEN homeauto_online.rate_limits.window_until<=now() THEN now()+make_interval(secs=>p_seconds) ELSE homeauto_online.rate_limits.window_until END RETURNING count INTO n;
 RETURN n<=p_limit;
END; $$;
CREATE FUNCTION homeauto_online.log_auth(p_user uuid,p_action text,p_success boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 DELETE FROM homeauto_online.audit_events WHERE audit_id IN(SELECT audit_id FROM homeauto_online.audit_events WHERE created_at<now()-interval '90 days' LIMIT 5000);
 INSERT INTO homeauto_online.audit_events(user_id,action,success) VALUES(p_user,p_action,p_success);
END; $$;

CREATE FUNCTION homeauto_online.prune_household(p_house uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF p_house::text IS DISTINCT FROM current_setting('homeauto.household_id',true) THEN RAISE EXCEPTION 'Household scope required'; END IF;
 DELETE FROM homeauto_online.observation_history WHERE history_id IN(SELECT history_id FROM homeauto_online.observation_history WHERE household_id=p_house AND received_at<now()-interval '1 day' LIMIT 5000);
 DELETE FROM homeauto_online.events WHERE sequence IN(SELECT sequence FROM homeauto_online.events WHERE household_id=p_house AND created_at<now()-interval '30 days' LIMIT 5000);
 DELETE FROM homeauto_online.gateway_inbox WHERE (gateway_id,event_id) IN(SELECT gateway_id,event_id FROM homeauto_online.gateway_inbox WHERE household_id=p_house AND received_at<now()-interval '7 days' LIMIT 5000);
 DELETE FROM homeauto_online.commands WHERE command_id IN(SELECT command_id FROM homeauto_online.commands WHERE household_id=p_house AND state NOT IN('queued','delivered','pending_observation') AND finished_at<now()-interval '30 days' LIMIT 5000);
 DELETE FROM homeauto_online.intents WHERE intent_id IN(SELECT intent_id FROM homeauto_online.intents WHERE household_id=p_house AND expires_at<now()-interval '1 minute' LIMIT 5000);
 DELETE FROM homeauto_online.sessions WHERE token_hash IN(SELECT token_hash FROM homeauto_online.sessions WHERE household_id=p_house AND expires_at<now()-interval '1 day' LIMIT 5000);
 DELETE FROM homeauto_online.alert_receipts WHERE household_id=p_house AND alert_id IN(SELECT alert_id FROM homeauto_online.alerts WHERE household_id=p_house AND state='resolved' AND resolved_at<now()-interval '90 days' LIMIT 5000);
 DELETE FROM homeauto_online.alerts WHERE household_id=p_house AND alert_id IN(SELECT alert_id FROM homeauto_online.alerts WHERE household_id=p_house AND state='resolved' AND resolved_at<now()-interval '90 days' LIMIT 5000);
END; $$;

CREATE FUNCTION homeauto_online.is_operator() RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog AS $$ SELECT current_user=(SELECT r.rolname FROM pg_namespace n JOIN pg_roles r ON r.oid=n.nspowner WHERE n.nspname='homeauto_online'); $$;
ALTER TABLE homeauto_online.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE homeauto_online.memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY member_self ON homeauto_online.memberships USING(homeauto_online.is_operator() OR user_id::text=current_setting('homeauto.user_id',true));
ALTER TABLE homeauto_online.gateways ENABLE ROW LEVEL SECURITY;
ALTER TABLE homeauto_online.gateways FORCE ROW LEVEL SECURITY;
CREATE POLICY gateway_scope ON homeauto_online.gateways USING(homeauto_online.is_operator() OR household_id::text=current_setting('homeauto.household_id',true) AND (gateway_id::text=current_setting('homeauto.gateway_id',true) OR EXISTS(SELECT 1 FROM homeauto_online.memberships m WHERE m.household_id=gateways.household_id AND m.active)));
CREATE FUNCTION homeauto_online.in_household(p_house uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT homeauto_online.is_operator() OR p_house::text=current_setting('homeauto.household_id',true) AND (EXISTS(SELECT 1 FROM homeauto_online.memberships m WHERE m.household_id=p_house AND m.active) OR EXISTS(SELECT 1 FROM homeauto_online.gateways g WHERE g.household_id=p_house AND g.gateway_id::text=current_setting('homeauto.gateway_id',true) AND g.revoked_at IS NULL));
$$;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['households','rooms','devices','observations','observation_history','commands','alerts','gateway_inbox','gateway_tickets','events'] LOOP
  EXECUTE format('ALTER TABLE homeauto_online.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE homeauto_online.%I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('CREATE POLICY tenant_scope ON homeauto_online.%I USING(homeauto_online.in_household(household_id)) WITH CHECK(homeauto_online.in_household(household_id))',tab);
 END LOOP;
 FOREACH tab IN ARRAY ARRAY['alert_receipts','preferences','intents'] LOOP
  EXECUTE format('ALTER TABLE homeauto_online.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE homeauto_online.%I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('CREATE POLICY personal_scope ON homeauto_online.%I USING(homeauto_online.in_household(household_id) AND (homeauto_online.is_operator() OR user_id::text=current_setting(''homeauto.user_id'',true))) WITH CHECK(homeauto_online.in_household(household_id) AND (homeauto_online.is_operator() OR user_id::text=current_setting(''homeauto.user_id'',true)))',tab);
 END LOOP;
END; $$;
REVOKE ALL ON ALL TABLES IN SCHEMA homeauto_online FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA homeauto_online FROM PUBLIC;
