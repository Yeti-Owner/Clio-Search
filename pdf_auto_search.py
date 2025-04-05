import os
import sys
import sqlite3
import fitz  # PyMuPDF
import cv2
import pytesseract
import numpy as np  # Added missing import
from pathlib import Path
import spacy

# Configuration
DB_NAME = "history_search.db"
PROCESSED_DIR = "processed"
TESSERACT_CONFIG = '--oem 3 --psm 6'
os.makedirs(PROCESSED_DIR, exist_ok=True)

# Initialize NLP
nlp = spacy.load("en_core_web_sm")

def init_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute('''CREATE VIRTUAL TABLE IF NOT EXISTS documents 
                 USING fts5(content, source, page)''')
    conn.commit()
    return conn

def preprocess_image(img_array):
    gray = cv2.cvtColor(img_array, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    return cv2.GaussianBlur(thresh, (3, 3), 0)

def extract_text_from_image(img_array):
    try:
        return pytesseract.image_to_string(img_array, config=TESSERACT_CONFIG)
    except pytesseract.TesseractError:
        rotated = cv2.rotate(img_array, cv2.ROTATE_180)
        return pytesseract.image_to_string(rotated, config=TESSERACT_CONFIG)

def process_page(page, pdf_path, conn):
    if page.rotation != 0:
        page.set_rotation(0)
    
    text = page.get_text()
    
    if not text.strip():
        pix = page.get_pixmap()
        img_array = cv2.imdecode(
            np.frombuffer(pix.tobytes(), dtype=np.uint8),  # Now has np import
            cv2.IMREAD_COLOR
        )
        processed_img = preprocess_image(img_array)
        text = extract_text_from_image(processed_img)
    
    doc = nlp(text)
    for sent in doc.sents:
        if len(sent.text.strip()) > 10:
            conn.execute("INSERT INTO documents VALUES (?, ?, ?)",
                        (sent.text.strip(), str(pdf_path), page.number))

def process_pdf(pdf_path, conn):
    txt_path = Path(PROCESSED_DIR) / f"{Path(pdf_path).stem}.txt"
    
    full_text = []
    with fitz.open(pdf_path) as doc:
        for page in doc:
            text = page.get_text() or ""
            full_text.append(text)
            process_page(page, pdf_path, conn)
    
    with open(txt_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(full_text))
    
    conn.commit()

def search_documents(query, conn):
    c = conn.cursor()
    c.execute('''SELECT content, source, page 
                 FROM documents 
                 WHERE documents MATCH ?
                 ORDER BY bm25(documents)''', (query,))
    return c.fetchall()

def main():
    conn = init_db()
    
    if len(sys.argv) != 2:
        print("Usage: python pdf_auto_search.py <input_file.pdf>")
        sys.exit(1)
    
    pdf_file = Path(sys.argv[1])
    if not pdf_file.exists():
        print(f"Error: File {pdf_file} not found")
        sys.exit(1)
    
    print(f"Processing {pdf_file.name}...")
    process_pdf(pdf_file, conn)
    
    while True:
        query = input("\nSearch query (q to quit): ").strip()
        if query.lower() == 'q':
            break
        results = search_documents(query, conn)
        print(f"\nFound {len(results)} results:")
        for i, (text, source, page) in enumerate(results, 1):
            print(f"{i}. [From {Path(source).name} p.{page+1}] {text}")

if __name__ == "__main__":
    main()