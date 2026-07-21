// Shared admin unlock state for the password-gated /admin pages.
//
// Previously each tab tracked its own unlock via sessionStorage, which meant
// links that open in a new tab (e.g. report links from the Vulcan reports
// chat) always hit the password screen. The unlock is now also stored in
// localStorage with an expiry, so it carries across tabs on the same device,
// while sessionStorage still works as before within a tab.

const KEY = 'dw-admin-unlocked';
const AT_KEY = 'dw-admin-unlocked-at';
const TTL_MS = 12 * 60 * 60 * 1000; // unlock lasts 12 hours across tabs

export function isAdminUnlocked(): boolean {
  try {
    if (sessionStorage.getItem(KEY) === 'true') return true;
    if (localStorage.getItem(KEY) === 'true') {
      const at = parseInt(localStorage.getItem(AT_KEY) || '0', 10);
      if (at && Date.now() - at < TTL_MS) {
        // Promote to this tab so existing sessionStorage checks keep working
        sessionStorage.setItem(KEY, 'true');
        return true;
      }
      // Expired — clean up
      localStorage.removeItem(KEY);
      localStorage.removeItem(AT_KEY);
    }
  } catch {
    // Storage unavailable (private mode etc.) — treat as locked
  }
  return false;
}

export function setAdminUnlocked(): void {
  try {
    sessionStorage.setItem(KEY, 'true');
    localStorage.setItem(KEY, 'true');
    localStorage.setItem(AT_KEY, String(Date.now()));
  } catch {
    // Storage unavailable — the in-memory unlocked state still works for this visit
  }
}
