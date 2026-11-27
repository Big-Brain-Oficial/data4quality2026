"use strict";

// Portada: situación, simulación del pago que falla y caso real. Después se abre el resto.
(() => {
  const phone = byId("payment-scene");
  const screens = new Map([...phone.querySelectorAll("[data-screen]")].map(screen => [screen.dataset.screen, screen]));
  const announcer = byId("payment-announcer");
  const phoneStage = phone.closest(".phone-stage");
  const openButton = byId("open-story");
  const pendingMessage = byId("pending-message");
  const pendingTime = byId("pending-time");
  const failedNote = byId("failed-attempt");
  const clock = byId("phone-clock");
  // Horario del relato: la llamada fue a las 13 y a las 17 seguía sin solución.
  const failureTimes = ["13:00", "14:30", "17:00"];
  let attempts = 0;
  let timers = [];

  function later(delay, action) {
    timers.push(setTimeout(action, delay));
  }

  function clearTimers() {
    for (const timer of timers) clearTimeout(timer);
    timers = [];
  }

  function show(name, announcement) {
    const hadFocus = phone.contains(document.activeElement);
    clearTimers();
    phone.dataset.state = name;
    for (const [key, screen] of screens) screen.hidden = key !== name;
    announcer.textContent = announcement;
    if (!hadFocus) return;
    const screen = screens.get(name);
    (screen.matches("[data-focus]") ? screen : screen.querySelector("[data-focus]"))?.focus({ preventScroll: true });
  }

  function home() {
    show("home", "Pantalla de inicio del banco simulado.");
  }

  function review() {
    if (!attempts) clock.textContent = "12:59";
    show("confirm", "Confirmá la transferencia de 285.000 libras.");
  }

  function pay() {
    const duration = reducedMotion.matches ? 900 : attempts ? 3200 : 5200;
    const start = Date.now();
    if (!attempts) clock.textContent = "13:00";
    pendingMessage.textContent = "Conectando con el banco";
    pendingTime.textContent = "0 s";
    show("pending", "Enviando la transferencia.");
    later(duration * .28, () => { pendingMessage.textContent = "Esperando confirmación"; });
    later(duration * .58, () => { pendingMessage.textContent = "Está tardando más de lo normal"; });
    for (let second = 1; second * 1000 < duration; second++) {
      later(second * 1000, () => { pendingTime.textContent = `${Math.round((Date.now() - start) / 1000)} s`; });
    }
    later(duration, fail);
  }

  function fail() {
    attempts++;
    clock.textContent = failureTimes[Math.min(attempts, failureTimes.length) - 1];
    failedNote.textContent = attempts === 1 ? "El banco tiene problemas técnicos." : `Intento ${attempts}: el banco sigue con problemas.`;
    show("failed", `No salió el pago. ${failedNote.textContent} Tu dinero no se movió.`);
    if (!reducedMotion.matches && navigator.userActivation?.hasBeenActive) navigator.vibrate?.([90, 60, 140]);
    revealCase();
  }

  const actions = { review, pay, retry: pay, home };
  phone.addEventListener("click", event => {
    const target = event.target.closest("[data-action]");
    if (target) actions[target.dataset.action]();
  });
  clock.textContent = "12:58";

  // Portada cerrada: la situación, después el celular solo y, cuando falla, el caso real al costado.
  // El resto se abre con el botón del caso o con un enlace directo a una sección.
  const intro = byId("intro");
  const hero = phone.closest(".hero");
  const casePanel = byId("case-panel");
  let closed = true;
  let step = "intro";
  let revealed = false;

  function worldRequested() {
    return location.hash === "#situacion-mundial" || location.hash === "#mundo";
  }

  function sectionRequested() {
    const target = byId(location.hash.slice(1));
    return Boolean(target) && target !== storyView && storyView.contains(target) && !target.closest(".scene, .hero");
  }

  function syncGate() {
    if (!closed) {
      step = "phone";
      revealed = true;
    }
    document.body.classList.toggle("gate-closed", closed && !worldRequested());
    intro.hidden = step !== "intro";
    hero.hidden = step !== "phone";
    hero.classList.toggle("revealed", revealed);
    casePanel.hidden = !revealed;
  }

  function startSimulation() {
    step = "phone";
    syncGate();
    window.scrollTo({ top: 0, behavior: "instant" });
    screens.get("home").querySelector("[data-focus]").focus({ preventScroll: true });
  }

  function revealCase() {
    if (revealed) return;
    const before = phoneStage.getBoundingClientRect();
    revealed = true;
    syncGate();
    if (!reducedMotion.matches) {
      // El celular se desliza desde donde estaba hasta su nuevo lugar.
      const after = phoneStage.getBoundingClientRect();
      const shift = before.left + before.width / 2 - after.left - after.width / 2;
      phoneStage.animate([{ transform: `translate(${shift}px, ${before.top - after.top}px)` }, { transform: "none" }],
        { duration: 900, easing: "cubic-bezier(.65, 0, .35, 1)" });
    }
    byId("overview-title").focus({ preventScroll: true });
    // En pantallas angostas el caso queda debajo del celular: se baja después de ver el error.
    if (window.matchMedia("(max-width: 760px)").matches) {
      setTimeout(() => casePanel.scrollIntoView({ block: "start", behavior: reducedMotion.matches ? "instant" : "smooth" }), 1600);
    }
  }

  function openStory() {
    closed = false;
    syncGate();
    const heading = byId("story-evidence");
    heading.focus({ preventScroll: true });
    heading.closest(".story-block").scrollIntoView({ block: "start", behavior: reducedMotion.matches ? "instant" : "smooth" });
  }

  byId("start-sim").addEventListener("click", startSimulation);
  openButton.addEventListener("click", openStory);

  // Enter funciona como "siguiente": adelanta el próximo texto y los demás conservan la pausa.
  // Cuando ya están todos, avanza con el botón de la pantalla.
  function waitingAnimations(scene) {
    return [...scene.querySelectorAll("*")].flatMap(item => item.getAnimations())
      .filter(animation => animation.animationName !== "gate-pulse" && animation.currentTime < animation.effect.getTiming().delay);
  }

  document.addEventListener("keydown", event => {
    if (event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey || !closed || worldRequested()) return;
    const scene = step === "intro" ? intro : revealed ? casePanel : null;
    if (!scene) return;
    if (event.repeat) {
      event.preventDefault();
      return;
    }
    const waiting = waitingAnimations(scene);
    const control = event.target.closest("a, button");
    // Un botón o enlace a la vista (por ejemplo, Reintentar) hace lo suyo.
    if (control && !waiting.some(animation => animation.effect.target === control)) return;
    event.preventDefault();
    if (!waiting.length) {
      scene.querySelector(".gate-button").click();
      return;
    }
    const jump = Math.min(...waiting.map(animation => animation.effect.getTiming().delay - animation.currentTime)) + 1;
    for (const animation of scene.getAnimations({ subtree: true })) {
      if (animation.playState !== "finished") animation.currentTime += jump;
    }
  });
  // En captura: la sección tiene que estar visible antes de que la navegación le dé el foco.
  window.addEventListener("hashchange", () => {
    if (sectionRequested()) closed = false;
    syncGate();
  }, { capture: true });

  if (sectionRequested()) closed = false;
  syncGate();
})();
