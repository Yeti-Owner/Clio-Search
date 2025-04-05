import fitz  # PyMuPDF
import re
import nltk
from nltk.tokenize import sent_tokenize
import os
import tempfile
from PIL import Image
import pytesseract
import sys

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
        self.configure_tesseract()

    def configure_tesseract(self):
        if sys.platform == 'win32':
            tesseract_path = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
            if os.path.exists(tesseract_path):
                pytesseract.pytesseract.tesseract_cmd = tesseract_path
            else:
                try:
                    from shutil import which
                    found_path = which('tesseract')
                    if found_path:
                        pytesseract.pytesseract.tesseract_cmd = found_path
                    else:
                        raise EnvironmentError
                except:
                    print("\nERROR: Tesseract not found. Please install it.")
                    sys.exit(1)

    def extract_text(self):
        try:
            doc = fitz.open(self.file_path)
            text_pages = []
            
            for page_num, page in enumerate(doc):
                print(f"\nProcessing page {page_num + 1}...")
                
                # First try standard text extraction
                text = self.extract_page_text(page)
                print(f"Standard extraction: {text[:100]}{'...' if len(text) > 100 else ''}")
                
                # If no text found, use OCR
                if not text.strip():
                    print("Trying OCR extraction...")
                    text = self.extract_text_with_ocr(page)
                    print(f"OCR extraction: {text[:100]}{'...' if len(text) > 100 else ''}")
                
                if text.strip():
                    text = self.clean_text(text)
                    sentences = sent_tokenize(text)
                    
                    for sentence in sentences:
                        if sentence.strip():
                            text_pages.append({
                                "page": page_num + 1,
                                "sentence": sentence
                            })
            
            if not text_pages:
                raise ValueError("PDF contains no extractable text")
            return text_pages
        
        except Exception as e:
            raise RuntimeError(f"PDF processing failed: {str(e)}")

    def extract_page_text(self, page):
        rotation = page.rotation
        if rotation != 0:
            page.set_rotation(0)
    
        # First try all text extraction methods
        text = page.get_text("text")
        if not text.strip():
            text = page.get_text("words")
            text = " ".join([word[4] for word in text if word[4].strip()])
        if not text.strip():
            text = page.get_text("blocks")
            text = " ".join([block[4] for block in text if isinstance(block, tuple) and len(block) > 4 and block[4].strip()])
    
        # If still no text, mark for OCR
        if not text.strip() or "image:" in text:
            return ""  # Force OCR fallback
        return text


    def extract_text_with_ocr(self, page):
        try:
            # Increase DPI for better OCR accuracy
            pix = page.get_pixmap(dpi=400)
            img_path = tempfile.mktemp(suffix=".png")
            pix.save(img_path)
        
            # Custom OCR configuration
            custom_config = r'--oem 3 --psm 6'
            text = pytesseract.image_to_string(img_path, config=custom_config)
        
            # Post-process OCR results
            text = re.sub(r'\s+', ' ', text)  # Normalize whitespace
            os.remove(img_path)
            return text.strip()
        except Exception as e:
            print(f"OCR Error: {str(e)}")
            return ""

    def detect_rotation(self, img_path):
        try:
            osd = pytesseract.image_to_osd(img_path)
            angle = int(re.search(r'Orientation in degrees: (\d+)', osd).group(1))
            return angle % 360
        except:
            return 0

    def rotate_image(self, img_path, angle):
        img = Image.open(img_path)
        rotated = img.rotate(-angle, expand=True)
        rotated.save(img_path)
        img.close()

    def clean_text(self, text):
        text = re.sub(r"(\w+)-\s*\n\s*(\w+)", r"\1\2", text, flags=re.MULTILINE)
        text = re.sub(r"\s+", " ", text)
        return text.strip()