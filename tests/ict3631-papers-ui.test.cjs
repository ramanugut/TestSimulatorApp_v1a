"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM, VirtualConsole } = require("jsdom");
const names = fs.readdirSync(".").filter(name => /^ict3631-.*-exam-excerpts\.json$/.test(name));
const settle = async () => { for (let i = 0; i < 16; i++) await new Promise(r => setImmediate(r)); };
async function open(name, appearance) {
  const errors = [], vc = new VirtualConsole();
  vc.on("jsdomError", e => errors.push(e));
  vc.on("error", (...args) => errors.push(args));
  const dom = new JSDOM(fs.readFileSync("index.html", "utf8"), {
    url: "https://example.test/TestSimulatorApp_v1a/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc
  });
  const w = dom.window, doc = w.document;
  w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.confirm = () => true;
  w.alert = message => errors.push(message);
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  w.HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); this.dispatchEvent(new w.Event("close")); };
  w.localStorage.setItem("testSimulatorPreferences", JSON.stringify({
    mode: "study", studyGuessFirst: false, questionOrder: "paper", lastSelectedPaper: name, questionsPerPage: 5
  }));
  const requests = [];
  w.fetch = (file, options = {}) => {
    requests.push([file, options]);
    assert.ok(!options.method || options.method === "GET", "Loading a paper must not send an AI request");
    return Promise.resolve({ ok: true, json: async () => JSON.parse(fs.readFileSync(String(file), "utf8")) });
  };
  w.eval(fs.readFileSync("script.js", "utf8"));
  w.eval(fs.readFileSync("paper-picker.js", "utf8"));
  await new Promise(r => doc.addEventListener("DOMContentLoaded", r, { once: true }));
  await settle();
  if (appearance === "new") {
    doc.body.classList.add("new-look");
    doc.getElementById("test-select").dispatchEvent(new w.Event("change", { bubbles: true }));
    await settle();
  }
  return { dom, w, doc, errors, requests };
}
(async () => {
  for (const name of names) for (const appearance of ["old", "new"]) {
    const app = await open(name, appearance);
    const { doc, w } = app;
    const data = JSON.parse(fs.readFileSync(name, "utf8"));
    assert.equal(doc.getElementById("test-select").value, name);
    assert.equal(doc.querySelectorAll(".question").length, data.questions.length);
    assert.equal(doc.querySelectorAll(".text-area-input").length, data.questions.length,
      "Every written or command question needs an answer field");
    const bodies = [...doc.querySelectorAll(".question-body")].map(x => x.textContent.trim());
    assert.deepEqual(bodies, data.questions.map(q => q.text), "Question wording is preserved in both layouts");
    const notice = doc.querySelector(".paper-preview-notice");
    assert.ok(notice);
    assert.ok(notice.textContent.includes(data.totalMarks + "/100 marks"));
    assert.ok(notice.textContent.includes("not an official memo"));
    assert.equal(notice.querySelector("a").href, data.sourceReference);
    assert.match(doc.querySelector(".study-guide")?.textContent || doc.body.textContent, /Why this answer is correct/);
    assert.ok(doc.body.textContent.includes(data.questions[0].studentNote));
    doc.getElementById("open-paper-picker").click();
    const module = [...doc.querySelectorAll(".paper-module-card")].find(x => x.textContent.includes("ICT3631"));
    module.click();
    const rows = [...doc.querySelectorAll(".paper-picker-item")];
    assert.equal(rows.filter(x => /Partial/.test(x.textContent)).length, 4);
    assert.equal(doc.querySelectorAll(".paper-picker-source-link:not(.paper-pending-source)").length, 4);
    assert.equal(doc.querySelectorAll(".paper-pending-source").length, 3,
      "Unverified older questions remain sources, not selectable tests");
    assert.ok(rows.every(x => !x.querySelector("a")), "Source links must not be nested inside paper buttons");
    const currentRow = rows.find(x => x.title === data.testName);
    assert.ok(currentRow.textContent.includes(data.totalMarks + "/100 marks"));
    assert.match(doc.getElementById("current-paper-title").textContent, /Partial/i);
    // Switching to a complete paper clears the preview notice and its source.
    doc.getElementById("test-select").value = "ict2631-oct-nov-2022-exam.json";
    doc.getElementById("test-select").dispatchEvent(new w.Event("change", { bubbles: true }));
    await settle();
    assert.equal(doc.querySelector(".paper-preview-notice"), null);
    assert.deepEqual(app.errors, []);
    app.dom.window.close();
  }
  console.log("ICT3631 UI: all four previews load in both layouts with inputs, notes, partial marks, source links and clean switching.");
})().catch(error => { console.error(error); process.exitCode = 1; });
