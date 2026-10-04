CREATE TABLE public.account_preferences (
 user_id uuid PRIMARY KEY,
 active_role public.app_role NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.account_preferences TO authenticated;
GRANT ALL ON public.account_preferences TO service_role;
ALTER TABLE public.account_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own dashboard preference" ON public.account_preferences FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Set own basic dashboard preference" ON public.account_preferences FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND active_role IN ('shopkeeper','driver') AND public.has_role(auth.uid(), active_role));
CREATE POLICY "Update own basic dashboard preference" ON public.account_preferences FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND active_role IN ('shopkeeper','driver') AND public.has_role(auth.uid(), active_role));
CREATE TRIGGER account_preferences_updated BEFORE UPDATE ON public.account_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE FUNCTION public.validate_delivery_fee() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.delivery_charge IS NULL OR NEW.delivery_charge <= 10 OR NEW.delivery_charge = 'NaN'::numeric OR NEW.delivery_charge = 'Infinity'::numeric THEN
  RAISE EXCEPTION 'Delivery charge must be greater than ₹10';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_delivery_fee() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER validate_new_delivery_fee BEFORE INSERT OR UPDATE OF delivery_charge ON public.orders FOR EACH ROW EXECUTE FUNCTION public.validate_delivery_fee();