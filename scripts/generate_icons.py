import os
import sys

# Attempt to import PIL to draw a sleek icon, otherwise create a raw binary placeholder
try:
    from PIL import Image, ImageDraw
    has_pil = True
except ImportError:
    has_pil = False

icon_dir = os.path.join(os.path.dirname(__file__), '..', 'extension', 'icons')
os.makedirs(icon_dir, exist_ok=True)

sizes = [16, 32, 48, 128]

if has_pil:
    print("PIL found. Generating high-quality icon assets...")
    for size in sizes:
        # Create an image with cyan-blue gradient look
        img = Image.new('RGBA', (size, size), color=(10, 13, 20, 255))
        draw = ImageDraw.Draw(img)
        
        # Draw dynamic bounding boxes or shields
        padding = max(1, size // 8)
        draw.rounded_rectangle(
            [(padding, padding), (size - padding, size - padding)],
            radius=max(2, size // 6),
            fill=(0, 242, 254, 255)
        )
        # Inner shield
        inner_padding = padding * 2
        draw.rounded_rectangle(
            [(inner_padding, inner_padding), (size - inner_padding, size - inner_padding)],
            radius=max(1, size // 8),
            fill=(10, 13, 20, 255)
        )
        img.save(os.path.join(icon_dir, f'icon{size}.png'))
    print("Icons created successfully.")
else:
    print("PIL not found. Creating basic raw image files...")
    # Write tiny valid PNG files (1x1 transparent or similar) using base64 decoding
    import base64
    # 1x1 transparent PNG base64
    png_data = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
    for size in sizes:
        with open(os.path.join(icon_dir, f'icon{size}.png'), 'wb') as f:
            f.write(png_data)
    print("Basic icons created.")
