(() => {
  const form = document.getElementById("extract-form");
  const transcriptEl = document.getElementById("transcript");
  const heuristicEl = document.getElementById("heuristic");
  const statusEl = document.getElementById("status");
  const resultsEl = document.getElementById("results");
  const btnExtract = document.getElementById("btn-extract");
  const btnSample = document.getElementById("btn-sample");
  const btnCopyMd = document.getElementById("btn-copy-md");
  const btnCopyJson = document.getElementById("btn-copy-json");

  let lastPayload = null;

  function setStatus(msg, isError = false) {
    statusEl.textContent = msg || "";
    statusEl.classList.toggle("hidden", !msg);
    statusEl.classList.toggle("error", Boolean(isError));
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function render(result, markdown) {
    lastPayload = { result, markdown };

    document.getElementById("result-summary").textContent =
      result.summary || "Extraction complete.";
    document.getElementById("result-meta").textContent =
      `Source · ${result.source}` +
      (result.attendees?.length ? ` · ${result.attendees.length} attendees` : "");

    const decisions = document.getElementById("decisions-list");
    if (!result.decisions?.length) {
      decisions.innerHTML = `<li class="empty">No decisions found.</li>`;
    } else {
      decisions.innerHTML = result.decisions
        .map(
          (d) => `<li class="decision-item">
            <strong>${escapeHtml(d.text)}</strong>
            ${d.context ? `<span>${escapeHtml(d.context)}</span>` : ""}
          </li>`
        )
        .join("");
    }

    const actions = document.getElementById("actions-list");
    if (!result.action_items?.length) {
      actions.innerHTML = `<li class="empty">No action items found.</li>`;
    } else {
      actions.innerHTML = result.action_items
        .map((a) => {
          const due = a.due ? ` · due ${escapeHtml(a.due)}` : "";
          return `<li class="action-item">
            <span class="owner">${escapeHtml(a.owner || "Unassigned")}</span>
            <div class="action-body">
              <p>${escapeHtml(a.task)}</p>
              <p class="action-meta">
                <span class="priority-${escapeHtml(a.priority)}">${escapeHtml(a.priority)}</span>${due}
              </p>
            </div>
          </li>`;
        })
        .join("");
    }

    const questions = document.getElementById("questions-list");
    if (!result.open_questions?.length) {
      questions.innerHTML = `<li class="empty">None flagged.</li>`;
    } else {
      questions.innerHTML = result.open_questions
        .map((q) => `<li>${escapeHtml(q)}</li>`)
        .join("");
    }

    document.getElementById("attendees-list").textContent =
      result.attendees?.length ? result.attendees.join(" · ") : "Not detected";

    resultsEl.classList.remove("hidden");
    resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`${label} copied.`);
    } catch {
      setStatus(`Could not copy ${label}.`, true);
    }
  }

  btnSample.addEventListener("click", () => {
    transcriptEl.value = window.__SAMPLE__ || "";
    setStatus("Sample transcript loaded. Hit Extract actions.");
    transcriptEl.focus();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const transcript = transcriptEl.value.trim();
    if (!transcript) {
      setStatus("Paste a transcript first.", true);
      return;
    }

    btnExtract.disabled = true;
    setStatus("Extracting decisions and owners…");

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          heuristic: heuristicEl.checked,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Extraction failed.");
      }
      render(data.result, data.markdown);
      setStatus(
        data.result.source === "llm"
          ? "Done via LLM."
          : "Done via offline heuristics (set OPENAI_API_KEY for LLM)."
      );
    } catch (err) {
      setStatus(err.message || "Extraction failed.", true);
    } finally {
      btnExtract.disabled = false;
    }
  });

  btnCopyMd.addEventListener("click", () => {
    if (!lastPayload) return;
    copyText(lastPayload.markdown, "Markdown");
  });

  btnCopyJson.addEventListener("click", () => {
    if (!lastPayload) return;
    copyText(JSON.stringify(lastPayload.result, null, 2), "JSON");
  });
})();
