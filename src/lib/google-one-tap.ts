import { registerPlugin } from "@capacitor/core";

interface GoogleOneTapResult {
  idToken: string;
  nonce: string;
}

interface GoogleOneTapPlugin {
  signIn(options: { webClientId: string }): Promise<GoogleOneTapResult>;
}

const GoogleOneTap = registerPlugin<GoogleOneTapPlugin>("GoogleOneTap");

/**
 * Triggers Android's native "Sign in with Google" (Credential Manager) sheet
 * and returns the Google ID token + the raw nonce that was hashed into the
 * request. Pass both straight to supabase.auth.signInWithIdToken — Supabase
 * re-hashes the raw nonce and checks it against the token's own nonce claim.
 *
 * Native (Android) only — call isNativeApp() first.
 */
export async function googleOneTapSignIn(): Promise<GoogleOneTapResult> {
  const webClientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined;
  if (!webClientId) {
    throw new Error("Google sign-in is not configured (missing VITE_GOOGLE_WEB_CLIENT_ID).");
  }
  return GoogleOneTap.signIn({ webClientId });
}
