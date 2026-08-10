-- helper: current settings
CREATE OR REPLACE FUNCTION public.get_settings()
RETURNS public.app_settings LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.app_settings WHERE id = true;
$$;
REVOKE EXECUTE ON FUNCTION public.get_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_settings() TO authenticated;

-- generate OTP + expiry on insert
CREATE OR REPLACE FUNCTION public.prepare_new_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.app_settings;
BEGIN
  SELECT * INTO s FROM public.app_settings WHERE id = true;
  IF NEW.delivery_otp IS NULL THEN
    NEW.delivery_otp := lpad((floor(random()*10000))::int::text, 4, '0');
  END IF;
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := now() + make_interval(mins => COALESCE(s.request_expiry_minutes, 10));
  END IF;
  IF NEW.radius_km IS NULL OR NEW.radius_km = 0 THEN
    NEW.radius_km := COALESCE(s.delivery_radius_km, 3);
  END IF;
  NEW.total_amount := COALESCE(NEW.order_amount,0) + COALESCE(NEW.delivery_charge,0);
  NEW.status := 'searching';
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.prepare_new_order() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_prepare_new_order ON public.orders;
CREATE TRIGGER trg_prepare_new_order BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.prepare_new_order();

-- log status history
CREATE OR REPLACE FUNCTION public.log_order_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_status_history (order_id, status, changed_by)
    VALUES (NEW.id, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.log_order_status() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_log_order_status_ins ON public.orders;
CREATE TRIGGER trg_log_order_status_ins AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_status();
DROP TRIGGER IF EXISTS trg_log_order_status_upd ON public.orders;
CREATE TRIGGER trg_log_order_status_upd AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_status();

-- expire stale requests (called opportunistically)
CREATE OR REPLACE FUNCTION public.expire_stale_orders()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.orders
     SET status = 'no_driver_found'
   WHERE status IN ('pending','searching') AND driver_id IS NULL AND expires_at < now();
$$;
REVOKE EXECUTE ON FUNCTION public.expire_stale_orders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expire_stale_orders() TO authenticated;

-- nearby orders for the calling driver, eligibility enforced server-side
DROP FUNCTION IF EXISTS public.nearby_orders(double precision, double precision);
CREATE OR REPLACE FUNCTION public.nearby_orders(driver_lat double precision, driver_lng double precision)
RETURNS TABLE(
  id uuid, shop_id uuid, shop_name text, pickup_address text, shop_phone text,
  customer_name text, customer_address text,
  order_amount numeric, delivery_charge numeric, total_amount numeric,
  payment_method text, order_description text, pickup_notes text,
  pickup_lat double precision, pickup_lng double precision,
  distance_km double precision, created_at timestamptz, expires_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    o.id, o.shop_id, s.shop_name, s.address, COALESCE(s.shop_phone, p.phone),
    o.customer_name, o.customer_address,
    o.order_amount, o.delivery_charge, o.total_amount,
    o.payment_method, o.order_description, o.pickup_notes,
    o.pickup_lat, o.pickup_lng,
    public.haversine_km(driver_lat, driver_lng, o.pickup_lat, o.pickup_lng),
    o.created_at, o.expires_at
  FROM public.orders o
  JOIN public.shopkeepers s ON s.id = o.shop_id
  LEFT JOIN public.profiles p ON p.id = s.id
  JOIN public.drivers d ON d.id = auth.uid()
  WHERE o.status IN ('pending','searching')
    AND o.driver_id IS NULL
    AND (o.expires_at IS NULL OR o.expires_at > now())
    AND d.approval_status = 'approved'
    AND d.verification_status IN ('verified','active')
    AND d.is_online AND d.is_available AND NOT d.is_busy
    AND d.location_updated_at > now() - interval '10 minutes'
    AND o.order_amount <= d.available_cash
    AND public.haversine_km(driver_lat, driver_lng, o.pickup_lat, o.pickup_lng) <= COALESCE(o.radius_km, 3)
  ORDER BY 16 ASC;
$$;
REVOKE EXECUTE ON FUNCTION public.nearby_orders(double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nearby_orders(double precision, double precision) TO authenticated;

-- atomic accept
CREATE OR REPLACE FUNCTION public.accept_order(p_order_id uuid, p_lat double precision, p_lng double precision)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.drivers; o public.orders; dist double precision;
BEGIN
  SELECT * INTO d FROM public.drivers WHERE id = auth.uid();
  IF d.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_a_driver'); END IF;
  IF d.approval_status <> 'approved' OR d.verification_status NOT IN ('verified','active') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_verified');
  END IF;
  IF d.is_busy THEN RETURN jsonb_build_object('ok', false, 'error', 'busy'); END IF;

  SELECT * INTO o FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF o.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF o.driver_id IS NOT NULL OR o.status NOT IN ('pending','searching') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_taken');
  END IF;
  IF o.expires_at IS NOT NULL AND o.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  dist := public.haversine_km(p_lat, p_lng, o.pickup_lat, o.pickup_lng);
  IF dist > COALESCE(o.radius_km, 3) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_far');
  END IF;

  UPDATE public.orders SET driver_id = d.id, status = 'accepted', accepted_at = now()
   WHERE id = p_order_id AND driver_id IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'already_taken'); END IF;

  UPDATE public.drivers SET is_busy = true WHERE id = d.id;
  RETURN jsonb_build_object('ok', true, 'order_id', p_order_id);
END; $$;
REVOKE EXECUTE ON FUNCTION public.accept_order(uuid, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_order(uuid, double precision, double precision) TO authenticated;

-- guarded status advance by the assigned driver
CREATE OR REPLACE FUNCTION public.advance_order(p_order_id uuid, p_status public.order_status, p_otp text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF o.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF o.driver_id IS DISTINCT FROM auth.uid() THEN RETURN jsonb_build_object('ok', false, 'error', 'not_your_order'); END IF;
  IF o.status = 'delivered' THEN RETURN jsonb_build_object('ok', false, 'error', 'already_delivered'); END IF;

  IF p_status = 'delivered' THEN
    IF o.delivery_otp IS NOT NULL AND COALESCE(p_otp,'') <> o.delivery_otp THEN
      RETURN jsonb_build_object('ok', false, 'error', 'bad_otp');
    END IF;
    UPDATE public.orders SET status = 'delivered', delivered_at = now(), otp_verified = true WHERE id = p_order_id;
    UPDATE public.drivers SET is_busy = false WHERE id = auth.uid();
  ELSE
    UPDATE public.orders SET status = p_status WHERE id = p_order_id;
  END IF;
  RETURN jsonb_build_object('ok', true);
END; $$;
REVOKE EXECUTE ON FUNCTION public.advance_order(uuid, public.order_status, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advance_order(uuid, public.order_status, text) TO authenticated;

-- shop resends an expired request
CREATE OR REPLACE FUNCTION public.resend_order(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.app_settings; o public.orders;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = p_order_id;
  IF o.id IS NULL OR o.shop_id <> auth.uid() THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF o.driver_id IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'already_assigned'); END IF;
  SELECT * INTO s FROM public.app_settings WHERE id = true;
  UPDATE public.orders
     SET status = 'searching', expires_at = now() + make_interval(mins => COALESCE(s.request_expiry_minutes,10)),
         radius_km = COALESCE(s.delivery_radius_km, 3)
   WHERE id = p_order_id;
  RETURN jsonb_build_object('ok', true);
END; $$;
REVOKE EXECUTE ON FUNCTION public.resend_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resend_order(uuid) TO authenticated;

-- extend lifecycle notifications
CREATE OR REPLACE FUNCTION public.notify_order_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_title text; v_body text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, title, body, order_id)
    VALUES (NEW.shop_id, 'Searching for a delivery partner', COALESCE(NEW.order_description,'Order') || ' — request sent to nearby partners', NEW.id);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_title := CASE NEW.status
      WHEN 'accepted' THEN 'Delivery partner assigned'
      WHEN 'going_to_shop' THEN 'Partner is on the way to your shop'
      WHEN 'arrived_at_shop' THEN 'Partner arrived at your shop'
      WHEN 'reached_shop' THEN 'Partner reached your shop'
      WHEN 'payment_received' THEN 'Payment confirmed'
      WHEN 'picked_up' THEN 'Order picked up'
      WHEN 'going_to_customer' THEN 'Out for delivery'
      WHEN 'out_for_delivery' THEN 'Out for delivery'
      WHEN 'arrived_at_customer' THEN 'Partner reached the customer'
      WHEN 'delivered' THEN 'Delivered'
      WHEN 'cancelled' THEN 'Order cancelled'
      WHEN 'no_driver_found' THEN 'No delivery partner found'
      WHEN 'expired' THEN 'Request expired'
      ELSE 'Order updated' END;
    v_body := COALESCE(NEW.order_description, 'Order');

    INSERT INTO public.notifications (user_id, title, body, order_id)
      VALUES (NEW.shop_id, v_title, v_body, NEW.id);
    IF NEW.driver_id IS NOT NULL AND NEW.status IN ('cancelled','delivered','accepted','payment_received') THEN
      INSERT INTO public.notifications (user_id, title, body, order_id)
        VALUES (NEW.driver_id, v_title, v_body, NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END; $$;