import fitz  # PyMuPDF
import re
import nltk
from nltk.tokenize import sent_tokenize
import os

def download_nltk_data():
    try:
        nltk.data.find('tokenizers/punkt')
    except LookupError:
        nltk.download('punkt', quiet=True)
    try:
        nltk.data.find('tokenizers/punkt_tab')
    except LookupError:
        nltk.download('punkt_tab', quiet=True)

download_nltk_data()

class PDFProcessor:
    def __init__(self, file_path):
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"PDF file not found: {file_path}")
        self.file_path = file_path

    def extract_text(self):
        try:
            doc = fitz.open(self.file_path)
            text_pages = []
            
            for page_num, page in enumerate(doc):
                # Primary text extraction method
                text = page.get_text("text")
                
                # Fallback methods if primary fails
                if not text.strip():
                    blocks = page.get_text("blocks")
                    text = " ".join([block[4] for block in blocks if block[4].strip()])
                
                if not text.strip():
                    words = page.get_text("words")
                    text = " ".join([word[4] for word in words if word[4].strip()])
                
                if not text.strip():
                    continue
                    
                text = self.clean_text(text)
                sentences = sent_tokenize(text)
                
                for sentence in sentences:
                    if sentence.strip():
                        text_pages.append({
                            "page": page_num + 1,
                            "sentence": sentence
                        })
            
            if not text_pages:
                raise ValueError("PDF contains no extractable text (may be scanned)")
            return text_pages
        
        except Exception as e:
            raise RuntimeError(f"PDF processing failed: {str(e)}")

    def clean_text(self, text):
        # Merge hyphenated words
        text = re.sub(r"(\w+)-\s*\n\s*(\w+)", r"\1\2", text, flags=re.MULTILINE)
        # Normalize whitespace
        text = re.sub(r"\s+", " ", text)
        return text.strip()