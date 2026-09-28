# AI written-answer grading

The app supports semantic AI marking for questions where the learner can explain the same correct concept in different words.

## Question format

```json
{
  "text": "Explain the concept in your own words.",
  "grading": "ai",
  "aiPassScore": 70,
  "correctAnswer": "Reference/model answer used as a marking guide.",
  "aiRubric": [
    "Key idea the learner should explain",
    "Another required idea",
    "Accept equivalent wording and valid examples"
  ],
  "aiReferenceNotes": "Short notes grounded in the prescribed book.",
  "study": {
    "chapter": "Chapter 4 – Project Integration Management",
    "section": "Relevant section",
    "simple": "Simple study explanation"
  }
}
```

The learner's answer is compared for meaning and coverage rather than exact wording. The AI returns a 0–100 score, verdict, short feedback, strengths and missing points. The score contributes proportionally to the test percentage.

## Security

Never put the Groq API key in JSON, `app-config.js`, `script.js`, HTML, or any browser-delivered file.

The serverless grader reads `GROQ_API_KEY` from the hosting provider's secret environment variables.

## Runtime endpoint

Set the deployed secure grader URL in `app-config.js`:

```js
window.APP_CONFIG = {
  aiGraderEndpoint: "https://YOUR-BACKEND.example/api/grade-answer"
};
```

The included Netlify function is at:

`netlify/functions/grade-answer.mts`

and exposes:

`/api/grade-answer`

## Full written examination: INF3708 Oct/Nov 2021

The exam file inf3708-oct-nov-2021.json contains 16 answer parts belonging to Questions 1–6,
with the original **100 marks** (marks per question), durationMinutes: 150 and
preserveOrder: true, the case study and the original calculation tables.
Written and calculation answers use grading: ai with separate reference answers and
point-by-point aiRubric fields. Show working: the AI awards partial credit
for correct methods and reasonable rounding.

Scoring uses each question's marks as its weight. Older tests without marks
still count one point per question. PDF results use the same weights and show AI feedback.

### Q5.1: Activity-on-Arrow network diagram

Set answerType: diagram and diagramRequired: true. The simulator offers a drawing
canvas and a PNG/JPEG/WebP upload with an optional written explanation.
Drawn images are retained in the learner's local saved progress, then sent
to the secure grader on submission. They are compressed to a 960 × 480 JPEG
and are not stored in the repository.

For images, the grader uses Groq's image-capable qwen/qwen3.8-27b in JSON mode
to inspect arrows, durations, dependencies and event labels. Text-only answers
still use openai/gpt-oss-120b. The original paper deducts **7 of 14 marks**
when no network is drawn, so the backend caps text-only Q5.1 at 50%.
Accept equivalent valid event numbering and network representations.

AI marks are for study practice, not official UNISA grading. If the AI service
is unavailable the app asks the learner to retry, without treating a failed
request as an incorrect answer. After merging, redeploy the Netlify site
containing netlify/functions/grade-answer.mts and keep GROQ_API_KEY
in Netlify's secure environment variables.
