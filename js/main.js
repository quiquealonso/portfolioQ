// Animaciones del portfolio (GSAP + ScrollTrigger + SplitText).
// Sin GSAP o con "reducir movimiento" la página se muestra completa y estática.
(() => {
  const root = document.documentElement;
  const $ = (selector, scope = document) => [
    ...scope.querySelectorAll(selector),
  ];
  const $1 = (selector, scope = document) => scope.querySelector(selector);
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const finePointer = window.matchMedia(
    "(hover: hover) and (pointer: fine)",
  ).matches;

  /* ---------- Funciones que no dependen de la animación ---------- */

  // Hora local de Alberic.
  const clocks = $("[data-clock]");
  if (clocks.length) {
    const format = new Intl.DateTimeFormat("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Madrid",
    });
    const tick = () => {
      const time = format.format(new Date());
      clocks.forEach((el) => (el.textContent = time));
    };
    tick();
    setInterval(tick, 15000);
  }

  // Copiar el correo.
  $("[data-copy]").forEach((button) => {
    const label = $1("span", button) || button;
    const original = label.textContent;
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.copy);
        label.textContent = "¡Copiado!";
      } catch (error) {
        label.textContent = button.dataset.copy;
      }
      setTimeout(() => (label.textContent = original), 2200);
    });
  });

  // Guardar el CV en PDF.
  $("[data-print]").forEach((button) =>
    button.addEventListener("click", () => window.print()),
  );

  // Editor con pestañas (clic o flechas del teclado).
  const editorEl = $1("[data-editor]");
  if (editorEl) {
    const tabs = $('[role="tab"]', editorEl);
    editorEl.selectTab = (index, { focus = false, user = false } = {}) => {
      tabs.forEach((tab, i) => {
        const on = i === index;
        tab.setAttribute("aria-selected", String(on));
        tab.tabIndex = on ? 0 : -1;
        document.getElementById(tab.getAttribute("aria-controls")).hidden = !on;
      });
      if (focus) tabs[index].focus();
      editorEl.dispatchEvent(
        new CustomEvent("editor:show", { detail: { index, user } }),
      );
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () =>
        editorEl.selectTab(i, { user: true }),
      );
      tab.addEventListener("keydown", (event) => {
        const keys = { ArrowRight: 1, ArrowLeft: -1 };
        if (!(event.key in keys)) return;
        event.preventDefault();
        const next = (i + keys[event.key] + tabs.length) % tabs.length;
        editorEl.selectTab(next, { focus: true, user: true });
      });
    });
  }

  // Modo claro / oscuro. El tema inicial lo fija el script del <head>.
  const themeMeta = $1('meta[name="theme-color"]');
  const paintTheme = () => {
    const light = root.dataset.theme === "light";
    $("[data-theme-toggle]").forEach((button) => {
      button.setAttribute("aria-pressed", String(light));
      button.setAttribute(
        "aria-label",
        light ? "Activar modo oscuro" : "Activar modo claro",
      );
    });
    if (themeMeta) themeMeta.content = light ? "#eef8f4" : "#031314";
  };
  const setTheme = (theme) => {
    root.dataset.theme = theme;
    try {
      localStorage.setItem("ea-theme", theme);
    } catch (error) {
      /* sin localStorage el modo dura lo que dure la página */
    }
    paintTheme();
  };
  paintTheme();
  $("[data-theme-toggle]").forEach((button) =>
    button.addEventListener("click", (event) => {
      const next = root.dataset.theme === "light" ? "dark" : "light";
      // El nuevo modo se revela en un círculo que nace del botón.
      if (document.startViewTransition && !reduceMotion) {
        const r = button.getBoundingClientRect();
        const x = event.clientX || r.left + r.width / 2;
        const y = event.clientY || r.top + r.height / 2;
        root.style.setProperty("--tx", `${x}px`);
        root.style.setProperty("--ty", `${y}px`);
        document.startViewTransition(() => setTheme(next));
      } else {
        setTheme(next);
      }
    }),
  );

  // Las animaciones CSS de maquetas y tarjetas solo corren cuando se ven.
  const watched = $(".mock, .tile, .langs, .orbit, .eq");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) =>
          entry.target.classList.toggle("is-in", entry.isIntersecting),
        ),
      { threshold: 0.2 },
    );
    watched.forEach((el) => io.observe(el));
  } else {
    watched.forEach((el) => el.classList.add("is-in"));
  }

  if (
    typeof gsap === "undefined" ||
    typeof ScrollTrigger === "undefined" ||
    typeof SplitText === "undefined" ||
    reduceMotion
  ) {
    root.classList.add("anim-off");
    root.classList.remove("is-loading", "is-entering");
    return;
  }

  gsap.registerPlugin(ScrollTrigger, SplitText);
  gsap.config({ nullTargetWarn: false });
  root.classList.add("anim-ready");

  /* ---------- Telón: pantalla de carga y transición entre páginas ---------- */

  const pageNames = {
    inicio: "Inicio",
    proyectos: "Proyectos",
    cv: "Currículum",
  };
  const pageFor = (pathname) => {
    if (pathname.endsWith("proyectos.html")) return "Proyectos";
    if (pathname.endsWith("cv.html")) return "Currículum";
    return "Inicio";
  };

  const curtain = document.createElement("div");
  curtain.className = "curtain";
  curtain.setAttribute("aria-hidden", "true");
  curtain.innerHTML = '<p class="curtain-label"></p>';
  document.body.append(curtain);
  const curtainLabel = $1(".curtain-label", curtain);

  const entering = root.classList.contains("is-entering");
  const loading = root.classList.contains("is-loading");
  gsap.set(curtain, {
    clipPath: entering ? "circle(150% at 50% 50%)" : "circle(0% at 50% 50%)",
  });

  const splitChars = (el, extra = {}) =>
    SplitText.create(el, { type: "words,chars", mask: "words", ...extra })
      .chars;

  // Pantalla de carga (solo la primera visita de la sesión).
  const preload = async () => {
    const loader = document.createElement("div");
    loader.className = "loader";
    loader.setAttribute("aria-hidden", "true");
    loader.innerHTML =
      '<div class="loader-byte" data-byte="head"></div>' +
      '<p class="loader-name">Enrique Alonso</p>' +
      '<p class="loader-count mono">000</p>' +
      '<div class="loader-bar"><i></i></div>';
    document.body.append(loader);
    root.classList.remove("is-loading");
    if (window.Byte) window.Byte.mount($1(".loader-byte", loader));

    const name = splitChars($1(".loader-name", loader));
    const count = $1(".loader-count", loader);
    const bar = $1(".loader-bar i", loader);
    const progress = { v: 0 };
    const paint = () => {
      count.textContent = String(Math.round(progress.v)).padStart(3, "0");
      bar.style.transform = `scaleX(${progress.v / 100})`;
    };

    gsap
      .timeline()
      .from(".loader-byte", {
        scale: 0,
        rotate: -30,
        duration: 0.9,
        ease: "back.out(2)",
      })
      .from(
        name,
        { yPercent: 110, duration: 1, stagger: 0.035, ease: "expo.out" },
        0.15,
      );
    gsap.to(".loader-byte", {
      y: -10,
      duration: 0.45,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
      delay: 0.9,
    });
    gsap.to(progress, {
      v: 80,
      duration: 1.5,
      ease: "power2.out",
      onUpdate: paint,
    });

    const loaded = new Promise((resolve) =>
      document.readyState === "complete"
        ? resolve()
        : window.addEventListener("load", resolve, { once: true }),
    );
    await Promise.race([
      Promise.all([wait(1500), loaded, document.fonts && document.fonts.ready]),
      wait(4500),
    ]);
    await gsap.to(progress, {
      v: 100,
      duration: 0.5,
      ease: "power2.inOut",
      overwrite: true,
      onUpdate: paint,
    });
    await gsap
      .timeline()
      .to(name, {
        yPercent: -110,
        duration: 0.6,
        stagger: 0.02,
        ease: "power3.in",
      })
      .to([".loader-byte", count], { autoAlpha: 0, y: -20, duration: 0.4 }, 0)
      .to(loader, {
        clipPath: "inset(0% 0% 100% 0%)",
        duration: 1,
        ease: "expo.inOut",
      });
    loader.remove();
  };

  // Llegada desde otra página: el nombre del destino aparece y el telón se abre.
  const arrive = async () => {
    root.classList.remove("is-entering");
    let label = pageNames[document.body.dataset.page] || "";
    try {
      label = sessionStorage.getItem("ea-label") || label;
      sessionStorage.removeItem("ea-label");
    } catch (error) {
      /* sin sessionStorage solo cambia el texto */
    }
    curtainLabel.textContent = label;
    const chars = splitChars(curtainLabel);
    await gsap.from(chars, {
      yPercent: 110,
      duration: 0.6,
      stagger: 0.03,
      ease: "expo.out",
    });
    await gsap
      .timeline()
      .to(chars, {
        yPercent: -110,
        duration: 0.45,
        stagger: 0.02,
        ease: "power3.in",
        delay: 0.15,
      })
      .to(curtain, {
        clipPath: "circle(0% at 50% 50%)",
        duration: 0.9,
        ease: "expo.inOut",
      });
    curtainLabel.textContent = "";
  };

  // Al pulsar un enlace interno, un círculo crece desde el cursor y tapa la página.
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (
      !link ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      link.target ||
      link.origin !== location.origin ||
      link.protocol === "mailto:" ||
      link.pathname === location.pathname
    ) {
      return;
    }
    event.preventDefault();
    const label = pageFor(link.pathname);
    try {
      sessionStorage.setItem("ea-nav", "1");
      sessionStorage.setItem("ea-label", label);
    } catch (error) {
      /* sin sessionStorage la entrada no muestra telón */
    }
    const x = `${((event.clientX || window.innerWidth / 2) / window.innerWidth) * 100}%`;
    const y = `${((event.clientY || window.innerHeight / 2) / window.innerHeight) * 100}%`;
    curtainLabel.textContent = label;
    const chars = splitChars(curtainLabel);
    gsap
      .timeline({ onComplete: () => (location.href = link.href) })
      .fromTo(
        curtain,
        { clipPath: `circle(0% at ${x} ${y})` },
        {
          clipPath: `circle(150% at ${x} ${y})`,
          duration: 0.85,
          ease: "expo.inOut",
        },
      )
      .from(
        chars,
        { yPercent: 110, duration: 0.5, stagger: 0.03, ease: "expo.out" },
        0.45,
      );
  });

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      gsap.set(curtain, { clipPath: "circle(0% at 50% 50%)" });
      curtainLabel.textContent = "";
    }
  });

  /* ---------- Cursor y elementos magnéticos ---------- */

  const cursor = () => {
    if (!finePointer) return;
    const dot = document.createElement("div");
    dot.className = "cursor";
    dot.setAttribute("aria-hidden", "true");
    dot.innerHTML = '<span class="cursor-label"></span>';
    document.body.append(dot);
    const label = $1(".cursor-label", dot);
    gsap.set(dot, { xPercent: -50, yPercent: -50 });
    const x = gsap.quickTo(dot, "x", { duration: 0.35, ease: "power3.out" });
    const y = gsap.quickTo(dot, "y", { duration: 0.35, ease: "power3.out" });
    window.addEventListener("pointermove", (e) => {
      x(e.clientX);
      y(e.clientY);
      root.classList.add("has-cursor");
    });
    document.addEventListener("pointerleave", () =>
      root.classList.remove("has-cursor"),
    );
    document.addEventListener("pointerover", (e) => {
      const labelled = e.target.closest("[data-cursor]");
      dot.classList.toggle("is-label", Boolean(labelled));
      if (labelled) label.textContent = labelled.dataset.cursor;
      dot.classList.toggle(
        "is-link",
        !labelled && Boolean(e.target.closest("a, button")),
      );
    });
    window.addEventListener("pointerdown", () => dot.classList.add("is-down"));
    window.addEventListener("pointerup", () => dot.classList.remove("is-down"));
  };

  const magnetic = () => {
    if (!finePointer) return;
    $("[data-magnetic]").forEach((el) => {
      const inner = $1("span, .orbit-core", el);
      const x = gsap.quickTo(el, "x", {
        duration: 0.6,
        ease: "elastic.out(1, 0.4)",
      });
      const y = gsap.quickTo(el, "y", {
        duration: 0.6,
        ease: "elastic.out(1, 0.4)",
      });
      const ix =
        inner &&
        gsap.quickTo(inner, "x", { duration: 0.6, ease: "power3.out" });
      const iy =
        inner &&
        gsap.quickTo(inner, "y", { duration: 0.6, ease: "power3.out" });
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        x(dx * 0.35);
        y(dy * 0.35);
        if (inner) {
          ix(dx * 0.15);
          iy(dy * 0.15);
        }
      });
      el.addEventListener("pointerleave", () => {
        x(0);
        y(0);
        if (inner) {
          ix(0);
          iy(0);
        }
      });
    });
  };

  /* ---------- Texto que reacciona al cursor ---------- */

  // Cada letra se vuelve más fina y cambia de color cuanto más cerca está el cursor.
  const proximity = () => {
    const chars = [];
    $("[data-proximity]").forEach((el) => {
      chars.push(
        ...SplitText.create(el, {
          type: "chars",
          charsClass: "pc",
          aria: el.matches("h1, h2") ? "auto" : "none",
        }).chars,
      );
    });
    if (!finePointer || !chars.length) return chars;
    let mx = -9999;
    let my = -9999;
    let queued = false;
    const update = () => {
      queued = false;
      chars.forEach((char) => {
        const r = char.getBoundingClientRect();
        const d = Math.hypot(
          mx - (r.left + r.width / 2),
          my - (r.top + r.height / 2),
        );
        const k = Math.max(0, 1 - d / 340);
        gsap.to(char, {
          "--w": 800 - 600 * k,
          "--s": k,
          duration: 0.5,
          ease: "power2.out",
          overwrite: "auto",
        });
      });
    };
    window.addEventListener("pointermove", (e) => {
      mx = e.clientX;
      my = e.clientY;
      if (!queued) {
        queued = true;
        requestAnimationFrame(update);
      }
    });
    return chars;
  };

  // Texto que se "descifra" con caracteres aleatorios antes de mostrar la siguiente palabra.
  const scramble = (el) => {
    const words = el.dataset.scramble.split("|");
    const glyphs = "!_/[]{}=+*^?#01%$";
    let index = 0;
    const to = (text) =>
      new Promise((resolve) => {
        const from = el.textContent;
        const length = Math.max(from.length, text.length);
        const queue = [];
        for (let n = 0; n < length; n++) {
          const start = Math.floor(Math.random() * 18);
          queue.push({
            from: from[n] || "",
            to: text[n] || "",
            start,
            end: start + Math.floor(Math.random() * 18) + 4,
            glyph: "",
          });
        }
        let frame = 0;
        const step = () => {
          let out = "";
          let done = 0;
          queue.forEach((item) => {
            if (frame >= item.end) {
              done++;
              out += item.to;
            } else if (frame >= item.start) {
              if (!item.glyph || Math.random() < 0.3) {
                item.glyph = glyphs[Math.floor(Math.random() * glyphs.length)];
              }
              out += `<span class="glyph">${item.glyph}</span>`;
            } else {
              out += item.from;
            }
          });
          el.innerHTML = out;
          if (done === queue.length) resolve();
          else {
            frame++;
            requestAnimationFrame(step);
          }
        };
        step();
      });
    const cycle = async () => {
      index = (index + 1) % words.length;
      await to(words[index]);
      setTimeout(cycle, 2600);
    };
    setTimeout(cycle, 2800);
  };

  // La terminal escribe sus comandos letra a letra.
  const terminal = () => {
    const list = $1("[data-terminal]");
    if (!list) return () => {};
    const items = $("li", list);
    const texts = items.map((li) => li.textContent);
    const caret = document.createElement("span");
    caret.className = "caret";
    items.forEach((li) => {
      li.textContent = "";
      li.classList.add("is-hidden");
    });
    return async () => {
      for (const [n, li] of items.entries()) {
        li.classList.remove("is-hidden");
        if (li.classList.contains("cmd")) {
          for (const char of texts[n]) {
            li.textContent += char;
            li.append(caret);
            await wait(40 + Math.random() * 70);
          }
          await wait(280);
        } else {
          li.textContent = texts[n];
          li.append(caret);
          await wait(320);
        }
      }
    };
  };

  /* ---------- Entrada de la página ---------- */

  const intro = (nameChars, typeTerminal) => {
    const tl = gsap.timeline();
    tl.from(".site-header", {
      yPercent: -130,
      duration: 1.1,
      ease: "expo.out",
    });
    gsap.set("[data-proximity]", { autoAlpha: 1 });
    tl.from(
      nameChars,
      {
        yPercent: 120,
        rotate: 10,
        duration: 1.3,
        stagger: 0.045,
        ease: "expo.out",
      },
      0.05,
    );
    tl.fromTo(
      "[data-intro]",
      { autoAlpha: 0, y: 34 },
      { autoAlpha: 1, y: 0, duration: 1, stagger: 0.08, ease: "expo.out" },
      0.45,
    );

    const scene = $1("[data-intro-scene]");
    if (scene) {
      const peek = $1(".terminal-byte", scene);
      tl.fromTo(
        scene,
        { autoAlpha: 0, y: 90, rotate: -5, scale: 0.9 },
        {
          autoAlpha: 1,
          y: 0,
          rotate: 0,
          scale: 1,
          duration: 1.4,
          ease: "expo.out",
        },
        0.6,
      )
        .fromTo(
          peek,
          { yPercent: 75 },
          { yPercent: 0, duration: 0.9, ease: "back.out(2)" },
          1.3,
        )
        .fromTo(
          ".terminal-hands i",
          { y: 26, autoAlpha: 0 },
          {
            y: 0,
            autoAlpha: 1,
            duration: 0.5,
            stagger: 0.1,
            ease: "back.out(3)",
          },
          1.55,
        )
        .call(typeTerminal, null, 1.5)
        .call(
          () => {
            if (!window.Byte) return;
            window.Byte.wave(peek);
            window.Byte.say(peek, "¡Hola! Soy Enriquito, el ayudante de Enrique.");
          },
          null,
          2.3,
        );
    }
    $("[data-scramble]").forEach(scramble);
  };

  /* ---------- Cabecera: fondo al bajar, se esconde y vuelve al subir ---------- */

  const header = () => {
    const el = $1(".site-header");
    if (!el) return;
    let hidden = false;
    ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => {
        const y = self.scroll();
        el.classList.toggle("is-scrolled", y > 40);
        const hide = self.direction === 1 && y > 400;
        if (hide === hidden) return;
        hidden = hide;
        gsap.to(el, {
          yPercent: hide ? -120 : 0,
          duration: 0.5,
          ease: "power3.out",
          overwrite: "auto",
        });
      },
    });
  };

  /* ---------- Hero: las líneas del nombre se separan al bajar ---------- */

  const heroScroll = () => {
    const hero = $1(".hero");
    if (!hero) return;
    const lines = $(".hero-line", hero);
    const scrub = {
      trigger: hero,
      start: "top top",
      end: "bottom top",
      scrub: true,
    };
    gsap.to(lines[0], { xPercent: -18, ease: "none", scrollTrigger: scrub });
    gsap.to(lines[1], { xPercent: 18, ease: "none", scrollTrigger: scrub });
    gsap.to(".terminal-scene", {
      yPercent: -18,
      ease: "none",
      scrollTrigger: scrub,
    });
    gsap.to([".hero-copy", ".hero-meta"], {
      autoAlpha: 0,
      y: -60,
      ease: "none",
      scrollTrigger: { ...scrub, end: "60% top" },
    });
  };

  /* ---------- Apariciones genéricas al hacer scroll ---------- */

  const pending = new Set();
  const onView = (trigger, run, start = "top 86%") => {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      pending.delete(go);
      run();
    };
    pending.add(go);
    ScrollTrigger.create({ trigger, start, once: true, onEnter: go });
  };

  const reveals = () => {
    $("[data-reveal]").forEach((el) => {
      const type = el.dataset.reveal || "up";
      const delay = Number(el.dataset.delay) || 0;
      if (type === "chars") {
        const chars = splitChars(el);
        gsap.set(el, { autoAlpha: 1 });
        gsap.set(chars, { yPercent: 115, rotate: 6 });
        onView(el, () =>
          gsap.to(chars, {
            yPercent: 0,
            rotate: 0,
            duration: 1.1,
            stagger: 0.022,
            ease: "expo.out",
            delay,
          }),
        );
      } else if (type === "stagger") {
        const kids = [...el.children];
        gsap.set(el, { autoAlpha: 1 });
        gsap.set(kids, { autoAlpha: 0, y: 30 });
        onView(el, () =>
          gsap.to(kids, {
            autoAlpha: 1,
            y: 0,
            duration: 0.8,
            stagger: 0.07,
            ease: "expo.out",
            delay,
          }),
        );
      } else {
        const from =
          type === "scale"
            ? { autoAlpha: 0, scale: 0.88, y: 30 }
            : { autoAlpha: 0, y: 60 };
        gsap.set(el, from);
        onView(el, () =>
          gsap.to(el, {
            autoAlpha: 1,
            scale: 1,
            y: 0,
            duration: 1.1,
            ease: "expo.out",
            delay,
          }),
        );
      }
    });

    // Contadores.
    $("[data-count]").forEach((el) => {
      const end = Number(el.dataset.count);
      const value = { v: 0 };
      el.textContent = "0";
      onView(el, () =>
        gsap.to(value, {
          v: end,
          duration: 1.8,
          ease: "power3.out",
          onUpdate: () => (el.textContent = String(Math.round(value.v))),
        }),
      );
    });

    // Párrafo que se ilumina palabra a palabra.
    $("[data-scrub-words]").forEach((el) => {
      // Las palabras de las píldoras no se atenúan: su fondo ya les da contraste.
      const words = SplitText.create(el, {
        type: "words",
        aria: "none",
      }).words.filter((word) => !word.closest(".chip"));
      const scroll = {
        trigger: el,
        start: "top 82%",
        end: "bottom 50%",
        scrub: 0.6,
      };
      gsap.fromTo(
        words,
        { opacity: 0.12 },
        { opacity: 1, stagger: 0.1, ease: "none", scrollTrigger: scroll },
      );
      gsap.fromTo(
        $(".chip", el),
        { scale: 0.4, rotate: -10 },
        {
          scale: 1,
          rotate: 0,
          stagger: 0.3,
          ease: "back.out(2)",
          scrollTrigger: scroll,
        },
      );
    });

    // Si la página llega al final, se ejecuta lo que quede pendiente.
    ScrollTrigger.create({
      start: () => Math.max(0, ScrollTrigger.maxScroll(window) - 4),
      onEnter: () => [...pending].forEach((run) => run()),
    });
  };

  /* ---------- Sobre mí: las tarjetas entran una a una sobre la baraja ---------- */

  const deck = () => {
    const section = $1(".about");
    if (!section) return;
    const pin = $1(".about-pin", section);
    const cards = $(".deck-card", section);
    const dots = $(".deck-dots li", section);
    const tilt = [-3, 2.5, -1.5, 3];
    const mm = gsap.matchMedia();

    mm.add("(min-width: 900px) and (min-height: 600px)", () => {
      section.classList.add("is-deck");
      gsap.set(cards, {
        y: (i) => (i ? window.innerHeight : 0),
        rotate: (i) => tilt[i] * (i ? 4 : 1),
        filter: "brightness(1)",
      });
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: pin,
          start: "top top",
          end: () => `+=${(cards.length - 1) * window.innerHeight * 0.8}`,
          pin: true,
          scrub: 0.7,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const active = Math.round(self.progress * (cards.length - 1));
            dots.forEach((dot, n) =>
              dot.classList.toggle("is-on", n === active),
            );
          },
        },
      });
      cards.forEach((card, i) => {
        if (!i) return;
        tl.to(
          card,
          { y: 0, rotate: tilt[i], duration: 1, ease: "power2.out" },
          i - 1,
        ).to(
          cards.slice(0, i),
          {
            scale: (n) => 1 - (i - n) * 0.05,
            y: (n) => -(i - n) * 24,
            filter: "brightness(0.72)",
            duration: 1,
          },
          i - 1,
        );
      });
      return () => {
        section.classList.remove("is-deck");
        gsap.set(cards, { clearProps: "all" });
      };
    });

    mm.add("(max-width: 899px), (max-height: 599px)", () => {
      cards.forEach((card, i) =>
        gsap.from(card, {
          autoAlpha: 0,
          y: 60,
          rotate: tilt[i],
          duration: 1,
          ease: "expo.out",
          scrollTrigger: { trigger: card, start: "top 88%", once: true },
        }),
      );
    });
  };

  /* ---------- Cintas de texto (reaccionan a la velocidad del scroll) ---------- */

  const marquees = () => {
    $("[data-marquee]").forEach((band) => {
      const track = $1(".marquee-track", band);
      const dir = Number(band.dataset.marquee) || 1;
      track.append(
        ...[...track.children].map((child) => child.cloneNode(true)),
      );
      const loop = gsap.fromTo(
        track,
        { xPercent: dir > 0 ? 0 : -50 },
        { xPercent: dir > 0 ? -50 : 0, ease: "none", duration: 38, repeat: -1 },
      );
      const skew = gsap.quickTo(track, "skewX", {
        duration: 0.5,
        ease: "power3.out",
      });
      ScrollTrigger.create({
        trigger: band,
        start: "top bottom",
        end: "bottom top",
        onUpdate: (self) => {
          const velocity = self.getVelocity();
          gsap.to(loop, {
            timeScale:
              self.direction * (1 + Math.min(Math.abs(velocity) / 150, 8)),
            duration: 0.2,
            overwrite: true,
            onComplete: () =>
              gsap.to(loop, { timeScale: self.direction, duration: 1.2 }),
          });
          skew(gsap.utils.clamp(-10, 10, (velocity / -260) * dir));
        },
        onLeave: () => skew(0),
      });
    });
  };

  /* ---------- Bento de habilidades ---------- */

  const bento = () => {
    const tiles = $("[data-tile]");
    if (!tiles.length) return;
    gsap.set(tiles, {
      autoAlpha: 0,
      y: 90,
      rotateX: -12,
      transformPerspective: 1000,
    });
    ScrollTrigger.batch(tiles, {
      start: "top 88%",
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, {
          autoAlpha: 1,
          y: 0,
          rotateX: 0,
          duration: 1.2,
          stagger: 0.1,
          ease: "expo.out",
        }),
    });

    if (finePointer) {
      tiles.forEach((tile) => {
        tile.addEventListener("pointermove", (e) => {
          const r = tile.getBoundingClientRect();
          tile.style.setProperty("--mx", `${e.clientX - r.left}px`);
          tile.style.setProperty("--my", `${e.clientY - r.top}px`);
        });
      });
    }

    // Editor: el archivo visible se escribe línea a línea. Mientras nadie toque las
    // pestañas, alterna solo entre los dos archivos.
    const editor = $1("[data-editor]");
    if (editor) {
      let typing = null;
      let visible = false;
      let auto = true;
      let index = 0;
      const tabsCount = $('[role="tab"]', editor).length;
      const type = () => {
        const panel = $(".editor-code", editor).find((p) => !p.hidden);
        const lines = $(".l", panel);
        if (typing) typing.kill();
        typing = gsap.timeline({
          paused: true,
          onComplete: () => {
            if (!auto) return;
            gsap.delayedCall(2.6, () => {
              if (auto && visible) {
                editor.selectTab((index + 1) % tabsCount);
              }
            });
          },
        });
        lines.forEach((line) => {
          const length = Math.max(2, line.textContent.length);
          typing.fromTo(
            line,
            { clipPath: "inset(0% 100% 0% 0%)" },
            {
              clipPath: "inset(0% 0% 0% 0%)",
              duration: length * 0.026,
              ease: `steps(${length})`,
            },
          );
        });
        if (visible) typing.play();
      };
      editor.addEventListener("editor:show", (event) => {
        index = event.detail.index;
        if (event.detail.user) auto = false;
        type();
      });
      type();
      ScrollTrigger.create({
        trigger: editor,
        start: "top 90%",
        end: "bottom top",
        onToggle: (self) => {
          visible = self.isActive;
          if (!typing) return;
          if (visible) typing.play();
          else typing.pause();
        },
      });
    }

    // Pipeline de calidad: cada paso gira y termina en verde.
    const ci = $1(".ci");
    if (ci) {
      const steps = $("li", ci);
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.8, paused: true });
      tl.call(() =>
        steps.forEach((li) => li.classList.remove("is-run", "is-ok")),
      );
      steps.forEach((li, i) => {
        tl.call(() => li.classList.add("is-run"), null, 0.3 + i * 0.75);
        tl.call(
          () => {
            li.classList.remove("is-run");
            li.classList.add("is-ok");
          },
          null,
          0.3 + i * 0.75 + 0.7,
        );
      });
      tl.to({}, { duration: 1.6 });
      ScrollTrigger.create({
        trigger: ci,
        start: "top 92%",
        end: "bottom top",
        onToggle: (self) => (self.isActive ? tl.play() : tl.pause()),
      });
    }
  };

  /* ---------- Proyectos apilados ---------- */

  const stack = () => {
    const cards = $(".stack-card");
    cards.forEach((card, i) => {
      gsap.fromTo(
        card,
        { y: 120, rotate: i % 2 ? 3 : -3 },
        {
          y: 0,
          rotate: 0,
          ease: "none",
          scrollTrigger: {
            trigger: card,
            start: "top bottom",
            end: "top 55%",
            scrub: 0.6,
          },
        },
      );
      const next = cards[i + 1];
      if (!next) return;
      gsap.to(card, {
        scale: 0.9,
        filter: "brightness(0.55)",
        ease: "none",
        scrollTrigger: {
          trigger: next,
          start: "top 85%",
          end: "top 15%",
          scrub: true,
        },
      });
    });
  };

  /* ---------- Trayectoria en horizontal ---------- */

  const journey = () => {
    const section = $1(".journey");
    if (!section) return;
    const pin = $1(".journey-pin", section);
    const list = $1(".journey-list", section);
    const bar = $1(".journey-progress i", section);
    const items = $(".milestone", section);
    const head = $(".section-head > *", section);
    gsap.set(head, { autoAlpha: 1 });
    const mm = gsap.matchMedia();

    mm.add("(min-width: 900px) and (min-height: 560px)", () => {
      section.classList.add("is-horizontal");
      const distance = () => list.scrollWidth - window.innerWidth + 48;
      const move = gsap.to(list, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: pin,
          start: "top top",
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 0.8,
          invalidateOnRefresh: true,
          onUpdate: (self) => gsap.set(bar, { scaleX: self.progress }),
        },
      });
      items.forEach((item) => {
        gsap.fromTo(
          item,
          { autoAlpha: 0.25, y: 40 },
          {
            autoAlpha: 1,
            y: 0,
            ease: "power2.out",
            scrollTrigger: {
              trigger: item,
              containerAnimation: move,
              start: "left 85%",
              end: "left 45%",
              scrub: true,
              toggleClass: { targets: item, className: "is-active" },
            },
          },
        );
      });
      return () => section.classList.remove("is-horizontal");
    });

    mm.add("(max-width: 899px), (max-height: 559px)", () => {
      items.forEach((item) =>
        gsap.from(item, {
          autoAlpha: 0,
          x: -40,
          duration: 1,
          ease: "expo.out",
          scrollTrigger: { trigger: item, start: "top 88%", once: true },
        }),
      );
    });
  };

  /* ---------- Contacto y pie ---------- */

  const contact = () => {
    const byte = $1(".contact-byte");
    if (byte) {
      gsap.from(byte, {
        yPercent: 40,
        autoAlpha: 0,
        rotate: -8,
        duration: 1.2,
        ease: "back.out(1.6)",
        scrollTrigger: { trigger: byte, start: "top 88%", once: true },
        onComplete: () => {
          if (!window.Byte) return;
          window.Byte.wave(byte);
          window.Byte.say(byte, byte.dataset.say.split("|")[0]);
        },
      });
    }
    const orbit = $1(".orbit");
    if (orbit) {
      gsap.from(orbit, {
        scale: 0,
        rotate: -120,
        duration: 1.4,
        ease: "expo.out",
        scrollTrigger: { trigger: orbit, start: "top 92%", once: true },
      });
    }
  };

  const footer = () => {
    const name = $1("[data-footer-name]");
    if (!name) return;
    const chars = SplitText.create(name, {
      type: "chars",
      charsClass: "fc",
    }).chars;
    gsap.fromTo(
      chars,
      { yPercent: 100 },
      {
        yPercent: 0,
        stagger: 0.04,
        ease: "none",
        scrollTrigger: {
          trigger: name,
          start: "top bottom",
          end: "bottom bottom",
          scrub: 0.6,
        },
      },
    );
  };

  /* ---------- Páginas de proyectos y CV ---------- */

  const parallax = () => {
    $("[data-parallax]").forEach((el, i) => {
      gsap.fromTo(
        el,
        { yPercent: 10, rotate: i % 2 ? 2 : -2 },
        {
          yPercent: -10,
          rotate: i % 2 ? -2 : 2,
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        },
      );
      gsap.from(el, {
        clipPath: "inset(18% 12% 18% 12% round 28px)",
        duration: 1.4,
        ease: "expo.out",
        scrollTrigger: { trigger: el, start: "top 85%", once: true },
      });
    });
  };

  const timelines = () => {
    $("[data-timeline]").forEach((list) => {
      gsap.fromTo(
        list,
        { "--line": 0 },
        {
          "--line": 1,
          ease: "none",
          scrollTrigger: {
            trigger: list,
            start: "top 80%",
            end: "bottom 60%",
            scrub: true,
          },
        },
      );
      $("li", list).forEach((item) => {
        gsap.set(item, { autoAlpha: 0, x: -40 });
        onView(
          item,
          () => {
            gsap.to(item, {
              autoAlpha: 1,
              x: 0,
              duration: 1,
              ease: "expo.out",
            });
            item.classList.add("is-on");
          },
          "top 88%",
        );
      });
    });
  };

  /* ---------- Arranque ---------- */

  const start = async () => {
    cursor();
    magnetic();
    const nameChars = proximity();
    const typeTerminal = terminal();
    deck();
    journey();
    reveals();
    header();
    heroScroll();
    marquees();
    bento();
    stack();
    contact();
    footer();
    parallax();
    timelines();
    ScrollTrigger.sort();

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => ScrollTrigger.refresh());
    }

    if (loading) await preload();
    else if (entering) await arrive();
    intro(nameChars, typeTerminal);
  };

  // Si algo falla, se descubre la página en lugar de dejarla tapada.
  start().catch(() => {
    root.classList.remove("is-loading", "is-entering", "anim-ready");
    root.classList.add("anim-off");
    gsap.set(curtain, { clipPath: "circle(0% at 50% 50%)" });
    $(".loader").forEach((el) => el.remove());
    gsap.set(
      "[data-intro], [data-reveal], [data-proximity], [data-tile], [data-intro-scene], .timeline li",
      { clearProps: "opacity,visibility,transform" },
    );
  });
})();
