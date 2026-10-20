// No Firebase project is configured for this app yet (no google-services.json
// anywhere in the repo), so the native push plugin has nothing to register
// against. Calling PushNotifications.register() in that state is a known
// cause of a hard native crash on Android (FCM throwing because no
// FirebaseApp was initialized) — not a catchable JS error, the whole app
// process dies. Until a real Firebase project + google-services.json are
// added, this stays a static notice instead of a working toggle.
export function NotificationSettings() {
  return <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="max-w-lg">
      <h2 className="text-lg font-semibold">Phone notifications</h2>
      <p role="status" className="text-sm text-muted-foreground">
        Phone notifications aren't set up for this app yet.
      </p>
    </div>
  </div>;
}
