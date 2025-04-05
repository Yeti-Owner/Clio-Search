async function processPDF() {
    const file = document.getElementById('pdfFile').files[0];
    const searchInput = document.getElementById('searchTerms').value;
    const resultsDiv = document.getElementById('results');
    
    resultsDiv.innerHTML = '';
    resultsDiv.classList.remove('error', 'success');

    if (!file || !searchInput) {
        showError('Please select a PDF and enter search terms');
        return;
    }

    showLoading(true);

    try {
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
            throw new Error('Invalid search format - use "quotes" for exact terms or [brackets] for topics');
        }

        // Sensitive topic warning
        const sensitiveTopics = ['incest', 'violence', 'abuse', 'trauma'];
        const hasSensitiveTopic = topics.some(topic => 
            sensitiveTopics.some(st => topic.toLowerCase().includes(st.toLowerCase()))
        ) || keywords.some(keyword => 
            sensitiveTopics.some(st => keyword.toLowerCase().includes(st.toLowerCase()))
        );

        if (hasSensitiveTopic) {
            const proceed = confirm('Warning: This search includes sensitive historical content. Continue?');
            if (!proceed) {
                resultsDiv.textContent = 'Search canceled';
                showLoading(false);
                return;
            }
        }

        const base64PDF = await readFileAsBase64(file);
        const response = await callProcessingAPI(base64PDF, { keywords, topics });
        
        if (response.error) {
            showError(response.error);
            return;
        }

        // Process and display results
        const results = response.text.split('\n')
            .filter(line => line.trim().length > 0)
            .map(line => {
                if (line.startsWith('[')) {
                    const isKeywordMatch = line.includes('(Match type: KEYWORD)');
                    const matchType = isKeywordMatch ? 'Keyword Match' : 'Topic Match';
                    const matchClass = isKeywordMatch ? 'keyword-match' : 'topic-match';
                    
                    const content = line
                        .replace(/\(Match type: KEYWORD\)/g, '')
                        .replace(/\(Match type: TOPIC\)/g, '')
                        .trim();
                    
                    return `
                        <div class="result-line ${matchClass}">
                            ${content}
                            <span class="match-type">${matchType}</span>
                        </div>
                    `;
                }
                return `<div>${line}</div>`;
            });

        resultsDiv.innerHTML = results.join('');

        if (results.length > 0) {
            resultsDiv.classList.add('success');
        } else {
            resultsDiv.textContent = 'No matches found after comprehensive analysis';
        }

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
    resultsDiv.innerHTML = `<div class="error">${message}</div>`;
}

function showLoading(isLoading) {
    const button = document.querySelector('button');
    button.disabled = isLoading;
    button.textContent = isLoading ? 'Searching History...' : 'Search History';
}

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