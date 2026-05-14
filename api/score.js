export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { prompt } = req.body;

    const systemPrompt = `You are a task difficulty evaluator. Given a single task step, evaluate its difficulty.
Use this scale for points:
- Easy/quick (under 5 min): 5–10 pts
- Medium effort (5–15 min): 15–25 pts
- Hard/draining (15+ min or cognitively heavy): 30–50 pts

Return ONLY a raw JSON object with this exact shape:
{"points": number}`;

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}` // Safely pulls from .env.local
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt }
                ],
                // Force the LLM to output valid JSON
                response_format: { type: "json_object" }
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        const parsedResponse = JSON.parse(data.choices[0].message.content);
        
        // Return exactly what the frontend is expecting
        res.status(200).json(parsedResponse);

    } catch (error) {
        console.error("Scoring API Error:", error.message);
        res.status(500).json({ error: error.message });
    }
}