-- ============================================================================
-- SIIF Incubation Application Schema - Complete
-- ============================================================================

-- 1. Main Applications Table
-- ============================================================================
CREATE TABLE applications (
  -- Primary & Metadata
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'submitted',
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- ========== SECTION 1: Business Information ==========
  business_name VARCHAR(255) NOT NULL,
  business_description TEXT,
  
  -- ========== SECTION 2: Lead Entrepreneur Information ==========
  lead_name VARCHAR(255) NOT NULL,
  age INTEGER,
  email VARCHAR(255) NOT NULL,
  mobile_phone VARCHAR(20) NOT NULL,
  residential_phone VARCHAR(20),
  
  -- ========== SECTION 3: SJCET Association ==========
  sjcet_associated VARCHAR(10),
  sjcet_association_type VARCHAR(50),
  
  -- ========== SECTION 4: Address Information ==========
  postal_address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
  
  -- ========== SECTION 5: Educational Background ==========
  qualification VARCHAR(255),
  specialization VARCHAR(255),
  institute VARCHAR(255),
  
  -- ========== SECTION 6: Type of Business (Categories) ==========
  stage_of_startup VARCHAR(100),
  legal_status VARCHAR(150),
  sector_domain TEXT[] DEFAULT '{}',
  nature_of_business VARCHAR(100),
  innovation_category VARCHAR(100),
  
  -- ========== SECTION 7: Entrepreneurial Motivation ==========
  entrepreneurial_motivation TEXT,
  
  -- ========== SECTION 8: Team Information ==========
  team_details TEXT,
  company_description TEXT,
  
  -- ========== SECTION 9: Product & Market Information ==========
  product_novelty TEXT,
  competitors TEXT,
  competitive_advantage TEXT,
  market_size TEXT,
  revenue_model TEXT,
  
  -- ========== SECTION 10: Infrastructure Requirements ==========
  machinery_required VARCHAR(10),
  machinery_details TEXT,
  
  -- ========== SECTION 11: Market Survey & Research ==========
  market_survey VARCHAR(10),
  market_survey_details TEXT,
  research_validation TEXT,
  
  -- ========== SECTION 12: Financial Projections ==========
  project_cost DECIMAL(15, 2),
  pre_operative_expenses DECIMAL(15, 2),
  prototype_expenses DECIMAL(15, 2),
  test_marketing DECIMAL(15, 2),
  equipment DECIMAL(15, 2),
  working_capital DECIMAL(15, 2),
  other_requirements DECIMAL(15, 2),
  
  -- ========== SECTION 13: Services Required ==========
  laboratory_access BOOLEAN DEFAULT FALSE,
  library_access BOOLEAN DEFAULT FALSE,
  technical_consulting BOOLEAN DEFAULT FALSE,
  services_expected TEXT[] DEFAULT '{}',
  other_services TEXT,
  
  -- ========== SECTION 14: Declaration & Submission ==========
  declaration BOOLEAN DEFAULT FALSE,
  declaration_date DATE,
  declaration_place VARCHAR(255),
  
  -- ========== ADMIN FIELDS ==========
  status VARCHAR(50) DEFAULT 'submitted',
  admin_notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Application References Table
-- ============================================================================
CREATE TABLE application_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  reference_number INTEGER,
  name VARCHAR(255),
  organization VARCHAR(255),
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Indexes for Performance
-- ============================================================================
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_created_at ON applications(created_at DESC);
CREATE INDEX idx_applications_email ON applications(email);
CREATE INDEX idx_applications_sjcet_associated ON applications(sjcet_associated);
CREATE INDEX idx_application_references_application_id ON application_references(application_id);

-- 4. Enable Row Level Security
-- ============================================================================
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_references ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for Applications Table
-- ============================================================================
CREATE POLICY "Allow insert on applications" ON applications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow read on applications" ON applications
  FOR SELECT USING (true);

CREATE POLICY "Allow update on applications" ON applications
  FOR UPDATE USING (true) WITH CHECK (true);

-- 6. RLS Policies for Application References Table
-- ============================================================================
CREATE POLICY "Allow insert on application_references" ON application_references
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow read on application_references" ON application_references
  FOR SELECT USING (true);

CREATE POLICY "Allow update on application_references" ON application_references
  FOR UPDATE USING (true) WITH CHECK (true);

-- ============================================================================
-- REVIEWER & ASSIGNMENT TABLES
-- Run these additions after the initial schema above
-- ============================================================================

-- 7. Reviewers Table
-- ============================================================================
CREATE TABLE reviewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Application Assignments Table
-- ============================================================================
CREATE TABLE application_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES reviewers(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id),
  review_status VARCHAR(50) DEFAULT 'pending',  -- pending | in_progress | completed
  review_comments TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(application_id, reviewer_id)
);

-- 9. Indexes for Reviewer Tables
-- ============================================================================
CREATE INDEX idx_reviewers_user_id ON reviewers(user_id);
CREATE INDEX idx_reviewers_email ON reviewers(email);
CREATE INDEX idx_assignments_application_id ON application_assignments(application_id);
CREATE INDEX idx_assignments_reviewer_id ON application_assignments(reviewer_id);
CREATE INDEX idx_assignments_review_status ON application_assignments(review_status);

-- 10. RLS for Reviewer Tables
-- ============================================================================
ALTER TABLE reviewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on reviewers" ON reviewers
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on application_assignments" ON application_assignments
  FOR ALL USING (true) WITH CHECK (true);