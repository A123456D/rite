export function registerPwa() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(new URL("sw.js", document.baseURI)).catch(() => {});
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
