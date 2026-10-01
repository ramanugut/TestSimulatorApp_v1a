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

  const requestMode = body.mode === "tutor" ? "tutor" : "grade";

  const rawDiagramImage = typeof body.diagramImage === "string"
    ? body.diagramImage.trim()
    : "";
  const validImage =
    /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(rawDiagramImage) &&
    rawDiagramImage.length <= 3_000_000;
  if (rawDiagramImage && !validImage) {
    return jsonResponse({ error: "Invalid or oversized diagram image." }, 400, origin);
  }
  const diagramImage = validImage ? rawDiagramImage : "";
  const diagramRequired = body.diagramRequired === true;
  // Keep the 2021 default deduction, but allow other papers to set a different rule.
  const rawNoDrawingCap = body.diagramNoDrawingCapPercent;
  const diagramNoDrawingCapPercent =
    typeof rawNoDrawingCap === 'number' && Number.isFinite(rawNoDrawingCap)
      ? Math.max(0, Math.min(100, rawNoDrawingCap))
      : 50;
  const diagramNoDrawingNote = cleanText(body.diagramNoDrawingNote, 800);
  const question = cleanText(body.question, 8000);
  const studentAnswer = cleanText(body.studentAnswer, 10000) ||
    (diagramImage ? "See attached Activity-on-Arrow network drawing." : "");
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

  if (
    !question ||
    !modelAnswer ||
    (requestMode === "grade" && !studentAnswer)
  ) {
    return jsonResponse(
      {
        error:
          requestMode === "tutor"
            ? "Question and reference material are required for AI tutoring."
            : "Question, student answer and reference answer are required for AI marking.",
      },
      400,
      origin
    );
  }

  const markerSystemPrompt = [
    "You are a fair university study-practice marker for the subject named in the question and its reference notes. Mark diagrams, written answers, code and structured explanations against their specific rubric.",
    "CRITICAL SOURCE RULE: only the field named studentAnswer and any submitted diagram image are the learner's work.",
    "The fields referenceAnswer, markingRubric, and bookReference are reference material written for marking/study support. They are NOT statements made by the learner.",
    "Never attribute wording, ideas, examples, steps, definitions, or explanations from the reference material to the learner unless the same idea is actually present in studentAnswer or clearly visible in the submitted diagram.",
    "Do not say phrases such as 'you correctly described', 'you mentioned', 'you identified', or 'your explanation shows' unless the claimed point is supported by the learner's actual submission.",
    "Every item in strengths must be supported by something the learner actually wrote or drew. If the learner did not state a reference point, place it in missingPoints instead of strengths.",
    "When referring to study material, say 'the reference answer explains...' or 'the study notes add...' rather than implying the learner wrote it.",
    "Mark the learner's UNDERSTANDING, not whether they copied the reference answer word for word.",
    "Different wording, sentence structure, examples, and order are acceptable when the meaning is accurate.",
    "Do not penalize spelling, grammar, or simple English unless it changes the meaning.",
    "Award partial credit when the learner understands some but not all required ideas.",
    "Do not award credit for vague statements that do not actually show the concept.",
    "If the learner contradicts a core principle, reduce the score even if other keywords are present.",
    "Use only the supplied question, learner submission, reference answer, rubric, and reference notes. Do not introduce unrelated requirements.",
    "The reference answer is a marking guide, not a phrase-matching template and not part of the learner's response.",
    "For submitted drawings, identify the diagram type from the question. Examine visible labels, actors, use cases, associations, cardinalities, class attributes, decisions, arrows and flow as relevant. Only award marks for elements actually present and readable.",
    "Apply each paper's own missing-diagram rule. The INF3708 2021 Q5.1 penalty of 7/14 must NOT be applied to other papers.",
    "If a drawing is supplied, award partial marks fairly for diagram structure and any correct readable calculations.",
    "Return concise, helpful feedback that teaches the learner what they understood and what they should improve, while keeping learner work and reference material clearly separate.",
    "Return JSON with score (0-100 number), verdict (correct, mostly_correct, partially_correct, incorrect), feedback, strengths (string array), missingPoints (string array), and bookAlignment (string).",
  ].join("\n");

  const tutorSystemPrompt = [
    "You are a patient university study tutor. This request is for teaching, NOT marking.",
    "No learner exam answer is being graded in tutor mode.",
    "The question, reference answer, rubric and study notes are teaching context only. They are NOT statements written by the learner.",
    "Never say 'you correctly described', 'you mentioned', 'you identified', 'your explanation shows', or similar wording based on reference material.",
    "Explain the concept in plain English, define important terms, and show how to approach similar questions.",
    "Use feedback for the main teaching explanation.",
    "Use strengths for useful foundations or rules from the reference material, but describe them as concepts or reference points, never as learner achievements.",
    "Use missingPoints for key ideas the learner should still understand or remember.",
    "Use bookAlignment for one short Student note, memory tip, or course-context reminder.",
    "Do not discuss marks, scores or verdicts in the visible teaching text.",
    "Return JSON with score, verdict, feedback, strengths, missingPoints, and bookAlignment using the required schema.",
  ].join("\n");

  const systemPrompt =
    requestMode === "tutor" ? tutorSystemPrompt : markerSystemPrompt;

  const userPrompt = JSON.stringify(
    requestMode === "tutor"
      ? {
          tutorTask: question,
          referenceMaterialDoNotAttributeToLearner: {
            referenceAnswer: modelAnswer,
            suggestedTeachingPoints: rubric,
            bookReference: {
              chapter,
              section,
              notes: referenceNotes,
            },
          },
          tutoringInstruction:
            "Teach from the reference material without treating any of it as learner-authored text. Put the main explanation in feedback, useful concept foundations in strengths, important follow-up ideas in missingPoints, and one Student note or memory tip in bookAlignment. Set score to 100 and verdict to correct because this is not a marking request.",
        }
      : {
          question,
          learnerSubmission: {
            studentAnswer,
            diagramProvided: Boolean(diagramImage),
          },
          referenceMaterialDoNotAttributeToLearner: {
            referenceAnswer: modelAnswer,
            markingRubric: rubric,
            bookReference: {
              chapter,
              section,
              notes: referenceNotes,
            },
          },
          passThreshold: minimumScore,
          diagramRequired,
          markingInstruction:
            "Score semantic accuracy and coverage from 0 to 100. A learner can earn full marks using different valid wording. Attribute strengths only to content in learnerSubmission. Treat all referenceMaterialDoNotAttributeToLearner content only as marking/study guidance.",
        },
    null,
    2
  );

  try {
    const model =
      requestMode === "grade" && diagramImage
        ? "qwen/qwen3.8-27b"
        : "openai/gpt-oss-120b";
    const userContent = requestMode === "grade" && diagramImage
      ? [
          { type: "text", text: userPrompt },
          { type: "image_url", image_url: { url: diagramImage } },
        ]
      : userPrompt;
    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          ...(requestMode === "grade" && diagramImage
            ? { max_completion_tokens: 1600 }
            : { reasoning_effort: "low" }),
          temperature: 0,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          response_format: requestMode === "grade" && diagramImage ? { type: "json_object" } : {
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

    if (requestMode === "tutor") {
      return jsonResponse(
        {
          score: 100,
          accepted: true,
          verdict: "correct",
          feedback: typeof grade.feedback === "string" ? grade.feedback : "",
          strengths: Array.isArray(grade.strengths) ? grade.strengths.slice(0, 5) : [],
          missingPoints: Array.isArray(grade.missingPoints)
            ? grade.missingPoints.slice(0, 5)
            : [],
          bookAlignment:
            typeof grade.bookAlignment === "string" ? grade.bookAlignment : "",
          mode: "tutor",
        },
        200,
        origin
      );
    }

    const withoutDrawing = diagramRequired && !diagramImage;
    const cap = withoutDrawing ? diagramNoDrawingCapPercent : 100;
    const score = Math.max(0, Math.min(cap, Number(grade.score) || 0));
    const deductionMessage = withoutDrawing
      ? (diagramNoDrawingNote || "No drawn network was supplied: the original paper deducts 7 of 14 marks, so this answer is capped at 50%.")
      : "";
    const verdict = score >= 85 ? "correct"
      : score >= minimumScore ? "mostly_correct"
      : score >= 35 ? "partially_correct" : "incorrect";

    return jsonResponse(
      {
        score,
        accepted: score >= minimumScore,
        verdict,
        feedback: [typeof grade.feedback === "string" ? grade.feedback : "", deductionMessage]
          .filter(Boolean).join(" "),
        strengths: Array.isArray(grade.strengths) ? grade.strengths.slice(0, 5) : [],
        missingPoints: [
          ...(Array.isArray(grade.missingPoints) ? grade.missingPoints.slice(0, 4) : []),
          ...(withoutDrawing ? [diagramNoDrawingNote || "Draw or upload the Activity-on-Arrow network to avoid the 7-mark deduction."] : []),
        ],
        bookAlignment: typeof grade.bookAlignment === "string" ? grade.bookAlignment : "",
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
