/* Responsive paper browser behaviour tests. CI installs jsdom@25. */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM } = require("jsdom");

async function main() {
  const index = fs.readFileSync("index.html", "utf8");
  assert.match(index, /<dialog id="paper-picker"/, "paper browser uses a native accessible dialog");
  assert.match(index, /id="test-select" class="paper-native-select"/,
    "the original data select remains in the app");
  assert.match(fs.readFileSync("paper-picker.css", "utf8"),
    /@media \(max-width: 768px\)/, "mobile bottom-sheet layout exists");

  const markup = `<!doctype html><html><body>
    <select id="test-select"></select>
    <button id="open-paper-picker" aria-controls="paper-picker">
      <strong id="current-paper-module"></strong><span id="current-paper-title"></span>
    </button>
    <dialog id="paper-picker">
      <button id="close-paper-picker">Close</button>
      <input id="paper-picker-search" type="search">
      <div id="paper-picker-modules"></div><div id="paper-picker-types"></div>
      <p id="paper-picker-count"></p><div id="paper-picker-results"></div>
    </dialog>
  </body></html>`;
  const dom = new JSDOM(markup, {
    url: "http://localhost/", runScripts: "outside-only", pretendToBeVisual: true
  });
  const win = dom.window;
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
  const doc = win.document;
  const get = id => doc.getElementById(id);
  const buttons = root => [...root.querySelectorAll("button")];
  const byText = (root, text) => buttons(root).find(el =>
    el.textContent.includes(text)
  );

  assert.equal(get("current-paper-module").textContent, "ICT2631");
  assert.match(get("current-paper-title").textContent, /Oct\/Nov 2025/);
  assert.ok(!get("current-paper-title").textContent.includes("(original)"),
    "header shows a short paper label");

  get("open-paper-picker").click();
  assert.ok(get("paper-picker").open, "paper library opens");
  assert.equal(get("paper-picker-results").querySelectorAll(".paper-picker-item").length, 2,
    "the active module is shown first");
  assert.match(get("paper-picker-count").textContent, /2 of 4 papers/);
  assert.ok(byText(get("paper-picker-types"), "Assessments"),
    "paper type filters are visible");
  assert.ok(byText(get("paper-picker-results"), "Assessment 2 · 2026"),
    "assessment titles are short and dated");

  byText(get("paper-picker-modules"), "All").click();
  assert.equal(get("paper-picker-results").querySelectorAll(".paper-picker-item").length, 4);
  assert.ok(byText(get("paper-picker-results"), "Extended Practical Skills Lab"),
    "practical lab is listed");

  const search = get("paper-picker-search");
  search.value = "2021";
  search.dispatchEvent(new win.Event("input", { bubbles: true }));
  assert.equal(get("paper-picker-results").querySelectorAll(".paper-picker-item").length, 1,
    "search looks across modules");
  byText(get("paper-picker-types"), "Exams").click();
  assert.equal(get("paper-picker-results").querySelectorAll(".paper-picker-item").length, 1);
  byText(get("paper-picker-results"), "Oct/Nov 2021").click();
  assert.equal(source.value, "inf3708-oct-nov-2021.json",
    "choosing a paper changes the original select");
  assert.ok(!get("paper-picker").open, "successful choice closes the picker");

  get("open-paper-picker").click();
  search.value = "practical";
  search.dispatchEvent(new win.Event("input", { bubbles: true }));
  byText(get("paper-picker-types"), "Practice / labs").click();
  assert.equal(get("paper-picker-results").querySelectorAll(".paper-picker-item").length, 1,
    "Assessment 3-style lab is correctly grouped as practice");
  rejectSwitch = true;
  byText(get("paper-picker-results"), "Extended Practical Skills Lab").click();
  assert.equal(source.value, "inf3708-oct-nov-2021.json",
    "rejected switch preserves the active paper");
  assert.ok(get("paper-picker").open, "rejected switch leaves the picker available");
  rejectSwitch = false;
  get("close-paper-picker").click();

  // A dynamically uploaded file should appear without reloading the browser.
  add("student-upload.json", "My revision upload", 12);
  await Promise.resolve();
  get("open-paper-picker").click();
  assert.ok(byText(get("paper-picker-modules"), "MY UPLOADS"),
    "uploaded papers receive a separate module tab");
  assert.match(get("paper-picker-count").textContent, /of 5 papers/);
  dom.window.close();
  console.log("Paper picker UI tests passed: compact header, module/type grouping, global search, lab classification, cancellation and uploads.");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
