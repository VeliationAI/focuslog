(() => {
  const CIRC = 2 * Math.PI * 104;
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

  const els = {
    ringWrap: document.querySelector(".ring-wrap"),
    ringProgress: document.querySelector(".ring-progress"),
    kind: document.getElementById("timer-kind"),
    digits: document.getElementById("timer-digits"),
    label: document.getElementById("timer-label"),
    heroStatus: document.getElementById("hero-status"),
    startForm: document.getElementById("start-form"),
    activeActions: document.getElementById("active-actions"),
    minutes: document.getElementById("minutes"),
    workLabel: document.getElementById("label"),
    btnBreak: document.getElementById("btn-break"),
    btnDone: document.getElementById("btn-done"),
    btnAbort: document.getElementById("btn-abort"),
    distractForm: document.getElementById("distract-form"),
    reason: document.getElementById("reason"),
    category: document.getElementById("category"),
    toast: document.getElementById("toast"),
    weekRange: document.getElementById("week-range"),
    weekPrev: document.getElementById("week-prev"),
    weekNext: document.getElementById("week-next"),
    mFocus: document.getElementById("m-focus"),
    mCompletion: document.getElementById("m-completion"),
    mDistractions: document.getElementById("m-distractions"),
    mPer: document.getElementById("m-per"),
    dayBars: document.getElementById("day-bars"),
    topReasons: document.getElementById("top-reasons"),
    topCategories: document.getElementById("top-categories"),
    recent: document.getElementById("recent-distractions"),
    recentSessions: document.getElementById("recent-sessions"),
    btnSeed: document.getElementById("btn-seed"),
    insightBanner: document.getElementById("insight-banner"),
    insightHeadline: document.getElementById("insight-headline"),
    insightBody: document.getElementById("insight-body"),
    pulseStreak: document.getElementById("pulse-streak"),
    pulseAllFocus: document.getElementById("pulse-all-focus"),
    pulseAllDistract: document.getElementById("pulse-all-distract"),
    quickChips: document.getElementById("quick-chips"),
  };

  let activeSession = null;
  let tickTimer = null;
  let weeksAgo = 0;

  els.ringProgress.style.strokeDasharray = String(CIRC);

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

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.remove("hidden", "show");
    void els.toast.offsetWidth;
    els.toast.classList.add("show");
    setTimeout(() => els.toast.classList.add("hidden"), 2400);
  }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = data.detail;
      throw new Error(typeof detail === "string" ? detail : "Request failed");
    }
    return data;
  }

  function setIdleUI(presetMinutes = 25) {
    activeSession = null;
    clearInterval(tickTimer);
    tickTimer = null;
    els.ringWrap.dataset.state = "idle";
    els.kind.textContent = "Ready";
    els.digits.textContent = formatClock(presetMinutes * 60);
    els.label.textContent = "Set a block. Protect it.";
    els.heroStatus.textContent =
      "Timers count minutes. Focus Log ranks interruptions — so you can change the environment, not just the willpower.";
    els.ringProgress.style.strokeDashoffset = "0";
    els.startForm.classList.remove("hidden");
    els.activeActions.classList.add("hidden");
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
    els.label.textContent = activeSession.label || (isBreak ? "Rest well" : "Stay with it");
    els.heroStatus.textContent = isBreak
      ? "Break in progress — step away cleanly, come back sharper."
      : "Session live. When attention slips, log it — don’t pretend it didn’t.";
    els.ringProgress.style.strokeDashoffset = String(CIRC * progress);
    els.startForm.classList.add("hidden");
    els.activeActions.classList.remove("hidden");

    if (left <= 0) {
      clearInterval(tickTimer);
      tickTimer = null;
      els.kind.textContent = "Done";
      els.digits.textContent = "00:00";
      els.label.textContent = "Complete the session to save it.";
    }
  }

  function startTicker() {
    clearInterval(tickTimer);
    renderActive();
    tickTimer = setInterval(renderActive, 250);
  }

  function renderInsight(insight) {
    if (!insight) return;
    els.insightBanner.dataset.tone = insight.tone || "idle";
    els.insightHeadline.textContent = insight.headline;
    els.insightBody.textContent = insight.body;
  }

  function renderPulse(overview) {
    els.pulseStreak.textContent = String(overview.streak_days || 0);
    els.pulseAllFocus.textContent = formatDuration((overview.all_time || {}).focus_seconds);
    els.pulseAllDistract.textContent = String((overview.all_time || {}).distractions || 0);
  }

  function renderReport(report) {
    const t = report.totals;
    els.weekRange.textContent = `${report.week_start} → ${report.week_end}`;
    els.weekNext.disabled = weeksAgo <= 0;
    els.mFocus.textContent = formatDuration(t.focus_seconds);
    els.mCompletion.textContent = `${t.completion_rate}%`;
    els.mDistractions.textContent = String(t.distractions);
    els.mPer.textContent = String(t.distractions_per_session);

    const maxFocus = Math.max(1, ...report.day_series.map((d) => d.focus_seconds));
    const maxDistract = Math.max(1, ...report.day_series.map((d) => d.distractions));

    els.dayBars.innerHTML = report.day_series
      .map((d, i) => {
        const fh = Math.max(d.focus_seconds ? 8 : 2, Math.round((d.focus_seconds / maxFocus) * 100));
        const dh = d.distractions
          ? Math.max(6, Math.round((d.distractions / maxDistract) * 28))
          : 0;
        return `
          <div class="bar-col" title="${d.day}: ${formatDuration(d.focus_seconds)} focus, ${d.distractions} distractions">
            <div class="bar-stack">
              <div class="bar distract" style="height:${dh}px; animation-delay:${i * 40}ms"></div>
              <div class="bar focus" style="height:${fh}px; animation-delay:${i * 40 + 40}ms"></div>
            </div>
            <span class="bar-day">${d.weekday}</span>
          </div>`;
      })
      .join("");

    if (!report.top_reasons.length) {
      els.topReasons.innerHTML = `<li class="empty" style="display:block;border:0">No distractions logged. Rare air.</li>`;
    } else {
      els.topReasons.innerHTML = report.top_reasons
        .slice(0, 6)
        .map(
          (r, i) => `
          <li style="animation-delay:${i * 50}ms">
            <span class="n">${i + 1}</span>
            <span>${escapeHtml(r.reason)} <span class="meta">${categoryLabel(r.category)}</span></span>
            <span class="meta">${r.count}×</span>
          </li>`
        )
        .join("");
    }

    const maxCat = Math.max(1, ...(report.top_categories.map((c) => c.count) || [1]));
    if (!report.top_categories.length) {
      els.topCategories.innerHTML = `<p class="empty">Categories will appear as you log pulls.</p>`;
    } else {
      els.topCategories.innerHTML = report.top_categories
        .map(
          (c, i) => `
          <div class="cat-row">
            <span>${categoryLabel(c.category)}</span>
            <div class="cat-track"><div class="cat-fill" style="width:${Math.round((c.count / maxCat) * 100)}%; animation-delay:${i * 60}ms"></div></div>
            <span class="count">${c.count}</span>
          </div>`
        )
        .join("");
    }

    const recent = (report.recent_distractions || []).slice(0, 8);
    if (!recent.length) {
      els.recent.innerHTML = `<li class="empty" style="display:block;border:0">Nothing logged this week yet.</li>`;
    } else {
      els.recent.innerHTML = recent
        .map((d) => {
          const when = new Date(d.logged_at);
          const stamp = when.toLocaleString(undefined, {
            weekday: "short",
            hour: "2-digit",
            minute: "2-digit",
          });
          return `
            <li>
              <span>${escapeHtml(d.reason)} <span class="meta">${categoryLabel(d.category)}</span></span>
              <span class="meta">${stamp}</span>
            </li>`;
        })
        .join("");
    }

    const sessions = (report.recent_sessions || []).filter((s) => s.kind === "focus").slice(0, 6);
    if (!sessions.length) {
      els.recentSessions.innerHTML = `<li class="empty" style="display:block;border:0">No sessions this week yet.</li>`;
    } else {
      els.recentSessions.innerHTML = sessions
        .map((s) => {
          const stamp = new Date(s.started_at).toLocaleString(undefined, {
            weekday: "short",
            hour: "2-digit",
            minute: "2-digit",
          });
          return `
            <li>
              <span>${escapeHtml(s.label || "Focus")} <span class="meta">${s.status} · ${formatDuration(s.focus_seconds)}</span></span>
              <span class="meta">${stamp}</span>
            </li>`;
        })
        .join("");
    }
  }

  async function refresh() {
    const overview = await api("/api/overview");
    activeSession = overview.active_session;
    if (activeSession) startTicker();
    else setIdleUI(Number(els.minutes.value) || 25);

    renderInsight(overview.insight);
    renderPulse(overview);

    const report = weeksAgo === 0 ? overview.week : await api(`/api/report?weeks_ago=${weeksAgo}`);
    renderReport(report);
  }

  async function logDistraction(reason, category) {
    const clean = String(reason || "").trim();
    if (!clean) return;
    await api("/api/distract", {
      method: "POST",
      body: JSON.stringify({ reason: clean, category: category || "other" }),
    });
    els.reason.value = "";
    showToast(`Logged: ${clean}`);
    await refresh();
  }

  els.startForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const data = await api("/api/session/start", {
        method: "POST",
        body: JSON.stringify({
          minutes: Number(els.minutes.value) || 25,
          label: els.workLabel.value.trim(),
          kind: "focus",
        }),
      });
      activeSession = data.session;
      startTicker();
      showToast("Focus session started");
    } catch (err) {
      showToast(err.message);
    }
  });

  els.btnBreak.addEventListener("click", async () => {
    try {
      const data = await api("/api/session/start", {
        method: "POST",
        body: JSON.stringify({ minutes: 5, label: "Break", kind: "break" }),
      });
      activeSession = data.session;
      startTicker();
      showToast("Break started");
    } catch (err) {
      showToast(err.message);
    }
  });

  els.btnDone.addEventListener("click", async () => {
    try {
      await api("/api/session/done", { method: "POST", body: "{}" });
      showToast("Session completed");
      await refresh();
    } catch (err) {
      showToast(err.message);
    }
  });

  els.btnAbort.addEventListener("click", async () => {
    try {
      await api("/api/session/abort", { method: "POST", body: "{}" });
      showToast("Session aborted");
      await refresh();
    } catch (err) {
      showToast(err.message);
    }
  });

  els.distractForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await logDistraction(els.reason.value, els.category.value);
    } catch (err) {
      showToast(err.message);
    }
  });

  els.quickChips.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-reason]");
    if (!btn) return;
    try {
      els.category.value = btn.dataset.category || "other";
      await logDistraction(btn.dataset.reason, btn.dataset.category);
    } catch (err) {
      showToast(err.message);
    }
  });

  els.weekPrev.addEventListener("click", async () => {
    weeksAgo += 1;
    const report = await api(`/api/report?weeks_ago=${weeksAgo}`);
    renderReport(report);
  });

  els.weekNext.addEventListener("click", async () => {
    if (weeksAgo <= 0) return;
    weeksAgo -= 1;
    const report = await api(`/api/report?weeks_ago=${weeksAgo}`);
    renderReport(report);
  });

  els.btnSeed.addEventListener("click", async () => {
    await api("/api/seed", { method: "POST", body: "{}" });
    showToast("Demo week loaded (if DB was empty)");
    weeksAgo = 0;
    await refresh();
  });

  els.minutes.addEventListener("input", () => {
    if (!activeSession) {
      const m = Number(els.minutes.value) || 25;
      els.digits.textContent = formatClock(m * 60);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      els.reason.focus();
      document.getElementById("distract-section").scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });

  setIdleUI();
  refresh().catch((err) => showToast(err.message));
})();
