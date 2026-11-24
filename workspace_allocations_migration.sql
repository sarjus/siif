-- Select the existing SIIF database before running this migration.
CREATE TABLE IF NOT EXISTS workspace_allocation_revision (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  version CHAR(36) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workspace_seat_assignments (
  seat_id VARCHAR(16) NOT NULL PRIMARY KEY,
  company_id CHAR(36) NULL,
  reservation_reason VARCHAR(500) NULL,
  INDEX idx_workspace_company (company_id),
  CONSTRAINT fk_workspace_company FOREIGN KEY (company_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO workspace_allocation_revision (id, version)
VALUES (1, '00000000-0000-0000-0000-000000000000');
