import os
import re

def migrate_vision():
    source_file = 'vision_init.md'
    output_dir = os.path.join('docs', 'backlog')
    
    if not os.path.exists(source_file):
        print(f"Error: {source_file} not found.")
        return

    with open(source_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Split by level 2 headers, but keep the header
    # The regex looks for lines starting with ## 
    sections = re.split(r'(^##\s+.+$)', content, flags=re.MULTILINE)
    
    # The first element might be introductory text or empty if the file starts with a header
    # We'll treat the first valid section found as 001
    
    current_index = 1
    
    # Process sections. re.split with capturing group returns [preamble, header1, body1, header2, body2...]
    
    # Handle the case where there is text before the first header
    if sections[0].strip():
        # This is the preamble (Title, etc.)
        filename = "000_Preamble.md"
        filepath = os.path.join(output_dir, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(sections[0].strip() + "\n")
        print(f"Created {filename}")

    # Now iterate through the rest in pairs (header, body)
    for i in range(1, len(sections), 2):
        header = sections[i].strip()
        body = sections[i+1].strip() if i+1 < len(sections) else ""
        
        # Extract title from header for filename
        # Remove '## ' and sanitize
        title_raw = header.replace('##', '').strip()
        # Allow alphanumeric, spaces, hyphens, keep it simple
        safe_title = "".join([c if c.isalnum() or c in (' ', '-', '_') else '' for c in title_raw]).strip()
        safe_title = safe_title.replace(' ', '_')
        
        filename = f"{current_index:03d}_{safe_title}.md"
        filepath = os.path.join(output_dir, filename)
        
        full_content = f"{header}\n\n{body}\n"
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(full_content)
            
        print(f"Created {filename}")
        current_index += 1

if __name__ == "__main__":
    migrate_vision()
