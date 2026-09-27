/* Molten heat core: a WebGL blob behind the hero numeral. Displacement,
   turbulence and glow all scale with heat; drag to spin. Three is loaded
   lazily so the instrument page paints before the 3D chunk arrives. */

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function hexToRGB(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255);
}

function radialTexture(size, stops) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [t, col] of stops) g.addColorStop(t, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

const NOISE_GLSL = `
vec3 mod289(vec3 x){return x - floor(x * (1.0/289.0)) * 289.0;}
vec4 mod289(vec4 x){return x - floor(x * (1.0/289.0)) * 289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}`;

const VERT = `
uniform float uTime;
uniform float uAmp;
uniform float uSpeed;
varying float vN;
varying vec3 vNormal;
varying vec3 vView;
${NOISE_GLSL}
void main() {
  float n1 = snoise(normal * 1.7 + vec3(0.0, uTime * uSpeed, uTime * uSpeed * 0.6));
  float n2 = snoise(normal * 4.4 - vec3(uTime * uSpeed * 1.5));
  float d = n1 * 0.72 + n2 * 0.28;
  vN = d;
  vec3 pos = position + normal * d * uAmp;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = `
precision highp float;
uniform vec3 uDeep;
uniform vec3 uMid;
uniform vec3 uHot;
uniform float uGlow;
uniform float uDim;
varying float vN;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  float t = smoothstep(-0.7, 0.95, vN);
  vec3 col = mix(uDeep, uMid, t);
  col = mix(col, uHot, smoothstep(0.55, 1.0, t));
  float fr = pow(1.0 - max(dot(normalize(vNormal), normalize(vView)), 0.0), 2.4);
  col += uHot * fr * (0.5 + uGlow * 0.7);
  gl_FragColor = vec4(col * uDim, 1.0);
}`;

export async function createHeatCore(canvas, initialHeat = 50) {
  let THREE;
  try {
    THREE = await import("three");
  } catch {
    return null; // chunk failed to load; hero still works without it
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch {
    return null;
  }
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 20);
  camera.position.set(0, 0, 3.4);

  const deep = new THREE.Color(...hexToRGB(cssVar("--ember-2", "#d34000"))).multiplyScalar(0.22);
  const mid = new THREE.Color(...hexToRGB(cssVar("--ember", "#ff5500")));
  const hot = new THREE.Color(...hexToRGB(cssVar("--hot", "#ffb060")));

  const uniforms = {
    uTime: { value: 0 },
    uAmp: { value: 0.14 },
    uSpeed: { value: 0.4 },
    uGlow: { value: 0.3 },
    uDim: { value: 0.7 },
    uDeep: { value: deep },
    uMid: { value: mid },
    uHot: { value: hot },
  };
  const blob = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, 5),
    new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG })
  );

  // soft halo behind the blob
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(
        radialTexture(256, [
          [0, "rgba(255,255,255,0.55)"],
          [0.35, "rgba(255,255,255,0.16)"],
          [1, "rgba(255,255,255,0)"],
        ])
      ),
      color: mid,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  halo.scale.setScalar(3.4);

  // orbiting embers
  const COUNT = 160;
  const positions = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const r = 1.35 + Math.random() * 1.05;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(ph) * Math.cos(th);
    positions[i * 3 + 1] = r * Math.cos(ph) * 0.72;
    positions[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const emberMat = new THREE.PointsMaterial({
    size: 0.055,
    map: new THREE.CanvasTexture(
      radialTexture(64, [
        [0, "rgba(255,255,255,1)"],
        [1, "rgba(255,255,255,0)"],
      ])
    ),
    color: hot,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const embers = new THREE.Points(emberGeo, emberMat);

  const group = new THREE.Group();
  group.add(halo, blob, embers);
  scene.add(group);

  // heat drives everything; eased toward the live value
  let heat = initialHeat / 100;
  let heatShown = heat;
  let targetRotY = 0;
  let targetRotX = 0;
  let velY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function setHeat(v) {
    heat = Math.max(0, Math.min(1, v / 100));
  }

  // drag to spin (vertical scroll still passes through)
  function down(e) {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  }
  function move(e) {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    targetRotY += dx * 0.006;
    targetRotX = Math.max(-0.7, Math.min(0.7, targetRotX + dy * 0.004));
    velY = dx * 0.0006;
  }
  function up() {
    dragging = false;
  }
  canvas.addEventListener("pointerdown", down);
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);

  const reduced =
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let cssW = 2;
  let cssH = 2;
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cssW = Math.max(2, canvas.clientWidth);
    cssH = Math.max(2, canvas.clientHeight);
    renderer.setPixelRatio(dpr);
    renderer.setSize(cssW, cssH, false);
    camera.aspect = cssW / cssH;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  let visible = true;
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  });
  io.observe(canvas);
  const onVis = () => {
    visible = !document.hidden && visible;
  };
  document.addEventListener("visibilitychange", onVis);

  const clock = new THREE.Clock();
  let raf = 0;

  function frame() {
    const t = clock.getElapsedTime();
    heatShown += (heat - heatShown) * 0.05;
    const h = heatShown;

    uniforms.uTime.value = t;
    uniforms.uAmp.value = 0.08 + 0.3 * h;
    uniforms.uSpeed.value = 0.3 + 1.0 * h;
    uniforms.uGlow.value = 0.15 + 0.85 * h;
    uniforms.uDim.value = 0.5 + 0.5 * h;
    blob.scale.setScalar(0.5 + 0.55 * h);
    halo.scale.setScalar(2.3 + 1.7 * h);
    halo.material.opacity = 0.22 + 0.55 * h;
    emberMat.opacity = 0.3 + 0.6 * h;
    emberMat.size = 0.045 + 0.03 * h;

    if (!dragging) {
      targetRotY += 0.0016 + velY + 0.004 * h;
      velY *= 0.94;
    }
    group.rotation.y += (targetRotY - group.rotation.y) * 0.08;
    group.rotation.x += (targetRotX - group.rotation.x) * 0.08;

    renderer.render(scene, camera);
    if (!reduced) raf = requestAnimationFrame(frame);
  }

  function start() {
    if (reduced) {
      frame();
      return;
    }
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }
  start();
  const startIfVisible = (entries) => {
    if (entries.some((e) => e.isIntersecting) && !reduced && !document.hidden) start();
  };
  const ioStart = new IntersectionObserver(startIfVisible, { threshold: 0.05 });
  ioStart.observe(canvas);
  const onVisStart = () => {
    if (!document.hidden) start();
  };
  document.addEventListener("visibilitychange", onVisStart);

  return {
    setHeat,
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      ioStart.disconnect();
      canvas.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      document.removeEventListener("visibilitychange", onVisStart);
      blob.geometry.dispose();
      blob.material.dispose();
      emberGeo.dispose();
      emberMat.dispose();
      halo.material.map?.dispose();
      halo.material.dispose();
      emberMat.map?.dispose();
      renderer.dispose();
    },
  };
}
