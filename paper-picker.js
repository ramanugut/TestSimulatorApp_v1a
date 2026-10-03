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
  // Display names match UNISA's published module titles. One metadata map is
  // reusable by the cards, current-paper label, and subject/topic search.
  const subjectInfo = {
    ICT2622: {
      title: "Object-Oriented Analysis",
      hint: "UML diagrams · classes · use cases",
      keywords: "object oriented analysis ooa uml modelling model diagrams class use case sequence analysis requirements system design"
    },
    ICT2631: {
      title: "Operating Systems Practice",
      hint: "Linux · Windows · commands",
      keywords: "operating system os linux windows terminal shell kernel process memory command commands installation administration"
    },
    INF3708: {
      title: "Software Project Management",
      hint: "Project planning · WBS · risk",
      keywords: "project management planning schedule critical path gantt risk wbs work breakdown structure budget effort agile"
    },
    ICT2613: {
      title: "Internet Programming",
      hint: "PHP · SQL · PDO · MVC",
      keywords: "internet programming web php mysql sql database pdo mvc model view controller apache browser http dynamic web pages debugging"
    },
    ICT2642: {
      title: "Business Informatics IIB",
      hint: "MIS · data · CRM · enterprise systems",
      keywords: "business informatics management information systems mis data mining olap crm enterprise systems linux unix software platforms saas cloud"
    },
    ICT3612: {
      title: "Advanced Internet Programming",
      hint: "PHP · OOP · SQL · web programming",
      keywords: "advanced internet programming php functions oop object oriented classes inheritance exceptions regex sql database web"
    },
    ICT3621: {
      title: "Database Design",
      hint: "Normalisation · dependencies · ERD",
      keywords: "database design normalization normalisation functional dependency dependencies 1nf 2nf 3nf erd entity relationship business rules"
    },
    ICT3631: {
      title: "Advanced Operating System Practice",
      hint: "Linux · networking · Samba · firewall",
      keywords: "advanced operating system linux networking ssh rsyslog samba iptables firewall acl commands administration"
    },
    ICT3641: {
      title: "Business Informatics IIIA",
      hint: "E-commerce · digital business · marketing",
      keywords: "business informatics ecommerce e-commerce digital business marketing portals mobile wallets attribution location b2b"
    },
    ICT3642: {
      title: "Business Informatics IIIB",
      hint: "E-business · entrepreneurship · ventures",
      keywords: "business informatics e-business entrepreneurship entrepreneur opportunity bootstrapping portfolio venture"
    },
    ICT3722: {
      title: "Database Practice",
      hint: "Oracle SQL · users · privileges",
      keywords: "database practice oracle sql user users privileges grant revoke create alter select joins security"
    },
    "MY UPLOADS": {
      title: "My uploaded papers",
      hint: "Papers you added yourself",
      keywords: "uploaded upload custom my papers"
    }
  };
  function subject(code) {
    return subjectInfo[code] || {
      title: code, hint: "Choose this module to see its papers", keywords: code
    };
  }
  // Words can be recalled out of order. Small spelling errors in longer
  // subject/topic words are also accepted (e.g. "operatng" -> "operating").
  function editDistanceWithin(a, b, limit) {
    if (Math.abs(a.length - b.length) > limit) return false;
    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const next = [i];
      let minimum = next[0];
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        next[j] = Math.min(previous[j] + 1, next[j - 1] + 1, previous[j - 1] + cost);
        minimum = Math.min(minimum, next[j]);
      }
      if (minimum > limit) return false;
      previous = next;
    }
    return previous[b.length] <= limit;
  }
  function matchesText(value, searchText) {
    const candidate = value.toLocaleLowerCase();
    const queryWords = searchText.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    const candidateWords = candidate.match(/[a-z0-9]+/g) || [];
    return queryWords.every(word => candidate.includes(word) ||
      (word.length >= 5 && candidateWords.some(entry =>
        editDistanceWithin(word, entry, word.length > 7 ? 2 : 1))));
  }
  function matchesSubject(code, searchText) {
    const info = subject(code);
    return matchesText([code, info.title, info.hint, info.keywords].join(" "), searchText);
  }
  // null = module overview; a code = papers in that module. Search is always global.
  const state = { module: null };
  const preferencesKey = "testSimulatorPreferences";

  function readPickerPreferences() {
    try {
      const saved = JSON.parse(localStorage.getItem(preferencesKey) || "{}");
      return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
    } catch (error) {
      return {};
    }
  }

  function rememberModule(code) {
    if (!code || code === "MY UPLOADS") return;
    try {
      const saved = readPickerPreferences();
      localStorage.setItem(preferencesKey, JSON.stringify({
        ...saved,
        lastSelectedModule: code,
        updatedAt: Date.now(),
      }));
    } catch (error) {
      // The picker still works when storage is blocked/private.
    }
  }

  // Android and iOS keyboards resize the *visual* viewport, not always the
  // CSS layout viewport. Follow that visible rectangle while the modal is open.
  // This also keeps the dialog centered if the browser scrolls to the search input.
  let fullVisibleHeight = 0;
  function syncPaperViewport() {
    if (!dialog.open) return;
    if (window.innerWidth > 768) {
      dialog.classList.remove("keyboard-visible");
      dialog.style.removeProperty("--paper-visible-center");
      dialog.style.removeProperty("--paper-visible-height");
      return;
    }
    const visual = window.visualViewport;
    const height = Math.max(180, Math.round(Math.min(
      visual ? visual.height : window.innerHeight,
      window.innerHeight || (visual && visual.height) || 768
    )));
    const top = visual ? (visual.offsetTop || 0) : 0;
    fullVisibleHeight = Math.max(fullVisibleHeight, height);
    dialog.style.setProperty("--paper-visible-height", height + "px");
    dialog.style.setProperty("--paper-visible-center", Math.round(top + height / 2) + "px");
    dialog.classList.toggle("keyboard-visible", fullVisibleHeight - height > 120);
  }
  window.addEventListener("resize", syncPaperViewport);
  window.addEventListener("orientationchange", () => {
    fullVisibleHeight = 0;
    syncPaperViewport();
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncPaperViewport);
    window.visualViewport.addEventListener("scroll", syncPaperViewport);
  }

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
    let moduleText = "Choose module";
    let paperText = "Choose assessment or exam";
    let titleText = "Choose module and paper";

    if (option && option.value) {
      if (option.value === "__custom_session__") {
        moduleText = "Custom mix";
        paperText = option.textContent.trim() || "Your practice session";
        titleText = paperText;
      } else {
        const name = option.textContent.trim();
        const module = paperModule(name, option.value);
        const title = paperTitle(name, option.value, module, paperKind(name, option.value));
        moduleText = "Module: " + module;
        paperText = "Paper: " + title;
        titleText = subject(module).title + " — " + name;
      }
    }

    triggerModule.textContent = moduleText;
    triggerTitle.textContent = paperText;
    trigger.title = titleText;
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
      rememberModule(paper.module);
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

  function showModules(allPapers, filteredCodes = null) {
    modules.replaceChildren();
    results.replaceChildren();
    modules.classList.remove("hidden");
    results.classList.add("hidden");
    back.classList.add("hidden");
    step.textContent = filteredCodes ? "Modules matching your search" : "1. Choose a module";
    description.textContent = filteredCodes
      ? "Found a familiar subject? Select it to see its papers."
      : "Choose by subject name or topic. You do not need to remember the code.";
    const codes = (filteredCodes || [...new Set(allPapers.map(paper => paper.module))]).sort();
    count.textContent = codes.length + (codes.length === 1 ? " module" : " modules");
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
      button.setAttribute("aria-label", code + ", " + subject(code).title + ", view " + matches.length + " papers");
      const text = document.createElement("span");
      text.className = "paper-module-copy";
      const title = document.createElement("strong");
      title.textContent = code;
      const subjectName = document.createElement("span");
      subjectName.className = "paper-module-title";
      subjectName.textContent = subject(code).title;
      const hint = document.createElement("span");
      hint.className = "paper-module-hint";
      hint.textContent = subject(code).hint;
      const detail = document.createElement("span");
      detail.className = "paper-module-meta";
      detail.textContent = matches.length + (matches.length === 1 ? " paper" : " papers") +
        (current ? " · Current module" : "");
      text.append(title, subjectName, hint, detail);
      const action = document.createElement("span");
      action.className = "paper-module-action";
      action.textContent = "View papers →";
      button.append(text, action);
      button.addEventListener("click", () => {
        state.module = code;
        rememberModule(code);
        search.value = ""; // Selecting a subject always shows its complete paper list.
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
        ? matchesText([paper.name, paper.file, paper.module, paper.title,
            subject(paper.module).title, subject(paper.module).keywords].join(" "), query)
        : paper.module === state.module
    ));
    modules.classList.add("hidden");
    results.classList.remove("hidden");
    back.classList.remove("hidden");
    step.textContent = searching ? "Search results" : "2. Choose a paper · " + subject(state.module).title;
    description.textContent = searching
      ? "Results from every module. Choose a paper to open it."
      : "Tap a paper below to open it. Use Modules to go back.";
    count.textContent = shown.length + (shown.length === 1 ? " paper" : " papers");
    results.replaceChildren();
    if (!shown.length) {
      const empty = document.createElement("p");
      empty.className = "paper-picker-empty";
      empty.textContent = "Nothing found. Try a subject or topic (such as Linux, UML or project management), a module code, or a paper year.";
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
        searching ? key + " · " + subject(key).title : categoryNames[key], members, searching
      ));
    });
  }

  function render() {
    const allPapers = papers();
    const query = search.value.trim().toLocaleLowerCase();
    if (!query && !state.module) {
      showModules(allPapers);
      return;
    }
    if (query) {
      const codes = [...new Set(allPapers.map(paper => paper.module))];
      const matchingCodes = codes.filter(code => matchesSubject(code, query));
      // Subject or topic searches show recognizable module cards, not a
      // long list of every exam associated with that subject.
      const lookingForPaper = /\b(?:20\d{2}|assessment|exam|mock|supplementary|practical|practice|paper|jan|feb|oct|nov)\b/i.test(query);
      if (matchingCodes.length && !lookingForPaper) {
        showModules(allPapers, matchingCodes);
        return;
      }
    }
    showPaperResults(allPapers, query);
  }
  function openPicker(event) {
    if (dialog.open) return;
    state.module = null;
    search.value = "";
    updateTrigger();
    render();
    dialog.showModal();
    fullVisibleHeight = 0;
    syncPaperViewport();
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
    fullVisibleHeight = 0;
    dialog.classList.remove("keyboard-visible");
    dialog.style.removeProperty("--paper-visible-center");
    dialog.style.removeProperty("--paper-visible-height");
    trigger.setAttribute("aria-expanded", "false");
    trigger.focus({ preventScroll: true });
  });
  search.addEventListener("input", () => {
    render(); // Global search works even while viewing a module.
    results.scrollTop = 0;
  });
  search.addEventListener("focus", syncPaperViewport);
  search.addEventListener("blur", syncPaperViewport);
  new MutationObserver(refresh).observe(source, {
    childList: true, subtree: true, characterData: true, attributes: true,
    attributeFilter: ["data-question-count"]
  });
  source.addEventListener("change", () => queueMicrotask(refresh));
  window.PaperPicker = { refresh, open: openPicker };
  refresh();
});
