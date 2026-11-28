"use strict";

// The narrative and the detailed views share the same frozen records.
(() => {
  const rows = [...argentina].sort((a, b) => a.service.localeCompare(b.service) || a.reported.localeCompare(b.reported));
  const dayCount = new Set(rows.map(record => record.reported.slice(0, 10))).size;
  byId("story-scope").textContent = `${rows.length} avisos argentinos · ${dayCount} días con reportes · 4–24 nov. 2026`;

  const point = rows.filter(record => record.service === "point");
  const qr = rows.filter(record => record.service === "qr");
  const span = records => {
    const values = records.map(record => Math.round(record.minutes));
    const low = Math.min(...values), high = Math.max(...values);
    return low === high ? `≈ ${low} min` : `${low}–${high} min`;
  };
  for (const [label, records] of [["Point", point], ["QR", qr]]) {
    const comparison = node("span", "finding-comparison");
    comparison.append(node("span", "small", `${label} · ${records.length} avisos`), node("strong", "", span(records)));
    byId("story-finding").append(comparison);
  }
  byId("story-sample").textContent = `${incidents.length} avisos en total: ${argentina.length} de Argentina, ${scopedRecords("all").length} globales (ALL SITES), ${scopedRecords("unspecified").length} sin país indicado y ${scopedRecords("other").length} de otros países. La comparación principal utiliza únicamente los ${argentina.length} de Argentina.`;

  const time = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZone: "America/Argentina/Buenos_Aires" });
  const buttons = new Map();
  function select(record, disclose = true) {
    for (const [id, item] of buttons) press(item, id === record.id);
    byId("story-incident-detail").replaceChildren(
      node("strong", "", `${services[record.service].label}: ${record.title}`),
      node("p", "", `Publicado: ${time.format(new Date(record.reported))}. Resolución informada: ${time.format(new Date(record.resolved))}. Hora argentina (UTC−3). Intervalo: ${decimal.format(record.minutes)} minutos.`),
      externalLink(`https://status.mercadopago.com/incidents/${record.id}`, "Abrir el aviso original")
    );
    if (disclose) byId("incident-disclosure").open = true;
  }

  for (const record of rows) {
    const item = button("interval-row");
    const label = node("span", "interval-label");
    label.append(node("strong", "", `${services[record.service].label} · ${duration(record.minutes)}`), node("span", "", `${record.day} nov. · ${record.reported.slice(11, 16)}`));
    const plot = node("span", "interval-plot");
    plot.setAttribute("aria-hidden", "true");
    plot.style.setProperty("--duration", `${record.minutes / 150 * 100}%`);
    plot.append(node("span", "interval-bar"));
    item.append(label, plot);
    item.addEventListener("click", () => select(record));
    item.dataset.incident = record.id;
    item.style.setProperty("--row-delay", `${buttons.size * 55}ms`);
    buttons.set(record.id, item);
    byId("story-intervals").append(item);
  }

  const slider = byId("story-minutes");
  const readout = byId("story-readout");
  const countDisplay = node("strong", "clock-count");
  readout.append(countDisplay, node("span", "", ` de ${rows.length} avisos sin resolución informada`));
  function updateClock() {
    const minutes = Number(slider.value);
    const open = rows.filter(record => record.minutes > minutes).length;
    const label = `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
    byId("story-minutes-value").textContent = label;
    slider.setAttribute("aria-valuetext", label);
    countDisplay.textContent = open;
    for (const preset of document.querySelectorAll("[data-minute]")) press(preset, Number(preset.dataset.minute) === minutes);
    byId("story-intervals").style.setProperty("--marker", `${minutes / 150 * 100}%`);
    for (const record of rows) {
      const item = buttons.get(record.id);
      const stillOpen = record.minutes > minutes;
      item.dataset.open = String(stillOpen);
      item.setAttribute("aria-label", `${services[record.service].label}, ${record.day} de noviembre a las ${record.reported.slice(11, 16)}, intervalo ${duration(record.minutes)}. ${stillOpen ? "Sin resolución informada" : "Con resolución informada"} a los ${label}. Ver detalle.`);
    }
  }
  const playButton = byId("play-clock");
  let clockFrame = 0;
  let playing = false;
  function stopClock() {
    cancelAnimationFrame(clockFrame);
    playing = false;
    playButton.textContent = "Reproducir el tiempo";
    press(playButton, false);
    readout.setAttribute("aria-live", "polite");
  }
  playButton.addEventListener("click", () => {
    if (playing) { stopClock(); return; }
    const startMinute = Number(slider.value) >= 150 ? 0 : Number(slider.value);
    slider.value = String(startMinute);
    updateClock();
    playing = true;
    playButton.textContent = "Pausar";
    press(playButton, true);
    readout.setAttribute("aria-live", "off");
    const start = performance.now();
    function tick(now) {
      const minute = Math.min(150, startMinute + Math.floor((now - start) / 100));
      if (Number(slider.value) !== minute) { slider.value = String(minute); updateClock(); }
      if (minute < 150) clockFrame = requestAnimationFrame(tick);
      else { stopClock(); updateClock(); }
    }
    clockFrame = requestAnimationFrame(tick);
  });
  slider.addEventListener("input", () => { stopClock(); updateClock(); });
  for (const preset of document.querySelectorAll("[data-minute]")) {
    preset.addEventListener("click", () => { stopClock(); slider.value = preset.dataset.minute; updateClock(); });
  }
  window.addEventListener("hashchange", stopClock);
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopClock(); });
  function motionPreference() {
    if (reducedMotion.matches) stopClock();
    playButton.hidden = reducedMotion.matches;
  }
  reducedMotion.addEventListener("change", motionPreference);
  motionPreference();
  updateClock();
  select(point[0] ?? rows[0], false);

  if ("IntersectionObserver" in window) {
    const storyBlocks = document.querySelectorAll("#vista-general > :is(.hero, .story-block, .story-data)");
    const reveal = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("reveal-visible");
          reveal.unobserve(entry.target);
        }
      }
    }, { threshold: 0.06 });
    for (const block of storyBlocks) reveal.observe(block);
    const clockVisibility = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting && playing) stopClock();
    });
    clockVisibility.observe(byId("story-intervals"));
  }

  byId("download-evidence").addEventListener("click", () => {
    const evidence = {
      source: "https://status.mercadopago.com/api/v2/incidents.json",
      cutoff: "2026-11-26",
      period: { first_date: "2026-11-04", last_date: "2026-11-24", calendar_dates: 21 },
      timezone: "America/Argentina/Buenos_Aires",
      description: "Registros normalizados incorporados al sitio. No es la respuesta íntegra original de la API.",
      fields: { reported: "created_at de la API", resolved: "resolved_at de la API", service: "Categoría de servicio asignada al incidente", scope: "ar = Argentina (MLA); all = ALL SITES; unspecified = sin país; other = otro país" },
      formula: "minutes = (Date.parse(resolved) - Date.parse(reported)) / 60000",
      limitations: ["Muestra de avisos recientes, no monitoreo exhaustivo", "Intervalos publicados, no tiempo real de caída", "Sin datos de usuarios ni pagos afectados", "No permite estimar disponibilidad real"],
      incidents: embedded("incident-data")
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(evidence, null, 2)], { type: "application/json;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "mercado-pago-muestra-2026-11-26.json";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
})();
