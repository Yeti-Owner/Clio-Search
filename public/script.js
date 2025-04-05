async function processPDF() {
    const file = document.getElementById('pdfFile').files[0];
    const keywords = document.getElementById('keywords').value;
    const resultsDiv = document.getElementById('results');
    
    // Reset previous state
    resultsDiv.textContent = '';
    resultsDiv.classList.remove('error');

    if (!file || !keywords) {
        showError('Please select a PDF and enter keywords');
        return;
    }

    showLoading(true);

    try {
        const base64PDF = await readFileAsBase64(file);
        const response = await callProcessingAPI(base64PDF, keywords);
        
        if (response.error) {
            showError(response.error);
            return;
        }

        resultsDiv.textContent = response.text;
        resultsDiv.classList.add('success');

    } catch (error) {
        showError(error.message);
    } finally {
        showLoading(false);
    }
}

async function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            if (!base64) reject(new Error('File conversion failed'));
            resolve(base64);
        };
        reader.onerror = () => reject(new Error('Error reading file'));
        reader.readAsDataURL(file);
    });
}

async function callProcessingAPI(base64PDF, keywords) {
    const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            pdfData: base64PDF,
            keywords: keywords.split(',').map(k => k.trim()).filter(k => k)
        })
    });

    const textResponse = await response.text();
    try {
        return JSON.parse(textResponse);
    } catch (e) {
        console.error('Failed to parse response:', textResponse);
        throw new Error(`Server response error: ${textResponse.slice(0, 100)}`);
    }
}

function showError(message) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.textContent = `Error: ${message}`;
    resultsDiv.classList.add('error');
}

function showLoading(isLoading) {
    const button = document.querySelector('button');
    button.disabled = isLoading;
    button.textContent = isLoading ? 'Processing...' : 'Search';
}

// Event listeners remain the same as previous version
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('keywords').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') processPDF();
    });
    
    document.getElementById('pdfFile').addEventListener('change', (e) => {
        if (e.target.files[0]?.size > 2 * 1024 * 1024) {
            showError('File is too large (max 2MB)');
        }
    });
});