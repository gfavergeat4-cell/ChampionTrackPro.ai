import App from "../App";
import { initAuth } from "./firebaseConfig.web";

async function registerFcmSw() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) {
      return existing;
    }

    await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/",
      type: "classic",
    });

    const readyRegistration = await navigator.serviceWorker.ready;
    return readyRegistration;
  } catch (err) {
    console.error("[WEB PUSH] Failed to auto-register FCM service worker", err);
    return null;
  }
}

// Ne pas bloquer le rendu web
setTimeout(() => {
  initAuth().catch(() => {});
  registerFcmSw().catch((err) => console.error(err));
}, 0);

export default App;


