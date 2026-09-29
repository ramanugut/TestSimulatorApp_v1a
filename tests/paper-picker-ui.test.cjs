/* Guided paper-library browser tests. CI installs jsdom@25. */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM } = require("jsdom");

async function main() {
  const index = fs.readFileSync("index.html", "utf8");
  assert.match(index, /<dialog id="paper-picker"/, "accessible paper dialog is present");
  assert.match(index, /id="test-select" class="paper-native-select"/,
    "original data select remains the source of truth");
  assert.match(index, /id="paper-picker-back"/, "return to modules is explicit");
  const css = fs.readFileSync("paper-picker.css", "utf8");
  assert.match(css, /@media \(max-width: 768px\)/, "mobile layout exists");
  assert.match(css, /paper-module-card/, "large module cards exist");
  assert.match(css, /--paper-visible-center/, "mobile dialog tracks the visible viewport");
  assert.match(css, /keyboard-visible/, "keyboard-open layout keeps results readable");
  assert.match(css, /overflow-y: auto; overscroll-behavior: contain/,
    "mobile results remain independently scrollable");

  const markup = [
    '<!doctype html><html><body>',
    '<select id="test-select"></select>',
    '<button id="open-paper-picker" aria-controls="paper-picker">',
    '<strong id="current-paper-module"></strong><span id="current-paper-title"></span>',
    '</button><dialog id="paper-picker">',
    '<h2 id="paper-picker-title"></h2><p id="paper-picker-description"></p>',
    '<button id="close-paper-picker">Close</button>',
    '<input id="paper-picker-search" type="search">',
    '<button id="paper-picker-back" class="hidden">Modules</button>',
    '<h3 id="paper-picker-step"></h3>',
    '<p id="paper-picker-count"></p>',
    '<div id="paper-picker-modules"></div><div id="paper-picker-results"></div>',
    '</dialog></body></html>'
  ].join("");
  const dom = new JSDOM(markup, {
    url: "http://localhost/", runScripts: "outside-only", pretendToBeVisual: true
  });
  const win = dom.window;
  // Mock Chrome/Android's visible viewport: the layout viewport stays tall
  // while the virtual keyboard reduces the area actually visible to students.
  Object.defineProperty(win, "innerWidth", { configurable: true, writable: true, value: 390 });
  Object.defineProperty(win, "innerHeight", { configurable: true, writable: true, value: 780 });
  const viewport = new win.EventTarget();
  viewport.height = 780;
  viewport.offsetTop = 0;
  Object.defineProperty(win, "visualViewport", { configurable: true, value: viewport });
  win.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  win.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new win.Event("close"));
  };
  const source = win.document.getElementById("test-select");
  function add(file, name, questionCount) {
    const option = win.document.createElement("option");
    option.value = file;
    option.textContent = name;
    option.dataset.questionCount = String(questionCount);
    source.appendChild(option);
  }
  add("ict2631-oct-nov-2025-inspired.json",
    "ICT2631 – Oct/Nov 2025 Topic-Based Mock (original)", 32);
  add("ict2631-assessment-2-2026-practice.json",
    "ICT2631 – 2026 Assessment 2 Practice (original)", 30);
  add("inf3708-oct-nov-2021.json",
    "INF3708 – Software Project Management – OCT/NOV 2021 (100 marks, AI marked)", 27);
  add("ict2622-practical-skills-lab.json",
    "ICT2622 · Extended Practical Skills Lab (Assessment 3-style, original)", 25);
  source.value = "ict2631-oct-nov-2025-inspired.json";
  source.dataset.previousValue = source.value;
  let rejectSwitch = false;
  source.addEventListener("change", () => {
    if (rejectSwitch) {
      source.value = source.dataset.previousValue;
      return;
    }
    source.dataset.previousValue = source.value;
  });
  win.eval(fs.readFileSync("paper-picker.js", "utf8"));
  await new Promise(resolve =>
    win.document.addEventListener("DOMContentLoaded", resolve, { once: true })
  );
  const get = id => win.document.getElementById(id);
  const buttons = root => [...root.querySelectorAll("button")];
  const byText = (root, text) => buttons(root).find(el =>
    el.textContent.includes(text)
  );
  const moduleCards = () => get("paper-picker-modules").querySelectorAll(".paper-module-card");
  const paperRows = () => get("paper-picker-results").querySelectorAll(".paper-picker-item");
  const search = get("paper-picker-search");
  function type(text) {
    search.value = text;
    search.dispatchEvent(new win.Event("input", { bubbles: true }));
  }

  assert.match(get("current-paper-module").textContent, /ICT2631 · Operating Systems Practice/);
  assert.match(get("current-paper-title").textContent, /Oct\/Nov 2025/);

  // First screen requires no knowledge of filters or hidden categories.
  get("open-paper-picker").click();
  assert.ok(get("paper-picker").open, "picker opens");
  assert.match(get("paper-picker-step").textContent, /1. Choose a module/);
  assert.equal(moduleCards().length, 3, "module selection is the first screen");
  assert.equal(paperRows().length, 0, "all papers are not dumped on new students");
  assert.ok(byText(get("paper-picker-modules"), "ICT2631"));
  assert.match(byText(get("paper-picker-modules"), "ICT2622").textContent,
    /Object-Oriented Analysis.*UML diagrams/s, "students see subject names and familiar topics");
  assert.match(byText(get("paper-picker-modules"), "ICT2631").textContent,
    /Operating Systems Practice.*Linux.*2 papers.*Current module/s,
    "the full subject name and current module are recognizable");
  assert.match(byText(get("paper-picker-modules"), "INF3708").textContent,
    /Software Project Management.*WBS/s, "project subject hints appear");

  // The code is optional: partial names, familiar topics and small typos work.
  type("linux");
  assert.equal(moduleCards().length, 1, "remembering Linux finds the operating systems module");
  const dialog = get("paper-picker");
  assert.equal(dialog.style.getPropertyValue("--paper-visible-center"), "390px",
    "mobile dialog is centered rather than pinned to the screen bottom");
  search.focus();
  viewport.height = 345;
  viewport.dispatchEvent(new win.Event("resize"));
  assert.equal(dialog.style.getPropertyValue("--paper-visible-height"), "345px",
    "keyboard shrinking the visual viewport resizes the paper dialog");
  assert.equal(dialog.style.getPropertyValue("--paper-visible-center"), "173px",
    "dialog stays centered above the keyboard");
  assert.ok(dialog.classList.contains("keyboard-visible"), "compact keyboard layout is active");
  assert.equal(moduleCards().length, 1, "matching module remains available while typing");
  viewport.offsetTop = 35;
  viewport.dispatchEvent(new win.Event("scroll"));
  assert.equal(dialog.style.getPropertyValue("--paper-visible-center"), "208px",
    "dialog follows mobile browser visual-viewport scroll");
  type("2021");
  assert.equal(paperRows().length, 1, "searchable paper result remains present with the keyboard open");
  viewport.height = 780;
  viewport.offsetTop = 0;
  viewport.dispatchEvent(new win.Event("resize"));
  assert.equal(dialog.classList.contains("keyboard-visible"), false,
    "normal spacing returns after keyboard closes");
  type("linux");
  assert.ok(get("paper-picker-modules").textContent.includes("ICT2631"));
  type("uml");
  assert.equal(moduleCards().length, 1, "remembering UML finds object-oriented analysis");
  assert.ok(get("paper-picker-modules").textContent.includes("ICT2622"));
  type("project management");
  assert.equal(moduleCards().length, 1, "full subject name works");
  assert.ok(get("paper-picker-modules").textContent.includes("INF3708"));
  type("operatng");
  assert.equal(moduleCards().length, 1, "minor spelling mistakes in long subject words work");
  assert.ok(get("paper-picker-modules").textContent.includes("ICT2631"));
  type("");
  assert.equal(moduleCards().length, 3, "clearing search restores all modules");

  byText(get("paper-picker-modules"), "ICT2631").click();
  assert.match(get("paper-picker-step").textContent, /2. Choose a paper · Operating Systems Practice/);
  assert.equal(paperRows().length, 2);
  assert.ok(byText(get("paper-picker-results"), "Assessment 2 · 2026"),
    "assessment and year are visible");
  assert.ok(byText(get("paper-picker-results"), "Open →"),
    "paper rows use an explicit open action");
  assert.ok(!get("paper-picker-results").textContent.includes("2 of 4 papers"),
    "no mixed catalog count is shown");
  assert.ok(get("paper-picker-results").textContent.includes("Assessments"));
  assert.ok(get("paper-picker-results").textContent.includes("Exams & mock papers"));

  // Searching from inside a module still looks across *all* modules.
  type("2021");
  assert.match(get("paper-picker-step").textContent, /Search results/);
  assert.equal(paperRows().length, 1);
  assert.ok(get("paper-picker-results").textContent.includes("INF3708"));
  type("");
  assert.match(get("paper-picker-step").textContent, /Operating Systems Practice/,
    "clearing search returns to the previous module");
  get("paper-picker-back").click();
  assert.equal(moduleCards().length, 3, "back returns directly to module selection");

  // Open a paper from global search and reflect selection in the header.
  type("2021");
  byText(get("paper-picker-results"), "Oct/Nov 2021").click();
  assert.equal(source.value, "inf3708-oct-nov-2021.json");
  assert.match(get("current-paper-module").textContent, /INF3708 · Software Project Management/);
  assert.equal(get("paper-picker").open, false);

  // A denied switch must preserve the running paper and leave the picker open.
  get("open-paper-picker").click();
  assert.equal(moduleCards().length, 3, "fresh opening starts at step one");
  byText(get("paper-picker-modules"), "ICT2622").click();
  assert.equal(paperRows().length, 1);
  assert.ok(get("paper-picker-results").textContent.includes("Extended Practical Skills Lab"),
    "Assessment-style practical lab is correctly presented as practice");
  rejectSwitch = true;
  byText(get("paper-picker-results"), "Extended Practical Skills Lab").click();
  assert.equal(source.value, "inf3708-oct-nov-2021.json");
  assert.ok(get("paper-picker").open, "rejected switch does not close the dialog");
  rejectSwitch = false;
  get("close-paper-picker").click();

  // Uploaded paper appears as its own visible module, without a reload.
  add("student-upload.json", "My revision upload", 12);
  await Promise.resolve();
  get("open-paper-picker").click();
  assert.equal(moduleCards().length, 4);
  byText(get("paper-picker-modules"), "MY UPLOADS").click();
  assert.equal(paperRows().length, 1);
  assert.ok(get("paper-picker-results").textContent.includes("My revision upload"));
  get("paper-picker-back").click();
  type("not a real paper");
  assert.match(get("paper-picker-results").textContent, /Nothing found/);

  dom.window.close();
  console.log("Guided paper picker tests passed: first-time module cards, clear paper step, global search, back, open, cancellation and upload.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
