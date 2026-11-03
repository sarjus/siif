-- Fresh MySQL 8.0.16+ schema for SIIF application data.
-- Select the configured database before running this file.
-- Application accounts and sessions are stored in MySQL; uploaded photos are stored on disk.
-- This creates a fresh database; it cannot recover unavailable legacy rows.

CREATE TABLE IF NOT EXISTS auth_users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(320) NOT NULL,
  role VARCHAR(20) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  metadata JSON NULL,
  must_reset_password BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_auth_users_email (email),
  CONSTRAINT chk_auth_user_role CHECK (role IN ('admin', 'company', 'reviewer'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_sessions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_auth_session_token_hash (token_hash),
  INDEX idx_auth_sessions_user (user_id),
  INDEX idx_auth_sessions_expiry (expires_at),
  CONSTRAINT fk_auth_session_user FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_resets (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_password_reset_token_hash (token_hash),
  INDEX idx_password_resets_user (user_id),
  CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS applications (
  id CHAR(36) NOT NULL PRIMARY KEY,
  business_name VARCHAR(255) NULL,
  lead_name VARCHAR(255) NULL,
  sjcet_associated VARCHAR(100) NULL,
  sjcet_association_type VARCHAR(255) NULL,
  age SMALLINT UNSIGNED NULL,
  residential_phone VARCHAR(50) NULL,
  mobile_phone VARCHAR(50) NULL,
  email VARCHAR(320) NULL,
  postal_address TEXT NULL,
  city VARCHAR(150) NULL,
  state VARCHAR(150) NULL,
  postal_code VARCHAR(30) NULL,
  country VARCHAR(100) NULL,
  qualification TEXT NULL,
  specialization TEXT NULL,
  institute VARCHAR(255) NULL,
  stage_of_startup VARCHAR(100) NULL,
  legal_status VARCHAR(100) NULL,
  sector_domain JSON NULL,
  nature_of_business TEXT NULL,
  innovation_category VARCHAR(255) NULL,
  business_description TEXT NULL,
  entrepreneurial_motivation TEXT NULL,
  team_details TEXT NULL,
  company_description TEXT NULL,
  product_novelty TEXT NULL,
  competitors TEXT NULL,
  competitive_advantage TEXT NULL,
  market_size TEXT NULL,
  revenue_model TEXT NULL,
  machinery_required VARCHAR(100) NULL,
  machinery_details TEXT NULL,
  market_survey VARCHAR(100) NULL,
  market_survey_details TEXT NULL,
  research_validation TEXT NULL,
  project_cost DECIMAL(14,2) NULL,
  pre_operative_expenses DECIMAL(14,2) NULL,
  prototype_expenses DECIMAL(14,2) NULL,
  test_marketing DECIMAL(14,2) NULL,
  equipment DECIMAL(14,2) NULL,
  working_capital DECIMAL(14,2) NULL,
  other_requirements DECIMAL(14,2) NULL,
  laboratory_access BOOLEAN NOT NULL DEFAULT FALSE,
  library_access BOOLEAN NOT NULL DEFAULT FALSE,
  technical_consulting BOOLEAN NOT NULL DEFAULT FALSE,
  services_expected JSON NULL,
  other_services TEXT NULL,
  declaration BOOLEAN NOT NULL DEFAULT FALSE,
  declaration_date DATE NULL,
  declaration_place VARCHAR(255) NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'submitted',
  admin_notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_applications_status (status),
  INDEX idx_applications_email (email),
  INDEX idx_applications_submitted (submitted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS team_members (
  id CHAR(36) NOT NULL PRIMARY KEY,
  application_id CHAR(36) NOT NULL,
  member_number TINYINT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(320) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_team_member_number (application_id, member_number),
  CONSTRAINT fk_team_application FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS application_references (
  id CHAR(36) NOT NULL PRIMARY KEY,
  application_id CHAR(36) NOT NULL,
  reference_number TINYINT UNSIGNED NOT NULL,
  name VARCHAR(255) NULL,
  organization VARCHAR(255) NULL,
  address TEXT NULL,
  phone VARCHAR(50) NULL,
  email VARCHAR(320) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_application_reference (application_id, reference_number),
  CONSTRAINT fk_reference_application FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS requested_services (
  id CHAR(36) NOT NULL PRIMARY KEY,
  application_id CHAR(36) NOT NULL,
  service_name VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_requested_service_application FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS application_status_history (
  id CHAR(36) NOT NULL PRIMARY KEY,
  application_id CHAR(36) NOT NULL,
  old_status VARCHAR(40) NULL,
  new_status VARCHAR(40) NOT NULL,
  notes TEXT NULL,
  changed_by VARCHAR(320) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status_history_application (application_id, created_at),
  CONSTRAINT fk_status_history_application FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reviewers (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(320) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reviewer_user (user_id),
  UNIQUE KEY uq_reviewer_email (email),
  CONSTRAINT fk_reviewer_user FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS application_assignments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  application_id CHAR(36) NOT NULL,
  reviewer_id CHAR(36) NOT NULL,
  review_status VARCHAR(40) NOT NULL DEFAULT 'pending',
  review_comments LONGTEXT NULL,
  reviewed_at DATETIME NULL,
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_application_reviewer (application_id, reviewer_id),
  INDEX idx_assignments_reviewer (reviewer_id, assigned_at),
  CONSTRAINT fk_assignment_application FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  CONSTRAINT fk_assignment_reviewer FOREIGN KEY (reviewer_id) REFERENCES reviewers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS incubation_fee_settings (
  id CHAR(36) NOT NULL PRIMARY KEY,
  company_id CHAR(36) NOT NULL,
  monthly_fee DECIMAL(12,2) NOT NULL,
  refundable_deposit DECIMAL(12,2) NOT NULL DEFAULT 0,
  deposit_collection_date DATE NULL,
  deposit_status VARCHAR(40) NOT NULL DEFAULT 'pending',
  start_date DATE NOT NULL,
  due_day TINYINT UNSIGNED NOT NULL DEFAULT 5,
  grace_period_days INT UNSIGNED NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_fee_settings_company (company_id),
  INDEX idx_fee_settings_status (status),
  CONSTRAINT fk_fee_settings_application FOREIGN KEY (company_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS incubation_fee_invoices (
  id CHAR(36) NOT NULL PRIMARY KEY,
  company_id CHAR(36) NOT NULL,
  invoice_number VARCHAR(80) NOT NULL,
  billing_month DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  remarks TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_invoice_number (invoice_number),
  UNIQUE KEY uq_invoice_company_month (company_id, billing_month),
  INDEX idx_invoice_company (company_id),
  INDEX idx_invoice_due_status (status, due_date),
  CONSTRAINT fk_invoice_application FOREIGN KEY (company_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS company_deposits (
  id CHAR(36) NOT NULL PRIMARY KEY,
  company_id CHAR(36) NOT NULL,
  deposit_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  amount_collected DECIMAL(12,2) NOT NULL DEFAULT 0,
  amount_refunded DECIMAL(12,2) NOT NULL DEFAULT 0,
  balance_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  collection_date DATE NULL,
  refund_date DATE NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  remarks TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_deposit_company (company_id),
  CONSTRAINT fk_deposit_application FOREIGN KEY (company_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fee_collections (
  id CHAR(36) NOT NULL PRIMARY KEY,
  receipt_number VARCHAR(80) NULL,
  company_id CHAR(36) NOT NULL,
  collection_type VARCHAR(40) NOT NULL,
  invoice_id CHAR(36) NULL,
  deposit_id CHAR(36) NULL,
  collection_date DATE NOT NULL,
  amount_collected DECIMAL(12,2) NOT NULL,
  payment_mode VARCHAR(40) NOT NULL,
  transaction_reference VARCHAR(255) NULL,
  collected_by VARCHAR(320) NULL,
  remarks TEXT NULL,
  attachment_url TEXT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'recorded',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_receipt_number (receipt_number),
  INDEX idx_collections_company (company_id),
  INDEX idx_collections_type_date (collection_type, collection_date),
  INDEX idx_collections_invoice (invoice_id),
  INDEX idx_collections_deposit (deposit_id),
  CONSTRAINT fk_collection_application FOREIGN KEY (company_id) REFERENCES applications(id) ON DELETE CASCADE,
  CONSTRAINT fk_collection_invoice FOREIGN KEY (invoice_id) REFERENCES incubation_fee_invoices(id) ON DELETE SET NULL,
  CONSTRAINT fk_collection_deposit FOREIGN KEY (deposit_id) REFERENCES company_deposits(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(36) NOT NULL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  recipient_type VARCHAR(40) NOT NULL,
  company_id CHAR(36) NULL,
  sent_by VARCHAR(320) NULL,
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_company_date (company_id, sent_at),
  CONSTRAINT fk_notification_application FOREIGN KEY (company_id) REFERENCES applications(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fee_revision_history (
  id CHAR(36) NOT NULL PRIMARY KEY,
  company_id CHAR(36) NOT NULL,
  old_fee DECIMAL(12,2) NOT NULL,
  new_fee DECIMAL(12,2) NOT NULL,
  effective_from DATE NOT NULL,
  changed_by VARCHAR(320) NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_fee_revision_company_month (company_id, effective_from),
  CONSTRAINT fk_fee_revision_application FOREIGN KEY (company_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conference_bookings (
  id CHAR(36) NOT NULL PRIMARY KEY,
  company_id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  rejection_reason TEXT NULL,
  requested_by VARCHAR(320) NULL,
  reviewed_by VARCHAR(320) NULL,
  reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_conference_time (start_time, end_time),
  INDEX idx_conference_status (status),
  INDEX idx_conference_company (company_id),
  CONSTRAINT chk_booking_times CHECK (end_time > start_time),
  CONSTRAINT fk_booking_application FOREIGN KEY (company_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS incubatees (
  id CHAR(36) NOT NULL PRIMARY KEY,
  company_id CHAR(36) NOT NULL,
  incubatee_id VARCHAR(40) NULL,
  full_name VARCHAR(255) NOT NULL,
  designation VARCHAR(255) NOT NULL,
  email VARCHAR(320) NULL,
  mobile VARCHAR(50) NULL,
  gender VARCHAR(20) NULL,
  date_of_birth DATE NULL,
  address TEXT NULL,
  id_type VARCHAR(40) NULL,
  id_number VARCHAR(100) NULL,
  photo_url TEXT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  rejection_reason TEXT NULL,
  submitted_by VARCHAR(320) NULL,
  reviewed_by VARCHAR(320) NULL,
  reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_incubatee_display_id (incubatee_id),
  INDEX idx_incubatee_company (company_id),
  INDEX idx_incubatee_status (status),
  CONSTRAINT fk_incubatee_application FOREIGN KEY (company_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ledger_categories (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO ledger_categories (id, name) VALUES
  (UUID(), 'Opening Balance'),
  (UUID(), 'Fee Income'),
  (UUID(), 'Refundable Deposit'),
  (UUID(), 'Staff Salary'),
  (UUID(), 'CEO Honorarium'),
  (UUID(), 'Utilities'),
  (UUID(), 'Maintenance'),
  (UUID(), 'Office Supplies'),
  (UUID(), 'Event Expenses'),
  (UUID(), 'Miscellaneous Income'),
  (UUID(), 'Miscellaneous Expense'),
  (UUID(), 'Other');

CREATE TABLE IF NOT EXISTS siif_ledger (
  id CHAR(36) NOT NULL PRIMARY KEY,
  entry_date DATE NOT NULL,
  particulars TEXT NOT NULL,
  debit DECIMAL(12,2) NOT NULL DEFAULT 0,
  credit DECIMAL(12,2) NOT NULL DEFAULT 0,
  category VARCHAR(255) NULL,
  reference VARCHAR(255) NULL,
  entered_by VARCHAR(320) NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ledger_date (entry_date),
  CONSTRAINT chk_ledger_debit_nonnegative CHECK (debit >= 0),
  CONSTRAINT chk_ledger_credit_nonnegative CHECK (credit >= 0),
  CONSTRAINT chk_ledger_nonzero CHECK (debit > 0 OR credit > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS siif_staff (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  designation VARCHAR(255) NOT NULL,
  payment_type VARCHAR(30) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  bank_account VARCHAR(100) NULL,
  ifsc VARCHAR(30) NULL,
  email VARCHAR(320) NULL,
  phone VARCHAR(50) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS siif_staff_payments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  payment_number VARCHAR(80) NOT NULL UNIQUE,
  staff_id CHAR(36) NOT NULL,
  payment_type VARCHAR(30) NOT NULL,
  payment_month DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_mode VARCHAR(40) NOT NULL,
  payment_date DATE NOT NULL,
  transaction_reference VARCHAR(255) NULL,
  paid_by VARCHAR(320) NULL,
  remarks TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_staff_payment_staff (staff_id),
  INDEX idx_staff_payment_month (payment_month),
  CONSTRAINT fk_staff_payment_staff FOREIGN KEY (staff_id) REFERENCES siif_staff(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS siif_counters (
  id CHAR(36) NOT NULL PRIMARY KEY,
  series VARCHAR(10) NOT NULL,
  year SMALLINT UNSIGNED NOT NULL,
  last_seq INT UNSIGNED NOT NULL DEFAULT 0,
  UNIQUE KEY uq_counter_series_year (series, year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
