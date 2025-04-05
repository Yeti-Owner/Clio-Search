const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = async (req, res) => {
    console.log('Request received. Method:', req.method);
    
    try {
        if (req.method !== 'POST') {
            console.warn('Method not allowed:', req.method);
            return res.status(405).json({ error: 'Method not allowed' });
        }

        const { pdfData, keywords } = req.body;
        console.log('Request body received with keywords:', keywords);
        console.log('PDF data length:', pdfData?.length);

        if (!process.env.GEMINI_API_KEY) {
            console.error('Missing API key');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        if (!pdfData || !keywords?.length) {
            console.warn('Invalid request parameters');
            return res.status(400).json({ error: 'Missing PDF data or keywords' });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-pro-latest", // Updated model name
            generationConfig: { responseMimeType: "text/plain" }
        });

        const prompt = `Extract complete sentences containing these keywords: ${keywords.join(", ")}.
            Format: [Page X] Sentence text...
            If none, say "No matches found."`;

        console.log('Sending request to Gemini...');
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

        console.log('Received Gemini response');
        const response = await result.response;
        
        if (!response.text) {
            console.error('No text in Gemini response:', response);
            return res.status(500).json({ error: 'Empty response from AI' });
        }

        console.log('Successfully processed request');
        return res.status(200).json({ text: response.text() });

    } catch (error) {
        console.error('Full error stack:', error.stack);
        return res.status(500).json({ 
            error: error.message.includes('400') ? 'Invalid PDF format' : 'Processing failed',
            details: error.message.slice(0, 100)
        });
    }
};