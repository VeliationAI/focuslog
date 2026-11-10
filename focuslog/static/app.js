(() => {
  const CIRC = 2 * Math.PI * 104;
  const BASE_TITLE = "Focus Log — Know what steals your attention";
  const CATEGORY_LABELS = {
    chat: "Chat / Slack",
    social: "Social",
    email: "Email",
    phone: "Phone",
    web: "Web",
    meetings: "Meetings",
    people: "People",
    environment: "Environment",
    other: "Other",
  };

  // Keyword → category, so most pulls need zero extra clicks.
  const CATEGORY_HINTS = [
    ["chat", /slack|teams|discord|dm\b|chat|message|ping|whatsapp|telegram/i],
    ["social", /twitter|\bx\b|reddit|instagram|tiktok|youtube|facebook|linkedin|social|scroll|feed|shorts?/i],
    ["email", /e-?mail|inbox|gmail|outlook/i],
    ["phone", /phone|text|call|notification|buzz|unlock/i],
    ["meetings", /meeting|standup|zoom|invite|call with/i],
    ["people", /coworker|colleague|boss|someone|person|kid|family|partner|stopped by|question/i],
    ["environment", /noise|snack|coffee|water|hungry|tired|cold|hot|loud|bathroom|food/i],
    ["web", /tab|browse|google|search|news|curios|web|website|wiki/i],
  ];

  const els = {
    ringWrap: document.querySelector(".ring-wrap"),
    ringProgress: document.querySelector(".ring-progress"),
    kind: document.getElementById("timer-kind"),
    digits: document.getElementById("timer-digits"),
    label: document.getElementById("timer-label"),
    heroStatus: document.getElementById("hero-status"),
    loopTrack: document.getElementById("loop-track"),
    startForm: document.getElementById("start-form"),
    activeActions: document.getElementById("active-actions"),
    minutes: document.getElementById("minutes"),
    presets: Array.from(document.querySelectorAll(".preset")),
    workLabel: document.getElementById("label"),
    btnStart: document.getElementById("btn-start"),
    btnBreak: document.getElementById("btn-break"),
    btnDone: document.getElementById("btn-done"),
    btnAbort: document.getElementById("btn-abort"),
    pullCard: document.getElementById("distract-section"),
    pullSub: document.getElementById("pull-sub"),
    pullCount: document.getElementById("pull-count"),
    distractForm: document.getElementById("distract-form"),
    reason: document.getElementById("reason"),
    presetCustom: document.getElementById("preset-custom"),
    customWrap: document.getElementById("custom-wrap"),
    labelToggle: document.getElementById("label-toggle"),
    labelWrap: document.getElementById("label-wrap"),
    emptyWeekText: document.getElementById("empty-week-text"),
    emptyStart: document.getElementById("empty-start"),
    toast: document.getElementById("toast"),
    weekRange: document.getElementById("week-range"),
    weekPrev: document.getElementById("week-prev"),
    weekNext: document.getElementById("week-next"),
    weekBody: document.getElementById("week-body"),
    emptyWeek: document.getElementById("empty-week"),
    mFocus: document.getElementById("m-focus"),
    mCompletion: document.getElementById("m-completion"),
    mDistractions: document.getElementById("m-distractions"),
    dayBars: document.getElementById("day-bars"),
    topReasons: document.getElementById("top-reasons"),
    topCategories: document.getElementById("top-categories"),
    recent: document.getElementById("recent-distractions"),
    recentSessions: document.getElementById("recent-sessions"),
    btnSeed: document.getElementById("btn-seed"),
    insightBanner: document.getElementById("insight-banner"),
    insightKicker: document.getElementById("insight-kicker"),
    insightHeadline: document.getElementById("insight-headline"),
    insightBody: document.getElementById("insight-body"),
    allTime: document.getElementById("all-time"),
    quickChips: document.getElementById("quick-chips"),
  };

  const IDLE_LINE = "A focus timer that shows what keeps breaking your focus.";
  const IDLE_PULL_HINT = "Tap what it was. One tap logs it. <kbd>/</kbd> jumps here.";
  const PRESET_MINUTES = ["15", "25", "50"];

  let activeSession = null;
  let blockPulls = 0;
  let afterBlockLine = "";
  let tickTimer = null;
  let toastTimer = null;
  let weeksAgo = 0;
  let overviewCache = null;

  els.ringProgress.style.strokeDasharray = String(CIRC);

  /* ——— helpers ——— */

  function formatDuration(seconds) {
    const s = Math.max(0, Math.floor(seconds || 0));
    if (s < 60) return `${s}s`;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h) return `${h}h ${String(m).padStart(2, "0")}m`;
    return `${m}m`;
  }

  function formatClock(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }

  function categoryLabel(key) {
    return CATEGORY_LABELS[key] || String(key || "other").replaceAll("_", " ");
  }

  function guessCategory(reason) {
    const hit = CATEGORY_HINTS.find(([, re]) => re.test(reason));
    return hit ? hit[0] : "other";
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function plural(n, one, many) {
    return `${n} ${n === 1 ? one : many}`;
  }

  function showToast(message, isError = false) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.toggle("error", isError);
    els.toast.classList.remove("hidden", "show");
    void els.toast.offsetWidth;
    els.toast.classList.add("show");
    toastTimer = setTimeout(() => els.toast.classList.add("hidden"), isError ? 4000 : 2200);
  }

  function fail(err) {
    showToast(err && err.message ? err.message : "Something went wrong. Try again.", true);
  }

  async function api(path, options = {}) {
    let res;
    try {
      res = await fetch(path, {
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        ...options,
      });
    } catch {
      throw new Error("Can't reach the server. Check your connection.");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = data.detail;
      throw new Error(typeof detail === "string" ? detail : "Request failed");
    }
    return data;
  }

  function setLoopStep(current) {
    const order = ["protect", "log", "read"];
    const idx = order.indexOf(current);
    els.loopTrack.querySelectorAll("li").forEach((li) => {
      const i = order.indexOf(li.dataset.step);
      li.classList.toggle("is-current", i === idx);
      li.classList.toggle("is-done", i < idx);
    });
  }

  function currentMinutes() {
    return Math.min(180, Math.max(1, Number(els.minutes.value) || 25));
  }

  function setCustomOpen(open) {
    els.customWrap.classList.toggle("hidden", !open);
    els.presetCustom.setAttribute("aria-expanded", String(open));
  }

  function syncPresets() {
    const m = String(Number(els.minutes.value) || "");
    const isPreset = PRESET_MINUTES.includes(m);
    els.presets.forEach((btn) => {
      if (!btn.dataset.minutes) return;
      const on = btn.dataset.minutes === m;
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", String(on));
    });
    const customOpen = !els.customWrap.classList.contains("hidden");
    els.presetCustom.classList.toggle("is-on", customOpen || !isPreset);
    els.btnStart.textContent = `Start ${currentMinutes()} min focus`;
    if (!activeSession) els.digits.textContent = formatClock(currentMinutes() * 60);
  }

  function setLabelOpen(open) {
    els.labelWrap.classList.toggle("hidden", !open);
    els.labelToggle.setAttribute("aria-expanded", String(open));
    els.labelToggle.textContent = open ? "− Hide name" : "+ Name this block";
  }

  /* ——— timer UI ——— */

  function setIdleUI() {
    activeSession = null;
    clearInterval(tickTimer);
    tickTimer = null;
    document.title = BASE_TITLE;
    document.body.dataset.mode = "idle";
    els.ringWrap.dataset.state = "idle";
    els.kind.textContent = "Ready";
    els.digits.textContent = formatClock(currentMinutes() * 60);
    els.label.textContent = "Press start when ready";
    if (afterBlockLine) {
      els.heroStatus.innerHTML = `${escapeHtml(afterBlockLine)} <a href="#analytics">See your week ↓</a>`;
      afterBlockLine = "";
    } else {
      els.heroStatus.textContent = IDLE_LINE;
    }
    els.ringProgress.style.strokeDashoffset = "0";
    els.startForm.classList.remove("hidden");
    els.activeActions.classList.add("hidden");
    els.btnDone.classList.remove("ready");
    els.pullCard.classList.remove("is-live");
    els.pullSub.innerHTML = IDLE_PULL_HINT;
    els.pullCount.classList.add("hidden");
    els.btnStart.textContent = `Start ${currentMinutes()} min focus`;
    setLoopStep("protect");
  }

  function renderActive() {
    if (!activeSession) return;
    const started = new Date(activeSession.started_at).getTime();
    const planned = activeSession.planned_minutes * 60;
    const elapsed = Math.max(0, (Date.now() - started) / 1000);
    const left = Math.max(0, planned - elapsed);
    const progress = Math.min(1, elapsed / planned);
    const isBreak = activeSession.kind === "break";

    els.ringWrap.dataset.state = isBreak ? "break" : "active";
    els.kind.textContent = isBreak ? "Break" : "Focus";
    els.digits.textContent = formatClock(left);
    els.label.textContent = activeSession.label || (isBreak ? "Step away" : "Stay with it");
    els.ringProgress.style.strokeDashoffset = String(CIRC * progress);
    els.startForm.classList.add("hidden");
    els.activeActions.classList.remove("hidden");
    els.btnDone.textContent = isBreak ? "End break" : "Finish block";
    els.btnAbort.classList.toggle("hidden", isBreak);
    document.title = `${formatClock(left)} · ${isBreak ? "Break" : "Focus"} — Focus Log`;

    document.body.dataset.mode = isBreak ? "break" : "focus";
    if (isBreak) {
      els.heroStatus.textContent = "Break time. Step away, then come back.";
      els.pullCard.classList.remove("is-live");
      els.pullSub.innerHTML = IDLE_PULL_HINT;
      setLoopStep("protect");
    } else {
      els.heroStatus.textContent = "Focus is on. If something pulls you away, tap it below.";
      els.pullCard.classList.add("is-live");
      els.pullSub.textContent = "Tap what pulled you away.";
      setLoopStep("log");
      renderPullCount();
    }

    if (left <= 0) {
      clearInterval(tickTimer);
      tickTimer = null;
      els.kind.textContent = "Time";
      els.digits.textContent = "00:00";
      els.label.textContent = isBreak ? "Break over." : "Time’s up. Finish to save it.";
      els.btnDone.classList.add("ready");
      document.title = "Time’s up — Focus Log";
    }
  }

  function renderPullCount() {
    if (!activeSession || activeSession.kind === "break") {
      els.pullCount.classList.add("hidden");
      return;
    }
    els.pullCount.textContent = blockPulls
      ? `${plural(blockPulls, "pull", "pulls")} this block`
      : "None yet";
    els.pullCount.classList.remove("hidden");
  }

  // Server truth for this block's pulls; runs after each refresh.
  function syncBlockPulls() {
    if (!activeSession || activeSession.kind === "break" || !overviewCache) {
      blockPulls = 0;
      return;
    }
    const startedAt = new Date(activeSession.started_at).getTime();
    const serverCount = (overviewCache.recent_distractions || []).filter(
      (d) => new Date(d.logged_at).getTime() >= startedAt
    ).length;
    // recent_distractions is capped, so never let a refresh lower an optimistic count.
    blockPulls = Math.max(blockPulls, serverCount);
    renderPullCount();
  }

  function startTicker() {
    clearInterval(tickTimer);
    renderActive();
    tickTimer = setInterval(renderActive, 250);
  }

  /* ——— render data ——— */

  function renderInsight(insight, weekIsEmpty) {
    // The empty state already says "start a block"; a second banner is just noise.
    if (!insight || weekIsEmpty) {
      els.insightBanner.classList.add("hidden");
      return;
    }
    const tone = insight.tone || insight.severity || "idle";
    els.insightBanner.classList.remove("hidden");
    els.insightBanner.dataset.tone = tone;
    els.insightKicker.textContent =
      { coach: "Fix this first", win: "Nice work", idle: "Start here" }[tone] || "This week";
    els.insightHeadline.textContent = insight.headline;
    els.insightBody.textContent = insight.body;
  }

  function renderAllTime(overview) {
    const a = overview.all_time || {};
    if (!a.sessions && !a.distractions) {
      els.allTime.hidden = true;
      return;
    }
    const parts = [];
    if (overview.streak_days) parts.push(`${plural(overview.streak_days, "day", "days")} in a row`);
    parts.push(`${formatDuration(a.focus_seconds)} focused all time`);
    parts.push(`${plural(a.distractions || 0, "pull", "pulls")} logged`);
    els.allTime.textContent = parts.join(" · ");
    els.allTime.hidden = false;
  }

  function renderReport(report) {
    const t = report.totals;
    const empty = !t.sessions && !t.distractions;
    const hasAnyData = Boolean(overviewCache && (overviewCache.all_time.sessions || overviewCache.all_time.distractions));

    els.weekRange.textContent = formatWeekRange(report.week_start, report.week_end, weeksAgo);
    els.weekNext.disabled = weeksAgo <= 0;
    els.weekPrev.disabled = false;
    // Empty weeks show one clear next step instead of a grid of dashes.
    els.weekBody.classList.toggle("hidden", empty);
    els.emptyWeek.classList.toggle("hidden", !empty);
    // The coach card is about the current week only.
    renderInsight(overviewCache && overviewCache.insight, empty || weeksAgo > 0);
    // Demo seeding only works on a fully empty log, so only offer it then.
    els.btnSeed.classList.toggle("hidden", hasAnyData);
    els.emptyStart.classList.toggle("hidden", weeksAgo > 0);
    if (empty) {
      els.emptyWeekText.innerHTML = weeksAgo
        ? "<strong>Nothing logged that week.</strong> Use ← → to find a week with data."
        : "<strong>Nothing here yet.</strong> Run one block and tap a pull or two. Your week fills in here.";
    }

    els.mFocus.textContent = formatDuration(t.focus_seconds);
    els.mCompletion.textContent = t.sessions ? `${t.completed}/${t.sessions}` : "—";
    els.mDistractions.textContent = String(t.distractions);

    const maxFocus = Math.max(1, ...report.day_series.map((d) => d.focus_seconds));
    const maxDistract = Math.max(1, ...report.day_series.map((d) => d.distractions));

    els.dayBars.innerHTML = report.day_series
      .map((d, i) => {
        const fh = Math.max(d.focus_seconds ? 8 : 2, Math.round((d.focus_seconds / maxFocus) * 100));
        const dh = d.distractions ? Math.max(6, Math.round((d.distractions / maxDistract) * 28)) : 0;
        return `
          <div class="bar-col" title="${escapeHtml(d.day)}: ${formatDuration(d.focus_seconds)} focus, ${plural(d.distractions, "pull", "pulls")}">
            <div class="bar-stack">
              <div class="bar distract" style="height:${dh}px; animation-delay:${i * 40}ms"></div>
              <div class="bar focus" style="height:${fh}px; animation-delay:${i * 40 + 40}ms"></div>
            </div>
            <span class="bar-day">${escapeHtml(d.weekday)}</span>
          </div>`;
      })
      .join("");

    if (!report.top_reasons.length) {
      els.topReasons.innerHTML = `<li class="empty" style="display:block;border:0">No pulls yet. Tap one above when focus breaks.</li>`;
    } else {
      els.topReasons.innerHTML = report.top_reasons
        .slice(0, 5)
        .map(
          (r, i) => `
          <li style="animation-delay:${i * 50}ms">
            <span class="n">${i + 1}</span>
            <span>${escapeHtml(r.reason)} <span class="meta">${escapeHtml(categoryLabel(r.category))}</span></span>
            <span class="meta">${r.count}×</span>
          </li>`
        )
        .join("");
    }

    const maxCat = Math.max(1, ...report.top_categories.map((c) => c.count));
    if (!report.top_categories.length) {
      els.topCategories.innerHTML = `<p class="empty">Categories appear as you log pulls.</p>`;
    } else {
      els.topCategories.innerHTML = report.top_categories
        .map(
          (c, i) => `
          <div class="cat-row">
            <span>${escapeHtml(categoryLabel(c.category))}</span>
            <div class="cat-track"><div class="cat-fill" style="width:${Math.round((c.count / maxCat) * 100)}%; animation-delay:${i * 60}ms"></div></div>
            <span class="count">${c.count}</span>
          </div>`
        )
        .join("");
    }

    const recent = (report.recent_distractions || []).slice(0, 8);
    els.recent.innerHTML = recent.length
      ? recent
          .map(
            (d) => `
            <li>
              <span>${escapeHtml(d.reason)} <span class="meta">${escapeHtml(categoryLabel(d.category))}</span></span>
              <span class="meta">${formatStamp(d.logged_at)}</span>
            </li>`
          )
          .join("")
      : `<li class="empty" style="display:block;border:0">Nothing logged this week yet.</li>`;

    const sessions = (report.recent_sessions || []).filter((s) => s.kind === "focus").slice(0, 6);
    els.recentSessions.innerHTML = sessions.length
      ? sessions
          .map(
            (s) => `
            <li>
              <span>${escapeHtml(s.label || "Focus")} <span class="meta">${escapeHtml(s.status)} · ${formatDuration(s.focus_seconds)}</span></span>
              <span class="meta">${formatStamp(s.started_at)}</span>
            </li>`
          )
          .join("")
      : `<li class="empty" style="display:block;border:0">No blocks this week yet.</li>`;
  }

  function formatStamp(iso) {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatWeekRange(startIso, endIso, ago) {
    const fmt = (iso) =>
      new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const range = `${fmt(startIso)} – ${fmt(endIso)}`;
    return ago === 0 ? `This week · ${range}` : range;
  }

  /* ——— data flow ——— */

  async function refresh() {
    const overview = await api("/api/overview");
    overviewCache = overview;
    activeSession = overview.active_session;
    if (activeSession) startTicker();
    else setIdleUI();

    renderAllTime(overview);
    syncBlockPulls();

    const report = weeksAgo === 0 ? overview.week : await api(`/api/report?weeks_ago=${weeksAgo}`);
    renderReport(report);
  }

  async function loadWeek(delta) {
    const target = Math.max(0, weeksAgo + delta);
    if (target === weeksAgo) return;
    try {
      const report = target === 0 && overviewCache ? overviewCache.week : await api(`/api/report?weeks_ago=${target}`);
      weeksAgo = target;
      renderReport(report);
    } catch (err) {
      fail(err);
    }
  }

  async function logDistraction(reason, category) {
    const clean = String(reason || "").trim();
    if (!clean) return;
    const resolved = category || guessCategory(clean);

    // Optimistic: confirm instantly, then reconcile with the server.
    const counting = Boolean(activeSession && activeSession.kind === "focus");
    if (counting) {
      blockPulls += 1;
      renderPullCount();
    }
    showToast(`Logged · ${clean} (${categoryLabel(resolved)})`);
    if (navigator.vibrate) navigator.vibrate(12);

    try {
      await api("/api/distract", {
        method: "POST",
        body: JSON.stringify({ reason: clean, category: resolved }),
      });
    } catch (err) {
      if (counting) {
        blockPulls = Math.max(0, blockPulls - 1);
        renderPullCount();
      }
      throw err;
    }
    // Weekly numbers update in the background; the tap is already confirmed.
    refresh().catch(() => {});
  }

  function flashButton(btn) {
    btn.classList.remove("is-hit");
    void btn.offsetWidth;
    btn.classList.add("is-hit");
  }

  async function startSession(payload, message) {
    const data = await api("/api/session/start", { method: "POST", body: JSON.stringify(payload) });
    activeSession = data.session;
    blockPulls = 0;
    startTicker();
    showToast(message);
    // Prime the pull counter without blocking the UI.
    refresh().catch(() => {});
  }

  /* ——— events ——— */

  els.startForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const minutes = currentMinutes();
    els.minutes.value = String(minutes);
    els.btnStart.disabled = true;
    try {
      await startSession(
        { minutes, label: els.workLabel.value.trim(), kind: "focus" },
        `Focus started · ${minutes} min. Tap a pull below if you drift.`
      );
      els.workLabel.value = "";
      setLabelOpen(false);
    } catch (err) {
      fail(err);
    } finally {
      els.btnStart.disabled = false;
    }
  });

  els.btnBreak.addEventListener("click", async () => {
    try {
      await startSession({ minutes: 5, label: "Break", kind: "break" }, "5 minute break started");
    } catch (err) {
      fail(err);
    }
  });

  els.btnDone.addEventListener("click", async () => {
    const wasBreak = activeSession && activeSession.kind === "break";
    const pulls = blockPulls;
    try {
      await api("/api/session/done", { method: "POST", body: "{}" });
      weeksAgo = 0;
      blockPulls = 0;
      if (!wasBreak) {
        afterBlockLine = pulls ? `Block saved · ${plural(pulls, "pull", "pulls")} logged.` : "Block saved · no pulls logged.";
      }
      await refresh();
      showToast(wasBreak ? "Break ended" : "Block saved");
    } catch (err) {
      fail(err);
    }
  });

  els.btnAbort.addEventListener("click", async () => {
    if (!window.confirm("Stop this block early? It will still be saved.")) return;
    try {
      await api("/api/session/abort", { method: "POST", body: "{}" });
      weeksAgo = 0;
      blockPulls = 0;
      await refresh();
      showToast("Block stopped");
    } catch (err) {
      fail(err);
    }
  });

  els.distractForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = els.reason.value;
    if (!text.trim()) return;
    els.reason.value = ""; // clear now so the next pull can be typed immediately
    try {
      await logDistraction(text, "");
    } catch (err) {
      els.reason.value = text;
      fail(err);
    }
    els.reason.focus({ preventScroll: true });
  });

  // Chips stay enabled so rapid repeat taps all count.
  els.quickChips.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-reason]");
    if (!btn) return;
    flashButton(btn);
    try {
      await logDistraction(btn.dataset.reason, btn.dataset.category);
    } catch (err) {
      fail(err);
    }
  });

  els.weekPrev.addEventListener("click", () => loadWeek(1));
  els.weekNext.addEventListener("click", () => loadWeek(-1));

  els.btnSeed.addEventListener("click", async () => {
    try {
      await api("/api/seed", { method: "POST", body: "{}" });
      weeksAgo = 0;
      await refresh();
      showToast("Demo week loaded. Your own data will replace it as you log.");
    } catch (err) {
      fail(err);
    }
  });

  els.presets.forEach((btn) => {
    if (!btn.dataset.minutes) return;
    btn.addEventListener("click", () => {
      els.minutes.value = btn.dataset.minutes;
      setCustomOpen(false);
      syncPresets();
    });
  });

  els.presetCustom.addEventListener("click", () => {
    const open = els.customWrap.classList.contains("hidden");
    setCustomOpen(open);
    syncPresets();
    if (open) {
      els.minutes.focus();
      els.minutes.select();
    }
  });

  els.minutes.addEventListener("input", syncPresets);

  els.labelToggle.addEventListener("click", () => {
    const open = els.labelWrap.classList.contains("hidden");
    setLabelOpen(open);
    if (open) els.workLabel.focus();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      els.pullCard.scrollIntoView({ behavior: "smooth", block: "center" });
      els.reason.focus({ preventScroll: true });
    }
  });

  setIdleUI();
  syncPresets();
  setLabelOpen(false);
  refresh().catch(fail);
})();
