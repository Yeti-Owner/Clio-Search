async function processPDF() {
    const file = document.getElementById('pdfFile').files[0];
    const keywords = document.getElementById('keywords').value;
    const resultsDiv = document.getElementById('results');
    
    if (!file || !keywords) {
        alert('Please select a PDF and enter keywords');
        return;
    }

    resultsDiv.textContent = 'Processing...';

    try {
        // Read PDF as base64
        const base64PDF = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });

        // Call backend API
        const response = await fetch('/api/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pdfData: base64PDF,
                keywords: keywords.split(',').map(k => k.trim())
            })
        });

        const data = await response.json();
        resultsDiv.textContent = data.text || data.error;
    } catch (error) {
        resultsDiv.textContent = 'Error: ' + error.message;
    }
}