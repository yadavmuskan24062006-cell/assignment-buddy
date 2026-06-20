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

