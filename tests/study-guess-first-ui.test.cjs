const assert = require("node:assert/strict");
const fs = require("node:fs");

const index = fs.readFileSync("index.html", "utf8");
const script = fs.readFileSync("script.js", "utf8");

assert.match(index, /id="study-guess-first-toggle"/, "Study Mode should expose a Guess First toggle");
assert.match(script, /studyGuessFirstEnabled = appPreferences\.studyGuessFirst !== false/, "Guess First should default on");
assert.match(script, /function hasMeaningfulStudyAttempt/, "Guess First should require a real attempt");
assert.match(script, /function revealStudyAnswer/, "Study answers should reveal explicitly");
assert.match(script, /studyAnswerVisible\(actualIndex\)/, "Correct option highlighting must respect reveal state");
assert.match(script, /createStudyGuessGate\(actualIndex\)/, "Unrevealed questions should show Check answer");
assert.match(script, /!isStudyMode \|\| canRevealStudyContent/, "AI tutoring must stay hidden before the guess is checked");

console.log("Study Guess First UI checks passed");
