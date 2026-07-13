
-- Backfill missing roles for existing shopkeepers/drivers
INSERT INTO public.user_roles (user_id, role)
SELECT s.id, 'shopkeeper'::app_role FROM public.shopkeepers s
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT d.id, 'driver'::app_role FROM public.drivers d
ON CONFLICT (user_id, role) DO NOTHING;

-- Auto-assign role whenever a shopkeeper/driver row is inserted
CREATE OR REPLACE FUNCTION public.assign_role_from_profile_table()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'shopkeepers' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'shopkeeper')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF TG_TABLE_NAME = 'drivers' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'driver')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shopkeepers_assign_role ON public.shopkeepers;
CREATE TRIGGER shopkeepers_assign_role
  AFTER INSERT ON public.shopkeepers
  FOR EACH ROW EXECUTE FUNCTION public.assign_role_from_profile_table();

DROP TRIGGER IF EXISTS drivers_assign_role ON public.drivers;
CREATE TRIGGER drivers_assign_role
  AFTER INSERT ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.assign_role_from_profile_table();

REVOKE EXECUTE ON FUNCTION public.assign_role_from_profile_table() FROM PUBLIC, anon, authenticated;

-- Let drivers see shops of orders they're linked to (accepted/assigned)
CREATE POLICY "Drivers see linked order shops"
  ON public.shopkeepers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.shop_id = shopkeepers.id AND o.driver_id = auth.uid()
  ));

-- Let shopkeepers see drivers assigned to their orders
CREATE POLICY "Shops see linked order drivers"
  ON public.drivers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.driver_id = drivers.id AND o.shop_id = auth.uid()
  ));

-- Let shopkeepers see profile of their assigned drivers, and vice versa
CREATE POLICY "Order counterparties see profile"
  ON public.profiles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE (o.shop_id = auth.uid() AND o.driver_id = profiles.id)
       OR (o.driver_id = auth.uid() AND o.shop_id = profiles.id)
  ));
