// Clear two-step paper library. Keep #test-select as the data source so existing
// test loading, uploads, saved progress, and switch confirmation remain unchanged.
document.addEventListener("DOMContentLoaded", () => {
  const source = document.getElementById("test-select");
  const trigger = document.getElementById("open-paper-picker");
  const triggerModule = document.getElementById("current-paper-module");
  const triggerTitle = document.getElementById("current-paper-title");
  const dialog = document.getElementById("paper-picker");
  const description = document.getElementById("paper-picker-description");
  const closeButton = document.getElementById("close-paper-picker");
  const search = document.getElementById("paper-picker-search");
  const back = document.getElementById("paper-picker-back");
  const step = document.getElementById("paper-picker-step");
  const modules = document.getElementById("paper-picker-modules");
  const count = document.getElementById("paper-picker-count");
  const results = document.getElementById("paper-picker-results");
  if (![source, trigger, triggerModule, triggerTitle, dialog, description,
    closeButton, search, back, step, modules, count, results].every(Boolean)) return;

  const categoryNames = {
    assessments: "Assessments",
    exams: "Exams & mock papers",
    practice: "Practical & other practice"
  };
  const categoryOrder = ["assessments", "exams", "practice"];
  // null = module overview; a code = papers in that module. Search is always global.
  const state = { module: null };

  function paperModule(name, file) {
    return (name.match(/\b(?:INF|ICT)\d{4}\b/i) ||
      file.match(/(?:INF|ICT)\d{4}/i) || ["My uploads"])[0].toUpperCase();
  }
  function paperKind(name, file) {
    const value = name + " " + file;
    if (/practical[\s-]*skills[\s-]*lab|skills[\s-]*lab/i.test(value)) return "practice";
    if (/assessment/i.test(value)) return "assessments";
    if (/exam|supplementary|jan[\s/_-]*feb|oct[\s/_-]*nov/i.test(value)) return "exams";
    return "practice";
  }
  function paperTitle(name, file, module, kind) {
    const value = name + " " + file;
    const year = (value.match(/\b20\d{2}\b/) || [""])[0];
    if (kind === "assessments") {
      const number = (value.match(/assessment[\s_-]*(\d+)/i) || [, ""])[1];
      return "Assessment " + (number || "") + (year ? " · " + year : "");
    }
    const period = value.match(/(jan)[\s/_-]*(feb)|(oct)[\s/_-]*(nov)/i);
    if (period) {
      const term = period[1] ? "Jan/Feb" : "Oct/Nov";
      const prefix = term + (year ? " " + year : "");
      if (/topic[\s-]*based/i.test(value)) return prefix + " · Topic-based mock";
      if (/supplementary/i.test(value)) return prefix + " · Supplementary exam";
      return prefix + (/original|style|inspired|practice/i.test(value)
        ? " · Exam practice" : " · Exam");
    }
    return name
      .replace(new RegExp("^" + module + "\\s*[–—·:|-]?\\s*", "i"), "")
      .replace(/^Software Project Man[\u00ad-]?agement\s*[–—-]\s*/i, "")
      .replace(/\s*\([^)]*(?:original|practice|style)[^)]*\)\s*$/i, "")
      .trim() || "Practice paper";
  }
  function papers() {
    return Array.from(source.options).filter(option =>
      option.value && !option.disabled && option.value !== "__custom_session__"
    ).map(option => {
      const name = option.textContent.trim();
      const file = option.value;
      const module = paperModule(name, file);
      const kind = paperKind(name, file);
      const rawCount = Number(option.dataset.questionCount);
      const questionCount = Number.isFinite(rawCount) && rawCount > 0 ? rawCount : null;
      const practice = /original|style|mock|inspired|practice/i.test(name) ||
        /inspired|practice/i.test(file);
      const note = /AI marked/i.test(name) ? "AI marked" :
        /original/i.test(name) ? "Original practice" :
        practice ? "Practice version" : "";
      const year = (name.match(/\b20\d{2}\b/) || [""])[0];
      return {
        file, name, module, kind, year, questionCount, note,
        title: paperTitle(name, file, module, kind)
      };
    });
  }

  function updateTrigger() {
    const option = source.selectedOptions[0];
    if (!option || !option.value) {
      triggerModule.textContent = "Choose a paper";
      triggerTitle.textContent = "Select an assessment or exam";
      trigger.title = "Choose a paper";
      return;
    }
    if (option.value === "__custom_session__") {
      triggerModule.textContent = "Custom mix";
      triggerTitle.textContent = option.textContent.trim() || "Your practice session";
    } else {
      const name = option.textContent.trim();
      const module = paperModule(name, option.value);
      triggerModule.textContent = module;
      triggerTitle.textContent =
        paperTitle(name, option.value, module, paperKind(name, option.value));
    }
    trigger.title = option.textContent.trim();
  }

  function sortedPapers(items) {
    return items.slice().sort((a, b) => {
      const moduleCompare = a.module.localeCompare(b.module);
      if (moduleCompare) return moduleCompare;
      const categoryCompare = categoryOrder.indexOf(a.kind) - categoryOrder.indexOf(b.kind);
      if (categoryCompare) return categoryCompare;
      return Number(b.year || 0) - Number(a.year || 0) ||
        a.title.localeCompare(b.title, undefined, { numeric: true });
    });
  }

  function makePaperRow(paper, showModule) {
    const active = source.value === paper.file;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "paper-picker-item" + (active ? " is-current" : "");
    button.title = paper.name;
    button.setAttribute("aria-label", (showModule ? paper.module + ": " : "") +
      paper.name + (active ? ", currently open" : ", open this paper"));
    if (active) button.setAttribute("aria-current", "true");
    const copy = document.createElement("span");
    copy.className = "paper-picker-item-copy";
    const title = document.createElement("strong");
    title.textContent = paper.title;
    const detail = document.createElement("span");
    detail.className = "paper-picker-item-detail";
    const extra = [paper.note, paper.questionCount ? paper.questionCount + " questions" : ""]
      .filter(Boolean).join(" · ");
    detail.textContent = showModule
      ? [categoryNames[paper.kind], extra].filter(Boolean).join(" · ")
      : extra || "Select to open this paper";
    copy.append(title, detail);
    const marker = document.createElement("span");
    marker.className = "paper-picker-item-marker";
    marker.textContent = active ? "Currently open" : "Open →";
    button.append(copy, marker);
    button.addEventListener("click", () => {
      if (!active) {
        source.value = paper.file;
        source.dispatchEvent(new Event("change", { bubbles: true }));
        // An active test can veto the switch in the existing change handler.
        updateTrigger();
        if (source.value !== paper.file) {
          render();
          return;
        }
      }
      dialog.close();
    });
    return button;
  }

  function makePaperSection(label, items, showModule) {
    const section = document.createElement("section");
    section.className = "paper-picker-section";
    const heading = document.createElement("h4");
    heading.className = "paper-picker-section-title";
    heading.textContent = label;
    section.appendChild(heading);
    items.forEach(paper => section.appendChild(makePaperRow(paper, showModule)));
    return section;
  }

  function showModules(allPapers) {
    modules.replaceChildren();
    results.replaceChildren();
    modules.classList.remove("hidden");
    results.classList.add("hidden");
    back.classList.add("hidden");
    step.textContent = "1. Choose a module";
    description.textContent = "Start by choosing the subject you want to practise.";
    const codes = [...new Set(allPapers.map(paper => paper.module))].sort();
    count.textContent = codes.length + " modules";
    if (!codes.length) {
      const empty = document.createElement("p");
      empty.className = "paper-picker-empty";
      empty.textContent = "Your paper library is loading…";
      modules.appendChild(empty);
    }
    codes.forEach(code => {
      const matches = allPapers.filter(paper => paper.module === code);
      const current = matches.some(paper => paper.file === source.value);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "paper-module-card" + (current ? " is-current" : "");
      button.setAttribute("aria-label", code + ", view " + matches.length + " papers");
      const text = document.createElement("span");
      text.className = "paper-module-copy";
      const title = document.createElement("strong");
      title.textContent = code;
      const detail = document.createElement("span");
      detail.textContent = matches.length + (matches.length === 1 ? " paper" : " papers") +
        (current ? " · Current module" : "");
      text.append(title, detail);
      const action = document.createElement("span");
      action.className = "paper-module-action";
      action.textContent = "View papers →";
      button.append(text, action);
      button.addEventListener("click", () => {
        state.module = code;
        render();
        results.scrollTop = 0;
      });
      modules.appendChild(button);
    });
  }

  function showPaperResults(allPapers, query) {
    const searching = Boolean(query);
    const shown = sortedPapers(allPapers.filter(paper =>
      searching
        ? [paper.name, paper.file, paper.module, paper.title]
          .some(value => value.toLocaleLowerCase().includes(query))
        : paper.module === state.module
    ));
    modules.classList.add("hidden");
    results.classList.remove("hidden");
    back.classList.remove("hidden");
    step.textContent = searching ? "Search results" : "2. Choose a paper · " + state.module;
    description.textContent = searching
      ? "Results from every module. Choose a paper to open it."
      : "Tap a paper below to open it. Use Modules to go back.";
    count.textContent = shown.length + (shown.length === 1 ? " paper" : " papers");
    results.replaceChildren();
    if (!shown.length) {
      const empty = document.createElement("p");
      empty.className = "paper-picker-empty";
      empty.textContent = "No papers found. Try the module code, year or assessment number.";
      results.appendChild(empty);
      return;
    }
    // Only three short sections on module view; search results group by module.
    const groupKeys = searching
      ? [...new Set(shown.map(paper => paper.module))]
      : categoryOrder.filter(category => shown.some(paper => paper.kind === category));
    groupKeys.forEach(key => {
      const members = shown.filter(paper =>
        searching ? paper.module === key : paper.kind === key);
      results.appendChild(makePaperSection(
        searching ? key : categoryNames[key], members, searching
      ));
    });
  }

  function render() {
    const allPapers = papers();
    const query = search.value.trim().toLocaleLowerCase();
    if (!query && !state.module) showModules(allPapers);
    else showPaperResults(allPapers, query);
  }
  function openPicker() {
    if (dialog.open) return;
    state.module = null;
    search.value = "";
    updateTrigger();
    render();
    dialog.showModal();
    trigger.setAttribute("aria-expanded", "true");
    // Avoid unexpectedly opening the on-screen keyboard on mobile.
    closeButton.focus({ preventScroll: true });
  }
  function refresh() {
    updateTrigger();
    if (dialog.open) render();
  }

  trigger.addEventListener("click", openPicker);
  closeButton.addEventListener("click", () => dialog.close());
  back.addEventListener("click", () => {
    state.module = null;
    search.value = "";
    render();
    modules.scrollTop = 0;
  });
  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => {
    trigger.setAttribute("aria-expanded", "false");
    trigger.focus({ preventScroll: true });
  });
  search.addEventListener("input", () => {
    render(); // Global search works even while viewing a module.
    results.scrollTop = 0;
  });
  new MutationObserver(refresh).observe(source, {
    childList: true, subtree: true, characterData: true, attributes: true,
    attributeFilter: ["data-question-count"]
  });
  source.addEventListener("change", () => queueMicrotask(refresh));
  window.PaperPicker = { refresh, open: openPicker };
  refresh();
});
