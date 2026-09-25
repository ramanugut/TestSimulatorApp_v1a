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
