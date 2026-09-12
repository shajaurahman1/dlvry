package in.dlvry.app;

import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.Credential;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.NoCredentialException;
import android.os.CancellationSignal;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

/**
 * Bridges Android's Credential Manager "Sign in with Google" (One Tap) flow to JS.
 *
 * Returns a Google ID token plus the raw nonce that was hashed into the
 * request, so the caller can hand both to Supabase's signInWithIdToken,
 * which re-hashes the raw nonce and compares it to the token's own nonce
 * claim (the standard Google <-> Supabase native pairing).
 */
@CapacitorPlugin(name = "GoogleOneTap")
public class GoogleOneTapPlugin extends Plugin {
  private final Executor executor = Executors.newSingleThreadExecutor();

  @PluginMethod
  public void signIn(PluginCall call) {
    String webClientId = call.getString("webClientId");
    if (webClientId == null || webClientId.isEmpty()) {
      call.reject("Missing webClientId");
      return;
    }

    String rawNonce = generateNonce();
    String hashedNonce = sha256(rawNonce);
    if (hashedNonce == null) {
      call.reject("Could not hash nonce");
      return;
    }

    GetGoogleIdOption googleIdOption = new GetGoogleIdOption.Builder()
      .setFilterByAuthorizedAccounts(false)
      .setServerClientId(webClientId)
      .setAutoSelectEnabled(true)
      .setNonce(hashedNonce)
      .build();

    GetCredentialRequest request = new GetCredentialRequest.Builder()
      .addCredentialOption(googleIdOption)
      .build();

    CredentialManager credentialManager = CredentialManager.create(getContext());

    credentialManager.getCredentialAsync(
      getActivity(),
      request,
      new CancellationSignal(),
      executor,
      new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
        @Override
        public void onResult(GetCredentialResponse result) {
          Credential credential = result.getCredential();
          if (credential instanceof CustomCredential
              && GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
            try {
              GoogleIdTokenCredential googleIdTokenCredential =
                GoogleIdTokenCredential.createFrom(((CustomCredential) credential).getData());
              JSObject data = new JSObject();
              data.put("idToken", googleIdTokenCredential.getIdToken());
              data.put("nonce", rawNonce);
              call.resolve(data);
            } catch (Exception e) {
              call.reject("Could not parse Google ID token", e);
            }
          } else {
            call.reject("Unexpected credential type: " + credential.getType());
          }
        }

        @Override
        public void onError(GetCredentialException e) {
          if (e instanceof GetCredentialCancellationException) {
            call.reject("cancelled", "cancelled", e);
          } else if (e instanceof NoCredentialException) {
            call.reject("No Google account available on this device", "no_credential", e);
          } else {
            call.reject(e.getMessage(), e.getClass().getSimpleName(), e);
          }
        }
      }
    );
  }

  private static String generateNonce() {
    byte[] bytes = new byte[32];
    new SecureRandom().nextBytes(bytes);
    return Base64.encodeToString(bytes, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
  }

  private static String sha256(String input) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hash = digest.digest(input.getBytes("UTF-8"));
      StringBuilder hex = new StringBuilder();
      for (byte b : hash) {
        String h = Integer.toHexString(0xff & b);
        if (h.length() == 1) hex.append('0');
        hex.append(h);
      }
      return hex.toString();
    } catch (NoSuchAlgorithmException | java.io.UnsupportedEncodingException e) {
      return null;
    }
  }
}
