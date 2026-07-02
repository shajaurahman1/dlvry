
-- =========================================================
-- ROLES
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('shopkeeper', 'driver', 'admin');

CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected', 'suspended');

CREATE TYPE public.order_status AS ENUM (
  'pending','accepted','reached_shop','payment_received',
  'out_for_delivery','delivered','cancelled'
);

CREATE TYPE public.vehicle_type AS ENUM ('walking','cycle','bike','car');

-- =========================================================
-- HELPERS
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- USER ROLES (never store roles on profile)
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Admins read all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- SHOPKEEPERS
-- =========================================================
CREATE TABLE public.shopkeepers (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_name TEXT NOT NULL,
  shop_category TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  gov_id_url TEXT,
  shop_photo_url TEXT,
  trade_license_url TEXT,
  gst_number TEXT,
  approval_status public.approval_status NOT NULL DEFAULT 'pending',
  rating_avg NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.shopkeepers TO authenticated;
GRANT ALL ON public.shopkeepers TO service_role;
ALTER TABLE public.shopkeepers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop reads own" ON public.shopkeepers
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Shop inserts own" ON public.shopkeepers
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Shop updates own" ON public.shopkeepers
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admin reads all shops" ON public.shopkeepers
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin manages shops" ON public.shopkeepers
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
-- Drivers need to read minimal shop info for accepted orders (name/address) — done via order joins/RPC, not direct table read.

CREATE TRIGGER trg_shopkeepers_updated BEFORE UPDATE ON public.shopkeepers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- DRIVERS
-- =========================================================
CREATE TABLE public.drivers (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  date_of_birth DATE,
  home_address TEXT,
  gov_id_url TEXT,
  selfie_url TEXT,
  emergency_contact TEXT,
  vehicle_type public.vehicle_type NOT NULL,
  vehicle_number TEXT,
  available_cash NUMERIC(10,2) NOT NULL DEFAULT 0,
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  location_updated_at TIMESTAMPTZ,
  approval_status public.approval_status NOT NULL DEFAULT 'pending',
  is_available BOOLEAN NOT NULL DEFAULT true,
  rating_avg NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.drivers TO authenticated;
GRANT ALL ON public.drivers TO service_role;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Driver reads own" ON public.drivers
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Driver inserts own" ON public.drivers
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Driver updates own" ON public.drivers
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admin reads all drivers" ON public.drivers
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin manages drivers" ON public.drivers
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_drivers_updated BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- ORDERS
-- =========================================================
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shopkeepers(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  order_description TEXT NOT NULL,
  order_amount NUMERIC(10,2) NOT NULL,
  delivery_charge NUMERIC(10,2) NOT NULL,
  total_amount NUMERIC(10,2) GENERATED ALWAYS AS (order_amount + delivery_charge) STORED,
  pickup_notes TEXT,
  pickup_lat DOUBLE PRECISION NOT NULL,
  pickup_lng DOUBLE PRECISION NOT NULL,
  status public.order_status NOT NULL DEFAULT 'pending',
  accepted_at TIMESTAMPTZ,
  reached_shop_at TIMESTAMPTZ,
  payment_received_at TIMESTAMPTZ,
  out_for_delivery_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Shopkeeper owns their orders (full visibility)
CREATE POLICY "Shop reads own orders" ON public.orders
  FOR SELECT TO authenticated USING (auth.uid() = shop_id);
CREATE POLICY "Shop inserts orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = shop_id AND public.has_role(auth.uid(), 'shopkeeper'));
CREATE POLICY "Shop updates own orders" ON public.orders
  FOR UPDATE TO authenticated USING (auth.uid() = shop_id);

-- Driver sees pending orders (via nearby RPC, but also direct read for their assigned ones)
CREATE POLICY "Driver reads assigned orders" ON public.orders
  FOR SELECT TO authenticated USING (auth.uid() = driver_id);

-- Pending orders are visible to approved drivers (nearby filtering done client/RPC-side)
CREATE POLICY "Approved drivers read pending orders" ON public.orders
  FOR SELECT TO authenticated
  USING (
    status = 'pending'
    AND driver_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.id = auth.uid() AND d.approval_status = 'approved'
    )
  );

-- Driver can accept (claim) a pending order and later update status
CREATE POLICY "Driver updates own accepted order" ON public.orders
  FOR UPDATE TO authenticated USING (auth.uid() = driver_id);

-- Admin
CREATE POLICY "Admin reads all orders" ON public.orders
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin updates orders" ON public.orders
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX orders_status_idx ON public.orders(status);
CREATE INDEX orders_shop_idx ON public.orders(shop_id);
CREATE INDEX orders_driver_idx ON public.orders(driver_id);

CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Timestamps on status change
CREATE OR REPLACE FUNCTION public.stamp_order_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'accepted' AND NEW.accepted_at IS NULL THEN NEW.accepted_at = now(); END IF;
    IF NEW.status = 'reached_shop' AND NEW.reached_shop_at IS NULL THEN NEW.reached_shop_at = now(); END IF;
    IF NEW.status = 'payment_received' AND NEW.payment_received_at IS NULL THEN NEW.payment_received_at = now(); END IF;
    IF NEW.status = 'out_for_delivery' AND NEW.out_for_delivery_at IS NULL THEN NEW.out_for_delivery_at = now(); END IF;
    IF NEW.status = 'delivered' AND NEW.delivered_at IS NULL THEN NEW.delivered_at = now(); END IF;
    IF NEW.status = 'cancelled' AND NEW.cancelled_at IS NULL THEN NEW.cancelled_at = now(); END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_orders_stamp BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.stamp_order_status();

-- =========================================================
-- Distance helper (Haversine, km)
-- =========================================================
CREATE OR REPLACE FUNCTION public.haversine_km(lat1 DOUBLE PRECISION, lon1 DOUBLE PRECISION, lat2 DOUBLE PRECISION, lon2 DOUBLE PRECISION)
RETURNS DOUBLE PRECISION LANGUAGE SQL IMMUTABLE AS $$
  SELECT 2 * 6371 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians(lon2 - lon1) / 2), 2)
  ));
$$;

-- Nearby-orders RPC: only pending, within 3km, within driver cash cap
CREATE OR REPLACE FUNCTION public.nearby_orders(driver_lat DOUBLE PRECISION, driver_lng DOUBLE PRECISION)
RETURNS TABLE (
  id UUID,
  shop_id UUID,
  shop_name TEXT,
  pickup_address TEXT,
  order_amount NUMERIC,
  delivery_charge NUMERIC,
  total_amount NUMERIC,
  pickup_lat DOUBLE PRECISION,
  pickup_lng DOUBLE PRECISION,
  distance_km DOUBLE PRECISION,
  created_at TIMESTAMPTZ
)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
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
$$;
GRANT EXECUTE ON FUNCTION public.nearby_orders(DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

-- =========================================================
-- NOTIFICATIONS
-- =========================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User reads own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "User updates own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated can create notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);

-- =========================================================
-- RATINGS
-- =========================================================
CREATE TABLE public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ratee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  review TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, rater_id)
);
GRANT SELECT, INSERT ON public.ratings TO authenticated;
GRANT ALL ON public.ratings TO service_role;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties read ratings" ON public.ratings
  FOR SELECT TO authenticated USING (auth.uid() IN (rater_id, ratee_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Rater creates rating" ON public.ratings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = rater_id);

-- =========================================================
-- COMPLAINTS
-- =========================================================
CREATE TYPE public.complaint_status AS ENUM ('open','resolved','closed');

CREATE TABLE public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status public.complaint_status NOT NULL DEFAULT 'open',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.complaints TO authenticated;
GRANT ALL ON public.complaints TO service_role;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User reads own complaints" ON public.complaints
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "User creates complaint" ON public.complaints
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin updates complaints" ON public.complaints
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_complaints_updated BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- ADMIN LOGS
-- =========================================================
CREATE TABLE public.admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_logs TO authenticated;
GRANT ALL ON public.admin_logs TO service_role;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin reads logs" ON public.admin_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin writes logs" ON public.admin_logs
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') AND admin_id = auth.uid());

-- =========================================================
-- RATING AGGREGATES (auto-update)
-- =========================================================
CREATE OR REPLACE FUNCTION public.refresh_rating_aggregates()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  is_driver BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.drivers WHERE id = NEW.ratee_id) INTO is_driver;
  IF is_driver THEN
    UPDATE public.drivers
      SET rating_avg = (SELECT ROUND(AVG(stars)::numeric, 2) FROM public.ratings WHERE ratee_id = NEW.ratee_id),
          rating_count = (SELECT COUNT(*) FROM public.ratings WHERE ratee_id = NEW.ratee_id)
      WHERE id = NEW.ratee_id;
  ELSE
    UPDATE public.shopkeepers
      SET rating_avg = (SELECT ROUND(AVG(stars)::numeric, 2) FROM public.ratings WHERE ratee_id = NEW.ratee_id),
          rating_count = (SELECT COUNT(*) FROM public.ratings WHERE ratee_id = NEW.ratee_id)
      WHERE id = NEW.ratee_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_ratings_agg AFTER INSERT ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.refresh_rating_aggregates();

-- =========================================================
-- REALTIME
-- =========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
