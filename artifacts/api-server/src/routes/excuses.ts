import { Router } from "express";
import { db } from "@workspace/db";
import { excusesTable, studentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  AnalyzeExcuseBody,
  SaveExcuseBody,
  ListExcusesQueryParams,
} from "@workspace/api-zod";

const router = Router();

// ─── Rule-based excuse analyzer ───────────────────────────────────────────────
// Categorizes absence excuses as Valid, Invalid, or Needs Review based on
// linguistic and semantic patterns without requiring an external API.

interface AnalysisResult {
  verdict: "Valid" | "Invalid" | "Needs Review";
  confidence: number;
  reasoning: string;
  suggestedAction: string;
  keyFactors: string[];
}

function analyzeExcuseText(text: string, studentName?: string): AnalysisResult {
  const lower = text.toLowerCase().trim();

  // ── Valid indicators ──────────────────────────────────────────────────────
  const validPatterns = [
    { pattern: /\b(doctor|physician|hospital|clinic|emergency room|er)\b/, factor: "Medical appointment or emergency" },
    { pattern: /\b(sick|ill|illness|fever|flu|covid|nausea|vomiting|diarrhea|migraine|infection)\b/, factor: "Illness or medical condition" },
    { pattern: /\b(death|funeral|bereavement|passed away|lost.*family|family.*lost)\b/, factor: "Bereavement / family death" },
    { pattern: /\b(surgery|operation|procedure|hospitalized|hospitalization)\b/, factor: "Medical procedure" },
    { pattern: /\b(court|legal|subpoena|jury|mandatory)\b/, factor: "Legal obligation" },
    { pattern: /\b(natural disaster|flood|hurricane|tornado|earthquake|evacuation)\b/, factor: "Natural disaster or emergency" },
    { pattern: /\b(car accident|accident|emergency)\b/, factor: "Emergency situation" },
    { pattern: /\b(documented|documentation|note|certificate|proof|verified)\b/, factor: "Documentation provided or mentioned" },
  ];

  // ── Invalid indicators ────────────────────────────────────────────────────
  const invalidPatterns = [
    { pattern: /\b(lazy|didn't feel like|didn't want to|overslept|slept in|woke up late)\b/, factor: "Avoidable personal reason" },
    { pattern: /\b(forgot|forget|remember)\b/, factor: "Forgetfulness" },
    { pattern: /\b(party|concert|fun|hangout|hanging out|shopping|trip.*vacation)\b/, factor: "Leisure activity" },
    { pattern: /\b(no reason|nothing|just because|bored)\b/, factor: "No valid reason given" },
    { pattern: /\b(video game|gaming|netflix|movie|tv show)\b/, factor: "Entertainment / leisure" },
  ];

  // ── Weak / needs-review indicators ───────────────────────────────────────
  const reviewPatterns = [
    { pattern: /\b(tired|exhausted|stressed|anxiety|mental health|overwhelmed)\b/, factor: "Mental or emotional health concern" },
    { pattern: /\b(family.*issue|personal.*issue|personal.*matter|family.*matter)\b/, factor: "Vague personal or family issue" },
    { pattern: /\b(transportation|bus|car.*broke|no ride)\b/, factor: "Transportation problem" },
    { pattern: /\b(appointment|schedule|conflict)\b/, factor: "Scheduling conflict" },
    { pattern: /\b(religious|observance|holiday|church|temple|mosque)\b/, factor: "Religious observance" },
    { pattern: /\b(work|job|employment|shift)\b/, factor: "Work-related reason" },
    { pattern: /\b(parent.*said|parents.*allowed|family.*trip|family.*event)\b/, factor: "Family-sanctioned absence" },
  ];

  // ── Credibility signals ───────────────────────────────────────────────────
  const hasSpecificDate = /\b(monday|tuesday|wednesday|thursday|friday|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}\/\d{1,2}|\d{1,2}-\d{1,2})\b/.test(lower);
  const isDetailed = text.split(" ").length > 15;
  const hasVagueText = text.split(" ").length < 5;
  const hasNegativeLanguage = /\b(lie|fake|made up|excuse|whatever)\b/.test(lower);

  // ── Score ─────────────────────────────────────────────────────────────────
  let validScore = 0;
  let invalidScore = 0;
  let reviewScore = 0;
  const keyFactors: string[] = [];

  for (const { pattern, factor } of validPatterns) {
    if (pattern.test(lower)) {
      validScore += 3;
      keyFactors.push(factor);
    }
  }
  for (const { pattern, factor } of invalidPatterns) {
    if (pattern.test(lower)) {
      invalidScore += 3;
      keyFactors.push(factor);
    }
  }
  for (const { pattern, factor } of reviewPatterns) {
    if (pattern.test(lower)) {
      reviewScore += 2;
      keyFactors.push(factor);
    }
  }

  if (hasSpecificDate) { validScore += 1; keyFactors.push("Specific date/time mentioned"); }
  if (isDetailed) { validScore += 1; keyFactors.push("Detailed explanation provided"); }
  if (hasVagueText) { invalidScore += 2; keyFactors.push("Very brief / vague explanation"); }
  if (hasNegativeLanguage) { invalidScore += 3; keyFactors.push("Dismissive or negative tone"); }

  // ── Verdict ───────────────────────────────────────────────────────────────
  let verdict: "Valid" | "Invalid" | "Needs Review";
  let confidence: number;
  let reasoning: string;
  let suggestedAction: string;

  const name = studentName ?? "The student";
  const total = validScore + invalidScore + reviewScore;

  if (total === 0) {
    verdict = "Needs Review";
    confidence = 0.4;
    reasoning = `${name}'s absence excuse does not clearly indicate a recognized valid or invalid reason. The explanation is too brief or ambiguous to categorize definitively.`;
    suggestedAction = "Contact the student or guardian to request additional details or documentation.";
  } else if (validScore >= invalidScore && validScore >= reviewScore && validScore >= 3) {
    verdict = "Valid";
    confidence = Math.min(0.95, 0.6 + (validScore / (total + 2)) * 0.4);
    reasoning = `${name}'s excuse contains strong indicators of a legitimate absence. ${keyFactors.slice(0, 3).join(", ")} suggest this was a genuine reason beyond the student's control.`;
    suggestedAction = invalidScore > 0
      ? "Accept the excuse but request supporting documentation (e.g., doctor's note) for your records."
      : "Accept the excuse. Consider requesting documentation if school policy requires it.";
  } else if (invalidScore >= validScore && invalidScore >= reviewScore && invalidScore >= 3) {
    verdict = "Invalid";
    confidence = Math.min(0.92, 0.6 + (invalidScore / (total + 2)) * 0.4);
    reasoning = `${name}'s excuse does not meet the criteria for a valid absence. Identified concerns: ${keyFactors.slice(0, 3).join(", ")}.`;
    suggestedAction = "Mark as unexcused absence. Notify parent/guardian and issue a reminder of the attendance policy.";
  } else {
    verdict = "Needs Review";
    confidence = Math.min(0.75, 0.45 + (reviewScore / (total + 2)) * 0.35);
    reasoning = `${name}'s excuse contains factors that require further evaluation: ${keyFactors.slice(0, 3).join(", ")}. This case falls in a gray area and warrants a conversation.`;
    suggestedAction = "Discuss directly with the student and/or guardian to clarify circumstances before making a final determination.";
  }

  // Limit key factors to the most relevant
  const uniqueFactors = [...new Set(keyFactors)].slice(0, 5);

  return { verdict, confidence: Math.round(confidence * 100) / 100, reasoning, suggestedAction, keyFactors: uniqueFactors };
}

// ─── Routes ────────────────────────────────────────────────────────────────────

// Analyze excuse
router.post("/excuses/analyze", async (req, res) => {
  try {
    const { excuseText, studentName, date } = AnalyzeExcuseBody.parse(req.body);
    const result = analyzeExcuseText(excuseText, studentName);
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to analyze excuse" });
  }
});

// List excuses
router.get("/excuses", async (req, res) => {
  try {
    const query = ListExcusesQueryParams.safeParse(req.query);
    const params = query.success ? query.data : {};

    const conditions = [];
    if (params.studentId != null) conditions.push(eq(excusesTable.studentId, params.studentId));
    if (params.verdict) conditions.push(eq(excusesTable.verdict, params.verdict as "Valid" | "Invalid" | "Needs Review"));

    const { and } = await import("drizzle-orm");
    const excuses = await db
      .select({
        id: excusesTable.id,
        studentId: excusesTable.studentId,
        studentName: studentsTable.name,
        attendanceId: excusesTable.attendanceId,
        excuseText: excusesTable.excuseText,
        verdict: excusesTable.verdict,
        confidence: excusesTable.confidence,
        reasoning: excusesTable.reasoning,
        suggestedAction: excusesTable.suggestedAction,
        createdAt: excusesTable.createdAt,
      })
      .from(excusesTable)
      .leftJoin(studentsTable, eq(studentsTable.id, excusesTable.studentId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(excusesTable.createdAt);

    res.json(excuses);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list excuses" });
  }
});

// Save excuse
router.post("/excuses", async (req, res) => {
  try {
    const data = SaveExcuseBody.parse(req.body);
    const [excuse] = await db.insert(excusesTable).values({
      studentId: data.studentId,
      attendanceId: data.attendanceId,
      excuseText: data.excuseText,
      verdict: data.verdict as "Valid" | "Invalid" | "Needs Review",
      confidence: data.confidence,
      reasoning: data.reasoning,
      suggestedAction: data.suggestedAction,
    }).returning();

    const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, excuse.studentId));
    res.status(201).json({ ...excuse, studentName: student?.name ?? null });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to save excuse" });
  }
});

export default router;
