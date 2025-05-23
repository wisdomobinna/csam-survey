# src/scripts/rename_images.py
import os
import shutil
from pathlib import Path

def rename_images(dry_run=True):
    # Get the correct path to images directory
    script_dir = Path(__file__).parent  # This is src/scripts
    src_dir = script_dir.parent  # This is src
    images_dir = src_dir / 'images'  # This is src/images
    
    print(f"Scanning directory: {images_dir}")
    
    if not images_dir.exists():
        print(f"Error: Images directory not found at {images_dir}")
        return
    
    # Get all image files
    image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
    image_files = []
    
    for file in images_dir.iterdir():
        if file.suffix.lower() in image_extensions:
            image_files.append(file)
    
    # Sort files for consistent ordering
    image_files.sort()
    
    print(f"Found {len(image_files)} image files")
    
    if len(image_files) == 0:
        print("No image files found!")
        return
    
    if dry_run:
        print("\nDry run - Would rename:")
        for i, file in enumerate(image_files, 1):
            # Convert extension to lowercase
            new_name = f"{i:04d}{file.suffix.lower()}"
            print(f"{file.name} → {new_name}")
        print("\nTo actually rename files, run with --execute flag")
        return
    
    # Create temp directory
    temp_dir = images_dir / '_temp'
    temp_dir.mkdir(exist_ok=True)
    
    # First pass: Copy to temp with new names
    renamed_files = []
    for i, file in enumerate(image_files, 1):
        # Convert extension to lowercase
        new_name = f"img_{i:04d}{file.suffix.lower()}"
        temp_path = temp_dir / new_name
        
        shutil.copy2(file, temp_path)
        renamed_files.append((file, new_name, temp_path))
        print(f"Prepared: {file.name} → {new_name}")
    
    # Second pass: Move back from temp
    for old_file, new_name, temp_path in renamed_files:
        new_path = images_dir / new_name
        
        # Move from temp to final location
        shutil.move(str(temp_path), str(new_path))
        
        # Remove original if it's different
        if old_file.exists() and old_file != new_path:
            old_file.unlink()
        
        print(f"Renamed: {old_file.name} → {new_name}")
    
    # Remove temp directory
    temp_dir.rmdir()
    
    print(f"\nSuccessfully renamed {len(renamed_files)} images!")
    print(f"Images are now named from 0001 to {len(renamed_files):04d}")
    print("All extensions have been converted to lowercase")

if __name__ == "__main__":
    import sys
    
    # Check for --execute flag
    execute = "--execute" in sys.argv
    
    if not execute:
        print("Running in dry-run mode...")
        rename_images(dry_run=True)
    else:
        print("Executing rename operation...")
        rename_images(dry_run=False)