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

        if (pdfData.length > 2 * 1024 * 1024) { // 2MB limit
            console.warn('PDF too large:', pdfData.length);
            return res.status(400).json({ error: 'PDF exceeds 2MB limit' });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            generationConfig: { responseMimeType: "text/plain" }
        });

        const prompt = `Extract complete sentences containing these keywords: ${keywords.join(", ")}.
            Format: [Page X] Sentence text...
            If none, say "No matches found."`;

        console.log('Sending request to Gemini...');
        const result = await model.generateContent({
            contents: [
                { text: prompt },
                {
                    inlineData: {
                        mimeType: "application/pdf",
                        data: pdfData
                    }
                }
            ]
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
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            status: error.status
        });

        let clientMessage = error.message;
        if (error.message.includes('400')) clientMessage = 'Invalid PDF format';
        if (error.message.includes('500')) clientMessage = 'AI processing failed';
        if (error.message.includes('403')) clientMessage = 'Authorization error - check API key';

        return res.status(500).json({ 
            error: clientMessage,
            systemError: error.message.slice(0, 100) // Truncate for security
        });
    }
};