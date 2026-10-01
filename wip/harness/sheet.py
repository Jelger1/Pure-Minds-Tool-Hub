# Contact sheet: python sheet.py <dir> <out.png> [cols] [thumbW]
import fitz, sys, os, glob
d, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 3
tw = int(sys.argv[4]) if len(sys.argv) > 4 else 640
files = sorted(glob.glob(os.path.join(d, 'slide-*.png')))
th = tw * 1080 // 1920; gap = 12
rows = (len(files) + cols - 1) // cols
W, H = cols * tw + (cols + 1) * gap, rows * th + (rows + 1) * gap
doc = fitz.open(); page = doc.new_page(width=W, height=H)
page.draw_rect(page.rect, color=None, fill=(1, 1, 1))
for i, f in enumerate(files):
    r, c = divmod(i, cols)
    x, y = gap + c * (tw + gap), gap + r * (th + gap)
    page.insert_image(fitz.Rect(x, y, x + tw, y + th), filename=f)
    page.insert_text((x + 6, y + 18), os.path.basename(f)[6:8], fontsize=14, color=(1, 0, 1))
page.get_pixmap(dpi=72).save(out); print(out)
