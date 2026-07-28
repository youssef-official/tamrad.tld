-- Fast path for per-restaurant sales and customer statistics.
CREATE INDEX IF NOT EXISTS orders_reporting_tenant_status_branch_created_idx
  ON public.orders (tenant_id, status, branch_id, created_at DESC);

-- Owners receive only customers who completed orders in their own restaurant.
CREATE OR REPLACE FUNCTION public.get_tenant_customer_statistics(
  _tenant_id uuid,
  _branch_id uuid DEFAULT NULL
)
RETURNS TABLE (
  customer_id uuid,
  full_name text,
  phone text,
  last_address text,
  orders_count bigint,
  paid_iqd bigint,
  last_order_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.user_tenant_id(auth.uid()) IS DISTINCT FROM _tenant_id
     AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'غير مصرح بعرض إحصائيات هذا المطعم';
  END IF;

  RETURN QUERY
  SELECT
    o.customer_id,
    COALESCE(NULLIF(p.full_name, ''), 'زبون'),
    COALESCE(
      (array_agg(o.customer_phone ORDER BY o.created_at DESC) FILTER (WHERE o.customer_phone IS NOT NULL))[1],
      p.phone
    ) AS phone,
    (array_agg(o.customer_address ORDER BY o.created_at DESC) FILTER (WHERE o.customer_address IS NOT NULL))[1] AS last_address,
    count(*)::bigint AS orders_count,
    COALESCE(sum(o.total_iqd), 0)::bigint AS paid_iqd,
    max(o.created_at) AS last_order_at
  FROM public.orders o
  LEFT JOIN public.profiles p ON p.id = o.customer_id
  WHERE o.tenant_id = _tenant_id
    AND o.status = 'delivered'
    AND o.customer_id IS NOT NULL
    AND (_branch_id IS NULL OR o.branch_id = _branch_id)
  GROUP BY o.customer_id, p.full_name, p.phone
  ORDER BY max(o.created_at) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_tenant_customer_statistics(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_tenant_customer_statistics(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_tenant_customer_statistics(uuid, uuid) TO authenticated;
