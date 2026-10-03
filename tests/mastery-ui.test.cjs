/* Browser-like smoke test: npm i --no-save jsdom@25 && node tests/mastery-ui.test.cjs */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM, VirtualConsole } = require("jsdom");

async function main() {
  const domErrors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", error => domErrors.push(error));
  const dom = new JSDOM(
    '<!doctype html><html><body class="study-mode-active">' +
    '<details id="mastery-panel" hidden><summary><span id="mastery-summary-title">Topic mastery</span> <span id="mastery-module-label"></span></summary>' +
    '<div id="mastery-root"></div></details><div class="test-content">Existing exam questions</div>' +
    '</body></html>',
    { url: "http://localhost/", runScripts: "outside-only", virtualConsole }
  );
  const window = dom.window;
  // jsdom has no layout/scrolling engine, while browsers provide this method.
  window.HTMLElement.prototype.scrollIntoView = function () {};
  for (const path of ["learning-modules.js", "modules/inf3708-mastery.js", "modules/ict2622-mastery.js", "learning-engine.js"]) {
    window.eval(fs.readFileSync(path, "utf8"));
  }
  await new Promise(resolve =>
    window.document.addEventListener("DOMContentLoaded", resolve, { once: true })
  );
  const panel = window.document.getElementById("mastery-panel");
  const root = window.document.getElementById("mastery-root");
  const engine = window.MasteryEngine;
  assert.ok(engine && engine.setContext);

  engine.setContext({ mode: "test", testFile: "test36.json", enabled: true });
  assert.equal(panel.hidden, true, "Mastery must not clutter test mode");
  engine.setContext({ mode: "study", testFile: "test36.json", enabled: true });
  assert.equal(panel.hidden, false, "Study Mode should expose matching content");
  assert.equal(window.document.getElementById("mastery-module-label").textContent, "INF3708");
  panel.open = true;
  panel.dispatchEvent(new window.Event("toggle"));
  assert.ok(root.textContent.includes("Learn by topic"), "Topic hub should render on opening");

  const openTopic = id => {
    const button = root.querySelector('[data-mastery-action="open-topic"][data-value="' + id + '"]');
    assert.ok(button, "Expected topic link " + id);
    button.click();
  };
  const act = (card, label) => {
    const button = Array.from(card.querySelectorAll('[data-mastery-action]'))
      .find(node => node.textContent.includes(label));
    assert.ok(button, "Expected " + label);
    button.click();
  };
  openTopic("c6-critical");
  assert.ok(root.textContent.includes("Critical path and slack"));
  const nodeCard = root.querySelector('[data-exercise-id="c6a"]');
  assert.ok(nodeCard.querySelectorAll("button.mastery-node").length >= 4);
  const nodeA = nodeCard.querySelector('button.mastery-node[data-value="A"]');
  nodeA.click();
  assert.equal(nodeA.getAttribute("aria-pressed"), "true");
  act(nodeCard, "Check answer");
  assert.ok(nodeCard.querySelector(".mastery-feedback").textContent.includes("Correct"));

  root.querySelector('[data-mastery-action="home"]').click();
  openTopic("c6-pert");
  const numericCard = root.querySelector('[data-exercise-id="c6c"]');
  numericCard.querySelector(".mastery-answer").value = "12";
  act(numericCard, "Check answer");
  assert.ok(numericCard.querySelector(".mastery-feedback").textContent.includes("Correct"));
  assert.ok(numericCard.querySelector(".mastery-feedback").textContent.includes("Student note"));
  assert.ok(window.localStorage.getItem("test-simulator:mastery:v1:inf3708"),
    "Mastery progress should be saved separately from exam progress");

  // When the current module has a linked book, mastery becomes chapter-first.
  engine.setContext({
    mode: "study",
    testFile: "test36.json",
    enabled: true,
    bookAvailable: true,
    bookTitle: "Information Technology Project Management"
  });
  panel.open = true;
  panel.dispatchEvent(new window.Event("toggle"));
  assert.ok(root.textContent.includes("Learn by chapter"), "Book-backed mastery should open by chapter");
  assert.ok(root.textContent.includes("13 chapters mastered"), "Chapter summary should use chapter progress");
  assert.equal(
    window.document.getElementById("mastery-summary-title").textContent,
    "Chapter mastery",
    "Panel label should switch to chapter mastery when a book is linked"
  );
  const chapterButtons = root.querySelectorAll('[data-mastery-action="open-chapter"]');
  assert.equal(chapterButtons.length, 13, "INF3708 book mastery should expose all 13 chapters");
  chapterButtons[5].click();
  assert.ok(root.textContent.includes("6 · Project Schedule Management"));
  assert.ok(root.textContent.includes("Critical path and slack"));
  const chapterBack = root.querySelector('[data-mastery-action="home"]');
  assert.ok(chapterBack && chapterBack.textContent.includes("All chapters"));
  chapterBack.click();
  assert.ok(root.textContent.includes("Learn by chapter"));

  engine.setContext({ mode: "flashcards", testFile: "test36.json", enabled: true, bookAvailable: true });
  assert.equal(panel.hidden, true);
  assert.equal(panel.open, false);

  // Another module can use the same engine without changes to any shared code.
  window.MasteryModules.push({
    id: "other-subject", name: "Other subject", sourceFiles: ["other.json"],
    chapters: [{ title: "1 · Basics", topics: [{
      id: "other-topic", title: "A reusable topic", summary: "Independent content.",
      terms: [], notes: ["Independent notes."], exercises: [{
        id: "other-activity", kind: "choice", prompt: "Choose B.",
        options: ["A", "B"], answer: 1, explanation: "B is correct.", studentNote: "Remember B."
      }]
    }] }]
  });
  engine.setContext({ mode: "study", testFile: "other.json", enabled: true, bookAvailable: false });
  panel.open = true;
  panel.dispatchEvent(new window.Event("toggle"));
  assert.ok(root.textContent.includes("A reusable topic"));
  assert.equal(window.document.getElementById("mastery-module-label").textContent, "Other subject");
  assert.equal(window.localStorage.getItem("test-simulator:mastery:v1:other-subject"), null,
    "Other subject progress should start clean");
  engine.setContext({ mode: "study", testFile: "ict2622-oct-nov-2025-practice.json", enabled: true, bookAvailable: false });
  panel.open = true;
  panel.dispatchEvent(new window.Event("toggle"));
  assert.equal(window.document.getElementById("mastery-module-label").textContent, "ICT2622");
  assert.ok(root.textContent.includes("Learn by topic"),
    "A module without a linked book should keep topic-based mastery");
  assert.equal(
    window.document.getElementById("mastery-summary-title").textContent,
    "Topic mastery",
    "Panel label should return to topic mastery without a linked book"
  );
  assert.ok(root.textContent.includes("System vision and development cycles"),
    "ICT2622 should use the same shared topic engine");
  // Details elements queue native toggle events. Let them finish before closing
  // the window, and fail the test if any UI event handler threw an exception.
  await new Promise(resolve => window.setTimeout(resolve, 0));
  assert.deepEqual(domErrors, [], "Mastery interactions must not throw DOM errors");
  console.log("Mastery UI smoke test passed: chapter-first book mastery, topic fallback, diagram, calculation, progress isolation and mode switching.");
  dom.window.close();
}

main().catch(error => { console.error(error); process.exitCode = 1; });
