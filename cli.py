import argparse
from pdf_processor import PDFProcessor
from search_engine import SearchEngine
import sys

def main():
    parser = argparse.ArgumentParser(description="PDF Search Tool")
    parser.add_argument("file", help="Path to PDF file")
    parser.add_argument("keyword", help="Keyword to search")
    
    args = parser.parse_args()
    
    try:
        print(f"\nProcessing {args.file}...")
        processor = PDFProcessor(args.file)
        text_pages = processor.extract_text()
        
        print(f"\nSearching for '{args.keyword}'...")
        engine = SearchEngine(text_pages)
        results = engine.keyword_search(args.keyword)
        
        if not results:
            print("\nNo matches found. Possible issues:")
            print("- Try different keywords")
            print("- Check if text is visible in PDF")
            print("- Try a simpler PDF for testing")
        else:
            print(f"\nFound {len(results)} matches:")
            for i, result in enumerate(results, 1):
                print(f"\nMatch {i} (Page {result['page']}):")
                print(result["sentence"])
    
    except Exception as e:
        print(f"\nERROR: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()