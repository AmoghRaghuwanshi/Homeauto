-- Public registration creates a new private household, never membership in an
-- existing household. The runtime still has no direct access to credential rows.
CREATE FUNCTION homeauto_online.register_user(
 p_user uuid,p_household uuid,p_username text,p_display_name text,p_password_hash text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,homeauto_online AS $$
BEGIN
 IF p_user IS NULL OR p_household IS NULL OR p_username IS NULL
    OR p_username !~ '^[a-z0-9][a-z0-9._-]{2,31}$'
    OR p_display_name IS NULL OR length(btrim(p_display_name)) NOT BETWEEN 1 AND 80
    OR p_display_name ~ '[[:cntrl:]]'
    OR p_password_hash IS NULL
    OR p_password_hash !~ '^scrypt:32768:8:1:[a-f0-9]{32}:[a-f0-9]{128}$' THEN
  RAISE EXCEPTION 'Invalid registration input' USING ERRCODE='22023';
 END IF;
 INSERT INTO homeauto_online.users(user_id,username,display_name,password_hash)
 VALUES(p_user,p_username,p_display_name,p_password_hash);
 INSERT INTO homeauto_online.households(household_id,name) VALUES(p_household,'My home');
 INSERT INTO homeauto_online.memberships(household_id,user_id,role) VALUES(p_household,p_user,'owner');
 INSERT INTO homeauto_online.audit_events(household_id,user_id,action,success)
 VALUES(p_household,p_user,'signup',true);
 RETURN true;
EXCEPTION WHEN unique_violation THEN
 RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION homeauto_online.register_user(uuid,uuid,text,text,text) FROM PUBLIC;
