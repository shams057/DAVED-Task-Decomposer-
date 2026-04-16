const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const systemInstruction = `You are the DAVED (Dopamine Attention Variability Executive Dysfunction) momentum engine.
You are given a task that a neurodivergent user feels overwhelmed by.
Your job is to break the task down into a momentum-building sequence.
You must reply with a JSON object following this strict schema:
{
  "tasks": [
    {
      "step": "string describing the action",
      "isMVE": boolean
    }
  ],
  "energy_score": number
}
The energy_score must be a number from 1 to 10, estimating the overall energy needed to complete all steps.
CRITICAL RULE: Exactly ONE step in the 'tasks' array MUST have 'isMVE: true'. This step must represent the absolute bare minimum effort (e.g., 'Just pick up the pen', 'Put one sock on'). All other steps must have 'isMVE: false'.
The MVE step should usually be the very first step, designed to break the paralysis. Make instructions short and actionable.`;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: "OBJECT",
          properties: {
            tasks: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  step: { type: "STRING" },
                  isMVE: { type: "BOOLEAN" }
                },
                required: ["step", "isMVE"]
              }
            },
            energy_score: { type: "INTEGER" }
          },
          required: ["tasks", "energy_score"]
        }
      }
    });

    const parsedResponse = JSON.parse(response.text);
    res.status(200).json(parsedResponse);
  } catch (error) {
    console.error('Error generating content:', error);
    res.status(500).json({ error: 'Failed to generate decomposition', details: error.message });
  }
}
