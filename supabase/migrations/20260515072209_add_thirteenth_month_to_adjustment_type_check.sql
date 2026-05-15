/*
  # Add thirteenth_month to payroll_adjustments check constraint

  Adds 'thirteenth_month' to the allowed adjustment_type values to match
  the AdjustmentType enum in the application code.
*/

ALTER TABLE payroll_adjustments
  DROP CONSTRAINT payroll_adjustments_adjustment_type_check;

ALTER TABLE payroll_adjustments
  ADD CONSTRAINT payroll_adjustments_adjustment_type_check
  CHECK (adjustment_type = ANY (ARRAY[
    'bonus',
    'commission',
    'allowance',
    'sss_loan',
    'pagibig_loan',
    'cash_advance',
    'other_deduction',
    'other_addition',
    'thirteenth_month'
  ]));
