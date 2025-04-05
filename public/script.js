async function processPDF() {
    const file = document.getElementById('pdfFile').files[0];
    const keywords = document.getElementById('keywords').value;
    const resultsDiv = document.getElementById('results');
    
    if (!file) {
        alert('Please select a PDF file');
        return;
    }

    if (!keywords) {
        alert('Please enter at least one keyword');
        return;
    }

    resultsDiv.textContent = 'Processing... (this may take a moment)';
    resultsDiv.style.color = 'black';

    try {
        // Read PDF as base64
        const base64PDF = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64String = reader.result.split(',')[1];
                if (!base64String) {
                    reject(new Error('Failed to convert file to base64'));
                }
                resolve(base64String);
            };
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });

        console.log('PDF converted to base64, size:', base64PDF.length);

        // Call backend API
        const response = await fetch('/api/process', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                pdfData: base64PDF,
                keywords: keywords.split(',').map(k => k.trim()).filter(k => k)
            })
        });

        console.log('API response status:', response.status);

        // First check if response is OK
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }

        // Then try to parse as JSON
        const data = await response.json();
        console.log('API response data:', data);

        if (data.error) {
            throw new Error(data.error);
        }

        if (!data.text) {
            throw new Error('No results returned from server');
        }

        resultsDiv.textContent = data.text;
    } catch (error) {
        console.error('Full error:', error);
        resultsDiv.style.color = 'red';
        
        if (error.message.includes('Failed to fetch')) {
            resultsDiv.textContent = 'Network error: Could not connect to server. Check your internet connection.';
        } else if (error.message.includes('Unexpected token')) {
            resultsDiv.textContent = 'Server returned invalid data. Please try a different PDF.';
        } else if (error.message.includes('No results returned')) {
            resultsDiv.textContent = 'No matches found for your keywords.';
        } else {
            resultsDiv.textContent = `Error: ${error.message}`;
        }
    }
}

// Add event listeners for better UX
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('keywords').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            processPDF();
        }
    });
    
    document.getElementById('pdfFile').addEventListener('change', (e) => {
        if (e.target.files[0]?.size > 2 * 1024 * 1024) {
            alert('Warning: PDF files larger than 2MB may not process correctly');
        }
    });
});