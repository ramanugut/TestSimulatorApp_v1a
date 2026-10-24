"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");

const paper = JSON.parse(fs.readFileSync("ict2613-assessment-1-2026-partial.json", "utf8"));
assert.equal(paper.module, "ICT2613");
assert.equal(paper.questions.length, 30, "Assessment 1 must include Q1 to Q30");
assert.equal(paper.originalQuestionCount, 30);
assert.deepEqual(paper.missingQuestionNumbers, []);
assert.equal(paper.totalMarks, 41);
assert.deepEqual(paper.questions.map(question => Number(question.number)),
  Array.from({length: 30}, (_, i) => i + 1), "Original numbering must be complete");
assert.equal(paper.questions.reduce((sum, question) => sum + question.marks, 0), 41);
for (const question of paper.questions) {
  assert.ok(question.text?.length > 10, "Question " + question.number + " has original wording");
  assert.equal(question.options?.length, 4, "Question " + question.number + " retains four choices");
  assert.ok(question.options.includes(question.correctAnswer),
    "Question " + question.number + " correct answer must be one of its choices");
  assert.ok(question.explanation?.includes("Student note:"),
    "Question " + question.number + " needs an explanation and student note");
}
const q16 = paper.questions[15];
const q17 = paper.questions[16];
assert.match(q16.text, /Study the database table named weather/);
assert.equal(q16.tables[0].rows.length, 6, "Q16 uses six records");
assert.deepEqual(q16.tables[0].headers, ["record_number", "place", "date", "rainfall"]);
assert.deepEqual(q16.tables[0].rows[3], ["4", "Mamelodi", "2019-06-23", "10"]);
assert.deepEqual(q16.tables[0].rows[5], ["6", "Roodepoort", "2019-12-27", "25"]);
assert.deepEqual(q16.tables[1].rows, [["Roodepoort"], ["Johannesburg"], ["Gordons Bay"]]);
assert.match(q16.correctAnswer, /ORDER BY place DESC/);
assert.match(q17.text, /Assume that a PDO object named \$db is correctly connected/);
assert.equal(q17.table.rows.length, 5, "Q17 uses five records");
assert.deepEqual(q17.table.headers, ["record_number", "place", "date", "rainfall"]);
assert.deepEqual(q17.table.rows[3], ["4", "Mamelodi", "2019-06-23", "1"]);
assert.equal(q17.table.rows.some(row => row[1] === "Roodepoort"), false,
  "Roodepoort is in Q16 only");
assert.equal(q17.options.indexOf(q17.correctAnswer), 1,
  "Q17 correct answer is originally option 2");
assert.match(q17.correctAnswer, /SELECT \* FROM weather/);
console.log("ICT2613 2026 Assessment 1 validation passed: 30 original questions, 41 marks, explanations, and distinct Q16\/Q17 weather tables.");
