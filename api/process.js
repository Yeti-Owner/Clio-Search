const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = async (req, res) => {
    console.log('Request received. Method:', req.method);
    
    try {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        const { pdfData, keywords = [], topics = [] } = req.body;

        if (!pdfData || (keywords.length === 0 && topics.length === 0)) {
            return res.status(400).json({ error: 'Missing PDF data or search terms' });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-pro-latest",
            generationConfig: { 
                responseMimeType: "text/plain",
                temperature: 0.3 // Slightly higher for better recall
            }
        });

        const prompt = `Analyze this document thoroughly with priority on CONTENT ACCURACY over formatting. Follow these rules:

1. Search for ALL mentions of:
   - Exact terms: ${keywords.map(k => `"${k}"`).join(', ')}
   - Topics: ${topics.map(t => `[${t}]`).join(', ')}

2. Include ALL matches regardless of:
   - Text orientation (rotated/upside-down)
   - Page layout
   - Font variations
   - Case sensitivity

3. For sensitive topics (like [incest]), be comprehensive but professional

4. Return format (PRIORITIZE CONTENT OVER PERFECT FORMATTING):
   [Page X] Full sentence or relevant passage
   (Match type: ${keywords.length > 0 ? 'KEYWORD' : ''}${keywords.length > 0 && topics.length > 0 ? ' or ' : ''}${topics.length > 0 ? 'TOPIC' : ''})

5. If no matches found after thorough search, say: "No matches found after comprehensive analysis"`;

        const result = await model.generateContent({
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            data: pdfData,
                            mimeType: "application/pdf"
                        }
                    }
                ]
            }]
        });

        const response = await result.response;
        let resultText = response.text();

        // Clean up while preserving matches
        resultText = resultText
            .replace(/\(\s*Match\s*type\s*:\s*/gi, '(Match type: ')
            .replace(/No matches found/gi, 'No matches found after comprehensive analysis');

        return res.status(200).json({ text: resultText });

    } catch (error) {
        console.error('Error:', error.stack);
        return res.status(500).json({ 
            error: 'Analysis failed - please try again or check document quality',
            details: error.message.slice(0, 100)
        });
    }
};