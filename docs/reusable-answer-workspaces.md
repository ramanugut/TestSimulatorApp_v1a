# Reusable answers for diagrams, tables, commands and code

The simulator remains a plain browser app. `answer-workspace.js` and
`answer-workspace.css` handle the input UI; `script.js` selects the
appropriate UI and marking method from each question's JSON properties. New
modules need only import their question pack and register it in `testFiles`.
No module-specific logic should be added to the shared answer workspace.

## Marking choice

| Response | Question fields | Marking | Notes |
| --- | --- | --- | --- |
| MCQ / multi-select | `options`, `correctAnswer` | Local | No remote AI call. |
| Table with known values | `answerType:"table"`, `grading:"table"` | Local per expected cell | Partial marks, optional alternate expected strings. |
| Known terminal or SQL command | `answerType:"command"`, `grading:"command"` | Local string comparison | Preserves case. Normalises repeated horizontal spaces. Never executes input. |
| Open code or pseudocode | `answerType:"code"`, `grading:"ai"` | Existing secure rubric service | Never executes input. Valid equivalent logic should be accepted. |
| Open explanation | `grading:"ai"` | Existing secure rubric service | Checks meaning, not one exact wording. |
| UML drawing | `answerType:"uml-diagram"`, `grading:"ai"` | Existing image-capable rubric service | Canvas shapes or upload; optional notes. |
| Legacy freehand drawing | `answerType:"diagram"` | Existing image-capable rubric service | Preserved for existing INF3708 content. |

All modules retain the existing Study Mode notes and flashcards.
The editor appears **inside the current question**, not as another crowded
navigation panel. The canvas supports actors, use-case ellipses, class boxes,
action rectangles, decisions, initial/final nodes, line/arrow/dashed connectors,
freehand pen, eraser, typed labels, undo/redo, clear and PNG/JPEG/WebP uploads.
It supports mouse and touch. On narrow screens the tools scroll horizontally;
editable tables present each row with vertically stacked labelled cells.
Neither drawing nor editing requires an API.

### Movable UML objects (2026-09-29 update)

`editable-diagram.js` is loaded before `answer-workspace.js`; the legacy
raster-only editor remains as a fallback. **New diagrams save both**
`answer.image` (a JPEG for AI grading) and `answer.diagramModel` (editable
object positions, dimensions, labels, attached connector IDs and pen strokes).
Choose a shape, drag to create, then drag it using **Move**. Move is selected
automatically after creating a shape and on reopening saved object diagrams.
Use the bottom-right green handle to resize, and select a shape to change its
label. Undo, redo, Delete selected, keyboard arrow nudges and mouse/touch
pointer dragging are available. A line or arrow beginning and ending inside
a shape snaps to those objects and follows them when they move.

An old image-only answer (saved before this update), or an uploaded photograph,
can still be opened as a flat background. New shapes drawn on top remain
editable; the pixels inside the old flattened image cannot automatically
be converted back to individual objects. Uploading an image replaces the
current diagram canvas (Undo is available). A note-only submission must keep
`image:""` so it cannot bypass a question's required-drawing rule.

## Question schemas

### Diagram

```json
{
  "text": "Draw a use-case diagram from this scenario.",
  "marks": 20,
  "answerType": "uml-diagram",
  "grading": "ai",
  "diagramRequired": true,
  "diagramNoDrawingCapPercent": 0,
  "diagramNoDrawingNote": "A drawing is required for visual marks.",
  "correctAnswer": "Actors Customer and Staff, one labelled system boundary, ...",
  "aiRubric": ["Actors present", "Use cases present", "Correct associations"],
  "aiReferenceNotes": "How to assess alternative valid diagram arrangements.",
  "study": {
    "title": "Use case modelling",
    "simple": "A use case connects external actors to their goals in a system.",
    "steps": ["List actors.", "Draw the boundary.", "Connect actor goals."],
    "example": "Customer -> Submit order",
    "pitfall": "Do not confuse a use case with a sequence of workflow steps."
  }
}
```

### Fixed-answer table

```json
{
  "text": "Complete the classifications.",
  "marks": 4,
  "answerType": "table",
  "grading": "table",
  "tableColumns": [
    {"key": "name", "label": "Concept"},
    {"key": "type", "label": "Type"}
  ],
  "tableRows": 2,
  "tableFixedRows": true,
  "tableCorrectRows": [
    {"name": "Customer", "type": ["Domain entity", "Entity"]},
    {"name": "Checkout", "type": "Use case"}
  ],
  "correctAnswer": "Customer: Domain entity; Checkout: Use case."
}
```

The grader compares the expected non-empty cells independently and awards a
proportional mark. Alternate correct cell values can be arrays. Use a
rubric-based AI answer instead if arbitrary equivalent table layouts or
descriptions would be valid.

### Known command

```json
{
  "text": "Show the command to list files.",
  "marks": 2,
  "answerType": "command",
  "grading": "command",
  "correctAnswer": "ls -l",
  "acceptedAnswers": ["ls -l .", "ls -l ./"]
}
```

Commands are displayed and compared as text only. They are not evaluated in
a shell or connected to a student database.

### Open code or pseudocode

```json
{
  "text": "Write a function that checks whether a quote is present.",
  "marks": 5,
  "answerType": "code",
  "grading": "ai",
  "correctAnswer": "function valid(request): return request != null && request.quote != null",
  "aiRubric": [
    "Handles absent request safely",
    "Checks quote existence safely",
    "Returns a Boolean result",
    "Accepts equivalent pseudocode"
  ],
  "aiReferenceNotes": "A missing request must be checked before accessing quote."
}
```

The code editor is a multiline monospaced field with Tab indentation,
without auto-capitalisation, autocorrect or execution. The rubric looks for
required logical behaviour rather than matching one exact string.

## Security and cost

The UI uses ordinary browser JavaScript. No code or commands supplied by a
student are executed by the app. The diagram is stored with the student
answer and transmitted to the existing secure grader only on submission.
A secure server-side `GROQ_API_KEY` is still required for **AI** questions;
there is no key inside client-side code. Existing free-tier quota/availability
still governs those submissions; no separate paid drawing, table or code
service has been introduced. If AI marking is unavailable the submission
reports the error and permits retry rather than silently granting zero marks.

## ICT2622 source labels

The 2025 Jan/Feb (75-mark), 2025 Oct/Nov (60-mark) and 2026 Jan/Feb
(60-mark) packs are **original questions inspired by published exam topics and
structure**. The 2026 Assessment 1- and 2-style packs are independently
written from visible review topic coverage. The optional practical lab is NOT
a verified 2026 Assessment 3 and is labelled as such throughout. Never
misrepresent any of these packs as exact, fully transcribed university papers.

## Tests

```sh
node --check script.js
node --check answer-workspace.js
node --check modules/ict2622-mastery.js
node tests/ict2622-content.test.cjs
node tests/mastery-content.test.cjs
npm install --no-save --no-package-lock jsdom@25
node tests/answer-workspace-ui.test.cjs
node tests/mastery-ui.test.cjs
```
