-- Projects & state machine
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  industry TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'brief_created',
  -- brief_created | visual_harvested | identity_ready | space_3d_ready | campaign_ready | outreach_active
  brief_json TEXT NOT NULL,
  brand_spec_markdown TEXT NOT NULL DEFAULT '',
  style_tokens_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Pinterest & Behance reference candidates and auto-match scores
CREATE TABLE IF NOT EXISTS reference_pins (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  source TEXT NOT NULL, -- pinterest | behance
  source_url TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  perceptual_hash TEXT NOT NULL,
  intent_domain TEXT NOT NULL, -- brand_vi | packaging | spatial_3d | campaign
  match_score REAL NOT NULL DEFAULT 0,
  is_selected INTEGER NOT NULL DEFAULT 0,
  extracted_tags_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX IF NOT EXISTS idx_reference_pins_project_score
  ON reference_pins(project_id, match_score DESC);

-- Three.js scene & packaging configurations
CREATE TABLE IF NOT EXISTS three_scenes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  scene_type TEXT NOT NULL, -- packaging | spatial | combined
  scene_json TEXT NOT NULL,
  r2_bundle_key TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Auto-distilled rules and living memory
CREATE TABLE IF NOT EXISTS distilled_rules (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  domain TEXT NOT NULL, -- visual | packaging | spatial_3d | campaign | outreach
  rule_key TEXT NOT NULL,
  rule_content TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.8,
  source_event TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Skill execution & auto-trigger audit log
CREATE TABLE IF NOT EXISTS skill_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  trigger_reason TEXT NOT NULL,
  status TEXT NOT NULL, -- queued | running | completed | failed
  input_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Google Maps leads & tailored product outreach
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  place_name TEXT NOT NULL,
  category TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  fit_score REAL NOT NULL DEFAULT 0,
  outreach_status TEXT NOT NULL DEFAULT 'pending_draft',
  -- pending_draft | draft_ready | approved | sent | replied | rejected
  tailored_pitch TEXT,
  last_contacted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX IF NOT EXISTS idx_leads_project_status
  ON leads(project_id, outreach_status);
