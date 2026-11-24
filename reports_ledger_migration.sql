-- Select the existing SIIF database before running this migration.
-- Creates the ledger table if the import omitted it. Import any historical
-- ledger entries separately from the source backup.
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
