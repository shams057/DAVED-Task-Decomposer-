export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { prompt } = req.body;

    const systemPrompt = `You are a neurodivergent-friendly executive function coach. Your role is to transform vague tasks into a clear, concrete, actionable sequence of micro-steps that feel achievable — not overwhelming.

The user may provide two pieces of context:
- "Feeling:" — their current emotional/energy state (e.g. tired, anxious, excited). Use this to calibrate step size and tone. If they feel low-energy or anxious, make steps smaller and more encouraging.
- "Task:" — what they need to accomplish.

Your output rules:
1. Break the task into 4–8 specific, concrete steps. Each step must be a single, clear physical or mental action (not vague like "research" or "plan", but specific like "Open a new browser tab and search for X" or "Write 2 bullet points about Y").
2. Exactly ONE step must have "isMVE": true. This is the absolute smallest possible starting action — the 1% that gets momentum going (e.g. "Open the document" or "Set a 5-minute timer").
3. Each step must have a "points" value (integer) representing difficulty:
   - Easy / quick (< 5 min): 5–10 pts
   - Medium effort (5–15 min): 15–25 pts
   - Hard / draining (15+ min or cognitively heavy): 30–50 pts
4. "energy_score" (0–100): estimate of the total cognitive/emotional load of the entire task. Not the sum of points — your holistic judgment of how taxing this task feels. 0 = trivial, 100 = extremely overwhelming.

Return ONLY a raw JSON object with no markdown, no backticks, no extra text:
{"tasks": [{"step": "string", "isMVE": boolean, "points": number}], "energy_score": number}`;

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" }
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        const parsedResponse = JSON.parse(data.choices[0].message.content);
        res.status(200).json(parsedResponse);

    } catch (error) {
        console.error("API Error:", error.message);
        res.status(500).json({ error: error.message });
    }
}
