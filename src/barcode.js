// Barcode → food. Scanning uses the BarcodeDetector API (Android Chrome and
// most Chromium builds; absent on iOS Safari, where the manual field still
// works). Lookups go through Open Food Facts' v2 product endpoint.

export function barcodeSupported() {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}

export async function lookupBarcode(code) {
  const clean = String(code || "").replace(/\D/g, "");
  if (clean.length < 6) throw new Error("bad code");
  const url = `https://world.openfoodfacts.org/api/v2/product/${clean}.json?fields=product_name,brands,nutriments,serving_quantity,serving_size_unit`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("lookup failed");
  const data = await res.json();
  if (data.status !== 1 || !data.product) throw new Error("not found");
  const p = data.product;
  const n = p.nutriments || {};
  const kcal = Number(n["energy-kcal_100g"] || n["energy-kcal"] || 0);
  if (!kcal || !p.product_name) throw new Error("no nutrition data");
  const servingQ = Number(p.serving_quantity) || 0;
  const servingUnit = String(p.serving_size_unit || "g").toLowerCase();
  const useServing = servingQ > 0 && servingUnit === "g";
  const brand = p.brands ? String(p.brands).split(",")[0].trim() : "";
  return {
    id: "off-" + clean,
    name: brand ? `${p.product_name} — ${brand}` : p.product_name,
    kcal,
    protein: Number(n.proteins_100g || 0),
    carbs: Number(n.carbohydrates_100g || 0),
    fat: Number(n.fat_100g || 0),
    ...(Number(n["saturated-fat_100g"] || 0) > 0
      ? { satfat: Number(n["saturated-fat_100g"]) }
      : {}),
    unit: useServing ? "serving" : "100g",
    grams: useServing ? Math.round(servingQ) : null,
    source: "OFF",
  };
}

// Opens the camera and resolves with a decoded barcode string. Rejects on
// permission denial, unsupported environment, or cancel().
export function scanBarcode() {
  return new Promise((resolve, reject) => {
    if (!barcodeSupported()) return reject(new Error("unsupported"));

    const overlay = document.createElement("div");
    overlay.className = "scan-modal";
    overlay.innerHTML = `
      <div class="scan-box">
        <header class="kicker">Scan barcode</header>
        <video class="scan-video" playsinline muted></video>
        <p class="tiny">Hold the package steady, barcode facing the light.</p>
        <button class="btn ghost" type="button">Cancel</button>
      </div>
    `;
    const video = overlay.querySelector("video");
    const cancelBtn = overlay.querySelector("button");

    let stream = null;
    let raf = 0;
    let done = false;

    const cleanup = () => {
      done = true;
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      overlay.remove();
    };

    cancelBtn.onclick = () => {
      cleanup();
      reject(new Error("cancelled"));
    };
    document.body.append(overlay);

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        video.srcObject = stream;
        await video.play();
        const detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
        const tick = async () => {
          if (done) return;
          try {
            const hits = await detector.detect(video);
            if (hits.length) {
              const code = hits[0].rawValue;
              cleanup();
              return resolve(code);
            }
          } catch {
            /* frame not ready */
          }
          raf = requestAnimationFrame(() => setTimeout(tick, 120));
        };
        tick();
      } catch (err) {
        cleanup();
        reject(err);
      }
    })();
  });
}
