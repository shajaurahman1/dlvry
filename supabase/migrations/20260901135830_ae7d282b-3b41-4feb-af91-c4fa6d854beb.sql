ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS search_radius_km numeric NOT NULL DEFAULT 3;

CREATE OR REPLACE FUNCTION public.nearby_orders(driver_lat double precision, driver_lng double precision)
RETURNS TABLE(id uuid, shop_id uuid, shop_name text, pickup_address text, shop_phone text, customer_name text, customer_address text, order_amount numeric, delivery_charge numeric, total_amount numeric, payment_method text, order_description text, pickup_notes text, pickup_lat double precision, pickup_lng double precision, distance_km double precision, created_at timestamp with time zone, expires_at timestamp with time zone)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id,
         o.shop_id,
         s.shop_name,
         s.address AS pickup_address,
         s.shop_phone,
         o.customer_name,
         o.customer_address,
         o.order_amount,
         o.delivery_charge,
         o.total_amount,
         o.payment_method,
         o.order_description,
         o.pickup_notes,
         o.pickup_lat,
         o.pickup_lng,
         haversine_km(driver_lat, driver_lng, o.pickup_lat, o.pickup_lng) AS distance_km,
         o.created_at,
         o.expires_at
  FROM public.orders o
  JOIN public.shopkeepers s ON s.id = o.shop_id
  JOIN public.drivers d ON d.id = auth.uid()
  WHERE o.driver_id IS NULL
    AND o.status IN ('pending','searching')
    AND (o.expires_at IS NULL OR o.expires_at > now())
    AND d.approval_status = 'approved'
    AND d.verification_status IN ('verified','active')
    AND d.is_online = true
    AND d.is_available = true
    AND d.is_busy = false
    AND d.location_updated_at IS NOT NULL
    AND d.location_updated_at > now() - interval '10 minutes'
    AND o.order_amount <= d.available_cash
    AND haversine_km(driver_lat, driver_lng, o.pickup_lat, o.pickup_lng)
        <= LEAST(COALESCE(o.radius_km, 3), COALESCE(d.search_radius_km, 3))
  ORDER BY distance_km ASC
$$;

REVOKE ALL ON FUNCTION public.nearby_orders(double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nearby_orders(double precision, double precision) TO authenticated;