
CREATE OR REPLACE FUNCTION public.reject_if_branch_paused()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_branch_ok boolean; v_tenant_ok boolean;
BEGIN
  SELECT accepting_orders INTO v_tenant_ok FROM public.tenants WHERE id = NEW.tenant_id;
  IF v_tenant_ok = false THEN
    RAISE EXCEPTION 'TENANT_PAUSED' USING HINT = 'المطعم أوقف استقبال الطلبات مؤقتاً.';
  END IF;
  IF NEW.branch_id IS NOT NULL THEN
    SELECT accepting_orders INTO v_branch_ok FROM public.branches WHERE id = NEW.branch_id;
    IF v_branch_ok = false THEN
      RAISE EXCEPTION 'BRANCH_PAUSED' USING HINT = 'هذا الفرع أوقف الاستقبال مؤقتاً.';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
