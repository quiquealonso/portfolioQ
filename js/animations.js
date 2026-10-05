(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  // Sin GSAP o con movimiento reducido, el contenido se muestra tal cual.
  if (typeof gsap === "undefined" || reduceMotion.matches) {
    root.classList.remove("js", "is-entering", "is-loading");
    return;
  }

  gsap.registerPlugin(ScrollTrigger, SplitText);
  gsap.defaults({ ease: "power3.out", duration: 0.8 });
  gsap.config({ nullTargetWarn: false });

  const $ = (selector, scope = document) => [
    ...scope.querySelectorAll(selector),
  ];
  const $1 = (selector, scope = document) => scope.querySelector(selector);
  const finePointer = window.matchMedia(
    "(hover: hover) and (pointer: fine)",
  ).matches;

  // Dispara una animación una sola vez cuando el elemento aparece. Además de ScrollTrigger usa
  // IntersectionObserver y un aviso al llegar al final de la página, para que ninguna sección
  // se quede sin animar aunque el scroll sea muy rápido o la pantalla muy grande.
  const pending = new Set();
  const onceTrigger = ({ trigger, start, onEnter }) => {
    let done = false;
    let observer = null;
    const run = () => {
      if (done) return;
      done = true;
      pending.delete(run);
      if (observer) observer.disconnect();
      onEnter();
    };
    pending.add(run);
    ScrollTrigger.create({ trigger, start, once: true, onEnter: run });
    if ("IntersectionObserver" in window && trigger) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) run();
        },
        { threshold: 0.15 },
      );
      observer.observe(trigger);
    }
  };
  ScrollTrigger.create({
    start: () => Math.max(0, ScrollTrigger.maxScroll(window) - 160),
    onEnter: () => [...pending].forEach((run) => run()),
  });

  /* ---------- Transición de página y pantalla de carga ---------- */

  // Una tira de paneles cubre la pantalla. Al navegar se cierra mostrando el nombre
  // de la página de destino y, al llegar, el nombre sale y los paneles se levantan.
  // En una carga directa muestra una pantalla de carga con contador.
  const stage = document.createElement("div");
  stage.className = "pt";
  stage.setAttribute("aria-hidden", "true");
  stage.innerHTML =
    '<div class="pt-cols">' +
    "<i></i>".repeat(7) +
    "</div>" +
    '<p class="pt-label"></p>' +
    '<div class="pt-loader">' +
    '<p class="pt-name">Enrique Alonso Puig</p>' +
    '<p class="pt-role">Desarrollo de aplicaciones</p>' +
    '<div class="pt-meter"><span class="pt-count">000</span>' +
    '<span class="pt-bar"><i></i></span></div>' +
    "</div>";
  document.body.append(stage);

  const cols = $(".pt-cols i", stage);
  const labelEl = $1(".pt-label", stage);
  const loaderEl = $1(".pt-loader", stage);
  const wasEntering = root.classList.contains("is-entering");
  const wasLoading = root.classList.contains("is-loading");

  // Los paneles ya cubren la pantalla: se retira la cobertura provisional de CSS.
  gsap.set(cols, { yPercent: wasEntering || wasLoading ? 0 : 100 });
  gsap.set([labelEl, loaderEl], { autoAlpha: 0 });
  root.classList.remove("is-entering", "is-loading");

  const labelFor = (pathname) => {
    if (pathname.endsWith("proyectos.html")) return "Proyectos";
    if (pathname.endsWith("cv.html")) return "Currículum";
    return "Inicio";
  };

  const splitChars = (el) =>
    SplitText.create(el, {
      type: "lines,chars",
      mask: "lines",
      linesClass: "split-line",
    }).chars;

  // Cierra los paneles (sin texto: el nombre solo se muestra en la página nueva).
  const cover = () =>
    gsap.timeline().fromTo(
      cols,
      { yPercent: 100 },
      {
        yPercent: 0,
        duration: 0.75,
        ease: "power4.inOut",
        stagger: { each: 0.06, from: "start" },
      },
    );

  // Levanta los paneles y deja ver la página.
  const lift = (onMid) => {
    window.dispatchEvent(new Event("bg:warp"));
    return gsap
      .timeline()
      .to(cols, {
        yPercent: -100,
        duration: 1,
        ease: "power4.inOut",
        stagger: { each: 0.07, from: "start" },
      })
      .call(() => onMid && onMid(), null, 0.45)
      .set(cols, { yPercent: 100 })
      .set([labelEl, loaderEl], { autoAlpha: 0 });
  };

  const pageLoaded = () =>
    new Promise((resolve) =>
      document.readyState === "complete"
        ? resolve()
        : window.addEventListener("load", resolve, { once: true }),
    );

  const backgroundReady = () =>
    new Promise((resolve) => {
      const saveData = navigator.connection && navigator.connection.saveData;
      if (saveData || window.__bgReady) return resolve();
      window.addEventListener("bg:ready", resolve, { once: true });
      setTimeout(resolve, 3500);
    });

  // Pantalla de carga: nombre, contador y barra de progreso.
  const preload = (fontsReady) =>
    new Promise((resolve) => {
      gsap.set(loaderEl, { autoAlpha: 1 });
      const name = splitChars($1(".pt-name", loaderEl));
      const count = $1(".pt-count", loaderEl);
      const bar = $1(".pt-bar i", loaderEl);
      const progress = { v: 0 };
      const paint = () => {
        count.textContent = String(Math.round(progress.v)).padStart(3, "0");
        gsap.set(bar, { scaleX: progress.v / 100 });
      };

      gsap
        .timeline()
        .from(name, {
          yPercent: 115,
          duration: 1.1,
          stagger: 0.035,
          ease: "power4.out",
        })
        .from(
          ".pt-role, .pt-count",
          { autoAlpha: 0, y: 14, duration: 0.8, stagger: 0.1 },
          0.5,
        );

      // El contador avanza solo hasta el 85 %; el resto espera a que todo esté listo.
      gsap.to(progress, {
        v: 85,
        duration: 1.8,
        ease: "power2.out",
        onUpdate: paint,
      });
      const minimum = new Promise((r) => gsap.delayedCall(1.6, r));
      const failsafe = new Promise((r) => setTimeout(r, 6000));
      Promise.race([
        Promise.all([minimum, pageLoaded(), fontsReady, backgroundReady()]),
        failsafe,
      ]).then(() => {
        gsap.to(progress, {
          v: 100,
          duration: 0.6,
          ease: "power2.inOut",
          overwrite: true,
          onUpdate: paint,
          onComplete: () => {
            gsap
              .timeline({ onComplete: resolve })
              .to(name, {
                yPercent: -115,
                duration: 0.7,
                stagger: 0.02,
                ease: "power3.in",
              })
              .to(
                ".pt-role, .pt-meter",
                { autoAlpha: 0, y: -14, duration: 0.5, stagger: 0.05 },
                0,
              );
          },
        });
      });
    });

  // Llegada desde otra página: el nombre del destino sube, se mantiene un instante y sale.
  const arrive = () =>
    new Promise((resolve) => {
      let label = "";
      try {
        label = sessionStorage.getItem("ptLabel") || "";
        sessionStorage.removeItem("ptLabel");
      } catch (error) {
        /* sin sessionStorage solo se pierde el nombre en pantalla */
      }
      if (!label) return resolve();
      labelEl.textContent = label;
      gsap.set(labelEl, { autoAlpha: 1 });
      const chars = splitChars(labelEl);
      gsap
        .timeline({ delay: 0.1, onComplete: resolve })
        .from(chars, {
          yPercent: 115,
          duration: 0.7,
          stagger: 0.025,
          ease: "power4.out",
        })
        .to(
          chars,
          {
            yPercent: -115,
            duration: 0.6,
            stagger: 0.02,
            ease: "power3.in",
          },
          "+=0.25",
        );
    });

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
      link.hasAttribute("download") ||
      link.origin !== location.origin ||
      link.pathname === location.pathname
    ) {
      return;
    }
    event.preventDefault();
    const label = labelFor(link.pathname);
    try {
      sessionStorage.setItem("pt", "1");
      sessionStorage.setItem("ptLabel", label);
    } catch (error) {
      /* sin sessionStorage la transición de entrada simplemente no se muestra */
    }
    window.dispatchEvent(new Event("bg:warp"));
    gsap.to("main", { autoAlpha: 0, y: -40, duration: 0.6, ease: "power2.in" });
    cover().then(() => {
      setTimeout(() => {
        location.href = link.href;
      }, 100);
    });
  });

  // Al volver con el botón "atrás" el navegador restaura la página tal cual.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      gsap.set(cols, { yPercent: 100 });
      gsap.set([labelEl, loaderEl], { autoAlpha: 0 });
      gsap.set("main", { clearProps: "all" });
    }
  });

  /* ---------- Entrada de la página ---------- */

  const intro = () => {
    const tl = gsap.timeline({ delay: 0.15 });
    const container = $1(".hero, .page-intro");
    const heading = $1("h1", container);

    tl.fromTo(
      ".site-header",
      { autoAlpha: 0, yPercent: -100 },
      { autoAlpha: 1, yPercent: 0, duration: 0.8 },
    );

    if (heading) {
      gsap.set(heading, { autoAlpha: 1 });
      const split = SplitText.create(heading, {
        type: "words,chars",
        wordsClass: "split-word",
        charsClass: "split-char",
      });
      tl.from(
        split.chars,
        {
          yPercent: 120,
          rotateX: -90,
          autoAlpha: 0,
          transformOrigin: "50% 100%",
          duration: 1.1,
          stagger: 0.012,
          ease: "back.out(1.5)",
        },
        "-=0.4",
      );
    }

    const lead = $1(".hero-lead, .page-intro > p:last-child");
    const rest = $(".hero > *, .page-intro > *").filter(
      (el) => el !== heading && el !== lead && !el.matches(".eyebrow"),
    );
    tl.fromTo(
      $1(".eyebrow", container),
      { autoAlpha: 0, x: -24 },
      { autoAlpha: 1, x: 0, duration: 0.7 },
      0.3,
    );
    if (lead) {
      gsap.set(lead, { autoAlpha: 1 });
      const words = SplitText.create(lead, { type: "words" });
      tl.from(
        words.words,
        { autoAlpha: 0, y: 18, duration: 0.7, stagger: 0.018 },
        "-=0.7",
      );
    }
    tl.fromTo(
      rest,
      { autoAlpha: 0, y: 28 },
      { autoAlpha: 1, y: 0, stagger: 0.12, duration: 0.8 },
      "-=0.5",
    );

    // Al salir del hero, el contenido se desvanece y se aleja.
    if (container) {
      gsap.to(container, {
        y: -90,
        opacity: 0.1,
        ease: "none",
        scrollTrigger: {
          trigger: container,
          start: "top top",
          end: "bottom 15%",
          scrub: true,
        },
      });
    }
  };

  /* ---------- Cabecera y barra de progreso ---------- */

  const chrome = () => {
    const bar = document.createElement("div");
    bar.className = "scroll-progress";
    bar.setAttribute("aria-hidden", "true");
    document.body.append(bar);
    gsap.fromTo(
      bar,
      { scaleX: 0 },
      {
        scaleX: 1,
        ease: "none",
        scrollTrigger: { start: 0, end: "max", scrub: 0.3 },
      },
    );

    // La cabecera se oculta al bajar y reaparece al subir.
    let hidden = false;
    ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => {
        const hide = self.direction === 1 && self.scroll() > 260;
        if (hide !== hidden) {
          hidden = hide;
          gsap.to(".site-header", {
            yPercent: hide ? -110 : 0,
            duration: 0.45,
            overwrite: "auto",
          });
        }
      },
    });
  };

  /* ---------- Aparición al hacer scroll ---------- */

  /* ---------- Perfil: panel que se expande y contadores ---------- */

  const profile = () => {
    const section = $1(".profile");
    if (!section) return;
    const panel = $1(".profile-panel", section);
    const ghost = $1(".profile-ghost", section);
    const eyebrow = $1(".eyebrow", section);
    const heading = $1("h2", section);
    const paragraphs = $(".copy-block p", section);
    const stats = $(".profile-stats li", section);

    // Los contenedores quedan visibles; cada pieza se anima por separado.
    gsap.set($(".profile > *", section.parentElement), { autoAlpha: 1 });
    gsap.set(section, { autoAlpha: 1 });
    gsap.set($(":scope > *", section), { autoAlpha: 1 });

    // El panel nace como un rectángulo pequeño en el centro y se abre con el scroll.
    gsap.fromTo(
      panel,
      { clipPath: "inset(38% 22% 38% 22% round 48px)", opacity: 0.4 },
      {
        clipPath: "inset(0% 0% 0% 0% round 4px)",
        opacity: 1,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top 92%",
          end: "top 38%",
          scrub: 0.6,
        },
      },
    );

    // La palabra gigante se desplaza en horizontal.
    gsap.fromTo(
      ghost,
      { xPercent: 18 },
      {
        xPercent: -18,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      },
    );

    // Titular: cada línea entra deslizada y torcida.
    const lines = SplitText.create(heading, {
      type: "lines",
      mask: "lines",
      linesClass: "split-line",
    }).lines;
    gsap.set(eyebrow, { autoAlpha: 0, x: -30 });
    gsap.set(lines, { yPercent: 120, skewY: 7 });
    gsap.set(stats, { autoAlpha: 0, y: 40 });
    onceTrigger({
      trigger: section,
      start: "top 62%",
      once: true,
      onEnter: () => {
        gsap.timeline().to(eyebrow, { autoAlpha: 1, x: 0, duration: 0.7 }).to(
          lines,
          {
            yPercent: 0,
            skewY: 0,
            duration: 1.1,
            stagger: 0.12,
            ease: "power4.out",
          },
          0.1,
        );
      },
    });

    // Párrafos: cada palabra se enciende según avanza el scroll.
    paragraphs.forEach((paragraph) => {
      const words = SplitText.create(paragraph, { type: "words" }).words;
      gsap.fromTo(
        words,
        { opacity: 0.14 },
        {
          opacity: 1,
          ease: "none",
          stagger: 0.12,
          scrollTrigger: {
            trigger: paragraph,
            start: "top 80%",
            end: "bottom 50%",
            scrub: 0.5,
          },
        },
      );
    });

    // Cifras: entran y cuentan hasta su valor.
    onceTrigger({
      trigger: $1(".profile-stats", section),
      start: "top 92%",
      once: true,
      onEnter: () => {
        gsap.to(stats, {
          autoAlpha: 1,
          y: 0,
          duration: 0.9,
          stagger: 0.12,
        });
        $("[data-count]", section).forEach((el) => {
          const end = Number(el.dataset.count);
          const counter = { value: 0 };
          el.textContent = "0";
          gsap.to(counter, {
            value: end,
            duration: 1.6,
            ease: "power2.out",
            delay: 0.2,
            onUpdate: () => {
              el.textContent = String(Math.round(counter.value));
            },
          });
        });
      },
    });
  };

  /* ---------- Competencias: iconos que se dibujan y etiquetas ---------- */

  const capabilityDetails = () => {
    $(".capability-list article").forEach((card) => {
      const shapes = $(".cap-icon svg > *", card);
      const num = $1(".cap-num", card);
      const tags = $(".cap-tags li", card);
      gsap.set(shapes, { strokeDasharray: 1, strokeDashoffset: 1 });
      gsap.set(tags, { autoAlpha: 0, y: 12, scale: 0.9 });
      gsap.set(num, { autoAlpha: 0, x: 24 });
      onceTrigger({
        trigger: card,
        start: "top 85%",
        once: true,
        onEnter: () => {
          gsap
            .timeline({ delay: 0.25 })
            .to(shapes, {
              strokeDashoffset: 0,
              duration: 1.1,
              stagger: 0.12,
              ease: "power2.inOut",
            })
            .to(num, { autoAlpha: 1, x: 0, duration: 0.8 }, 0.1)
            .to(
              tags,
              {
                autoAlpha: 1,
                y: 0,
                scale: 1,
                duration: 0.6,
                stagger: 0.08,
                ease: "back.out(2)",
              },
              0.5,
            );
        },
      });
    });
  };

  /* ---------- Contacto ---------- */

  const contactSection = () => {
    const panel = $1(".cta-panel");
    if (!panel) return;
    const ghost = $1(".cta-ghost", panel);
    const eyebrow = $1(".eyebrow", panel);
    const heading = $1("h2", panel);
    const status = $1(".cta-status", panel);
    const actions = $(".cta-actions > *", panel);

    gsap.set(panel, { autoAlpha: 1 });
    const words = SplitText.create(heading, {
      type: "lines,words",
      mask: "lines",
      linesClass: "split-line",
    }).words;
    gsap.set(words, { yPercent: 115, rotate: 6 });
    gsap.set([eyebrow, status], { autoAlpha: 0, y: 20 });
    gsap.set(actions, { autoAlpha: 0, y: 30 });

    // El correo se puede copiar con un clic.
    const email = "enralopui@alu.edu.gva.es";
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "button button-secondary";
    copy.textContent = "Copiar email";
    copy.setAttribute("aria-live", "polite");
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(email);
        copy.textContent = "¡Copiado!";
      } catch (error) {
        copy.textContent = "Copia: " + email;
      }
      setTimeout(() => (copy.textContent = "Copiar email"), 2200);
    });
    $1(".cta-actions", panel).insertBefore(copy, $1(".cta-email", panel));
    gsap.set(copy, { autoAlpha: 0, y: 30 });

    gsap.fromTo(
      ghost,
      { xPercent: -8 },
      {
        xPercent: 8,
        ease: "none",
        scrollTrigger: {
          trigger: panel,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      },
    );

    // Se reproduce al entrar el panel (sin depender de cuánto scroll quede).
    onceTrigger({
      trigger: panel,
      start: "top 92%",
      once: true,
      onEnter: () => {
        gsap
          .timeline()
          .fromTo(
            panel,
            { y: 80, scale: 0.96 },
            { y: 0, scale: 1, duration: 1.1, ease: "power4.out" },
          )
          .to(eyebrow, { autoAlpha: 1, y: 0, duration: 0.7 }, 0.2)
          .to(
            words,
            {
              yPercent: 0,
              rotate: 0,
              duration: 1,
              stagger: 0.07,
              ease: "power4.out",
            },
            0.3,
          )
          .to(status, { autoAlpha: 1, y: 0, duration: 0.7 }, 0.9)
          .to(
            [...actions, copy],
            { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.1 },
            0.7,
          );
      },
    });

    // Foco de luz que sigue al cursor dentro del panel.
    panel.addEventListener("pointermove", (e) => {
      const r = panel.getBoundingClientRect();
      panel.style.setProperty("--mx", `${e.clientX - r.left}px`);
      panel.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  };

  const scrollReveals = () => {
    // Bloques genéricos: suben con un ligero giro.
    const generic = [".section-heading", ".cv-photo", ".cv-block"].join(",");
    gsap.set(generic, { autoAlpha: 0, y: 60 });
    ScrollTrigger.batch(generic, {
      start: "top 90%",
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, {
          autoAlpha: 1,
          y: 0,
          duration: 1,
          stagger: 0.15,
          ease: "power4.out",
          overwrite: true,
        }),
    });

    // Titulares: cada palabra se ilumina según avanza el scroll.
    $(".section-heading h2").forEach((heading) => {
      const split = SplitText.create(heading, { type: "words" });
      gsap.fromTo(
        split.words,
        { opacity: 0.12, y: 14 },
        {
          opacity: 1,
          y: 0,
          ease: "none",
          stagger: 0.1,
          scrollTrigger: {
            trigger: heading,
            start: "top 88%",
            end: "bottom 50%",
            scrub: 0.6,
          },
        },
      );
    });

    // Tarjetas de competencias: entran en perspectiva, una tras otra.
    const capabilities = $(".capability-list article");
    gsap.set(capabilities, { autoAlpha: 0 });
    ScrollTrigger.batch(capabilities, {
      start: "top 90%",
      once: true,
      onEnter: (batch) =>
        gsap.fromTo(
          batch,
          {
            autoAlpha: 0,
            y: 110,
            rotateX: -16,
            scale: 0.92,
            transformPerspective: 900,
          },
          {
            autoAlpha: 1,
            y: 0,
            rotateX: 0,
            scale: 1,
            duration: 1.1,
            stagger: 0.16,
            ease: "power4.out",
            overwrite: true,
          },
        ),
    });

    profile();
    capabilityDetails();
    contactSection();

    // Tarjetas de proyecto: se descubren con un recorte y luego entra su contenido.
    $(".project-card").forEach((card) => {
      const kids = $(".project-meta, h2, p, .tag-list li, .text-link", card);
      gsap.set(card, { autoAlpha: 0 });
      gsap.set(kids, { autoAlpha: 0, y: 28 });
      onceTrigger({
        trigger: card,
        start: "top 88%",
        once: true,
        onEnter: () => {
          gsap
            .timeline()
            .fromTo(
              card,
              {
                autoAlpha: 0,
                y: 120,
                rotateX: -12,
                transformPerspective: 1000,
                clipPath: "inset(0 0 100% 0)",
              },
              {
                autoAlpha: 1,
                y: 0,
                rotateX: 0,
                clipPath: "inset(0 0 0% 0)",
                duration: 1.2,
                ease: "power4.out",
                clearProps: "clipPath",
              },
            )
            .to(
              kids,
              { autoAlpha: 1, y: 0, stagger: 0.07, duration: 0.8 },
              "-=0.7",
            );
        },
      });
    });

    // Cronología del CV: la línea se dibuja con el scroll y el contenido entra desde la izquierda.
    $(".timeline-item").forEach((item) => {
      const kids = [...item.children];
      gsap.set(item, { autoAlpha: 1, "--draw": 0, "--dot": 0 });
      gsap.set(kids, { autoAlpha: 0, x: -36 });
      gsap.to(item, {
        "--draw": 1,
        ease: "none",
        scrollTrigger: {
          trigger: item,
          start: "top 80%",
          end: "bottom 55%",
          scrub: true,
        },
      });
      onceTrigger({
        trigger: item,
        start: "top 86%",
        once: true,
        onEnter: () => {
          gsap.to(item, { "--dot": 1, duration: 0.7, ease: "back.out(3)" });
          gsap.to(kids, { autoAlpha: 1, x: 0, stagger: 0.1, duration: 0.9 });
        },
      });
    });

    // Listas del CV: cada línea entra en cascada.
    $(".skill-list, .detail-list").forEach((list) => {
      const items = [...list.children];
      gsap.set(items, { autoAlpha: 0, x: -28 });
      onceTrigger({
        trigger: list,
        start: "top 90%",
        once: true,
        onEnter: () =>
          gsap.to(items, { autoAlpha: 1, x: 0, stagger: 0.08, duration: 0.8 }),
      });
    });

    // Foto del CV: ligero parallax.
    const photo = $1(".cv-photo");
    if (photo) {
      gsap.to(photo, {
        yPercent: -6,
        ease: "none",
        scrollTrigger: {
          trigger: photo,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      });
    }
  };

  /* ---------- Cinta de tecnologías (reacciona a la velocidad del scroll) ---------- */

  const marquee = () => {
    const band = $1(".marquee");
    if (!band) return;
    const track = $1(".marquee-track", band);
    track.append(...[...track.children].map((child) => child.cloneNode(true)));

    gsap.from(band, {
      autoAlpha: 0,
      y: 50,
      duration: 1,
      scrollTrigger: { trigger: band, start: "top 95%", once: true },
    });

    const loop = gsap.to(track, {
      xPercent: -50,
      ease: "none",
      duration: 32,
      repeat: -1,
    });
    const skew = gsap.quickTo(track, "skewX", {
      duration: 0.5,
      ease: "power3.out",
    });
    ScrollTrigger.create({
      onUpdate: (self) => {
        const velocity = self.getVelocity();
        const direction = self.direction;
        gsap.to(loop, {
          timeScale: direction * (1 + Math.min(Math.abs(velocity) / 180, 7)),
          duration: 0.2,
          overwrite: true,
          onComplete: () =>
            gsap.to(loop, { timeScale: direction, duration: 1.2 }),
        });
        skew(gsap.utils.clamp(-12, 12, velocity / -250));
      },
      onScrollEnd: () => skew(0),
    });
  };

  /* ---------- Microinteracciones (solo con ratón) ---------- */

  const microInteractions = () => {
    if (!finePointer) return;

    // Cursor personalizado: un punto y un aro que lo sigue.
    const ring = document.createElement("div");
    const dot = document.createElement("div");
    ring.className = "cursor-ring";
    dot.className = "cursor-dot";
    [ring, dot].forEach((el) => el.setAttribute("aria-hidden", "true"));
    document.body.append(ring, dot);
    gsap.set([ring, dot], { xPercent: -50, yPercent: -50 });
    const ringX = gsap.quickTo(ring, "x", {
      duration: 0.45,
      ease: "power3.out",
    });
    const ringY = gsap.quickTo(ring, "y", {
      duration: 0.45,
      ease: "power3.out",
    });
    const dotX = gsap.quickTo(dot, "x", { duration: 0.1 });
    const dotY = gsap.quickTo(dot, "y", { duration: 0.1 });
    window.addEventListener("pointermove", (e) => {
      ringX(e.clientX);
      ringY(e.clientY);
      dotX(e.clientX);
      dotY(e.clientY);
      root.classList.add("cursor-on");
    });
    document.addEventListener("pointerover", (e) => {
      ring.classList.toggle(
        "is-active",
        Boolean(e.target.closest("a, button, .project-card")),
      );
    });
    document.addEventListener("pointerleave", () =>
      root.classList.remove("cursor-on"),
    );

    // Botones "magnéticos".
    $(".button, .nav-contact").forEach((el) => {
      const x = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
      const y = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        x((e.clientX - (r.left + r.width / 2)) * 0.3);
        y((e.clientY - (r.top + r.height / 2)) * 0.3);
      });
      el.addEventListener("pointerleave", () => {
        x(0);
        y(0);
      });
    });

    // Tarjetas de proyecto: inclinación 3D siguiendo al cursor.
    $(".project-card").forEach((card) => {
      let rx;
      let ry;
      // Los setters se crean al entrar el cursor, cuando la animación de entrada ya ha terminado.
      card.addEventListener("pointerenter", () => {
        if (rx) return;
        gsap.set(card, { transformPerspective: 1000 });
        rx = gsap.quickTo(card, "rotateX", {
          duration: 0.6,
          ease: "power3.out",
        });
        ry = gsap.quickTo(card, "rotateY", {
          duration: 0.6,
          ease: "power3.out",
        });
      });
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        if (rx) {
          ry(px * 7);
          rx(-py * 7);
        }
        card.style.setProperty("--mx", `${e.clientX - r.left}px`);
        card.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
      card.addEventListener("pointerleave", () => {
        if (rx) {
          rx(0);
          ry(0);
        }
      });
    });

    // Tarjetas de competencias: elevación y foco de luz.
    $(".capability-list article").forEach((card) => {
      card.addEventListener("pointerenter", () =>
        gsap.to(card, { y: -8, duration: 0.4, overwrite: "auto" }),
      );
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${e.clientX - r.left}px`);
        card.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
      card.addEventListener("pointerleave", () =>
        gsap.to(card, { y: 0, duration: 0.5, overwrite: "auto" }),
      );
    });

    // Enlaces de texto: la flecha se desplaza.
    $(".text-link").forEach((link) => {
      const arrow = $1("span", link);
      if (!arrow) return;
      link.addEventListener("pointerenter", () =>
        gsap.to(arrow, { x: 5, y: -5, duration: 0.3 }),
      );
      link.addEventListener("pointerleave", () =>
        gsap.to(arrow, { x: 0, y: 0, duration: 0.3 }),
      );
    });
  };

  /* ---------- Arranque ---------- */

  const start = async () => {
    const fontsReady =
      document.fonts && document.fonts.ready
        ? document.fonts.ready
        : Promise.resolve();

    // Se preparan los estados iniciales mientras los paneles tapan la página.
    chrome();
    scrollReveals();
    marquee();
    microInteractions();
    await fontsReady;
    ScrollTrigger.refresh();

    if (wasEntering) await arrive();
    else if (wasLoading) await preload(fontsReady);
    lift(intro);
    root.classList.add("anim-ready");
  };

  // Si algo falla, se descubre la página en lugar de dejarla tapada.
  start().catch(() => {
    gsap.set(cols, { yPercent: 100 });
    gsap.set([labelEl, loaderEl], { autoAlpha: 0 });
    root.classList.remove("js");
  });
})();
