/* Reusable, offline topic mastery engine. Content lives in learning-modules.js.
   No module-specific rules or third-party AI calls belong in this file. */
(function () {
  "use strict";
  var panel = null;
  var root = null;
  var activeModule = null;
  var progress = null;
  var currentTopic = null;
  var currentChapter = null;
  var useChapterMastery = false;
  var currentBookTitle = "";
  var selectedNodes = {};
  var versions = {};
  var speaking = false;
  var reviewDays = [1, 3, 7, 14];

  function element(tag, className, label) {
    var result = document.createElement(tag);
    if (className) result.className = className;
    if (label !== undefined && label !== null) result.textContent = String(label);
    return result;
  }
  function append(parent, tag, className, label) {
    var child = element(tag, className, label);
    parent.appendChild(child);
    return child;
  }
  function action(parent, label, name, value, style) {
    var button = append(parent, "button", "mastery-action " + (style || ""), label);
    button.type = "button";
    button.dataset.masteryAction = name;
    if (value !== undefined && value !== null) button.dataset.value = String(value);
    return button;
  }
  function storageKey(module) { return "test-simulator:mastery:v1:" + module.id; }
  function readProgress(module) {
    try {
      var saved = JSON.parse(localStorage.getItem(storageKey(module)));
      if (saved && saved.version === 1 && saved.items && saved.visited) return saved;
    } catch (_) { /* Private mode can block storage. */ }
    return { version: 1, items: {}, visited: {} };
  }
  function saveProgress() {
    if (!activeModule || !progress) return;
    try { localStorage.setItem(storageKey(activeModule), JSON.stringify(progress)); }
    catch (_) { /* The session still works when storage is blocked. */ }
  }
  function chapters() { return activeModule ? activeModule.chapters || [] : []; }
  function topics() {
    return chapters().reduce(function (all, chapter, chapterIndex) {
      return all.concat((chapter.topics || []).map(function (topic) {
        return { chapter: chapter, chapterIndex: chapterIndex, topic: topic };
      }));
    }, []);
  }
  function findTopic(id) {
    return topics().find(function (entry) { return entry.topic.id === id; });
  }
  function status(topic) {
    var exercises = topic.exercises || [];
    if (!exercises.length) return progress.visited[topic.id] ? "Learning" : "Not started";
    var records = exercises.map(function (exercise) { return progress.items[exercise.id] || {}; });
    if (records.every(function (record) { return record.correct > 0 && record.reviewPasses > 0; })) return "Mastered";
    if (records.some(function (record) { return record.attempts > 0; })) return "Practising";
    return progress.visited[topic.id] ? "Learning" : "Not started";
  }
  function dueExercises() {
    var now = Date.now();
    return topics().reduce(function (all, entry) {
      (entry.topic.exercises || []).forEach(function (exercise) {
        var record = progress.items[exercise.id];
        if (record && record.nextAt && record.nextAt <= now) all.push(entry);
      });
      return all;
    }, []);
  }
  function chapterStatus(chapter) {
    var chapterTopics = chapter && Array.isArray(chapter.topics) ? chapter.topics : [];
    if (!chapterTopics.length) return "Not started";
    var states = chapterTopics.map(status);
    if (states.every(function (state) { return state === "Mastered"; })) return "Mastered";
    if (states.some(function (state) { return state === "Practising"; })) return "Practising";
    if (states.some(function (state) { return state === "Learning" || state === "Mastered"; })) return "Learning";
    return "Not started";
  }
  function chapterProgress(chapter) {
    var chapterTopics = chapter && Array.isArray(chapter.topics) ? chapter.topics : [];
    var mastered = chapterTopics.filter(function (topic) { return status(topic) === "Mastered"; }).length;
    return { mastered: mastered, total: chapterTopics.length };
  }
  function chapterDueCount(index) {
    return dueExercises().filter(function (entry) { return entry.chapterIndex === index; }).length;
  }
  function stopNarration() {
    if (speaking && "speechSynthesis" in window) window.speechSynthesis.cancel();
    speaking = false;
  }
  function speakTopic(topic) {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance !== "function") return;
    if (speaking) { stopNarration(); return; }
    var text = [topic.title, topic.summary].concat(topic.notes || []);
    (topic.terms || []).forEach(function (term) { text.push(term.term + ": " + term.meaning); });
    window.speechSynthesis.cancel();
    var utterance = new SpeechSynthesisUtterance(text.join(". "));
    utterance.lang = "en";
    utterance.rate = 0.94;
    utterance.onend = utterance.onerror = function () { speaking = false; };
    speaking = true;
    window.speechSynthesis.speak(utterance);
  }
  function notice(parent, text, className) {
    var node = append(parent, "p", "mastery-notice " + (className || ""), text);
    node.setAttribute("role", "status");
    return node;
  }
  function setContext(context) {
    if (!panel) panel = document.getElementById("mastery-panel");
    if (!root) root = document.getElementById("mastery-root");
    if (!panel || !root) return;
    var modules = window.MasteryModules || [];
    var match = modules.find(function (entry) {
      return (entry.sourceFiles || []).indexOf(context.testFile) !== -1 ||
        (context.moduleId && entry.id === context.moduleId);
    });
    var available = context.enabled === true && context.mode === "study" && !!match;
    panel.hidden = !available;
    if (!available) {
      panel.open = false;
      document.body.classList.remove("mastery-open");
      stopNarration();
      return;
    }
    if (!activeModule || activeModule.id !== match.id) {
      activeModule = match;
      progress = readProgress(match);
      currentTopic = null;
      currentChapter = null;
      versions = {};
      selectedNodes = {};
    }

    var nextChapterMode = context.bookAvailable === true;
    if (useChapterMastery !== nextChapterMode) {
      currentTopic = null;
      currentChapter = null;
    }
    useChapterMastery = nextChapterMode;
    currentBookTitle =
      typeof context.bookTitle === "string" ? context.bookTitle.trim() : "";

    var name = document.getElementById("mastery-module-label");
    if (name) name.textContent = match.name;
    var summaryTitle = document.getElementById("mastery-summary-title");
    if (summaryTitle) summaryTitle.textContent = useChapterMastery ? "Chapter mastery" : "Topic mastery";
    if (panel.open) render();
  }
  function render() {
    if (!root || !activeModule) return;
    root.replaceChildren();
    if (currentTopic && findTopic(currentTopic)) {
      renderTopic(findTopic(currentTopic));
    } else if (
      useChapterMastery &&
      Number.isInteger(currentChapter) &&
      chapters()[currentChapter]
    ) {
      renderChapter(currentChapter);
    } else {
      renderHome();
    }
  }
  function renderHome() {
    var header = append(root, "div", "mastery-heading");
    append(header, "h3", "", useChapterMastery ? "Learn by chapter" : "Learn by topic");
    append(
      header,
      "p",
      "",
      useChapterMastery
        ? "Mastery follows the linked textbook chapter structure. Open a chapter, learn its topics, practise, then return for revision."
        : "Understand, practise, apply, then return for revision."
    );
    if (useChapterMastery && currentBookTitle) {
      append(header, "p", "mastery-book-context", "Book: " + currentBookTitle);
    }

    var summary = append(root, "div", "mastery-overview");
    var due = dueExercises();

    if (useChapterMastery) {
      var chapterList = chapters();
      var masteredChapters = chapterList.filter(function (chapter) {
        return chapterStatus(chapter) === "Mastered";
      }).length;
      append(summary, "strong", "", masteredChapters + " / " + chapterList.length + " chapters mastered");
      append(summary, "span", "", due.length ? due.length + " review activities due" : "No reviews due now");
      if (due.length) action(summary, "Review due", "open-topic", due[0].topic.id, "mastery-primary");

      var grid = append(root, "div", "mastery-chapter-list");
      chapterList.forEach(function (chapter, index) {
        var button = action(grid, "", "open-chapter", index, "mastery-chapter-card");
        var copy = append(button, "span", "mastery-chapter-card-copy");
        append(copy, "strong", "", chapter.title);
        var progressInfo = chapterProgress(chapter);
        var dueCount = chapterDueCount(index);
        append(
          copy,
          "span",
          "mastery-chapter-progress",
          progressInfo.mastered + " / " + progressInfo.total + " topics mastered" +
            (dueCount ? " · " + dueCount + " review" + (dueCount === 1 ? "" : "s") + " due" : "")
        );
        var chapterState = chapterStatus(chapter);
        var badge = append(button, "span", "mastery-status", chapterState);
        badge.setAttribute("data-status", chapterState.toLowerCase().replace(/\s+/g, "-"));
      });
      return;
    }

    var all = topics();
    var mastered = all.filter(function (x) { return status(x.topic) === "Mastered"; }).length;
    append(summary, "strong", "", mastered + " / " + all.length + " topics mastered");
    append(summary, "span", "", due.length ? due.length + " review activities due" : "No reviews due now");
    if (due.length) action(summary, "Review due", "open-topic", due[0].topic.id, "mastery-primary");
    chapters().forEach(function (chapter) {
      var section = append(root, "section", "mastery-chapter");
      append(section, "h4", "", chapter.title);
      (chapter.topics || []).forEach(function (topic) {
        var button = action(section, topic.title, "open-topic", topic.id, "mastery-topic-link");
        var badge = append(button, "span", "mastery-status", status(topic));
        badge.setAttribute("data-status", status(topic).toLowerCase().replace(/\s+/g, "-"));
      });
    });
  }

  function renderChapter(index) {
    var chapter = chapters()[index];
    if (!chapter) {
      currentChapter = null;
      renderHome();
      return;
    }

    var nav = append(root, "div", "mastery-topic-nav");
    action(nav, "← All chapters", "home", null, "mastery-back");
    if (currentBookTitle) append(nav, "span", "", currentBookTitle);

    append(root, "h3", "mastery-topic-title", chapter.title);
    var chapterState = chapterStatus(chapter);
    var badge = append(root, "span", "mastery-status mastery-current-status", chapterState);
    badge.setAttribute("data-status", chapterState.toLowerCase().replace(/\s+/g, "-"));

    var progressInfo = chapterProgress(chapter);
    var overview = append(root, "div", "mastery-overview mastery-chapter-overview");
    append(overview, "strong", "", progressInfo.mastered + " / " + progressInfo.total + " topics mastered");
    var dueCount = chapterDueCount(index);
    append(
      overview,
      "span",
      "",
      dueCount
        ? dueCount + " review activit" + (dueCount === 1 ? "y" : "ies") + " due in this chapter"
        : "No reviews due in this chapter"
    );

    append(root, "p", "mastery-chapter-intro",
      "Work through the topics below. The chapter is mastered when every topic has passed practice and a later review.");

    var section = append(root, "section", "mastery-chapter mastery-chapter-topics");
    (chapter.topics || []).forEach(function (topic) {
      var button = action(section, topic.title, "open-topic", topic.id, "mastery-topic-link");
      var topicState = status(topic);
      var topicBadge = append(button, "span", "mastery-status", topicState);
      topicBadge.setAttribute("data-status", topicState.toLowerCase().replace(/\s+/g, "-"));
    });
  }
  function renderTopic(entry) {
    var topic = entry.topic;
    var nav = append(root, "div", "mastery-topic-nav");
    if (useChapterMastery) {
      action(nav, "← Chapter", "open-chapter", entry.chapterIndex, "mastery-back");
    } else {
      action(nav, "← All topics", "home", null, "mastery-back");
    }
    append(nav, "span", "", entry.chapter.title);
    append(root, "h3", "mastery-topic-title", topic.title);
    var badge = append(root, "span", "mastery-status mastery-current-status", status(topic));
    badge.setAttribute("data-status", status(topic).toLowerCase().replace(/\s+/g, "-"));
    var guide = append(root, "section", "mastery-guide");
    append(guide, "h4", "", "Understand");
    append(guide, "p", "mastery-concept", topic.summary);
    if (topic.terms && topic.terms.length) {
      append(guide, "h5", "", "Key words explained");
      var terms = append(guide, "dl", "mastery-terms");
      topic.terms.forEach(function (term) {
        append(terms, "dt", "", term.term);
        append(terms, "dd", "", term.meaning);
      });
    }
    if (topic.notes && topic.notes.length) {
      append(guide, "h5", "", "Additional student notes");
      var list = append(guide, "ul", "");
      topic.notes.forEach(function (line) { append(list, "li", "", line); });
    }
    if (topic.reference) append(guide, "p", "mastery-reference", "Reference: " + topic.reference);
    if ("speechSynthesis" in window) action(guide, "Read these notes", "narrate", topic.id, "mastery-subtle");
    append(root, "h4", "mastery-practice-title", "Practise and apply");
    (topic.exercises || []).forEach(function (exercise, index) {
      renderExercise(root, exercise, index);
    });
    append(root, "p", "mastery-revision-tip",
      "Mastery requires correct practice and a later successful review. Your progress is saved on this device.");
  }
  function exampleFor(exercise) {
    var examples = exercise.examples || [];
    if (!examples.length) return null;
    return examples[(versions[exercise.id] || 0) % examples.length];
  }
  function drawDiagram(parent, exercise) {
    var diagram = exercise.diagram;
    if (!diagram || !Array.isArray(diagram.nodes)) return;
    var graph = append(parent, "div", "mastery-diagram");
    graph.setAttribute("role", "group");
    graph.setAttribute("aria-label", diagram.alt || "Practice diagram");
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("mastery-lines");
    (diagram.edges || []).forEach(function (edge) {
      var from = diagram.nodes.find(function (node) { return node.id === edge[0]; });
      var to = diagram.nodes.find(function (node) { return node.id === edge[1]; });
      if (!from || !to) return;
      var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      ["x1", "y1", "x2", "y2"].forEach(function (key, index) {
        line.setAttribute(key, [from.x, from.y, to.x, to.y][index]);
      });
      svg.appendChild(line);
    });
    graph.appendChild(svg);
    diagram.nodes.forEach(function (node) {
      var selectable = exercise.kind === "node";
      var visual = append(graph, selectable ? "button" : "span", "mastery-node", node.label);
      visual.style.left = node.x + "%";
      visual.style.top = node.y + "%";
      if (selectable) {
        visual.type = "button";
        visual.dataset.masteryAction = "pick-node";
        visual.dataset.value = node.id;
        visual.dataset.exerciseId = exercise.id;
        visual.setAttribute("aria-pressed", String(selectedNodes[exercise.id] === node.id));
      }
    });
    if (exercise.kind === "node") append(parent, "p", "mastery-helper", "Tap a box in the diagram, then check your answer.");
  }
  function renderExercise(parent, exercise, number) {
    var card = append(parent, "section", "mastery-exercise");
    card.dataset.exerciseId = exercise.id;
    append(card, "p", "mastery-exercise-number", "Activity " + (number + 1) + " · " +
      (exercise.kind === "number" ? "Calculation" : exercise.kind === "node" ? "Diagram" :
       exercise.kind === "sequence" ? "Put in order" : exercise.caseStudy ? "Scenario" : "Check understanding"));
    if (exercise.caseStudy) {
      var caseStudy = append(card, "div", "mastery-case-study");
      append(caseStudy, "strong", "", "Situation");
      append(caseStudy, "p", "", exercise.caseStudy);
    }
    append(card, "h5", "", exercise.prompt);
    var example = exampleFor(exercise);
    if (example && example.givens) {
      var givens = append(card, "ul", "mastery-givens");
      example.givens.forEach(function (given) { append(givens, "li", "", given); });
    }
    if (exercise.formula) append(card, "p", "mastery-formula", exercise.formula);
    drawDiagram(card, exercise);
    if (exercise.kind === "choice") {
      var group = append(card, "fieldset", "mastery-choices");
      append(group, "legend", "sr-only", exercise.prompt);
      exercise.options.forEach(function (option, i) {
        var row = append(group, "label", "mastery-choice");
        var radio = append(row, "input");
        radio.type = "radio";
        radio.name = "mastery-" + exercise.id;
        radio.value = String(i);
        append(row, "span", "", option);
      });
    } else if (exercise.kind === "number") {
      var label = append(card, "label", "mastery-number-label", "Your answer" + (exercise.unit ? " (" + exercise.unit + ")" : ""));
      var input = append(label, "input", "mastery-answer");
      input.type = "text";
      input.inputMode = "decimal";
      input.autocomplete = "off";
      input.placeholder = "Enter a number";
    } else if (exercise.kind === "sequence") {
      var slots = append(card, "div", "mastery-sequence");
      exercise.answer.forEach(function (_, index) {
        var label = append(slots, "label", "", "Step " + (index + 1));
        var select = append(label, "select", "mastery-sequence-select");
        append(select, "option", "", "Choose a step").value = "";
        exercise.items.forEach(function (item) {
          var choice = append(select, "option", "", item);
          choice.value = item;
        });
      });
    }
    var controls = append(card, "div", "mastery-exercise-controls");
    action(controls, "Check answer", "check", exercise.id, "mastery-primary");
    if (exercise.hint) action(controls, "Hint", "hint", exercise.id, "mastery-subtle");
    if (example && exercise.examples.length > 1) action(controls, "Different numbers", "variant", exercise.id, "mastery-subtle");
    var feedback = append(card, "div", "mastery-feedback");
    feedback.setAttribute("aria-live", "polite");
    var record = progress.items[exercise.id];
    if (record && record.nextAt) {
      var due = record.nextAt <= Date.now();
      append(card, "p", "mastery-review-state", due ? "Ready for another review." :
        "Next review: " + new Date(record.nextAt).toLocaleDateString());
    }
  }
  function exerciseById(id) {
    for (var i = 0; i < topics().length; i++) {
      var found = (topics()[i].topic.exercises || []).find(function (exercise) { return exercise.id === id; });
      if (found) return found;
    }
    return null;
  }
  function normalNumber(value) {
    return Number(String(value || "").replace(/[,\sR$%]/g, "").trim());
  }
  function checkExercise(exercise, card) {
    var selected;
    var answer = exercise.answer;
    var example = exampleFor(exercise);
    if (example) answer = example.answer;
    if (exercise.kind === "choice") {
      var checked = card.querySelector('input[type="radio"]:checked');
      if (!checked) return null;
      selected = Number(checked.value);
      return selected === answer;
    }
    if (exercise.kind === "number") {
      var textInput = card.querySelector("input.mastery-answer");
      if (!textInput || !textInput.value.trim() || !Number.isFinite(normalNumber(textInput.value))) return null;
      selected = normalNumber(textInput.value);
      return Math.abs(selected - Number(answer)) <= Number(exercise.tolerance || 0.01);
    }
    if (exercise.kind === "node") {
      return selectedNodes[exercise.id] ? selectedNodes[exercise.id] === answer : null;
    }
    if (exercise.kind === "sequence") {
      var selects = Array.from(card.querySelectorAll("select.mastery-sequence-select"));
      if (!selects.length || selects.some(function (item) { return !item.value; })) return null;
      return selects.every(function (item, index) { return item.value === answer[index]; });
    }
    return null;
  }
  function recordAnswer(id, correct) {
    var now = Date.now();
    var record = progress.items[id] || {
      attempts: 0, correct: 0, streak: 0, reviewPasses: 0, firstCorrectAt: 0, nextAt: 0
    };
    var eligibleReview = correct && record.firstCorrectAt && now - record.firstCorrectAt >= 86400000 &&
      (!record.lastAt || now - record.lastAt >= 86400000);
    record.attempts++;
    record.lastAt = now;
    if (correct) {
      record.correct++;
      record.streak++;
      if (!record.firstCorrectAt) record.firstCorrectAt = now;
      if (eligibleReview) record.reviewPasses++;
      record.nextAt = now + reviewDays[Math.min(record.streak - 1, reviewDays.length - 1)] * 86400000;
    } else {
      record.streak = 0;
      record.nextAt = now + 86400000;
    }
    progress.items[id] = record;
    saveProgress();
  }
  function showFeedback(card, correct, exercise, example) {
    var target = card.querySelector(".mastery-feedback");
    target.replaceChildren();
    target.dataset.result = correct ? "correct" : "incorrect";
    append(target, "strong", "", correct ? "Correct — well done." : "Not quite. Review the explanation, then try again.");
    if (exercise.worked || (example && example.worked)) {
      append(target, "p", "mastery-worked", "Worked solution: " +
        ((example && example.worked) || exercise.worked));
    }
    if (exercise.explanation) append(target, "p", "", exercise.explanation);
    if (exercise.studentNote) append(target, "p", "mastery-student-note", "Student note: " + exercise.studentNote);
    if (correct) append(target, "p", "mastery-helper",
      "This result is saved. A later review will confirm that you still remember it.");
  }
  function showTopic(id) {
    stopNarration();
    var entry = findTopic(id);
    if (!entry) return;
    currentTopic = id;
    if (useChapterMastery) currentChapter = entry.chapterIndex;
    progress.visited[id] = true;
    saveProgress();
    selectedNodes = {};
    render();
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function onClick(event) {
    var control = event.target.closest("[data-mastery-action]");
    if (!control || !root.contains(control)) return;
    var operation = control.dataset.masteryAction;
    var value = control.dataset.value;
    if (operation === "home") {
      stopNarration();
      currentTopic = null;
      currentChapter = null;
      render();
      return;
    }
    if (operation === "open-chapter") {
      var chapterIndex = Number(value);
      if (!Number.isInteger(chapterIndex) || !chapters()[chapterIndex]) return;
      stopNarration();
      currentTopic = null;
      currentChapter = chapterIndex;
      render();
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (operation === "open-topic") { showTopic(value); return; }
    if (operation === "narrate") {
      var found = findTopic(value);
      if (found) speakTopic(found.topic);
      return;
    }
    if (operation === "pick-node") {
      var id = control.dataset.exerciseId;
      selectedNodes[id] = value;
      var cardNodes = control.closest(".mastery-exercise").querySelectorAll(".mastery-node[data-exercise-id]");
      cardNodes.forEach(function (node) { node.setAttribute("aria-pressed", String(node.dataset.value === value)); });
      return;
    }
    var exercise = exerciseById(value);
    if (!exercise) return;
    var card = root.querySelector('[data-exercise-id="' + exercise.id + '"]');
    if (!card) return;
    var feedback = card.querySelector(".mastery-feedback");
    if (operation === "hint") {
      feedback.replaceChildren();
      notice(feedback, exercise.hint, "");
    } else if (operation === "variant") {
      versions[value] = (versions[value] || 0) + 1;
      render();
    } else if (operation === "check") {
      var result = checkExercise(exercise, card);
      if (result === null) {
        feedback.replaceChildren();
        notice(feedback, "Enter or select an answer first.", "");
        return;
      }
      recordAnswer(value, result);
      showFeedback(card, result, exercise, exampleFor(exercise));
    }
  }
  function init() {
    panel = document.getElementById("mastery-panel");
    root = document.getElementById("mastery-root");
    if (!panel || !root) return;
    root.addEventListener("click", onClick);
    panel.addEventListener("toggle", function () {
      document.body.classList.toggle("mastery-open", panel.open && !panel.hidden);
      if (panel.open && activeModule) render();
      if (!panel.open) stopNarration();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  window.MasteryEngine = { setContext: setContext };
}());
