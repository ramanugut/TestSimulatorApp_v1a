const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const papers = [
  {
    file: "inf3708-oct-nov-2022-final.json",
    session: "OCT/NOV 2022 FINAL",
    marks: 100,
    duration: 180,
    questions: 22,
  },
  {
    file: "inf3708-jan-feb-2023-supplementary.json",
    session: "JAN/FEB 2023 SUPPLEMENTARY",
    marks: 100,
    duration: 180,
    questions: 23,
  },
  {
    file: "inf3708-oct-nov-2024-final.json",
    session: "OCT/NOV 2024 FINAL",
    marks: 80,
    duration: 120,
    questions: 17,
  },
];

const byNumber = (paper) => Object.fromEntries(
  paper.questions.map((question) => [question.number, question]),
);

for (const expected of papers) {
  const paper = JSON.parse(fs.readFileSync(path.join(root, expected.file), "utf8"));
  assert.equal(paper.module, "INF3708", `${expected.file}: module`);
  assert.equal(paper.examSession, expected.session, `${expected.file}: session`);
  assert.equal(paper.totalMarks, expected.marks, `${expected.file}: total marks`);
  assert.equal(paper.durationMinutes, expected.duration, `${expected.file}: duration`);
  assert.equal(paper.questions.length, expected.questions, `${expected.file}: question count`);
  assert.equal(
    paper.questions.reduce((sum, question) => sum + question.marks, 0),
    expected.marks,
    `${expected.file}: question marks add to exam total`,
  );
  assert.ok(paper.sourceNote && paper.sourceLimitations, `${expected.file}: source notes`);

  for (const question of paper.questions) {
    assert.ok(question.number && question.text, `${expected.file}: question prompt`);
    assert.ok(question.correctAnswer, `${expected.file} ${question.number}: reference answer`);
    assert.ok(question.explanation, `${expected.file} ${question.number}: explanation`);
    assert.ok(question.studentNote, `${expected.file} ${question.number}: student note`);
    assert.ok(Array.isArray(question.aiRubric) && question.aiRubric.length,
      `${expected.file} ${question.number}: marking rubric`);
    if (question.diagramRequired) {
      assert.equal(question.answerType, "diagram", `${expected.file} ${question.number}: diagram workspace`);
    }
    const tables = [...(question.table ? [question.table] : []), ...(question.tables || [])];
    for (const table of tables) {
      assert.ok(table.caption && table.headers.length, `${expected.file} ${question.number}: table caption/headers`);
      assert.ok(table.rows.length, `${expected.file} ${question.number}: table rows`);
      for (const row of table.rows) {
        assert.equal(row.length, table.headers.length,
          `${expected.file} ${question.number}: table row width (${table.caption})`);
      }
    }
  }
}

const q22 = byNumber(JSON.parse(fs.readFileSync(path.join(root, papers[0].file), "utf8")));
assert.equal(q22["5.1"].answerType, "diagram");
assert.match(q22["5.2"].correctAnswer, /A–B–D–G–I–J/);
assert.match(q22["5.3"].correctAnswer, /F4/);
assert.match(q22["3.4"].studentNote, /105%/);
assert.match(q22["6.4(a)"].studentNote, /PV/);

const q23 = byNumber(JSON.parse(fs.readFileSync(path.join(root, papers[1].file), "utf8")));
assert.equal(q23["1.3.1"].answerType, "diagram");
assert.match(q23["1.4.2"].correctAnswer, /5\.9167/);
assert.match(q23["1.4.2"].studentNote, /5\.6/);
assert.match(q23["1.4.5"].studentNote, /own predecessor/);
assert.match(q23["2.3.2"].correctAnswer, /88\.50%.*25\.29%/);

const q24 = byNumber(JSON.parse(fs.readFileSync(path.join(root, papers[2].file), "utf8")));
assert.equal(q24["3.1"].answerType, "diagram");
assert.match(q24["3.2"].correctAnswer, /B=5 days, C=2 days, E=5 days and F=2 days/);
assert.match(q24["4.3"].correctAnswer, /R26,840.*R660/);

const existing2025 = JSON.parse(fs.readFileSync(
  path.join(root, "inf3708-jan-feb-2025-supplementary.json"), "utf8",
));
assert.equal(existing2025.examSession, "JAN/FEB 2025 SUPPLEMENTARY");
assert.equal(existing2025.examCode, "INF3708-24-Y");
assert.equal(existing2025.totalMarks, 80);
assert.match(existing2025.questions[0].text, /Maslow/);

const picker = fs.readFileSync(path.join(root, "script.js"), "utf8");
const mastery = fs.readFileSync(path.join(root, "modules", "inf3708-mastery.js"), "utf8");
for (const { file } of papers) {
  assert.ok(picker.includes(`"${file}"`), `${file}: registered in paper picker`);
  assert.ok(mastery.includes(`"${file}"`), `${file}: registered in INF3708 mastery module`);
}

console.log("INF3708 exam-paper coverage, references, tables, and diagram workspaces passed.");
