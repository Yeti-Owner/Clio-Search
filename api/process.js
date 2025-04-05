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
                temperature: 0.1
            }
        });

        const prompt = `ANALYZE THIS HISTORICAL DOCUMENT. Follow these rules:
1. Process ALL text including rotated pages and scanned content
2. Identify both PDF page numbers and document's visible page numbers
3. Search for:
   - EXACT matches of: ${keywords.map(k => `"${k}"`).join(', ')} ${keywords.length > 0 ? '(KEYWORD_MATCH)' : ''}
   - TOPIC discussions of: ${topics.map(t => `[${t}]`).join(', ')} ${topics.length > 0 ? '(TOPIC_MATCH)' : ''}
4. For each match, return EXACTLY this format:
   [PDF Page X | Doc Page Y] Full sentence
   (Match type: ${keywords.length > 0 ? 'KEYWORD' : ''}${keywords.length > 0 && topics.length > 0 ? ' or ' : ''}${topics.length > 0 ? 'TOPIC' : ''})
5. Preserve original text case
6. If no matches: "No historical matches found"

EXAMPLE OUTPUT:
[PDF Page 3 | Doc Page 128] "The Templar order was disbanded in 1312"
(Match type: KEYWORD)

[PDF Page 5 | Doc Page 130] Economic impacts included trade route changes
(Match type: TOPIC)`;

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
        let formattedText = response.text();

        // Clean up any residual formatting issues
        formattedText = formattedText
            .replace(/\(\s*:\s*/g, '(') // Fix ": " in parentheses
            .replace(/"\s*\)/g, '")') // Fix quotes before )
            .replace(/\(\s*Match\s*type\s*:\s*/gi, '(Match type: ') // Standardize match type
            .replace(/No matches found/gi, 'No historical matches found')
            .replace(/(\d+)\s*\|\s*(\d+)/g, 'PDF Page $1 | Doc Page $2');

        return res.status(200).json({ text: formattedText });

    } catch (error) {
        console.error('Error:', error.stack);
        return res.status(500).json({ 
            error: error.message.includes('400') ? 'Invalid document format' : 'Historical analysis failed',
            details: error.message.slice(0, 100)
        });
    }
};