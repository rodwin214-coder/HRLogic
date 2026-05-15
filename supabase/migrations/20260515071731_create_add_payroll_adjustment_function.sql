/*
  # Create add_payroll_adjustment RPC function

  Wraps payroll adjustment insert in a SECURITY DEFINER function so it
  bypasses RLS (which relies on set_config session vars that don't persist
  across HTTP requests). The function validates company ownership before
  inserting.
*/

CREATE OR REPLACE FUNCTION add_payroll_adjustment(
    p_company_id    uuid,
    p_period_id     uuid,
    p_employee_id   uuid,
    p_adjustment_type text,
    p_amount        numeric,
    p_description   text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verify the period belongs to the company
    IF NOT EXISTS (
        SELECT 1 FROM payroll_periods
        WHERE id = p_period_id AND company_id = p_company_id
    ) THEN
        RAISE EXCEPTION 'Period not found for company';
    END IF;

    -- Verify the employee belongs to the company
    IF NOT EXISTS (
        SELECT 1 FROM employees
        WHERE id = p_employee_id AND company_id = p_company_id
    ) THEN
        RAISE EXCEPTION 'Employee not found for company';
    END IF;

    INSERT INTO payroll_adjustments (
        company_id,
        period_id,
        employee_id,
        adjustment_type,
        amount,
        description
    ) VALUES (
        p_company_id,
        p_period_id,
        p_employee_id,
        p_adjustment_type,
        p_amount,
        p_description
    );
END;
$$;
