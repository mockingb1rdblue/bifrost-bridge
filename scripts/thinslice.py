import os
import re
import glob

def thinslice():
    # Directories
    reference_dir = os.path.join('docs', 'reference')
    backlog_dir = os.path.join('docs', 'backlog')
    
    if not os.path.exists(reference_dir):
        print(f"Directory {reference_dir} not found.")
        return

    # 1. Scan for .md files in docs/reference
    ref_files = glob.glob(os.path.join(reference_dir, "*.md"))
    
    if not ref_files:
        print("No markdown files found in docs/reference to process.")
        return

    # 2. Find the highest existing index in docs/backlog
    existing_backlog = glob.glob(os.path.join(backlog_dir, "*.md"))
    max_index = 0
    
    for f in existing_backlog:
        basename = os.path.basename(f)
        # Assuming format NNN_Title.md
        parts = basename.split('_')
        if parts[0].isdigit():
            idx = int(parts[0])
            if idx > max_index:
                max_index = idx # Keep the highest one found
                
    # If 099 exists (Preamble), we should probably skip it or be smart. 
    # But simple logic: just increment max found. 
    # If users reordered things to 099, we might start at 100. That's fine.
    
    current_index = max_index + 1
    print(f"Starting index for new items: {current_index:03d}")

    for source_file in ref_files:
        print(f"Processing {source_file}...")
        
        with open(source_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Split by level 2 headers, but keep the header
        sections = re.split(r'(^##\s+.+$)', content, flags=re.MULTILINE)
        
        # Handle preamble (text before first header)
        if sections[0].strip():
            filename = f"{current_index:03d}_{os.path.basename(source_file).replace('.md', '_Preamble.md')}"
            filepath = os.path.join(backlog_dir, filename)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(sections[0].strip() + "\n")
            print(f"  Created {filename}")
            current_index += 1

        # Iterate sections
        for i in range(1, len(sections), 2):
            header = sections[i].strip()
            body = sections[i+1].strip() if i+1 < len(sections) else ""
            
            title_raw = header.replace('##', '').strip()
            # Sanitize title
            safe_title = "".join([c if c.isalnum() or c in (' ', '-', '_') else '' for c in title_raw]).strip()
            safe_title = safe_title.replace(' ', '_')
            
            filename = f"{current_index:03d}_{safe_title}.md"
            filepath = os.path.join(backlog_dir, filename)
            
            full_content = f"{header}\n\n{body}\n"
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(full_content)
                
            print(f"  Created {filename}")
            current_index += 1
            
        # Delete the source file permanently as requested
        try:
            os.remove(source_file)
            print(f"Deleted source file: {source_file}")
        except OSError as e:
            print(f"Error deleting {source_file}: {e}")

if __name__ == "__main__":
    thinslice()
