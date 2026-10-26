-- AICTE OneView PostgreSQL schema
-- Run this only after creating the aicte_oneview database and connecting to it.
-- Backend ORM uses these same table/column definitions.

CREATE TABLE IF NOT EXISTS institutions (
    id VARCHAR(40) PRIMARY KEY,
    name VARCHAR(250) NOT NULL,
    institution_type VARCHAR(100),
    address TEXT,
    state VARCHAR(100),
    region VARCHAR(100),
    status VARCHAR(40) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_institutions_name ON institutions(name);
CREATE INDEX IF NOT EXISTS ix_institutions_state ON institutions(state);
CREATE INDEX IF NOT EXISTS ix_institutions_region ON institutions(region);

CREATE TABLE IF NOT EXISTS officers (
    id VARCHAR(40) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    designation VARCHAR(150),
    bureau VARCHAR(30) NOT NULL,
    email VARCHAR(250),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_officers_name ON officers(name);
CREATE INDEX IF NOT EXISTS ix_officers_bureau ON officers(bureau);

CREATE TABLE IF NOT EXISTS complaints (
    id VARCHAR(40) PRIMARY KEY,
    institution_id VARCHAR(40) NOT NULL REFERENCES institutions(id),
    subject VARCHAR(300) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(120) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Received',
    source VARCHAR(100),
    assigned_bureau VARCHAR(30),
    assigned_officer_id VARCHAR(40) REFERENCES officers(id),
    received_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expected_disposal_date DATE,
    review_status VARCHAR(50) NOT NULL DEFAULT 'Not reviewed'
);
CREATE INDEX IF NOT EXISTS ix_complaints_institution_id ON complaints(institution_id);
CREATE INDEX IF NOT EXISTS ix_complaints_subject ON complaints(subject);
CREATE INDEX IF NOT EXISTS ix_complaints_category ON complaints(category);
CREATE INDEX IF NOT EXISTS ix_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS ix_complaints_assigned_bureau ON complaints(assigned_bureau);

CREATE TABLE IF NOT EXISTS cases (
    id VARCHAR(40) PRIMARY KEY,
    institution_id VARCHAR(40) NOT NULL REFERENCES institutions(id),
    title VARCHAR(300) NOT NULL,
    bureau VARCHAR(30) NOT NULL,
    officer_id VARCHAR(40) REFERENCES officers(id),
    status VARCHAR(50) NOT NULL DEFAULT 'Open',
    priority VARCHAR(30) NOT NULL DEFAULT 'Normal',
    opened_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expected_disposal_date DATE,
    next_action TEXT
);
CREATE INDEX IF NOT EXISTS ix_cases_institution_id ON cases(institution_id);
CREATE INDEX IF NOT EXISTS ix_cases_bureau ON cases(bureau);
CREATE INDEX IF NOT EXISTS ix_cases_status ON cases(status);

CREATE TABLE IF NOT EXISTS case_complaints (
    case_id VARCHAR(40) NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    complaint_id VARCHAR(40) NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    PRIMARY KEY (case_id, complaint_id)
);

CREATE TABLE IF NOT EXISTS case_actions (
    id VARCHAR(40) PRIMARY KEY,
    case_id VARCHAR(40) NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL,
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    remarks TEXT,
    officer_name VARCHAR(200),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_case_actions_case_id ON case_actions(case_id);
CREATE INDEX IF NOT EXISTS ix_case_actions_created_at ON case_actions(created_at);

CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(40) PRIMARY KEY,
    title VARCHAR(250) NOT NULL,
    message TEXT NOT NULL,
    related_case_id VARCHAR(40) REFERENCES cases(id),
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Authentication and security audit tables (passwords are stored as salted hashes, never plaintext).
CREATE TABLE IF NOT EXISTS auth_users (
    id VARCHAR(40) PRIMARY KEY,
    username VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(300) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    role VARCHAR(40) NOT NULL DEFAULT 'viewer',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_auth_users_username ON auth_users(username);
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(40) PRIMARY KEY,
    actor_user_id VARCHAR(40),
    actor_username VARCHAR(120) NOT NULL DEFAULT 'anonymous',
    action VARCHAR(20) NOT NULL,
    resource VARCHAR(300) NOT NULL,
    status_code INTEGER NOT NULL,
    ip_address VARCHAR(80),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS ix_audit_logs_actor_user_id ON audit_logs(actor_user_id);


-- Human-reviewed overlap decisions and issue grouping. These tables never merge/delete complaints.
CREATE TABLE IF NOT EXISTS issue_groups (
    id VARCHAR(40) PRIMARY KEY,
    classification VARCHAR(40) NOT NULL DEFAULT 'Confirmed Related',
    primary_complaint_id VARCHAR(40) NOT NULL REFERENCES complaints(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_issue_groups_primary_complaint_id ON issue_groups(primary_complaint_id);
CREATE TABLE IF NOT EXISTS issue_group_complaints (
    issue_group_id VARCHAR(40) NOT NULL REFERENCES issue_groups(id) ON DELETE CASCADE,
    complaint_id VARCHAR(40) NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    linked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (issue_group_id, complaint_id)
);
CREATE TABLE IF NOT EXISTS overlap_review_records (
    id VARCHAR(40) PRIMARY KEY,
    complaint_id VARCHAR(40) NOT NULL REFERENCES complaints(id),
    related_complaint_id VARCHAR(40) NOT NULL REFERENCES complaints(id),
    decision VARCHAR(40) NOT NULL,
    remarks TEXT,
    issue_group_id VARCHAR(40) REFERENCES issue_groups(id),
    reviewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_overlap_review_records_decision ON overlap_review_records(decision);
CREATE INDEX IF NOT EXISTS ix_overlap_review_records_reviewed_at ON overlap_review_records(reviewed_at);
