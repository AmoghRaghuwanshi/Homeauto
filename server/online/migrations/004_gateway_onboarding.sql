-- Browser enrollment is scoped by the current owner session, never caller IDs.
CREATE FUNCTION homeauto_online.enroll_browser_gateway(
 p_session_hash text,p_gateway uuid,p_key uuid,p_token_hash text,p_replace_unused boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid; a jsonb; h uuid; g homeauto_online.gateways; expiry timestamptz;
BEGIN
 IF p_gateway IS NULL OR p_key IS NULL OR p_replace_unused IS NULL
    OR p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$' THEN
  RAISE EXCEPTION 'VALIDATION_ERROR';
 END IF;
 SELECT user_id INTO u FROM homeauto_online.sessions WHERE token_hash=p_session_hash;
 IF u IS NULL THEN RAISE EXCEPTION 'LOGIN_REQUIRED'; END IF;
 PERFORM 1 FROM homeauto_online.users WHERE user_id=u FOR UPDATE;
 a := homeauto_online.session_actor(p_session_hash);
 IF a IS NULL THEN RAISE EXCEPTION 'LOGIN_REQUIRED'; END IF;
 IF a->>'role'<>'owner' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF a->>'reauth_at' IS NULL OR (a->>'reauth_at')::timestamptz<now()-interval '5 minutes' THEN
  RAISE EXCEPTION 'REAUTH_REQUIRED';
 END IF;
 h := (a->>'household_id')::uuid;
 PERFORM pg_advisory_xact_lock(hashtextextended(h::text,0));
 SELECT * INTO g FROM homeauto_online.gateways WHERE household_id=h;
 IF FOUND THEN
  IF g.revoked_at IS NOT NULL OR g.last_seen_at IS NOT NULL OR NOT p_replace_unused THEN
   RAISE EXCEPTION 'GATEWAY_ALREADY_ENROLLED';
  END IF;
  -- Explicit replacement is permitted only before the first gateway report.
  UPDATE homeauto_online.gateway_keys SET revoked_at=now()
   WHERE household_id=h AND gateway_id=g.gateway_id AND revoked_at IS NULL;
 ELSE
  INSERT INTO homeauto_online.gateways(household_id,gateway_id) VALUES(h,p_gateway) RETURNING * INTO g;
 END IF;
 expiry := now()+interval '30 days';
 INSERT INTO homeauto_online.gateway_keys(key_id,household_id,gateway_id,token_hash,expires_at)
 VALUES(p_key,h,g.gateway_id,p_token_hash,expiry);
 INSERT INTO homeauto_online.audit_events(household_id,user_id,action,success)
 VALUES(h,u,'gateway_enrolled',true);
 RETURN jsonb_build_object('household_id',h,'gateway_id',g.gateway_id,'key_id',p_key,'expires_at',expiry);
END;
$$;
REVOKE ALL ON FUNCTION homeauto_online.enroll_browser_gateway(text,uuid,uuid,text,boolean) FROM PUBLIC;
