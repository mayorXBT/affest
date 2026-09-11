CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  vault_address text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolios(id),
  onchain_strategy_id numeric,
  natural_language_instruction text NOT NULL,
  deterministic_policy_json jsonb NOT NULL,
  execution_mode text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  name text NOT NULL,
  credential_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS trigger_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id uuid NOT NULL REFERENCES strategies(id),
  source_chain text NOT NULL,
  source_transaction_hash text NOT NULL,
  log_index integer NOT NULL,
  status text NOT NULL,
  status_payload jsonb NOT NULL,
  attestation_status text NOT NULL,
  proof_reference text,
  proof_json jsonb,
  detected_at timestamptz NOT NULL,
  verified_at timestamptz,
  UNIQUE (source_chain, source_transaction_hash, log_index)
);

CREATE TABLE IF NOT EXISTS proposed_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id uuid NOT NULL REFERENCES strategies(id),
  trigger_event_id uuid NOT NULL REFERENCES trigger_events(id),
  action_json jsonb NOT NULL,
  simulation_json jsonb,
  status text NOT NULL,
  requires_approval boolean NOT NULL,
  expires_at timestamptz
);

CREATE TABLE IF NOT EXISTS executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposed_action_id uuid NOT NULL REFERENCES proposed_actions(id),
  creditcoin_transaction_hash text,
  initiated_by text NOT NULL,
  mcp_client_name text,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS worker_cursors (
  name text PRIMARY KEY,
  block_number numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
