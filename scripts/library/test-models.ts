import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  const response = await ai.models.list();
  for await (const m of response) {
    if (m.name?.includes('embed')) {
      console.log(m.name, (m as any).supportedGenerationMethods);
    }
  }
}
run();
