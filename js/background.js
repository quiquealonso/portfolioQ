// Fondo 3D con Three.js: estructura, partículas y campo de ondas que evolucionan con el scroll.
// Se carga en diferido para no penalizar el primer pintado.
const THREE_URL = new URL("../vendor/three.module.min.js", import.meta.url)
  .href;

const reduceMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;
const saveData = navigator.connection && navigator.connection.saveData;

const whenIdle = (callback) =>
  "requestIdleCallback" in window
    ? requestIdleCallback(callback, { timeout: 300 })
    : setTimeout(callback, 100);

const smooth = (t) => t * t * (3 - 2 * t);

const init = async () => {
  const THREE = await import(THREE_URL);

  const isSmall = () => window.innerWidth < 760;
  const canvas = document.createElement("canvas");
  canvas.className = "bg-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.z = 9;

  /* Escenas: la composición y el color cambian a lo largo de la página */
  const keys = [
    {
      p: 0,
      x: 5.6,
      y: 0.4,
      scale: 0.8,
      cam: 9,
      wave: 0.55,
      color: new THREE.Color(0x68c9f1),
    },
    {
      p: 0.35,
      x: -5.8,
      y: -0.2,
      scale: 0.9,
      cam: 7.6,
      wave: 0.8,
      color: new THREE.Color(0x5b8dff),
    },
    {
      p: 0.7,
      x: 5.4,
      y: 0.5,
      scale: 0.75,
      cam: 8.2,
      wave: 1,
      color: new THREE.Color(0x4fe3d2),
    },
    {
      p: 1,
      x: 0,
      y: 0.5,
      scale: 1.1,
      cam: 6.2,
      wave: 1.2,
      color: new THREE.Color(0x68c9f1),
    },
  ];
  const state = {
    x: 0,
    y: 0,
    scale: 1,
    cam: 9,
    wave: 0.5,
    color: new THREE.Color(),
  };
  const sampleKeys = (p) => {
    let i = 0;
    while (i < keys.length - 2 && p > keys[i + 1].p) i++;
    const a = keys[i];
    const b = keys[i + 1];
    const t = smooth(Math.min(Math.max((p - a.p) / (b.p - a.p), 0), 1));
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      scale: a.scale + (b.scale - a.scale) * t,
      cam: a.cam + (b.cam - a.cam) * t,
      wave: a.wave + (b.wave - a.wave) * t,
      color: a.color.clone().lerp(b.color, t),
    };
  };

  /* Partículas */
  const sprite = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();

  const count = isSmall() ? 600 : 1500;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const radius = 6 + Math.random() * 18;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.7;
    positions[i * 3 + 2] = radius * Math.cos(phi) - 4;
  }
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3),
  );
  const particleMaterial = new THREE.PointsMaterial({
    map: sprite,
    color: 0x68c9f1,
    size: 0.16,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particles);

  /* Estructura geométrica en alambre */
  const hero = new THREE.Group();
  const wire = (geometry, opacity) =>
    new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({
        color: 0x68c9f1,
        transparent: true,
        opacity,
      }),
    );
  const outer = wire(new THREE.IcosahedronGeometry(3.2, 1), 0.3);
  const inner = wire(new THREE.OctahedronGeometry(1.7, 0), 0.55);
  const core = wire(new THREE.IcosahedronGeometry(0.7, 0), 0.9);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(4.4, 0.012, 8, 160),
    new THREE.MeshBasicMaterial({
      color: 0x68c9f1,
      transparent: true,
      opacity: 0.35,
    }),
  );
  ring.rotation.x = Math.PI / 2.4;
  const ring2 = ring.clone();
  ring2.scale.setScalar(1.25);
  ring2.rotation.set(Math.PI / 3.1, 0.6, 0);
  hero.add(outer, inner, core, ring, ring2);
  scene.add(hero);

  /* Campo de ondas en el suelo (shader) */
  const waveUniforms = {
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector2(0, 0) },
    uColor: { value: new THREE.Color(0x68c9f1) },
    uOpacity: { value: 0.5 },
    uSize: { value: 2.4 },
    uPixelRatio: { value: 1 },
    uAmp: { value: 1 },
  };
  const waveField = new THREE.Points(
    new THREE.PlaneGeometry(70, 46, isSmall() ? 90 : 150, isSmall() ? 60 : 100),
    new THREE.ShaderMaterial({
      uniforms: waveUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        uniform float uTime;
        uniform vec2 uMouse;
        uniform float uSize;
        uniform float uPixelRatio;
        uniform float uAmp;
        varying float vHeight;
        void main() {
          vec3 p = position;
          float h = sin(p.x * 0.32 + uTime * 0.8) * 0.55
                  + sin(p.y * 0.42 + uTime * 0.6) * 0.5
                  + sin((p.x + p.y) * 0.18 + uTime * 0.4) * 0.7;
          float d = distance(p.xy, uMouse);
          h += exp(-d * d * 0.045) * 1.8 * sin(d * 1.6 - uTime * 4.0);
          p.z += h * uAmp;
          vHeight = h;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = uSize * uPixelRatio * (16.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vHeight;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          float edge = smoothstep(0.5, 0.05, d);
          float lift = clamp(vHeight * 0.3 + 0.45, 0.15, 1.0);
          gl_FragColor = vec4(uColor * (0.55 + lift * 0.6), edge * uOpacity * lift);
        }
      `,
    }),
  );
  waveField.rotation.x = -Math.PI / 2.25;
  waveField.position.set(0, -7.5, -8);
  scene.add(waveField);

  const layout = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    // En pantallas muy grandes se baja la resolución para que la animación siga fluida.
    let ratio = Math.min(window.devicePixelRatio, 1.75);
    const budget = 3.2e6;
    if (width * height * ratio * ratio > budget) {
      ratio = Math.max(0.75, Math.sqrt(budget / (width * height)));
    }
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    waveUniforms.uPixelRatio.value = ratio;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  layout();
  window.addEventListener("resize", layout);

  /* Interacción: ratón, scroll y transición de página */
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  window.addEventListener("pointermove", (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  });
  let scrollTarget = 0;
  let scrollSmooth = 0;
  let scrollVelocity = 0;
  const readScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    scrollTarget = max > 0 ? window.scrollY / max : 0;
  };
  window.addEventListener("scroll", readScroll, { passive: true });
  readScroll();
  scrollSmooth = scrollTarget;

  let warp = 0;
  window.addEventListener("bg:warp", () => {
    warp = 1;
  });

  /* Bucle de render (se pausa si la pestaña no se ve) */
  const clock = new THREE.Clock();
  let frame = 0;
  let time = 0;
  const render = () => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const previous = scrollSmooth;
    pointer.sx += (pointer.x - pointer.sx) * 0.05;
    pointer.sy += (pointer.y - pointer.sy) * 0.05;
    scrollSmooth += (scrollTarget - scrollSmooth) * 0.06;
    scrollVelocity +=
      (Math.abs(scrollSmooth - previous) * 90 - scrollVelocity) * 0.1;
    warp *= 0.95;

    const speed = 1 + scrollVelocity * 2.5 + warp * 5;
    time += dt * speed;

    // Interpola la escena actual hacia la que corresponde al scroll.
    const target = sampleKeys(scrollSmooth);
    const small = isSmall();
    state.x += ((small ? 0 : target.x) - state.x) * 0.08;
    state.y += ((small ? 2.4 : target.y) - state.y) * 0.08;
    state.scale += (target.scale * (small ? 0.65 : 1) - state.scale) * 0.08;
    state.cam += (target.cam - state.cam) * 0.08;
    state.wave += (target.wave - state.wave) * 0.08;
    state.color.lerp(target.color, 0.06);

    hero.position.set(
      state.x,
      state.y + Math.sin(time * 0.6) * 0.15,
      small ? -3 : 0,
    );
    hero.scale.setScalar(state.scale);
    outer.rotation.x = time * 0.1 + scrollSmooth * 3;
    outer.rotation.y = time * 0.14 + scrollSmooth * 5;
    inner.rotation.x = -time * 0.2;
    inner.rotation.y = -time * 0.26 - scrollSmooth * 3;
    core.rotation.y = time * 0.5;
    core.rotation.z = time * 0.3;
    ring.rotation.z = time * 0.12;
    ring2.rotation.z = -time * 0.09;

    [outer, inner, core].forEach((m) => m.material.color.copy(state.color));
    ring.material.color.copy(state.color);
    ring2.material.color.copy(state.color);
    particleMaterial.color.copy(state.color);
    waveUniforms.uColor.value.copy(state.color);

    particles.rotation.y = time * 0.015 + scrollSmooth * 1.2;
    particles.rotation.x = scrollSmooth * 0.4;

    waveUniforms.uTime.value = time;
    waveUniforms.uAmp.value = state.wave;
    waveUniforms.uMouse.value.set(pointer.sx * 22, 6 - pointer.sy * 12);
    waveField.position.y = -7.5 + scrollSmooth * 1.5;

    camera.position.x = pointer.sx * 1;
    camera.position.y = -pointer.sy * 0.7;
    camera.position.z = state.cam - warp * 4;
    camera.lookAt(0, -0.5, 0);

    renderer.render(scene, camera);
    frame = requestAnimationFrame(render);
  };
  frame = requestAnimationFrame(render);
  document.addEventListener("visibilitychange", () => {
    cancelAnimationFrame(frame);
    if (!document.hidden) {
      clock.getDelta();
      frame = requestAnimationFrame(render);
    }
  });

  requestAnimationFrame(() => {
    canvas.classList.add("is-ready");
    window.__bgReady = true;
    window.dispatchEvent(new Event("bg:ready"));
  });
};

if (!reduceMotion && !saveData) {
  const start = () => whenIdle(() => init().catch(() => {}));
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
}
