
CREATE OR REPLACE FUNCTION public.award_loyalty_on_delivered()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'delivered' AND OLD.status <> 'delivered' AND NEW.customer_id IS NOT NULL THEN
    INSERT INTO public.loyalty_points (user_id, tenant_id, points)
    VALUES (NEW.customer_id, NEW.tenant_id, GREATEST(1, (NEW.total_iqd / 1000)::int))
    ON CONFLICT (user_id, tenant_id) DO UPDATE SET
      points = public.loyalty_points.points + EXCLUDED.points,
      updated_at = now();
  END IF;
  RETURN NEW;
END; $$;
