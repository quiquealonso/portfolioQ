// Enriquito, la mascota: un gorila tecnológico con auriculares. Se dibuja en cualquier elemento con
// data-byte="full" (cuerpo entero), "peek" (asomado detrás de algo) o "head" (solo la cabeza).
// Sigue al cursor con la mirada, parpadea a ritmo irregular y saluda al hacer clic.
(() => {
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  let uid = 0;

  const art = (id) => `
  <defs>
    <linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#22626b"/>
      <stop offset="1" stop-color="#0c2b32"/>
    </linearGradient>
    <linearGradient id="${id}c" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3ff0d0"/>
      <stop offset="1" stop-color="#b6ff6b"/>
    </linearGradient>
  </defs>
  <g class="b-float">
    <g class="b-body">
      <path d="M62 172C30 188 22 232 34 254c10 10 26 6 28-8 4-24 10-44 24-58z" fill="#0f353d"/>
      <circle cx="36" cy="254" r="14" fill="#1d5560"/>
      <path d="M56 274C44 214 70 168 120 168s76 46 64 106z" fill="url(#${id}f)"/>
      <path d="M92 176c8 10 48 10 56 0" fill="none" stroke="#2c7480" stroke-width="3" stroke-linecap="round"/>
      <rect x="88" y="196" width="64" height="44" rx="12" fill="#04191b" stroke="url(#${id}c)" stroke-width="2.5"/>
      <text class="b-screen" x="120" y="225" text-anchor="middle" font-family="JetBrains Mono, Consolas, monospace" font-size="20" font-weight="700" fill="#3ff0d0">&lt;/&gt;</text>
      <circle class="b-led" cx="74" cy="210" r="3.2" fill="#3ff0d0"/>
      <circle class="b-led b-led--2" cx="166" cy="210" r="3.2" fill="#b6ff6b"/>
      <g class="b-arm">
        <path d="M178 172c32 16 40 60 28 82-10 10-26 6-28-8-4-24-10-44-24-58z" fill="#0f353d"/>
        <circle cx="204" cy="254" r="14" fill="#1d5560"/>
      </g>
    </g>
    <g class="b-head">
      <circle cx="52" cy="106" r="17" fill="#1d5560"/><circle cx="52" cy="106" r="8" fill="#8fd6c9"/>
      <circle cx="188" cy="106" r="17" fill="#1d5560"/><circle cx="188" cy="106" r="8" fill="#8fd6c9"/>
      <ellipse cx="120" cy="100" rx="66" ry="58" fill="url(#${id}f)"/>
      <path d="M84 62C98 28 142 28 156 62c-14-9-58-9-72 0z" fill="#0b2a31"/>
      <path class="b-circuit" d="M96 55h14l6-8h16" fill="none" stroke="#3ff0d0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="132" cy="47" r="2.4" fill="#3ff0d0"/>
      <path d="M120 40V24" stroke="#3ff0d0" stroke-width="3" stroke-linecap="round"/>
      <circle class="b-antenna" cx="120" cy="20" r="6" fill="#b6ff6b"/>
      <path d="M120 72c26-8 46 12 44 36-2 24-20 40-44 40s-42-16-44-40c-2-24 18-44 44-36z" fill="#bfeee4"/>
      <ellipse class="b-blush" cx="88" cy="122" rx="8" ry="5" fill="#3ff0d0" opacity=".25"/>
      <ellipse class="b-blush" cx="152" cy="122" rx="8" ry="5" fill="#3ff0d0" opacity=".25"/>
      <ellipse cx="120" cy="127" rx="29" ry="20" fill="#93ddd0"/>
      <path d="M104 117c3-9 29-9 32 0 2 6-5 10-16 10s-18-4-16-10z" fill="#4f9e96"/>
      <ellipse cx="112" cy="120" rx="4" ry="2.8" fill="#0b2a31"/>
      <ellipse cx="128" cy="120" rx="4" ry="2.8" fill="#0b2a31"/>
      <path class="b-mouth" d="M104 132q16 14 32 0" fill="none" stroke="#0b2a31" stroke-width="3.2" stroke-linecap="round"/>
      <circle cx="101" cy="99" r="12" fill="#fff"/><circle cx="139" cy="99" r="12" fill="#fff"/>
      <g class="b-pupils">
        <circle cx="101" cy="99" r="6.5" fill="#0b2328"/><circle cx="103" cy="96.5" r="2.2" fill="#fff"/>
        <circle cx="139" cy="99" r="6.5" fill="#0b2328"/><circle cx="141" cy="96.5" r="2.2" fill="#fff"/>
      </g>
      <g class="b-lids" fill="#bfeee4">
        <rect x="88" y="86" width="26" height="26"/>
        <rect x="126" y="86" width="26" height="26"/>
      </g>
      <path d="M84 90c4-14 30-16 36-6 6-10 32-8 36 6-8-5-26-6-36 2-10-8-28-7-36-2z" fill="#0b2a31"/>
      <path d="M52 108C48 30 192 30 188 108" fill="none" stroke="url(#${id}c)" stroke-width="7" stroke-linecap="round"/>
      <rect x="36" y="90" width="24" height="44" rx="11" fill="#0b2a31" stroke="#3ff0d0" stroke-width="3"/>
      <rect x="180" y="90" width="24" height="44" rx="11" fill="#0b2a31" stroke="#3ff0d0" stroke-width="3"/>
      <path class="b-beat" d="M44 104v16M196 104v16" stroke="#b6ff6b" stroke-width="3" stroke-linecap="round"/>
      <path d="M192 134c6 20-22 30-44 22" fill="none" stroke="#0b2a31" stroke-width="3.4" stroke-linecap="round"/>
      <circle cx="146" cy="156" r="5.5" fill="#3ff0d0"/>
    </g>
  </g>`;

  const instances = [];

  const mount = (el) => {
    const pose = el.dataset.byte || "full";
    const id = `byte${++uid}`;
    const box = pose === "head" ? "26 6 188 164" : "0 0 240 280";
    const svg = `<svg class="byte-svg" viewBox="${box}" aria-hidden="true" focusable="false">${art(id)}</svg>`;
    el.classList.add("byte", `byte--${pose}`);

    if (pose === "head") {
      el.innerHTML = svg;
    } else {
      el.innerHTML =
        '<p class="byte-bubble" role="status" aria-live="polite"></p>' +
        '<button type="button" class="byte-hit" aria-label="Saludar a Enriquito, la mascota">' +
        svg +
        "</button>";
    }

    const me = {
      el,
      pupils: el.querySelector(".b-pupils"),
      head: el.querySelector(".b-head"),
      bubble: el.querySelector(".byte-bubble"),
      timer: 0,
    };
    instances.push(me);

    const hit = el.querySelector(".byte-hit");
    if (hit) {
      const lines = (el.dataset.say || "¡Hola! Soy Enriquito.").split("|");
      let i = 0;
      hit.addEventListener("click", () => {
        wave(el);
        say(el, lines[i++ % lines.length]);
      });
    }
    blink(me);
  };

  // Parpadeo a intervalos irregulares, a veces doble.
  const blink = (me) => {
    if (reduceMotion) return;
    const next = 2200 + Math.random() * 3800;
    setTimeout(() => {
      me.el.classList.add("is-blink");
      setTimeout(() => me.el.classList.remove("is-blink"), 140);
      if (Math.random() < 0.25) {
        setTimeout(() => {
          me.el.classList.add("is-blink");
          setTimeout(() => me.el.classList.remove("is-blink"), 120);
        }, 260);
      }
      blink(me);
    }, next);
  };

  const wave = (el) => {
    if (reduceMotion) return;
    el.classList.remove("is-waving");
    void el.offsetWidth;
    el.classList.add("is-waving");
    clearTimeout(el._waveTimer);
    el._waveTimer = setTimeout(() => el.classList.remove("is-waving"), 1900);
  };

  const say = (el, text, ms = 4200) => {
    const me = instances.find((item) => item.el === el);
    if (!me || !me.bubble) return;
    me.bubble.textContent = text;
    me.bubble.classList.add("is-on");
    clearTimeout(me.timer);
    me.timer = setTimeout(() => me.bubble.classList.remove("is-on"), ms);
  };

  // La mirada de todas las instancias sigue al cursor.
  let px = 0;
  let py = 0;
  let queued = false;
  const look = () => {
    queued = false;
    instances.forEach((me) => {
      const r = me.el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      const dx = px - (r.left + r.width / 2);
      const dy = py - (r.top + r.height * 0.35);
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 220);
      const ex = (dx / d) * 4.5 * k;
      const ey = (dy / d) * 4.5 * k;
      me.pupils.setAttribute(
        "transform",
        `translate(${ex.toFixed(2)} ${ey.toFixed(2)})`,
      );
      if (!reduceMotion && me.head) {
        me.head.style.transform = `rotate(${(ex * 1.1).toFixed(2)}deg)`;
      }
    });
  };
  window.addEventListener("pointermove", (e) => {
    px = e.clientX;
    py = e.clientY;
    if (!queued) {
      queued = true;
      requestAnimationFrame(look);
    }
  });

  document.querySelectorAll("[data-byte]").forEach(mount);
  window.Byte = { wave, say, mount };
})();
