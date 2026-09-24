export function registerPwa() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(new URL("sw.js", document.baseURI))
      .then((reg) => {
        reg.addEventListener("updatefound", () => {
          const next = reg.installing;
          if (!next) return;
          next.addEventListener("statechange", () => {
            // Awaiting skipWaiting means a new build is live; let the UI offer
            // a one-tap reload instead of silently running stale code.
            if (next.state === "installed" && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent("rite-update"));
            }
          });
        });
      })
      .catch(() => {});
  });
}

let deferred;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferred = e;
  window.dispatchEvent(new Event("ember-installable"));
});

export function canInstall() {
  return Boolean(deferred);
}

export async function promptInstall() {
  if (!deferred) return { ok: false, reason: "manual" };
  deferred.prompt();
  const choice = await deferred.userChoice;
  deferred = null;
  return { ok: choice.outcome === "accepted" };
}

export function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}
