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
        # Windows-specific Tesseract path detection
        if sys.platform == 'win32':
            tesseract_path = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
            if os.path.exists(tesseract_path):
                pytesseract.pytesseract.tesseract_cmd = tesseract_path
            else:
                print("\nTesseract not found at default location. Searching...")
                try:
                    from shutil import which
                    found_path = which('tesseract')
                    if found_path:
                        pytesseract.pytesseract.tesseract_cmd = found_path
                        print(f"Found Tesseract at: {found_path}")
                    else:
                        raise EnvironmentError
                except:
                    print("\nERROR: Tesseract not found. Please:")
                    print("1. Install Tesseract from https://github.com/UB-Mannheim/tesseract/wiki")
                    print("2. Add it to your PATH or modify the tesseract_cmd path in the code")
                    sys.exit(1)

        try:
            pytesseract.get_tesseract_version()
        except Exception as e:
            print(f"\nTesseract configuration error: {str(e)}")
            sys.exit(1)

    def extract_text(self):
        try:
            doc = fitz.open(self.file_path)
            text_pages = []
            
            for page_num, page in enumerate(doc):
                text = self.extract_page_text(page)
                
                if not text.strip():
                    text = self.extract_text_with_ocr(page)
                
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
        
        text = page.get_text("text")
        if not text.strip():
            blocks = page.get_text("blocks")
            text = " ".join([block[4] for block in blocks if block[4].strip()])
        return text

    def extract_text_with_ocr(self, page):
        pix = page.get_pixmap(dpi=300)
        img_path = tempfile.mktemp(suffix=".png")
        pix.save(img_path)
        
        try:
            angle = self.detect_rotation(img_path)
            if angle != 0:
                self.rotate_image(img_path, angle)
        except Exception as e:
            print(f"Rotation detection failed: {str(e)}")
        
        text = pytesseract.image_to_string(img_path)
        os.remove(img_path)
        return text

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