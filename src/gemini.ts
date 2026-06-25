import { GoogleGenerativeAI } from "@google/generative-ai";


const genAI = new GoogleGenerativeAI(
  import.meta.env.VITE_GEMINI_API_KEY
);

export async function generateStudyPlan(prompt: string) {
  try {
    const model = genAI.getGenerativeModel({
   model: "gemini-3.1-flash-lite"
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;

    return response.text();
  } catch (err: any) {
    console.error("Error details:", err);
    return err.message;
  }
}

// ============================================
// Low Motivation Mode — AI Suggestion Engine
// ============================================

export interface MotivationContext {
  reason: string;
  overdueAssignments: { title: string; dueDate: string }[];
  upcomingAssignments: { title: string; dueDate: string }[];
  revisionTopics: { topic: string; lastRevised: string }[];
  recentTopic: string | null;
  previousSuggestion?: string;
}

export interface MotivationSuggestion {
  encouragement: string;
  recommendedTask: string;
  tinyTasks: string[];
  minimumWin: string;
}

function buildMotivationPrompt(context: MotivationContext): string {
  const reasonGuidance: Record<string, string> = {
    'mentally tired': 'The student is mentally tired. Prefer revision over learning new concepts. Suggest rest-friendly activities: reading notes, organizing tasks, reviewing flashcards, or a short breathing exercise. Avoid anything requiring heavy new thinking.',
    'overwhelmed': 'The student feels overwhelmed. Break work into the smallest possible step. Recommend only ONE assignment to focus on, and favor confidence-building, quick-win activities.',
    "don't know what to study": "The student doesn't know what to study. Pick the highest priority item from the data below (closest deadline first). If there are no assignments at all, recommend revising the most recently studied topic instead.",
    'something else': 'Give a balanced set of recommendations using all the data below.'
  };

  const guidance = reasonGuidance[context.reason.toLowerCase()] || reasonGuidance['something else'];

  return `
You are a warm, supportive study buddy helping a student who doesn't feel like studying today. You are NOT a strict productivity coach — keep the tone gentle and encouraging.

Student's reason: "${context.reason}"
What to do for this reason: ${guidance}

Student's real data (only reference items from this list — never invent assignment or topic names):
- Overdue assignments: ${context.overdueAssignments.length ? context.overdueAssignments.map(a => `${a.title} (was due ${a.dueDate})`).join('; ') : 'none'}
- Upcoming assignments: ${context.upcomingAssignments.length ? context.upcomingAssignments.map(a => `${a.title} (due ${a.dueDate})`).join('; ') : 'none'}
- Revision topics: ${context.revisionTopics.length ? context.revisionTopics.map(r => `${r.topic} (last revised ${r.lastRevised})`).join('; ') : 'none'}
- Most recently studied topic: ${context.recentTopic || 'none'} 
${context.previousSuggestion ? `\nThe student already saw this suggestion and asked for something different: "${context.previousSuggestion}". Give a noticeably different recommendedTask and different tinyTasks this time.` : ''}

Hard rules:
- NEVER suggest completing an entire assignment or a big task. Every single suggestion must be doable in 5-15 minutes.
- Every task must be specific and based on the real data above, not generic advice.
- Keep every piece of text short — one sentence each, no long paragraphs.
- Tone: warm, like a caring friend, never preachy.

Respond with ONLY raw JSON, no markdown formatting, no code fences, no extra commentary — exactly this shape:
{
  "encouragement": "one short encouraging sentence",
  "recommendedTask": "one specific assignment or revision topic to focus on today, one short sentence",
  "tinyTasks": ["tiny task 1", "tiny task 2", "tiny task 3"],
  "minimumWin": "the smallest possible version of a win for today, one short sentence"
}
`.trim();
}

function parseMotivationResponse(raw: string): MotivationSuggestion | null {
  try {
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (
      typeof parsed.encouragement === 'string' &&
      typeof parsed.recommendedTask === 'string' &&
      Array.isArray(parsed.tinyTasks) &&
      typeof parsed.minimumWin === 'string'
    ) {
      return parsed as MotivationSuggestion;
    }
    return null;
  } catch {
    return null;
  }
}

export async function generateMotivationSuggestion(
  context: MotivationContext
): Promise<MotivationSuggestion> {
  const prompt = buildMotivationPrompt(context);

  // Reuses your existing, already-working generateStudyPlan call as the transport —
  // this avoids guessing at your API setup and just changes what we ask Gemini for.
  const rawResult = await generateStudyPlan(prompt);

  const parsed = parseMotivationResponse(rawResult);
  if (parsed) return parsed;

  // Safety net: if Gemini ever returns something that isn't valid JSON,
  // this keeps the UI from breaking instead of crashing.
  return {
    encouragement: "It's okay to take it slow today.",
    recommendedTask: context.recentTopic ? `Revisit ${context.recentTopic}` : 'Pick one small thing to do',
    tinyTasks: [
      'Skim your notes for 5 minutes',
      'Write down what feels hardest right now',
      'Tidy up your task list for tomorrow'
    ],
    minimumWin: "Open one file or note — that's it."
  };
}