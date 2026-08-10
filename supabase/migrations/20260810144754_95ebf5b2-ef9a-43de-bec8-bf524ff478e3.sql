-- 1) enum extensions (must be committed before use)
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'searching';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'going_to_shop';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'arrived_at_shop';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'picked_up';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'going_to_customer';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'arrived_at_customer';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'expired';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'no_driver_found';

DO $$ BEGIN
  CREATE TYPE public.verification_status AS ENUM ('pending','verified','active','rejected','resubmit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) orders columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_lat double precision,
  ADD COLUMN IF NOT EXISTS customer_lng double precision,
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS delivery_otp text,
  ADD COLUMN IF NOT EXISTS otp_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS picked_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS radius_km numeric NOT NULL DEFAULT 3;

-- 3) drivers columns
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_busy boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_status public.verification_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verification_notes text,
  ADD COLUMN IF NOT EXISTS profile_photo_url text,
  ADD COLUMN IF NOT EXISTS licence_url text,
  ADD COLUMN IF NOT EXISTS rc_url text,
  ADD COLUMN IF NOT EXISTS insurance_url text,
  ADD COLUMN IF NOT EXISTS puc_url text,
  ADD COLUMN IF NOT EXISTS gov_id_number text,
  ADD COLUMN IF NOT EXISTS payout_upi text,
  ADD COLUMN IF NOT EXISTS bank_details text;

-- 4) shopkeepers columns
ALTER TABLE public.shopkeepers
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS shop_phone text,
  ADD COLUMN IF NOT EXISTS pan_number text,
  ADD COLUMN IF NOT EXISTS licence_number text,
  ADD COLUMN IF NOT EXISTS verification_status public.verification_status NOT NULL DEFAULT 'pending';

-- 5) status history
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status public.order_status NOT NULL,
  changed_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.order_status_history TO authenticated;
GRANT ALL ON public.order_status_history TO service_role;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Order parties read history" ON public.order_status_history
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.shop_id = auth.uid() OR o.driver_id = auth.uid()))
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "Order parties write history" ON public.order_status_history
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.shop_id = auth.uid() OR o.driver_id = auth.uid()))
    OR public.has_role(auth.uid(), 'admin')
  );

-- 6) platform settings
CREATE TABLE IF NOT EXISTS public.app_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  delivery_radius_km numeric NOT NULL DEFAULT 3,
  request_expiry_minutes integer NOT NULL DEFAULT 10,
  support_number text,
  notifications_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in reads settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins update settings" ON public.app_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert settings" ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.app_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
CREATE TRIGGER trg_app_settings_updated BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_drivers_online ON public.drivers(is_online, is_busy);