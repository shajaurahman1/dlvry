
CREATE OR REPLACE FUNCTION public.notify_order_events()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_body text;
BEGIN
  -- New order created -> notify shop
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, title, body, order_id)
    VALUES (NEW.shop_id, 'New order created', COALESCE(NEW.order_description, 'Order') || ' — awaiting a driver', NEW.id);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    CASE NEW.status
      WHEN 'accepted' THEN
        v_title := 'Driver accepted';
        v_body := 'A delivery partner accepted your order';
        INSERT INTO public.notifications (user_id, title, body, order_id)
          VALUES (NEW.shop_id, v_title, v_body, NEW.id);
        IF NEW.driver_id IS NOT NULL THEN
          INSERT INTO public.notifications (user_id, title, body, order_id)
            VALUES (NEW.driver_id, 'Order accepted', 'Head to the shop to pick up', NEW.id);
        END IF;
      WHEN 'reached_shop' THEN
        INSERT INTO public.notifications (user_id, title, body, order_id)
          VALUES (NEW.shop_id, 'Driver reached shop', 'Confirm payment to release customer details', NEW.id);
      WHEN 'payment_received' THEN
        IF NEW.driver_id IS NOT NULL THEN
          INSERT INTO public.notifications (user_id, title, body, order_id)
            VALUES (NEW.driver_id, 'Payment confirmed', 'Customer details unlocked. Start delivery.', NEW.id);
        END IF;
      WHEN 'out_for_delivery' THEN
        INSERT INTO public.notifications (user_id, title, body, order_id)
          VALUES (NEW.shop_id, 'Out for delivery', 'Driver is on the way to the customer', NEW.id);
      WHEN 'delivered' THEN
        INSERT INTO public.notifications (user_id, title, body, order_id)
          VALUES (NEW.shop_id, 'Delivered', 'Order delivered to the customer', NEW.id);
        IF NEW.driver_id IS NOT NULL THEN
          INSERT INTO public.notifications (user_id, title, body, order_id)
            VALUES (NEW.driver_id, 'Delivered', 'Nice work — order marked delivered', NEW.id);
        END IF;
      WHEN 'cancelled' THEN
        INSERT INTO public.notifications (user_id, title, body, order_id)
          VALUES (NEW.shop_id, 'Order cancelled', COALESCE(NEW.cancel_reason, 'Order was cancelled'), NEW.id);
        IF NEW.driver_id IS NOT NULL THEN
          INSERT INTO public.notifications (user_id, title, body, order_id)
            VALUES (NEW.driver_id, 'Order cancelled', COALESCE(NEW.cancel_reason, 'Order was cancelled'), NEW.id);
        END IF;
      ELSE
        NULL;
    END CASE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_order_insert ON public.orders;
CREATE TRIGGER trg_notify_order_insert
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_order_events();

DROP TRIGGER IF EXISTS trg_notify_order_update ON public.orders;
CREATE TRIGGER trg_notify_order_update
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_order_events();

-- Ensure realtime is enabled for notifications so the frontend can subscribe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;
