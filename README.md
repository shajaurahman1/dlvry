# DLVRY

Hyperlocal delivery connector. Customers call the shop; the shop dispatches; the nearest delivery partner (within 3 km) accepts and delivers. Cash / UPI settles directly between driver, shop and customer — DLVRY never touches money.

Built by **Shajau Rahman**.

---

## Stack

- **Frontend**: TanStack Start (React 19) + Vite + Tailwind v4
- **Backend**: Lovable Cloud (Supabase under the hood — Auth, Postgres, Storage, Realtime, RLS)
- **Auth**: Email / password (Gmail only)
- **Location**: Browser Geolocation API — driver must have GPS enabled and be within 3 km of the shop.

---

## Roles

| Role         | Home      | Notes                                          |
| ------------ | --------- | ---------------------------------------------- |
| `shopkeeper` | `/shop`   | Creates orders, marks payment received.        |
| `driver`     | `/driver` | Sees nearby orders (≤3 km), accepts, delivers. |
| `admin`      | `/admin`  | Approves shops / drivers, monitors orders.     |

### Master Admin

- **Email**: `mohammedshajaurahman@gmail.com`
- **Password**: `delvry`

---

## Environment variables

The frontend reads these at build time (already set in `.env`, injected by Lovable Cloud):

| Variable                        | Purpose                               |
| ------------------------------- | ------------------------------------- |
| `VITE_SUPABASE_URL`             | Backend URL                           |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public anon key (safe in the browser) |
| `VITE_SUPABASE_PROJECT_ID`      | Project identifier                    |

Server-only equivalents (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are used by server functions and are not exposed to the client.

You do **not** need to configure a `.env` yourself when running inside Lovable — the platform injects them.

---

## Managing the backend

DLVRY runs on **Lovable Cloud**, which is Supabase under the hood. You do not need a separate Supabase account.

From the Lovable editor:

- **View Backend** button (top of the chat) → opens the built-in dashboard.
- **Tables** → browse and edit rows in:
  - `profiles` — every signed-in user
  - `user_roles` — `shopkeeper` / `driver` / `admin`
  - `shopkeepers` — shop registrations (approval workflow)
  - `drivers` — delivery partner registrations (approval workflow, live GPS)
  - `orders` — the full delivery lifecycle
  - `ratings` — post-delivery star ratings
  - `complaints` — user-submitted complaints
  - `notifications` — in-app notification feed
  - `admin_logs` — audit trail of admin actions
- **Storage** → `dlvry-docs` bucket holds uploaded ID / shop / selfie documents.
- **Logs** → real-time query & auth logs for debugging.
- **Auth → Users** → list of signed-up accounts. You can reset passwords, delete users, or send magic links here.

### Editing / deleting records

Open the **Tables** view → pick a table → click a row → edit inline, or click the trash icon to delete. Row-Level Security still applies to end users but does **not** restrict edits from this dashboard.

### Live monitoring

- **Tables** view auto-refreshes.
- **Logs** stream requests in real time.
- The in-app `/admin` route also shows live stats (approved shops, drivers, delivered orders, pending approvals).

### Backups

Lovable Cloud takes automatic daily backups of the underlying Postgres database. To take an on-demand snapshot or restore, open **View Backend → Database → Backups**.

---

## Feature notes

### Location (drivers)

Drivers must allow browser location. The app:

1. Calls `navigator.geolocation.getCurrentPosition` directly (no `permissions.query` — Safari-friendly).
2. Starts a `watchPosition` for live updates.
3. Polls every 3 s so it auto-recovers the moment the user grants permission.
4. Only shows the "blocked" screen on an explicit `PERMISSION_DENIED`.

### Notifications

Postgres triggers on `public.orders` write into `public.notifications` for every lifecycle event:

- Order created → shop
- Driver accepted → shop + driver
- Driver reached shop → shop
- Payment received → driver (customer details unlock)
- Out for delivery → shop
- Delivered → shop + driver
- Cancelled → shop + driver

The `notifications` table is on the `supabase_realtime` publication, so any client can subscribe with `supabase.channel(...)`.

### Gmail validation

Sign-in / sign-up accept **Gmail addresses only**. Non-Gmail input shows `Please enter a valid Gmail address.` A failed sign-in with unknown credentials shows `Gmail account not found.`

### Back button

A minimal back button is shown at the top-left of every authenticated page. The Login page intentionally does not show one.

---

## Android build (Capacitor)

The project is ready to wrap with Capacitor:

```bash
npm run build
npx cap init dlvry app.dlvry --web-dir=dist
npx cap add android
npx cap sync
npx cap open android
```

Add these permissions to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

The web location code (`navigator.geolocation`) works unchanged inside a Capacitor WebView.

---

Made by **Shajau Rahman**.
