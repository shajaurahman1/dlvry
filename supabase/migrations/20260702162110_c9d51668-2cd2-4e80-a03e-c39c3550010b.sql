
-- search_path on remaining functions
CREATE OR REPLACE FUNCTION public.haversine_km(lat1 DOUBLE PRECISION, lon1 DOUBLE PRECISION, lat2 DOUBLE PRECISION, lon2 DOUBLE PRECISION)
RETURNS DOUBLE PRECISION LANGUAGE SQL IMMUTABLE SET search_path = public AS $$
  SELECT 2 * 6371 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians(lon2 - lon1) / 2), 2)
  ));
$$;

-- Revoke public execute on SECURITY DEFINER; grant only to authenticated
REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.nearby_orders(DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nearby_orders(DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_rating_aggregates() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stamp_order_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Tighten notifications insert
DROP POLICY IF EXISTS "Authenticated can create notifications" ON public.notifications;
CREATE POLICY "Notify own or order party" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR public.has_role(auth.uid(),'admin')
    OR (
      order_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_id
          AND (o.shop_id = auth.uid() OR o.driver_id = auth.uid())
      )
    )
  );
