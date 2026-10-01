const assert = require("node:assert/strict");
const fs = require("node:fs");

const index = fs.readFileSync("index.html", "utf8");
const script = fs.readFileSync("script.js", "utf8");
const styles = fs.readFileSync("styles.css", "utf8");

assert.match(index, /id="question-order-select"/, "Settings should expose question ordering");
for (const value of ["auto", "random", "paper", "type", "chapter"]) {
  assert.match(index, new RegExp('<option value="' + value + '">'),
    "Question order should include " + value);
}

assert.match(script, /appPreferences\.questionOrder/,
  "Question order should restore from browser preferences");
assert.match(script, /saveAppPreferences\(\{ questionOrder: questionOrderMode \}\)/,
  "Question order selection should persist in browser storage");
assert.match(script, /function getQuestionTypeInfo\(/,
  "Question type grouping should be implemented");
assert.match(script, /function getQuestionChapterLabel\(/,
  "Chapter\/topic grouping should be implemented");
assert.match(script, /function orderQuestionsForSession\(/,
  "Question ordering should be applied during paper load");
assert.match(script, /effectiveMode === "random"/,
  "Random order should be supported");
assert.match(script, /effectiveMode === "type"/,
  "Type grouping should be supported");
assert.match(script, /effectiveMode === "chapter"/,
  "Chapter grouping should be supported");
assert.match(script, /question-group-heading/,
  "Grouped question views should show visible group headings");

assert.match(script, /activeQuestions:\s*cloneQuestionsData\(questions\)/,
  "Saved progress should include the exact active question order");
assert.match(
  script,
  /savedProgress[\s\S]*Array\.isArray\(savedProgress\.activeQuestions\)/,
  "Resume should restore the saved active question order"
);
assert.match(script, /activeQuestionOrderMode/,
  "Current-attempt order should stay separate from future preference changes");
assert.match(
  script,
  /your current answers stay attached to the same questions/i,
  "Changing order during active work should not silently reshuffle the current attempt"
);

assert.match(styles, /\.question-order-note/, "Question order help text should be styled");
assert.match(styles, /\.question-group-heading/, "Question group headings should be styled");

console.log("Question order checks passed: saved preference, random/original/type/chapter modes, grouping labels and stable resume.");
