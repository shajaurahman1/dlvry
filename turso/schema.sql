-- MoveBy Turso/libSQL schema, consolidated from 15 PostgreSQL migrations.
-- Schema only: does NOT migrate users/data, auth, RLS, storage, realtime or push.
-- IDs are TEXT UUIDs. Application must generate UUIDs securely.
-- Timestamps are UTC ISO-8601 text. Monetary amounts are NUMERIC for compatibility;
-- server-side code must validate/round money consistently.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS profiles (
 id TEXT PRIMARY KEY, full_name TEXT NOT NULL DEFAULT '', email TEXT,
 phone TEXT, whatsapp TEXT, avatar_url TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS user_roles (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK (role IN ('shopkeeper','driver','admin')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(user_id,role)
);

CREATE TABLE IF NOT EXISTS shopkeepers (
 id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
 shop_name TEXT NOT NULL, shop_category TEXT NOT NULL, address TEXT NOT NULL,
 latitude REAL NOT NULL, longitude REAL NOT NULL,
 gov_id_url TEXT, shop_photo_url TEXT, trade_license_url TEXT, gst_number TEXT,
 approval_status TEXT NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('pending','approved','rejected','suspended','blocked')),
 rating_avg NUMERIC NOT NULL DEFAULT 0, rating_count INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 owner_name TEXT, shop_phone TEXT, pan_number TEXT, licence_number TEXT,
 verification_status TEXT NOT NULL DEFAULT 'verified' CHECK (verification_status IN ('pending','verified','active','rejected','resubmit'))
);

CREATE TABLE IF NOT EXISTS drivers (
 id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
 date_of_birth TEXT, home_address TEXT, gov_id_url TEXT, selfie_url TEXT,
 emergency_contact TEXT,
 vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('walking','cycle','bike','car')),
 vehicle_number TEXT, available_cash NUMERIC NOT NULL DEFAULT 0,
 current_lat REAL, current_lng REAL, location_updated_at TEXT,
 approval_status TEXT NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('pending','approved','rejected','suspended','blocked')),
 is_available INTEGER NOT NULL DEFAULT 1 CHECK(is_available IN (0,1)),
 rating_avg NUMERIC NOT NULL DEFAULT 0, rating_count INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 is_online INTEGER NOT NULL DEFAULT 0 CHECK(is_online IN (0,1)),
 is_busy INTEGER NOT NULL DEFAULT 0 CHECK(is_busy IN (0,1)),
 verification_status TEXT NOT NULL DEFAULT 'verified' CHECK (verification_status IN ('pending','verified','active','rejected','resubmit')),
 verification_notes TEXT, profile_photo_url TEXT, licence_url TEXT, rc_url TEXT,
 insurance_url TEXT, puc_url TEXT, gov_id_number TEXT, payout_upi TEXT,
 bank_details TEXT, search_radius_km NUMERIC NOT NULL DEFAULT 3
);

CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY KEY,
 shop_id TEXT NOT NULL REFERENCES shopkeepers(id) ON DELETE CASCADE,
 driver_id TEXT REFERENCES drivers(id) ON DELETE SET NULL,
 customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL,
 customer_address TEXT NOT NULL, order_description TEXT NOT NULL,
 order_amount NUMERIC NOT NULL, delivery_charge NUMERIC NOT NULL
   CHECK (delivery_charge > 10),
 total_amount NUMERIC GENERATED ALWAYS AS (order_amount + delivery_charge) STORED,
 pickup_notes TEXT, pickup_lat REAL NOT NULL, pickup_lng REAL NOT NULL,
 status TEXT NOT NULL DEFAULT 'searching' CHECK(status IN (
 'pending','accepted','reached_shop','payment_received','out_for_delivery',
 'delivered','cancelled','searching','going_to_shop','arrived_at_shop',
 'picked_up','going_to_customer','arrived_at_customer','expired','no_driver_found')),
 accepted_at TEXT, reached_shop_at TEXT, payment_received_at TEXT,
 out_for_delivery_at TEXT, delivered_at TEXT, cancelled_at TEXT,
 cancel_reason TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 customer_lat REAL, customer_lng REAL, payment_method TEXT NOT NULL DEFAULT 'cash',
 delivery_otp TEXT, otp_verified INTEGER NOT NULL DEFAULT 0 CHECK(otp_verified IN (0,1)),
 expires_at TEXT, picked_up_at TEXT, radius_km NUMERIC NOT NULL DEFAULT 3
);

CREATE TABLE IF NOT EXISTS notifications (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 title TEXT NOT NULL, body TEXT NOT NULL,
 order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
 read INTEGER NOT NULL DEFAULT 0 CHECK(read IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS ratings (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 rater_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 ratee_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 stars INTEGER NOT NULL CHECK(stars BETWEEN 1 AND 5), review TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(order_id,rater_id)
);

CREATE TABLE IF NOT EXISTS complaints (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
 subject TEXT NOT NULL, body TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved','closed')),
 admin_notes TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS admin_logs (
 id TEXT PRIMARY KEY, admin_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 action TEXT NOT NULL, target_type TEXT, target_id TEXT, metadata TEXT CHECK(metadata IS NULL OR json_valid(metadata)),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS order_status_history (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 status TEXT NOT NULL CHECK(status IN (
 'pending','accepted','reached_shop','payment_received','out_for_delivery',
 'delivered','cancelled','searching','going_to_shop','arrived_at_shop',
 'picked_up','going_to_customer','arrived_at_customer','expired','no_driver_found')),
 changed_by TEXT, note TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS app_settings (
 id INTEGER PRIMARY KEY DEFAULT 1 CHECK(id=1),
 delivery_radius_km NUMERIC NOT NULL DEFAULT 3,
 request_expiry_minutes INTEGER NOT NULL DEFAULT 10,
 support_number TEXT,
 notifications_enabled INTEGER NOT NULL DEFAULT 1 CHECK(notifications_enabled IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT OR IGNORE INTO app_settings(id) VALUES (1);

CREATE TABLE IF NOT EXISTS device_tokens (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 token TEXT NOT NULL UNIQUE, platform TEXT NOT NULL DEFAULT 'android',
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS account_preferences (
 user_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
 active_role TEXT NOT NULL CHECK(active_role IN ('shopkeeper','driver','admin')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS orders_shop_idx ON orders(shop_id);
CREATE INDEX IF NOT EXISTS orders_driver_idx ON orders(driver_id);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drivers_online ON drivers(is_online,is_busy);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id,created_at);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);

-- Deliberately NOT ported as database triggers/functions:
-- Supabase auth.users creation, RLS, role auto-assignment, order OTP/expiry,
-- status transition validation, notifications, rating aggregates, push delivery,
-- geospatial nearby lookup, atomic accept, and updated_at stamping.
-- Implement them with authenticated server-side endpoints and transactions.
-- Before importing existing data, insert profiles for the corresponding auth user IDs.
