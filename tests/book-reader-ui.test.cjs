const assert = require("node:assert/strict");
const fs = require("node:fs");

const index = fs.readFileSync("index.html", "utf8");
const script = fs.readFileSync("script.js", "utf8");

assert.match(index, /id="mode-tab-book"/, "Book tab should exist");
assert.match(index, /id="mode-panel-book"/, "Book panel should exist");
assert.match(index, /id="book-reader-frame"/, "Book reader iframe should exist");
assert.match(script, /INF3708[\s\S]*Information Technology Project Management/, "INF3708 book mapping should exist");
assert.match(script, /activeMode === "book"/, "Mode switching should support Book");
assert.match(script, /syncBookAvailability\(\)/, "Book availability should follow selected module");
assert.match(script, /drive\.google\.com\/file\/d\/1wSsvyKvhPLXYA7AryPtDSc6NcKG8lzlX/, "Verified Drive source should be used");

console.log("Book reader UI checks passed");
