import re

class SearchEngine:
    def __init__(self, text_pages):
        self.text_pages = text_pages
        print(f"\nTotal sentences to search: {len(text_pages)}")  # Debug output

    def keyword_search(self, keyword):
        results = []
        pattern = re.compile(re.escape(keyword), re.IGNORECASE)
        
        for entry in self.text_pages:
            if pattern.search(entry["sentence"]):
                print(f"Match found on page {entry['page']}")  # Debug output
                highlighted = pattern.sub(f"\033[1;31m{keyword}\033[0m", entry["sentence"], flags=re.IGNORECASE)
                results.append({
                    "page": entry["page"],
                    "sentence": highlighted
                })
        
        return results