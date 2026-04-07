-- 0002_business_constraints.sql
-- Add data integrity triggers for business rules.
-- SQLite cannot ALTER TABLE ADD CHECK CONSTRAINT, so we use BEFORE triggers
-- that RAISE(ABORT) on violation. Behaviour mirrors a CHECK constraint.

-- Rule 1: contracts.end_date must be >= start_date
CREATE TRIGGER IF NOT EXISTS contracts_dates_check_insert
BEFORE INSERT ON contracts
FOR EACH ROW
WHEN NEW.end_date < NEW.start_date
BEGIN
  SELECT RAISE(ABORT, 'contracts: end_date must be >= start_date');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS contracts_dates_check_update
BEFORE UPDATE ON contracts
FOR EACH ROW
WHEN NEW.end_date < NEW.start_date
BEGIN
  SELECT RAISE(ABORT, 'contracts: end_date must be >= start_date');
END;
--> statement-breakpoint

-- Rule 2: employees.billing_rate must be >= hourly_rate (UNS margin cannot be negative)
-- Both fields nullable; the check only applies when both are present.
CREATE TRIGGER IF NOT EXISTS employees_rate_check_insert
BEFORE INSERT ON employees
FOR EACH ROW
WHEN NEW.billing_rate IS NOT NULL
  AND NEW.hourly_rate IS NOT NULL
  AND NEW.billing_rate < NEW.hourly_rate
BEGIN
  SELECT RAISE(ABORT, 'employees: billing_rate must be >= hourly_rate (UNS margin cannot be negative)');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS employees_rate_check_update
BEFORE UPDATE ON employees
FOR EACH ROW
WHEN NEW.billing_rate IS NOT NULL
  AND NEW.hourly_rate IS NOT NULL
  AND NEW.billing_rate < NEW.hourly_rate
BEGIN
  SELECT RAISE(ABORT, 'employees: billing_rate must be >= hourly_rate (UNS margin cannot be negative)');
END;
