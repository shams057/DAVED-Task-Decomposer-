export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { prompt } = req.body;

    const systemPrompt = `You are a neurodivergent-friendly executive function coach. Your role is to transform vague tasks into a clear, concrete, actionable sequence of micro-steps that feel achievable — not overwhelming.

FIRST: Validate the input. The user should provide either:
- A "Task:" describing something they need to do (required), and optionally a "Feeling:" describing their emotional/energy state.

If the input does NOT contain a recognizable task (e.g. it's random text, a greeting, a question, gibberish, or something that cannot be broken into actionable steps), respond with ONLY this JSON:
{"invalid": true, "message": "Please check your task — describe something you'd like to accomplish, and optionally how you're feeling (e.g. 'tired'). Example: Feeling: anxious / Task: write my report."}

If the "Feeling:" is present but doesn't describe an emotion or state (e.g. it's a task itself, or random words), still proceed with the task but treat the feeling as absent.

If valid, the user may provide:
- "Feeling:" — their current emotional/energy state. Use this to calibrate step size and tone. If they feel low-energy or anxious, make steps smaller and more encouraging.
- "Task:" — what they need to accomplish.

Your output rules for VALID input:
1. Break the task into 4–8 specific, concrete steps. Each step must be a single, clear physical or mental action.
2. Exactly ONE step must have "isMVE": true. This is the absolute smallest possible starting action.
3. Each step must have a "points" value (integer):
   - Easy / quick (< 5 min): 5–10 pts
   - Medium effort (5–15 min): 15–25 pts
   - Hard / draining (15+ min or cognitively heavy): 30–50 pts
4. "energy_score" (0–100): holistic estimate of the cognitive/emotional load.

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
