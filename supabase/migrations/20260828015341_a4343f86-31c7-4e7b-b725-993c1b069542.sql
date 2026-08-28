CREATE OR REPLACE FUNCTION public.set_driver_location(p_lat double precision, p_lng double precision)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_lat IS NULL OR p_lng IS NULL THEN
    RETURN false;
  END IF;
  UPDATE public.drivers
     SET current_lat = p_lat,
         current_lng = p_lng,
         location_updated_at = now()
   WHERE id = auth.uid();
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.set_driver_location(double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_driver_location(double precision, double precision) TO authenticated;