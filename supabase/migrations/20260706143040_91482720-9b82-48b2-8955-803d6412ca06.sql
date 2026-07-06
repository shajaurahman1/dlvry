
ALTER TYPE approval_status ADD VALUE IF NOT EXISTS 'blocked';

CREATE OR REPLACE FUNCTION public.nearby_orders(driver_lat double precision, driver_lng double precision)
 RETURNS TABLE(id uuid, shop_id uuid, shop_name text, pickup_address text, order_amount numeric, delivery_charge numeric, total_amount numeric, pickup_lat double precision, pickup_lng double precision, distance_km double precision, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    o.id, o.shop_id, s.shop_name, s.address AS pickup_address,
    o.order_amount, o.delivery_charge, o.total_amount,
    o.pickup_lat, o.pickup_lng,
    public.haversine_km(driver_lat, driver_lng, o.pickup_lat, o.pickup_lng) AS distance_km,
    o.created_at
  FROM public.orders o
  JOIN public.shopkeepers s ON s.id = o.shop_id
  JOIN public.drivers d ON d.id = auth.uid()
  WHERE o.status = 'pending'
    AND o.driver_id IS NULL
    AND d.approval_status = 'approved'
    AND o.order_amount <= d.available_cash
    AND public.haversine_km(driver_lat, driver_lng, o.pickup_lat, o.pickup_lng) <= 3
  ORDER BY distance_km ASC;
$function$;
