async function processPDF() {
    const file = document.getElementById('pdfFile').files[0];
    const searchInput = document.getElementById('searchTerms').value;
    const resultsDiv = document.getElementById('results');
    
    resultsDiv.textContent = '';
    resultsDiv.classList.remove('error', 'success');

    if (!file || !searchInput) {
        showError('Please select a PDF and enter search terms');
        return;
    }

    showLoading(true);

    try {
        // Parse search terms
        const terms = searchInput.split(',')
            .map(t => t.trim())
            .filter(t => t.length > 0);

        const { keywords, topics } = terms.reduce((acc, term) => {
            if (term.startsWith('"') && term.endsWith('"')) {
                acc.keywords.push(term.slice(1, -1));
            } else if (term.startsWith('[') && term.endsWith(']')) {
                acc.topics.push(term.slice(1, -1));
            } else {
                acc.keywords.push(term);
            }
            return acc;
        }, { keywords: [], topics: [] });

        if (keywords.length === 0 && topics.length === 0) {
            throw new Error('Invalid search format - use "quotes" or [brackets]');
        }

        const base64PDF = await readFileAsBase64(file);
        const response = await callProcessingAPI(base64PDF, { keywords, topics });
        
        if (response.error) {
            showError(response.error);
            return;
        }

        // Format results with match types
        resultsDiv.innerHTML = response.text.split('\n')
            .filter(line => line.trim().length > 0)
            .map(line => {
                if (line.startsWith('[')) {
                    const isKeyword = line.includes('KEYWORD');
                    const matchType = isKeyword ? 'Keyword Match' : 'Topic Match';
                    const lineClass = isKeyword ? 'keyword-match' : 'topic-match';
                    
                    const cleanLine = line
                        .replace(/ ?(KEYWORD|TOPIC)_MATCH/g, '')
                        .replace(/\([^)]*\)/g, '')
                        .trim();
                    
                    return `
                        <div class="result-line ${lineClass}">
                            ${cleanLine}
                            <span class="match-type">${matchType}</span>
                        </div>`;
                }
                return `<div class="result-line">${line}</div>`;
            })
            .join('');

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

async function callProcessingAPI(base64PDF, { keywords, topics }) {
    const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            pdfData: base64PDF,
            keywords,
            topics
        })
    });

    const textResponse = await response.text();
    try {
        return JSON.parse(textResponse);
    } catch (e) {
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
    document.getElementById('searchTerms').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') processPDF();
    });
    
    document.getElementById('pdfFile').addEventListener('change', (e) => {
        if (e.target.files[0]?.size > 2 * 1024 * 1024) {
            showError('File is too large (max 2MB)');
        }
    });
});