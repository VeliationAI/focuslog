(() => {
  const form = document.getElementById("extract-form");
  const transcriptEl = document.getElementById("transcript");
  const heuristicEl = document.getElementById("heuristic");
  const statusEl = document.getElementById("status");
  const resultsEl = document.getElementById("results");
  const btnExtract = document.getElementById("btn-extract");
  const btnSample = document.getElementById("btn-sample");
  const btnClear = document.getElementById("btn-clear");
  const btnCopyMd = document.getElementById("btn-copy-md");
  const btnCopyJson = document.getElementById("btn-copy-json");
  const btnNew = document.getElementById("btn-new");
  const charHint = document.getElementById("char-hint");
  const countsEl = document.getElementById("counts");

  let lastPayload = null;
  let extracting = false;

  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || "");
  const kbd = btnExtract.querySelector(".btn-kbd");
  if (kbd) kbd.textContent = isMac ? "⌘↵" : "Ctrl+Enter";

  function setStatus(msg, kind = "") {
    statusEl.textContent = msg || "";
    statusEl.classList.toggle("error", kind === "error");
    statusEl.classList.toggle("ok", kind === "ok");
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function updatePaperChrome() {
    const len = transcriptEl.value.trim().length;
    btnClear.hidden = len === 0;
    charHint.textContent = len
      ? `${len.toLocaleString()} characters`
      : "Paste or try the sample";
  }

  function render(result, markdown) {
    lastPayload = { result, markdown };

    const actions = result.action_items || [];
    const decisions = result.decisions || [];
    const questions = result.open_questions || [];

    document.getElementById("result-summary").textContent =
      result.summary || "Ready to share with your team.";
    document.getElementById("result-meta").textContent =
      `Source · ${result.source}` +
      (result.attendees?.length ? ` · ${result.attendees.length} people` : "");

    countsEl.hidden = false;
    document.getElementById("c-actions").textContent = String(actions.length);
    document.getElementById("c-decisions").textContent = String(decisions.length);
    document.getElementById("c-questions").textContent = String(questions.length);
    document.getElementById("actions-count").textContent = String(actions.length);
    document.getElementById("decisions-count").textContent = String(decisions.length);
    document.getElementById("questions-count").textContent = String(questions.length);

    const actionsList = document.getElementById("actions-list");
    actionsList.innerHTML = actions.length
      ? actions
          .map((a) => {
            const due = a.due ? ` · due ${escapeHtml(a.due)}` : "";
            return `<li class="action-item">
              <span class="owner">${escapeHtml(a.owner || "Unassigned")}</span>
              <div class="action-body">
                <p>${escapeHtml(a.task)}</p>
                <p class="action-meta">
                  <span class="priority-${escapeHtml(a.priority || "medium")}">${escapeHtml(a.priority || "medium")}</span>${due}
                </p>
              </div>
            </li>`;
          })
          .join("")
      : `<li class="empty">No action items found — try a longer transcript.</li>`;

    const decisionsList = document.getElementById("decisions-list");
    decisionsList.innerHTML = decisions.length
      ? decisions
          .map(
            (d) => `<li class="decision-item">
              <strong>${escapeHtml(d.text)}</strong>
              ${d.context ? `<span>${escapeHtml(d.context)}</span>` : ""}
            </li>`
          )
          .join("")
      : `<li class="empty">No clear decisions detected.</li>`;

    const questionsList = document.getElementById("questions-list");
    questionsList.innerHTML = questions.length
      ? questions.map((q) => `<li>${escapeHtml(q)}</li>`).join("")
      : `<li class="empty">Nothing left open.</li>`;

    const attendees = document.getElementById("attendees-list");
    attendees.textContent = result.attendees?.length
      ? `Attendees · ${result.attendees.join(" · ")}`
      : "";

    resultsEl.classList.remove("hidden");
    resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`${label} copied — paste into Slack, Notion, or email.`, "ok");
    } catch {
      setStatus(`Could not copy ${label}.`, "error");
    }
  }

  async function runExtract() {
    if (extracting) return;
    const transcript = transcriptEl.value.trim();
    if (!transcript) {
      setStatus("Paste a transcript, or tap Try sample.", "error");
      transcriptEl.focus();
      return;
    }

    extracting = true;
    btnExtract.disabled = true;
    btnExtract.classList.add("loading");
    setStatus("Extracting owners and next steps…");

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          heuristic: heuristicEl.checked,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data.detail;
        throw new Error(
          typeof detail === "string"
            ? detail
            : Array.isArray(detail)
              ? detail.map((d) => d.msg || d).join(", ")
              : "Extraction failed."
        );
      }
      render(data.result, data.markdown);
      setStatus(
        data.result.source === "llm"
          ? "Done. Copy the checklist to share."
          : "Done offline. Copy the checklist to share.",
        "ok"
      );
    } catch (err) {
      setStatus(err.message || "Extraction failed.", "error");
    } finally {
      extracting = false;
      btnExtract.disabled = false;
      btnExtract.classList.remove("loading");
    }
  }

  btnSample.addEventListener("click", () => {
    transcriptEl.value = window.__SAMPLE__ || "";
    updatePaperChrome();
    setStatus("Sample loaded — hit Extract actions (or ⌘/Ctrl+Enter).");
    transcriptEl.focus();
  });

  btnClear.addEventListener("click", () => {
    transcriptEl.value = "";
    updatePaperChrome();
    setStatus("");
    transcriptEl.focus();
  });

  btnNew.addEventListener("click", () => {
    resultsEl.classList.add("hidden");
    lastPayload = null;
    transcriptEl.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
    setStatus("Paste another transcript whenever you’re ready.");
  });

  transcriptEl.addEventListener("input", updatePaperChrome);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    runExtract();
  });

  transcriptEl.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      runExtract();
    }
  });

  btnCopyMd.addEventListener("click", () => {
    if (!lastPayload) return;
    copyText(lastPayload.markdown, "Checklist");
  });

  btnCopyJson.addEventListener("click", () => {
    if (!lastPayload) return;
    copyText(JSON.stringify(lastPayload.result, null, 2), "JSON");
  });

  updatePaperChrome();
})();
