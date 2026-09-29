// A compact paper library for both small and large screens.
// The original #test-select remains the single source of truth for saved sessions,
// grading, uploads and the existing test-switch confirmation.
document.addEventListener("DOMContentLoaded", () => {
  const source = document.getElementById("test-select");
  const trigger = document.getElementById("open-paper-picker");
  const triggerModule = document.getElementById("current-paper-module");
  const triggerTitle = document.getElementById("current-paper-title");
  const dialog = document.getElementById("paper-picker");
  const closeButton = document.getElementById("close-paper-picker");
  const search = document.getElementById("paper-picker-search");
  const moduleTabs = document.getElementById("paper-picker-modules");
  const typeTabs = document.getElementById("paper-picker-types");
  const count = document.getElementById("paper-picker-count");
  const results = document.getElementById("paper-picker-results");
  if (![source, trigger, triggerModule, triggerTitle, dialog, closeButton,
    search, moduleTabs, typeTabs, count, results].every(Boolean)) return;

  const typeNames = {
    all: "All papers",
    assessments: "Assessments",
    exams: "Exams",
    practice: "Practice / labs"
  };
  const kindOrder = ["assessments", "exams", "practice"];
  const state = { module: "all", type: "all" };

  function paperModule(name, file) {
    return (name.match(/\b(?:INF|ICT)\d{4}\b/i) ||
      file.match(/(?:INF|ICT)\d{4}/i) || ["My uploads"])[0].toUpperCase();
  }

  function paperKind(name, file) {
    const value = name + " " + file;
    if (/practical[\\s-]*skills[\\s-]*lab|skills[\\s-]*lab/i.test(value)) return "practice";
    if (/assessment/i.test(value)) return "assessments";
    if (/exam|supplementary|jan[\s/_-]*feb|oct[\s/_-]*nov/i.test(value)) return "exams";
    return "practice";
  }

  function paperTitle(name, file, module, kind) {
    const value = name + " " + file;
    const year = (value.match(/\b20\d{2}\b/) || [""])[0];
    if (kind === "assessments") {
      const number = (value.match(/assessment[\s_-]*(\d+)/i) || [,""])[1];
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
      const questionCount = Number(option.dataset.questionCount);
      return {
        file, name, module, kind,
        title: paperTitle(name, file, module, kind),
        questionCount: Number.isFinite(questionCount) && questionCount > 0 ? questionCount : null,
        note: /AI marked/i.test(name) ? "AI marked" :
          /original/i.test(name) ? "Original practice" :
          /style|mock|inspired|practice/i.test(name) ? "Practice" : ""
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
      triggerTitle.textContent = paperTitle(name, option.value, module, paperKind(name, option.value));
    }
    trigger.title = option.textContent.trim();
  }

  function addTab(parent, title, value, active, onClick, number) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "paper-filter" + (active ? " is-active" : "");
    button.setAttribute("aria-pressed", String(active));
    button.textContent = title;
    if (number !== undefined) {
      const badge = document.createElement("span");
      badge.className = "paper-filter-count";
      badge.textContent = number;
      button.appendChild(badge);
    }
    button.addEventListener("click", () => onClick(value));
    parent.appendChild(button);
  }

  function renderTabs(allPapers) {
    moduleTabs.replaceChildren();
    const modules = [...new Set(allPapers.map(paper => paper.module))].sort();
    addTab(moduleTabs, "All", "all", state.module === "all", value => {
      state.module = value;
      render();
    }, allPapers.length);
    modules.forEach(module => addTab(moduleTabs, module, module,
      state.module === module, value => {
        state.module = value;
        render();
      }, allPapers.filter(paper => paper.module === module).length));

    typeTabs.replaceChildren();
    Object.entries(typeNames).forEach(([value, title]) => {
      addTab(typeTabs, title, value, state.type === value, selected => {
        state.type = selected;
        render();
      });
    });
  }

  function render() {
    const allPapers = papers();
    renderTabs(allPapers);
    const query = search.value.trim().toLocaleLowerCase();
    const matches = allPapers.filter(paper =>
      (state.module === "all" || paper.module === state.module) &&
      (state.type === "all" || paper.kind === state.type) &&
      (!query || [paper.name, paper.file, paper.module, paper.title]
        .some(value => value.toLocaleLowerCase().includes(query)))
    ).sort((a, b) => {
      const byModule = a.module.localeCompare(b.module);
      if (byModule) return byModule;
      const byKind = kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind);
      if (byKind) return byKind;
      const yearA = Number((a.name.match(/20\d{2}/) || ["0"])[0]);
      const yearB = Number((b.name.match(/20\d{2}/) || ["0"])[0]);
      return yearB - yearA || a.title.localeCompare(b.title, undefined, { numeric: true });
    });
    count.textContent = matches.length + " of " + allPapers.length + " papers" +
      (state.module === "all" ? "" : " · " + state.module);
    results.replaceChildren();

    if (!matches.length) {
      const empty = document.createElement("p");
      empty.className = "paper-picker-empty";
      empty.textContent = "No matching papers. Try another keyword or choose All.";
      results.appendChild(empty);
      return;
    }

    // All modules: group by module. One module: group by assessment/exam/practice.
    const groups = new Map();
    matches.forEach(paper => {
      const key = state.module === "all" ? paper.module : paper.kind;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(paper);
    });
    groups.forEach((group, key) => {
      const section = document.createElement("section");
      section.className = "paper-picker-section";
      const heading = document.createElement("h3");
      heading.className = "paper-picker-section-title";
      heading.textContent = state.module === "all" ? key : typeNames[key];
      const total = document.createElement("span");
      total.textContent = String(group.length);
      heading.appendChild(total);
      section.appendChild(heading);

      group.forEach(paper => {
        const active = source.value === paper.file;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "paper-picker-item" + (active ? " is-current" : "");
        button.title = paper.name;
        button.setAttribute("aria-label", paper.name + (active ? " (current paper)" : ""));
        if (active) button.setAttribute("aria-current", "true");

        const copy = document.createElement("span");
        copy.className = "paper-picker-item-copy";
        const title = document.createElement("strong");
        title.textContent = paper.title;
        const detail = document.createElement("span");
        detail.className = "paper-picker-item-detail";
        detail.textContent = [typeNames[paper.kind], paper.note,
          paper.questionCount ? paper.questionCount + " questions" : ""]
          .filter(Boolean).join(" · ");
        copy.append(title, detail);

        const marker = document.createElement("span");
        marker.className = "paper-picker-item-marker";
        marker.textContent = active ? "Current" : "›";
        button.append(copy, marker);
        button.addEventListener("click", () => {
          if (!active) {
            source.value = paper.file;
            source.dispatchEvent(new Event("change", { bubbles: true }));
            // A running test may reject the switch through its existing confirmation.
            updateTrigger();
            if (source.value !== paper.file) {
              render();
              return;
            }
          }
          dialog.close();
        });
        section.appendChild(button);
      });
      results.appendChild(section);
    });
  }

  function openPicker() {
    if (dialog.open) return;
    const chosen = papers().find(paper => paper.file === source.value);
    state.module = chosen ? chosen.module : "all";
    state.type = "all";
    search.value = "";
    updateTrigger();
    render();
    dialog.showModal();
    trigger.setAttribute("aria-expanded", "true");
    // Do not open the phone's on-screen keyboard automatically.
    closeButton.focus({ preventScroll: true });
  }

  function refresh() {
    updateTrigger();
    if (dialog.open) render();
  }

  trigger.addEventListener("click", openPicker);
  closeButton.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => {
    trigger.setAttribute("aria-expanded", "false");
    trigger.focus({ preventScroll: true });
  });
  search.addEventListener("input", () => {
    // Searching always searches across modules, not just the last opened module.
    if (search.value.trim()) state.module = "all";
    render();
  });
  new MutationObserver(refresh).observe(source, {
    childList: true, subtree: true, characterData: true, attributes: true,
    attributeFilter: ["data-question-count"]
  });
  source.addEventListener("change", () => queueMicrotask(refresh));
  window.PaperPicker = { refresh, open: openPicker };
  refresh();
});
