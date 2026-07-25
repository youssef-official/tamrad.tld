
ALTER TYPE settlement_status ADD VALUE IF NOT EXISTS 'pending_approval';
ALTER TYPE settlement_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE settlement_status ADD VALUE IF NOT EXISTS 'rejected';
