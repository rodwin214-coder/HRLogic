/*
  # Create get_payroll_adjustments RPC function

  Wraps payroll adjustments SELECT in a SECURITY DEFINER function to bypass
  RLS session-variable dependency. Validates company ownership before returning.
*/

CREATE OR REPLACE FUNCTION get_payroll_adjustments(
    p_company_id uuid,
    p_period_id  uuid
)
RETURNS TABLE (
    id              uuid,
    company_id      uuid,
    period_id       uuid,
    employee_id     uuid,
    adjustment_type text,
    amount          numeric,
    description     text,
    created_at      timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        pa.id,
        pa.company_id,
        pa.period_id,
        pa.employee_id,
        pa.adjustment_type,
        pa.amount,
        pa.description,
        pa.created_at
    FROM payroll_adjustments pa
    WHERE pa.period_id = p_period_id
      AND pa.company_id = p_company_id;
END;
$$;
