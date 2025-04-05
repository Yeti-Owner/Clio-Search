import argparse
from pdf_processor import PDFProcessor
from search_engine import SearchEngine
import sys

def main():
    parser = argparse.ArgumentParser(description="Universal PDF Search Tool")
    parser.add_argument("file", help="Path to PDF file")
    parser.add_argument("keyword", help="Keyword to search")
    
    args = parser.parse_args()
    
    try:
        print(f"\nProcessing {args.file}...")
        processor = PDFProcessor(args.file)
        print("- Detecting text/rotation...")
        text_pages = processor.extract_text()
        
        print(f"- Searching for '{args.keyword}'...")
        engine = SearchEngine(text_pages)
        results = engine.keyword_search(args.keyword)
        
        if not results:
            print(f"\nNo results found for '{args.keyword}'")
        else:
            print(f"\nFound {len(results)} matches:")
            for result in results:
                print(f"\n[Page {result['page']}] {result['sentence']}")
        print()
    
    except Exception as e:
        print(f"\nERROR: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()