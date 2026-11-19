-- Forward-only maintenance change. No household, observation or command data rewrite.
CREATE INDEX rate_limits_expiry_idx ON homeauto_online.rate_limits(window_until);
CREATE OR REPLACE FUNCTION homeauto_online.take_limit(p_bucket text,p_limit integer,p_seconds integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE n integer;
BEGIN
 INSERT INTO homeauto_online.rate_limits(bucket,count,window_until) VALUES(p_bucket,1,now()+make_interval(secs=>p_seconds))
 ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN homeauto_online.rate_limits.window_until<=now() THEN 1 ELSE homeauto_online.rate_limits.count+1 END,window_until=CASE WHEN homeauto_online.rate_limits.window_until<=now() THEN now()+make_interval(secs=>p_seconds) ELSE homeauto_online.rate_limits.window_until END RETURNING count INTO n;
 RETURN n<=p_limit;
END; $$;
CREATE OR REPLACE FUNCTION homeauto_online.log_auth(p_user uuid,p_action text,p_success boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 INSERT INTO homeauto_online.audit_events(user_id,action,success) VALUES(p_user,p_action,p_success);
END; $$;
CREATE FUNCTION homeauto_online.prune_global() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 DELETE FROM homeauto_online.rate_limits WHERE bucket IN(SELECT bucket FROM homeauto_online.rate_limits WHERE window_until<now()-interval '1 day' ORDER BY window_until LIMIT 5000);
 DELETE FROM homeauto_online.audit_events WHERE audit_id IN(SELECT audit_id FROM homeauto_online.audit_events WHERE created_at<now()-interval '90 days' ORDER BY created_at LIMIT 5000);
END; $$;
REVOKE ALL ON FUNCTION homeauto_online.prune_global() FROM PUBLIC;
