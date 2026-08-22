-- 1. Security-definer helpers to break the RLS recursion cycle
CREATE OR REPLACE FUNCTION public.is_order_counterparty(_other uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE (o.shop_id = auth.uid() AND o.driver_id = _other)
       OR (o.driver_id = auth.uid() AND o.shop_id = _other)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_shop_of_order_driver(_driver uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.orders o WHERE o.driver_id = _driver AND o.shop_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_driver_of_order_shop(_shop uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.orders o WHERE o.shop_id = _shop AND o.driver_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_active_driver()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.id = auth.uid() AND d.approval_status = 'approved'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_order_counterparty(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_shop_of_order_driver(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_driver_of_order_shop(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_active_driver() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_order_counterparty(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_shop_of_order_driver(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_driver_of_order_shop(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_driver() TO authenticated;

-- 2. Replace the recursive policies
DROP POLICY IF EXISTS "Order counterparties see profile" ON public.profiles;
CREATE POLICY "Order counterparties see profile" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_order_counterparty(profiles.id));

DROP POLICY IF EXISTS "Shops see linked order drivers" ON public.drivers;
CREATE POLICY "Shops see linked order drivers" ON public.drivers
  FOR SELECT TO authenticated USING (public.is_shop_of_order_driver(drivers.id));

DROP POLICY IF EXISTS "Drivers see linked order shops" ON public.shopkeepers;
CREATE POLICY "Drivers see linked order shops" ON public.shopkeepers
  FOR SELECT TO authenticated USING (public.is_driver_of_order_shop(shopkeepers.id));

DROP POLICY IF EXISTS "Approved drivers read pending orders" ON public.orders;
CREATE POLICY "Active drivers read open orders" ON public.orders
  FOR SELECT TO authenticated
  USING (driver_id IS NULL AND status IN ('pending','searching') AND public.is_active_driver());

-- 3. Let a user record their own non-admin role once
CREATE POLICY "Users assign own basic role" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND role IN ('shopkeeper','driver'));
GRANT INSERT ON public.user_roles TO authenticated;

-- 4. Instant activation for delivery partners
ALTER TABLE public.drivers ALTER COLUMN verification_status SET DEFAULT 'verified';
ALTER TABLE public.drivers ALTER COLUMN approval_status SET DEFAULT 'approved';
UPDATE public.drivers SET verification_status = 'verified' WHERE verification_status = 'pending';
UPDATE public.drivers SET approval_status = 'approved' WHERE approval_status = 'pending';
ALTER TABLE public.shopkeepers ALTER COLUMN approval_status SET DEFAULT 'approved';
ALTER TABLE public.shopkeepers ALTER COLUMN verification_status SET DEFAULT 'verified';
UPDATE public.shopkeepers SET approval_status = 'approved' WHERE approval_status = 'pending';

-- 5. Emergency contact is no longer collected
ALTER TABLE public.drivers ALTER COLUMN emergency_contact DROP NOT NULL;