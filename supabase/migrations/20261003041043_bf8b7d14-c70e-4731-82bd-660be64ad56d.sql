REVOKE EXECUTE ON FUNCTION public.dispatch_push_notification() FROM PUBLIC, anon, authenticated;

DROP EXTENSION pg_net;
CREATE EXTENSION pg_net WITH SCHEMA extensions;