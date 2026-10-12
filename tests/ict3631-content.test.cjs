"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const crypto = require("node:crypto");
const script = fs.readFileSync("script.js", "utf8");
const names = fs.readdirSync(".").filter(name => /^ict3631-.*-exam-excerpts\.json$/.test(name));
assert.equal(names.length, 4);
let questions = 0, marks = 0;
for (const name of names) {
  const data = JSON.parse(fs.readFileSync(name, "utf8"));
  assert.ok(script.includes('"' + name + '"'), name + " must load in the picker");
  assert.equal(data.module, "ICT3631");
  assert.equal(data.preserveOrder, true);
  assert.equal(data.paperStatus, "partial");
  assert.match(data.testName, /Partial preview/);
  assert.match(data.sourceType, /Exact short question excerpts/);
  assert.equal(data.originalTotalMarks, 100);
  assert.ok(data.totalMarks < data.originalTotalMarks);
  assert.equal(data.totalMarks, data.questions.reduce((sum, q) => sum + q.marks, 0));
  assert.match(data.sourceReference, /^https:\/\/(www\.)?(studocu|coursehero)\.com\//);
  assert.ok(data.sourceLimitations.length > 50);
  assert.ok(data.sourceNote.includes("not an official memorandum"));
  const numbers = new Set();
  for (const q of data.questions) {
    assert.ok(!numbers.has(q.number));
    numbers.add(q.number);
    assert.equal(q.grading, "ai", "Open responses need semantic marking");
    assert.ok(q.marks > 0 && q.correctAnswer && q.aiRubric.length);
    assert.ok(q.aiReferenceNotes.includes("not an official UNISA memorandum"));
    assert.ok(q.answerReferences.length);
    assert.ok(q.studentNote && q.explanation.includes("Why:") && q.explanation.includes("Student note:"));
    assert.ok(q.study.simple && q.study.whyCorrect[0].length > 80);
    assert.ok(q.study.notes.length >= 3 && q.study.example && q.study.pitfall);
    questions++;
    marks += q.marks;
  }
}
assert.equal(questions, 5);
assert.equal(marks, 26);
// Source transcription fingerprints protect wording without duplicating it.
const expected = JSON.parse(fs.readFileSync("tests/fixtures/ict3631-excerpt-hashes.json", "utf8"));
for (const [name, hashes] of Object.entries(expected)) {
  const data = JSON.parse(fs.readFileSync(name, "utf8"));
  assert.deepEqual(data.questions.map(q => crypto.createHash("sha256").update(q.text).digest("hex")), hashes,
    "Question wording changed in " + name);
}
console.log("ICT3631: four partial previews, five exact excerpts, 26 available marks, separate model answers and student notes.");
