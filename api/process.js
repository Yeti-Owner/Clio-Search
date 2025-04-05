const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Google Generative AI with API key from environment variables
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

module.exports = async (req, res) => {
    console.log('\n--- New Request Received ---');
    console.log('Method:', req.method);
    console.log('Content-Type:', req.headers['content-type']);

    try {
        // 1. Validate HTTP method
        if (req.method !== 'POST') {
            console.warn('Rejected: Method not allowed');
            return res.status(405).json({ 
                error: 'Only POST requests are allowed',
                receivedMethod: req.method
            });
        }

        // 2. Validate Content-Type
        if (!req.headers['content-type']?.includes('application/json')) {
            console.warn('Rejected: Invalid Content-Type');
            return res.status(400).json({ 
                error: 'Content-Type must be application/json',
                receivedContentType: req.headers['content-type']
            });
        }

        // 3. Parse and validate request body
        const { pdfData, keywords } = req.body;
        
        if (!pdfData) {
            console.warn('Rejected: Missing PDF data');
            return res.status(400).json({ error: 'PDF data is required' });
        }

        if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
            console.warn('Rejected: Invalid keywords');
            return res.status(400).json({ error: 'At least one keyword is required' });
        }

        // 4. Validate PDF size (2MB limit)
        const pdfSizeInMB = Buffer.byteLength(pdfData, 'base64') / (1024 * 1024);
        if (pdfSizeInMB > 2) {
            console.warn(`Rejected: PDF too large (${pdfSizeInMB.toFixed(2)}MB)`);
            return res.status(400).json({ 
                error: 'PDF exceeds 2MB size limit',
                actualSize: `${pdfSizeInMB.toFixed(2)}MB`
            });
        }

        console.log('Request validated. Processing...');
        console.log('Keywords:', keywords);
        console.log(`PDF size: ${pdfSizeInMB.toFixed(2)}MB`);

        // 5. Initialize model with specific configuration
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: {
                responseMimeType: "text/plain",
                temperature: 0.3
            }
        });

        // 6. Prepare prompt with clear instructions
        const prompt = `Analyze the document and extract complete sentences containing these keywords: ${keywords.join(", ")}.
        
        Requirements:
        - Return only exact sentences with their page numbers
        - Format: "[Page X] Sentence text..."
        - If no matches found, respond with "No matches found"
        - Preserve original wording and punctuation
        - Ignore partial matches or keyword fragments`;

        // 7. Process the document
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

        // 8. Handle response
        const response = await result.response;
        const text = response.text();

        if (!text) {
            console.error('Empty response from Gemini');
            return res.status(500).json({ error: 'Received empty response from AI service' });
        }

        console.log('Successfully processed request');
        console.log('Response length:', text.length);
        
        return res.status(200).json({ 
            text: text,
            metadata: {
                keywords: keywords,
                pagesAnalyzed: text.match(/\[Page \d+\]/g)?.length || 0
            }
        });

    } catch (error) {
        console.error('\n--- ERROR DETAILS ---');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        
        // Handle specific Gemini API errors
        let statusCode = 500;
        let errorMessage = 'Processing failed';
        
        if (error.message.includes('400')) {
            statusCode = 400;
            errorMessage = 'Invalid PDF format or content';
        } 
        else if (error.message.includes('429')) {
            statusCode = 429;
            errorMessage = 'API rate limit exceeded';
        }
        else if (error.message.includes('403')) {
            statusCode = 403;
            errorMessage = 'Authentication failed - check API key';
        }

        return res.status(statusCode).json({ 
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};