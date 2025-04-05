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
            model: "gemini-1.5-pro-latest",
            generationConfig: { 
                responseMimeType: "text/plain",
                temperature: 0.2 // More precise responses
            }
        });

        const prompt = `ANALYZE THIS DOCUMENT THOROUGHLY. Follow these instructions:
1. Process ALL pages including rotated/upside-down text and multi-column layouts
2. First identify the PDF page number (starting from 1) and any VISIBLE page numbers in the document content
3. Search for these keywords: ${keywords.join(", ")}
4. For each match, return:
   [PDF Page X | Content Page Y] Full sentence with keyword
   - X = PDF page number (1-based)
   - Y = Visible page number in document (if exists)
5. Include text from images/scan
6. Preserve original capitalization
7. If no matches, say "No matches found in document"

EXAMPLE RESPONSE:
[PDF Page 1 | Content Page 128] "The historical significance of the keyword example is evident in..."
[PDF Page 2 | Content Page 129] "As shown in the diagram, example usage demonstrates..."`;

        console.log('Sending enhanced request to Gemini...');
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

        // Post-process response
        const formattedText = response.text()
            .replace(/(\d+)\s*\|\s*(\d+)/g, 'PDF Page $1 | Content Page $2') // Standardize numbering
            .replace(/No matches found/gi, 'No matches found in document');

        console.log('Successfully processed request');
        return res.status(200).json({ text: formattedText });

    } catch (error) {
        console.error('Full error stack:', error.stack);
        return res.status(500).json({ 
            error: error.message.includes('400') ? 'Invalid PDF format' : 'Processing failed',
            details: error.message.slice(0, 100)
        });
    }
};