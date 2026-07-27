ALTER TABLE public.delivery_zones
  ADD COLUMN IF NOT EXISTS shape_type text NOT NULL DEFAULT 'circle' CHECK (shape_type IN ('circle', 'polygon')),
  ADD COLUMN IF NOT EXISTS polygon_points jsonb;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_lat double precision,
  ADD COLUMN IF NOT EXISTS delivery_lng double precision;

CREATE OR REPLACE FUNCTION public.point_in_delivery_polygon(_lat double precision, _lng double precision, _points jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE i integer; j integer; n integer; inside boolean := false; xi double precision; yi double precision; xj double precision; yj double precision;
BEGIN
  n := jsonb_array_length(COALESCE(_points, '[]'::jsonb));
  IF n < 3 THEN RETURN false; END IF;
  j := n - 1;
  FOR i IN 0..n - 1 LOOP
    xi := (_points->i->>'lat')::double precision; yi := (_points->i->>'lng')::double precision;
    xj := (_points->j->>'lat')::double precision; yj := (_points->j->>'lng')::double precision;
    IF ((yi > _lng) <> (yj > _lng)) AND (_lat < (xj - xi) * (_lng - yi) / NULLIF(yj - yi, 0) + xi) THEN inside := NOT inside; END IF;
    j := i;
  END LOOP;
  RETURN inside;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_delivery_zone()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE z public.delivery_zones%ROWTYPE; active_zones boolean; base_total bigint;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.delivery_zones WHERE tenant_id = NEW.tenant_id AND is_active) INTO active_zones;
  IF NOT active_zones THEN RETURN NEW; END IF;
  IF NEW.delivery_lat IS NULL OR NEW.delivery_lng IS NULL THEN RAISE EXCEPTION 'حدد موقع التوصيل عبر GPS أولاً'; END IF;
  SELECT * INTO z FROM public.delivery_zones dz
  WHERE dz.tenant_id = NEW.tenant_id AND dz.is_active AND (dz.branch_id IS NULL OR dz.branch_id = NEW.branch_id)
    AND (
      (
        dz.shape_type = 'circle'
        AND dz.center_lat IS NOT NULL
        AND dz.center_lng IS NOT NULL
        AND dz.radius_km IS NOT NULL
        AND 6371 * acos(least(1.0, greatest(-1.0,
          cos(radians(NEW.delivery_lat)) * cos(radians(dz.center_lat)) * cos(radians(dz.center_lng) - radians(NEW.delivery_lng))
          + sin(radians(NEW.delivery_lat)) * sin(radians(dz.center_lat))
        ))) <= dz.radius_km
      )
      OR (
        dz.shape_type = 'polygon'
        AND public.point_in_delivery_polygon(NEW.delivery_lat, NEW.delivery_lng, dz.polygon_points)
      )
    )
  ORDER BY dz.sort_order, dz.created_at LIMIT 1;
  IF z.id IS NULL THEN RAISE EXCEPTION 'عنوانك خارج مناطق التوصيل المتاحة لهذا المطعم'; END IF;
  base_total := GREATEST(0, COALESCE(NEW.total_iqd, 0) - COALESCE(NEW.delivery_fee_iqd, 0));
  NEW.zone_id := z.id; NEW.delivery_fee_iqd := z.fee_iqd; NEW.total_iqd := base_total + z.fee_iqd;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_delivery_zone ON public.orders;
CREATE TRIGGER trg_assign_delivery_zone BEFORE INSERT OR UPDATE OF delivery_lat, delivery_lng, branch_id ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.assign_delivery_zone();
