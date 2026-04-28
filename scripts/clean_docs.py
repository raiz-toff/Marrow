import os
import re

def remove_emojis(text):
    # Regex to match many common emojis and symbols used in the docs
    # Matching range of unicode characters often used for emojis
    # ranges: 1F600-1F64F (Emoticons), 1F300-1F5FF (Misc Symbols and Pictographs), 
    # 1F680-1F6FF (Transport and Map), 1F900-1F9FF (Supplemental Symbols and Pictographs)
    # 2600-26FF (Misc symbols), 2700-27BF (Dingbats)
    emoji_pattern = re.compile(
        u"[\U0001F600-\U0001F64F"  # emoticons
        u"\U0001F300-\U0001F5FF"  # symbols & pictographs
        u"\U0001F680-\U0001F6FF"  # transport & map symbols
        u"\U0001F900-\U0001F9FF"  # supplemental symbols
        u"\u2600-\u26FF"          # misc symbols
        u"\u2700-\u27BF"          # dingbats
        u"\u2300-\u23FF"          # misc technical (e.g. keyboard)
        u"\u2B50"                 # star
        u"\u203C"                 # double exclamation
        u"\u2049"                 # exclamation question
        u"]+", flags=re.UNICODE)
    
    return emoji_pattern.sub(r'', text)

def process_directory(root_dir):
    for dirpath, _, filenames in os.walk(root_dir):
        for filename in filenames:
            if filename.endswith('.md'):
                filepath = os.path.join(dirpath, filename)
                print(f"Processing {filepath}...")
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                new_content = remove_emojis(content)
                
                # Also clean up double spaces that might result from removing an emoji followed by a space
                new_content = new_content.replace('  ', ' ')
                
                # Fix headers if they became "#  Title" -> "# Title"
                new_content = re.sub(r'^(#+)\s+', r'\1 ', new_content, flags=re.MULTILINE)

                if content != new_content:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"Cleaned {filepath}")

if __name__ == "__main__":
    process_directory("docs")
