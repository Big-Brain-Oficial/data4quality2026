"use strict";

(() => {
  const view = byId("situacion-mundial");
  const cardInterval = 5000;
  const rotationPeriod = 60000;
  let cardHovered = false;
  let globeHovered = false;
  let cardVisible = false;
  let globeVisible = false;
  let elapsed = 0;
  let frame = 0;
  let lastTime = 0;
  let lastPaint = 0;
  let interactionUntil = 0;
  let signature = "";
  let deck = [];
  let cursor = 0;

  function refreshDeck() {
    const results = filteredCases();
    const key = results.map(item => item.id).join(",");
    if (signature !== key) {
      signature = key;
      const groups = new Map();
      for (const item of results) {
        if (!groups.has(item.country)) groups.set(item.country, []);
        groups.get(item.country).push(item);
      }
      // Give every country a turn before returning to another of its cases.
      const rounds = Math.max(0, ...Array.from(groups.values(), group => group.length));
      deck = [];
      for (let round = 0; round < rounds; round++) {
        for (const group of groups.values()) deck.push(group[round % group.length]);
      }
      cursor = 0;
    }
    if (deck[cursor]?.id !== selectedCase?.id) cursor = Math.max(0, deck.findIndex(item => item.id === selectedCase?.id));
    elapsed = 0;
  }

  function advance(direction) {
    if (!deck.length) return;
    cursor = (cursor + direction + deck.length) % deck.length;
    selectedCase = deck[cursor];
    renderMapCase();
    scheduleGlobe();
  }

  function canRun() {
    return !reducedMotion.matches && !view.hidden && !document.hidden && (cardVisible || globeVisible);
  }

  function reading() {
    return cardHovered || mapCase.contains(document.activeElement);
  }

  function tick(now) {
    frame = 0;
    if (!canRun()) { sync(); return; }
    const delta = lastTime ? Math.min(now - lastTime, 100) : 0;
    lastTime = now;
    const interacting = now < interactionUntil || drag !== null;
    if (globeVisible && !globeHovered && !globeStage.contains(document.activeElement) && !reading() && !interacting) {
      position.longitude = wrapLongitude(position.longitude + delta * 360 / rotationPeriod);
      if (now - lastPaint >= 33) { scheduleGlobe(); lastPaint = now; }
    }
    if (cardVisible && !showCaseDetails && !reading() && !globeHovered && !globeStage.contains(document.activeElement) && !interacting && deck.length > 1) {
      elapsed += delta;
      if (elapsed >= cardInterval) { advance(1); return; }
    }
    frame = requestAnimationFrame(tick);
  }

  function sync() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    if (canRun()) frame = requestAnimationFrame(tick);
  }

  document.addEventListener("world-case-change", () => { refreshDeck(); sync(); });
  mapCase.addEventListener("pointerenter", event => { if (event.pointerType === "mouse") { cardHovered = true; sync(); } });
  mapCase.addEventListener("pointerleave", () => { cardHovered = false; sync(); });
  globeStage.addEventListener("pointerenter", event => { if (event.pointerType === "mouse") { globeHovered = true; sync(); } });
  globeStage.addEventListener("pointerleave", () => { globeHovered = false; sync(); });
  for (const element of [mapCase, globeStage]) {
    element.addEventListener("focusin", sync);
    element.addEventListener("focusout", () => queueMicrotask(sync));
  }
  for (const event of ["pointerdown", "keydown", "change"]) {
    view.addEventListener(event, () => { interactionUntil = performance.now() + 1200; });
  }
  window.addEventListener("hashchange", sync);
  document.addEventListener("visibilitychange", sync);
  reducedMotion.addEventListener("change", () => {
    mapCase.setAttribute("aria-live", showCaseDetails || reducedMotion.matches ? "polite" : "off");
    if (reducedMotion.matches) mapCase.getAnimations().forEach(animation => animation.cancel());
    sync();
  });
  const visibility = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.target === mapCase) cardVisible = entry.isIntersecting && entry.intersectionRatio >= .25;
      else globeVisible = entry.isIntersecting && entry.intersectionRatio >= .25;
    }
    sync();
  }, { threshold: 0.25 });
  visibility.observe(mapCase);
  visibility.observe(globeStage);
  refreshDeck();
  sync();
})();
