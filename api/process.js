const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = async (req, res) => {
    try {
        const { pdfData, keywords } = req.body;
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
        
        res.status(200).json({ text: response.text() });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
};