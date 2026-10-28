"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const script = fs.readFileSync(path.join(root, "script.js"), "utf8");
const files = [
  ["ict2642-may-2026-assessment-quiz.json", 50, true],
  ["ict2642-assessment-2-2026.json", 8, false],
  ["ict2642-assessment-3-2026.json", 50, true],
  ["ict2642-assessment-4-2026.json", 7, false],
];
for (const [file, count, multipleChoice] of files) {
  const raw = fs.readFileSync(path.join(root, file), "utf8");
  const paper = JSON.parse(raw);
  assert.equal(paper.module, "ICT2642");
  assert.equal(paper.questions.length, count, `${file}: full source coverage`);
  assert.equal(paper.originalQuestionCount, count);
  assert.equal(paper.totalMarks, 50);
  assert.equal(paper.questions.reduce((total, q) => total + q.marks, 0), 50);
  assert.equal(paper.preserveOrder, true);
  assert.equal(script.split(`"${file}"`).length - 1, 1, `${file}: registered once`);
  assert.equal(new Set(paper.questions.map(q => q.number)).size, count);
  assert.ok(paper.sourceNote && paper.sourceLimitations);
  assert.doesNotMatch(raw, /53008316|Thembuluwo|Ramanugu/, "No personal identifiers in published papers");
  for (const q of paper.questions) {
    assert.ok(q.text && q.correctAnswer && q.studentNote);
    assert.match(q.explanation, /Student note:/);
    if (multipleChoice) {
      assert.equal(q.options.length, 4);
      assert.equal(q.options.filter(option => option === q.correctAnswer).length, 1);
      assert.equal(q.marks, 1);
    } else {
      assert.equal(q.grading, "ai");
      assert.equal(q.answerType, "ai-text");
      assert.ok(q.aiRubric.length > 0);
    }
  }
  if (multipleChoice) {
    assert.deepEqual(paper.questions.map(q => q.number), Array.from({length: 50}, (_, i) => String(i + 1)));
    assert.equal(paper.durationMinutes, undefined, "Completion time is not an official duration");
  }
}
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
const may = read(files[0][0]);
assert.match(may.sourceLimitations, /does not state its assessment number/);
assert.doesNotMatch(may.testName, /Assessment 1/i);
assert.equal(may.questions[43].correctAnswer, "At least three digital skills");
assert.match(may.questions[43].studentNote, /not a guaranteed/);
const third = read(files[2][0]);
assert.match(third.questions[0].correctAnswer, /human-provided rules/);
assert.match(third.questions[37].studentNote, /does not independently replace/);
assert.match(third.questions[49].correctAnswer, /LLMs are a type of foundation model/);
const fourth = read(files[3][0]);
assert.deepEqual(fourth.questions.map(q => q.number), ["1.1", "1.2", "1.3", "2.1", "2.2", "3.1", "3.2"]);
assert.deepEqual(fourth.questions.map(q => q.marks), [8, 8, 4, 4, 8, 10, 8]);
assert.match(fourth.sourceLimitations, /not a verbatim transcription/);
assert.match(fourth.questions[0].correctAnswer, /hotel/);
assert.match(fourth.questions[6].correctAnswer, /Transnational/);
console.log("ICT2642: four papers, 115 questions, valid answer keys, source labels, rubrics and student notes passed.");
