// Fondo líquido: un shader de WebGL que deforma ruido fractal en tonos verde azulado.
// Reacciona al ratón y al scroll. Se dibuja a baja resolución (el resultado es suave de por sí)
// y a 30 fps como máximo, y se detiene cuando la pestaña no está visible.
(() => {
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const saveData = navigator.connection && navigator.connection.saveData;
  if (saveData) return;

  const canvas = document.createElement("canvas");
  canvas.className = "bg-liquid";
  canvas.setAttribute("aria-hidden", "true");
  const gl =
    canvas.getContext("webgl", {
      antialias: false,
      depth: false,
      alpha: false,
      powerPreference: "low-power",
    }) || null;
  if (!gl) return;

  const vertex = `
    attribute vec2 p;
    void main() { gl_Position = vec4(p, 0.0, 1.0); }
  `;

  const fragment = `
    precision mediump float;
    uniform vec2 uRes;
    uniform float uTime;
    uniform vec2 uMouse;
    uniform float uScroll;
    uniform float uLight;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y
      );
    }
    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p = r * p * 2.02;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
      float t = uTime * 0.045;
      vec2 m = (uMouse - 0.5 * uRes) / uRes.y;

      // Atracción suave hacia el cursor.
      vec2 toMouse = m - p;
      p += toMouse * 0.18 * exp(-dot(toMouse, toMouse) * 3.0);

      vec2 q = vec2(fbm(p * 1.3 + t), fbm(p * 1.3 + vec2(5.2, 1.3) - t));
      vec2 w = vec2(
        fbm(p * 1.5 + 3.6 * q + vec2(1.7, 9.2) + t * 1.4 + uScroll * 0.6),
        fbm(p * 1.5 + 3.6 * q + vec2(8.3, 2.8) - t * 1.1)
      );
      float f = fbm(p * 1.2 + 3.8 * w);

      // Paleta oscura y clara; uLight mezcla entre las dos.
      vec3 deep = mix(vec3(0.008, 0.045, 0.05), vec3(0.93, 0.975, 0.96), uLight);
      vec3 sea = mix(vec3(0.015, 0.17, 0.17), vec3(0.68, 0.9, 0.86), uLight);
      vec3 teal = mix(vec3(0.12, 0.78, 0.68), vec3(0.16, 0.76, 0.66), uLight);
      vec3 lime = mix(vec3(0.6, 0.95, 0.4), vec3(0.72, 0.96, 0.5), uLight);

      vec3 col = mix(deep, sea, smoothstep(0.25, 0.85, f));
      col = mix(col, teal, smoothstep(0.62, 1.05, f + length(q) * 0.15) * 0.45);
      col += lime * pow(smoothstep(0.78, 1.2, f + w.x * 0.2), 3.0) * 0.22;

      float glow = exp(-dot(m - p, m - p) * 5.0);
      col += teal * glow * 0.08;

      float vignette = smoothstep(1.35, 0.15, length(p * vec2(0.8, 1.0)));
      col *= mix(0.55 + 0.45 * vignette, 0.9 + 0.1 * vignette, uLight);
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
  };
  const vs = compile(gl.VERTEX_SHADER, vertex);
  const fs = compile(gl.FRAGMENT_SHADER, fragment);
  if (!vs || !fs) return;
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const loc = gl.getAttribLocation(program, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(program, "uRes");
  const uTime = gl.getUniformLocation(program, "uTime");
  const uMouse = gl.getUniformLocation(program, "uMouse");
  const uScroll = gl.getUniformLocation(program, "uScroll");
  const uLight = gl.getUniformLocation(program, "uLight");

  // El tema cambia el fondo con un fundido suave.
  const isLight = () => document.documentElement.dataset.theme === "light";
  let light = isLight() ? 1 : 0;

  // Resolución reducida: el fondo es difuso y así cuesta muy poco.
  const SCALE = 0.32;
  let width = 0;
  let height = 0;
  const resize = () => {
    width = Math.max(1, Math.round(window.innerWidth * SCALE));
    height = Math.max(1, Math.round(window.innerHeight * SCALE));
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
    gl.uniform2f(uRes, width, height);
  };

  const mouse = { x: 0.7, y: 0.6, sx: 0.7, sy: 0.6 };
  window.addEventListener("pointermove", (e) => {
    mouse.x = e.clientX / window.innerWidth;
    mouse.y = 1 - e.clientY / window.innerHeight;
  });

  let scroll = 0;
  let scrollSmooth = 0;
  const readScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    scroll = max > 0 ? window.scrollY / max : 0;
  };
  window.addEventListener("scroll", readScroll, { passive: true });

  let time = Math.random() * 100;
  let last = performance.now();
  let frame = 0;
  const draw = () => {
    mouse.sx += (mouse.x - mouse.sx) * 0.06;
    mouse.sy += (mouse.y - mouse.sy) * 0.06;
    scrollSmooth += (scroll - scrollSmooth) * 0.05;
    gl.uniform1f(uTime, time);
    gl.uniform2f(uMouse, mouse.sx * width, mouse.sy * height);
    gl.uniform1f(uScroll, scrollSmooth * 4);
    light += ((isLight() ? 1 : 0) - light) * (reduceMotion ? 1 : 0.08);
    gl.uniform1f(uLight, light);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const loop = (now) => {
    frame = requestAnimationFrame(loop);
    const dt = now - last;
    if (dt < 1000 / 31) return;
    last = now;
    time += Math.min(dt, 100) / 1000;
    draw();
  };

  const start = () => {
    document.body.prepend(canvas);
    resize();
    readScroll();
    draw();
    requestAnimationFrame(() => canvas.classList.add("is-ready"));
    window.addEventListener("resize", resize);
    if (reduceMotion) {
      // Sin bucle de animación, se redibuja al cambiar de tema.
      new MutationObserver(draw).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
      return;
    }
    frame = requestAnimationFrame(loop);
    document.addEventListener("visibilitychange", () => {
      cancelAnimationFrame(frame);
      if (!document.hidden) {
        last = performance.now();
        frame = requestAnimationFrame(loop);
      }
    });
  };

  // Arranca cuando la página ya ha cargado y el navegador está libre.
  const idle = () =>
    "requestIdleCallback" in window
      ? requestIdleCallback(start, { timeout: 1200 })
      : setTimeout(start, 200);
  if (document.readyState === "complete") idle();
  else window.addEventListener("load", idle, { once: true });
})();
