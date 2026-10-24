// Server-only. Sends push notifications via Firebase Cloud Messaging's HTTP
// v1 API, authenticated directly with the project's own service account
// (FIREBASE_SERVICE_ACCOUNT_JSON) instead of going through a third-party
// gateway. Implemented with Node's built-in crypto rather than the
// firebase-admin SDK to avoid pulling in a heavy dependency for what's a
// handful of HTTP calls.
import { createSign } from "node:crypto";

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

function base64url(input: Buffer | string): string {
  return (typeof input === "string" ? Buffer.from(input) : input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function getServiceAccount(): ServiceAccount {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON environment variable");
  return JSON.parse(raw) as ServiceAccount;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(account: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  signer.end();
  const signature = base64url(signer.sign(account.private_key));
  const jwt = `${header}.${claims}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`Firebase token exchange failed [${res.status}]: ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

/** Sends a single FCM message. Returns true on success, false on failure
 *  (the caller decides what to do — e.g. drop a dead token). */
export async function sendPushMessage(
  token: string,
  title: string,
  body: string,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const account = getServiceAccount();
  const accessToken = await getAccessToken(account);
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: { token, notification: { title, body }, data: { path: "/" } },
      }),
    },
  );
  if (res.ok) return { ok: true };
  return { ok: false, status: res.status, message: await res.text() };
}
