const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = async (req, res) => {
    try {
        // Check for POST method
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        const { pdfData, keywords } = req.body;
        
        // Validate input
        if (!pdfData || !keywords?.length) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `Extract all complete sentences from the document that contain any of these keywords: ${keywords.join(", ")}. 
            Return only the exact sentences with their page numbers in this format:
            [Page X] Sentence text here...
            If no matches found, state "No matches found."`;

        const contents = [
            { text: prompt },
            {
                inlineData: {
                    mimeType: "application/pdf",
                    data: pdfData
                }
            }
        ];

        const result = await model.generateContent({ contents });
        const response = await result.response;
        
        // Ensure we have valid text response
        if (!response.text) {
            throw new Error('No response text from Gemini');
        }

        res.status(200).json({ text: response.text() });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ 
            error: error.message,
            ...(error.response?.text) && { geminiResponse: error.response.text() }
        });
    }
};