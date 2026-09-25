// Redeploy after Netlify environment configuration
const ALLOWED_ORIGINS = new Set([
  "https://ramanugut.github.io",
  "http://localhost:8888",
  "http://127.0.0.1:8888",
]);

function corsHeaders(origin: string) {
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : "";
  return {
    "Content-Type": "application/json; charset=utf-8",
    ...(allowed
      ? {
          "Access-Control-Allow-Origin": allowed,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          Vary: "Origin",
        }
      : {}),
  };
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  origin: string
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(origin),
  });
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function cleanStringArray(value: unknown, maxItems = 12, maxItemLength = 600) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim().slice(0, maxItemLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

export default async (req: Request) => {
  const origin = req.headers.get("origin") || "";

  if (req.method === "OPTIONS") {
    if (!ALLOWED_ORIGINS.has(origin)) {
      return jsonResponse({ error: "Origin not allowed." }, 403, origin);
    }
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, origin);
  }

  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return jsonResponse({ error: "Origin not allowed." }, 403, origin);
  }

  const apiKey = Netlify.env.get("GROQ_API_KEY");
  if (!apiKey) {
    return jsonResponse(
      { error: "AI marking service is not configured." },
      503,
      origin
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "Invalid JSON request." }, 400, origin);
  }

  const question = cleanText(body.question, 8000);
  const studentAnswer = cleanText(body.studentAnswer, 10000);
  const modelAnswer = cleanText(body.modelAnswer, 12000);
  const referenceNotes = cleanText(body.referenceNotes, 12000);
  const chapter = cleanText(body.chapter, 300);
  const section = cleanText(body.section, 500);
  const rubric = cleanStringArray(body.rubric);
  const minimumScore = Math.max(
    0,
    Math.min(
      100,
      Number.isFinite(Number(body.minimumScore))
        ? Number(body.minimumScore)
        : 70
    )
  );

  if (!question || !studentAnswer || !modelAnswer) {
    return jsonResponse(
      {
        error:
          "Question, student answer and reference answer are required for AI marking.",
      },
      400,
      origin
    );
  }

  const systemPrompt = [
    "You are a fair university study-practice marker for INF3708 Software Project Management.",
    "Mark the learner's UNDERSTANDING, not whether they copied the reference answer word for word.",
    "Different wording, sentence structure, examples, and order are acceptable when the meaning is accurate.",
    "Do not penalize spelling, grammar, or simple English unless it changes the meaning.",
    "Award partial credit when the learner understands some but not all required ideas.",
    "Do not award credit for vague statements that do not actually show the concept.",
    "If the learner contradicts a core principle, reduce the score even if other keywords are present.",
    "Use only the supplied question, reference answer, rubric, and reference notes. Do not introduce unrelated requirements.",
    "The reference answer is a marking guide, not a phrase-matching template.",
    "Return concise, helpful feedback that teaches the learner what they understood and what they should improve.",
  ].join("\n");

  const userPrompt = JSON.stringify(
    {
      question,
      studentAnswer,
      referenceAnswer: modelAnswer,
      markingRubric: rubric,
      bookReference: {
        chapter,
        section,
        notes: referenceNotes,
      },
      passThreshold: minimumScore,
      markingInstruction:
        "Score semantic accuracy and coverage from 0 to 100. A learner can earn full marks using different valid wording. Base the verdict on the score and the supplied material.",
    },
    null,
    2
  );

  try {
    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          reasoning_effort: "low",
          temperature: 0,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "answer_grade",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  score: {
                    type: "number",
                    minimum: 0,
                    maximum: 100,
                  },
                  verdict: {
                    type: "string",
                    enum: [
                      "correct",
                      "mostly_correct",
                      "partially_correct",
                      "incorrect",
                    ],
                  },
                  feedback: { type: "string" },
                  strengths: {
                    type: "array",
                    items: { type: "string" },
                    maxItems: 5,
                  },
                  missingPoints: {
                    type: "array",
                    items: { type: "string" },
                    maxItems: 5,
                  },
                  bookAlignment: { type: "string" },
                },
                required: [
                  "score",
                  "verdict",
                  "feedback",
                  "strengths",
                  "missingPoints",
                  "bookAlignment",
                ],
              },
            },
          },
        }),
      }
    );

    const groqPayload = await groqResponse.json();

    if (!groqResponse.ok) {
      console.error("Groq grading error", groqResponse.status, groqPayload);
      return jsonResponse(
        { error: "AI marking service could not grade this answer." },
        502,
        origin
      );
    }

    const content = groqPayload?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      return jsonResponse(
        { error: "AI marking service returned an empty result." },
        502,
        origin
      );
    }

    const grade = JSON.parse(content);
    const score = Math.max(0, Math.min(100, Number(grade.score) || 0));

    return jsonResponse(
      {
        score,
        accepted: score >= minimumScore,
        verdict: grade.verdict,
        feedback: grade.feedback,
        strengths: grade.strengths,
        missingPoints: grade.missingPoints,
        bookAlignment: grade.bookAlignment,
      },
      200,
      origin
    );
  } catch (error) {
    console.error("AI grading function failed", error);
    return jsonResponse(
      { error: "AI marking service is temporarily unavailable." },
      500,
      origin
    );
  }
};

export const config = {
  path: "/api/grade-answer",
};
