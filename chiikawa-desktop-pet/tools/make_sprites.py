"""저장소 루트의 캐릭터 사진에서 배경을 지워 투명 PNG 스프라이트를 만든다.

사용법 (chiikawa-desktop-pet 폴더에서):
    python3 tools/make_sprites.py

결과물: src/sprites/<캐릭터>_<번호>.png, 사진.jpg 에서 잘라낸 <캐릭터>_picnic.png,
        토벌 괴물 monster_*.png (배경이 복잡한 사진은 opencv-python 필요)
"""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parents[1] / "src" / "sprites"
TARGET_H = 260  # 스프라이트 높이(px). 화면에서는 이보다 작게 표시됨
GAPS = (1, 2, 3, 4, 6, 8, 10, 12)  # 시도해 볼 테두리 틈 크기(px)

SOURCES = {
    "chiikawa": ["치이카와_1.jpg", "치이카와_2.png", "치이카와_3.jpg"],
    "hachiware": ["하치와레_1.jpg", "하치와레_2.jpg", "하치와레_3.jpg"],
    "usagi": ["우사기_1.jpg", "우사기_2.jpg", "우사기_3.jpg"],
}
GROUP_PHOTO = "사진.jpg"  # 왼쪽부터 우사기, 치이카와, 하치와레

# 토벌 괴물: 출력 이름 -> (사진, 배경이 복잡하면 GrabCut 영역 (x, y, w, h)와 외곽선 밝기 기준)
MONSTERS = {
    "monster_sit": ("괴물_1.png", (30, 8, 305, 330), 70),     # 숲 배경
    "monster_night": ("괴물_2.jpg", (35, 125, 285, 300), 45),  # 밤 배경
    "monster_pounce": ("괴물_3.jpg", None, None),              # 흰 배경
    "mermaid": ("인어괴물.jpg", None, None),                   # 흰 배경
}


def dilate(mask, n=1):
    img = Image.fromarray((mask * 255).astype(np.uint8))
    for _ in range(n):
        img = img.filter(ImageFilter.MaxFilter(3))
    return np.array(img) > 127


def flood_from_border(passable):
    h, w = passable.shape
    seen = np.zeros_like(passable)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if passable[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if passable[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and passable[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    return seen


def components(mask):
    """8-연결 컴포넌트 목록 (픽셀 수 큰 순서)."""
    h, w = mask.shape
    label = np.zeros(mask.shape, dtype=np.int32)
    comps = []
    for sy, sx in zip(*np.nonzero(mask)):
        if label[sy, sx]:
            continue
        idx = len(comps) + 1
        label[sy, sx] = idx
        q = deque([(sy, sx)])
        pix = []
        while q:
            y, x = q.popleft()
            pix.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not label[ny, nx]:
                        label[ny, nx] = idx
                        q.append((ny, nx))
        comps.append(pix)
    comps.sort(key=len, reverse=True)
    return comps


def foreground_mask(rgb, gap):
    arr = rgb.astype(np.int16)
    border = np.concatenate([arr[0], arr[-1], arr[:, 0], arr[:, -1]])
    bg = np.median(border, axis=0)
    dist = np.abs(arr - bg).max(axis=2)
    lum = arr.mean(axis=2)
    bgish = dist < 38
    dark = lum < 110
    # 선에 난 작은 틈으로 몸통 안쪽까지 지워지지 않도록 선을 두껍게 해서 막고 채움
    outside = flood_from_border(bgish & ~dilate(dark, gap))
    # 선을 두껍게 하느라 남은 배경 띠는 같은 두께만큼만 다시 지움
    for _ in range(gap + 1):
        outside |= bgish & dilate(outside, 1) & ~dark
    return ~outside


def auto_mask(rgb):
    """틈을 메운 정도에 따라 전경 넓이가 거의 최대가 되는 가장 작은 틈 크기를 고름."""
    masks = [foreground_mask(rgb, g) for g in GAPS]
    best = masks[-1].sum()
    return next(m for m in masks if m.sum() >= best * 0.97)


def scene_mask(rgb, rect, dark_th):
    """배경이 그림(숲, 밤하늘)인 사진: GrabCut 으로 대략 영역을 잡고, 그 안에서 외곽선 기준으로 채움."""
    import cv2

    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    gc = np.zeros(rgb.shape[:2], np.uint8)
    cv2.grabCut(bgr, gc, rect, np.zeros((1, 65)), np.zeros((1, 65)), 8, cv2.GC_INIT_WITH_RECT)
    rough = (gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD)
    rough = ~flood_from_border(~rough)
    ys, xs = zip(*components(rough)[0])
    rough = np.zeros_like(rough)
    rough[list(ys), list(xs)] = True
    rough = dilate(rough, 6)  # GrabCut 이 놓친 외곽선까지 포함
    dark = rgb.astype(np.int16).mean(axis=2) < dark_th
    masks = []
    for gap in GAPS[:6]:
        outside = flood_from_border(~dilate(dark, gap) | ~rough)
        for _ in range(gap + 1):
            grown = dilate(outside, 1)
            outside |= (grown & ~dark & rough) | (grown & ~rough)
        masks.append(~outside)
    best = max(m.sum() for m in masks)
    return next(m for m in masks if m.sum() >= best * 0.97)


def to_sprite(rgb, mask):
    comps = components(mask)
    keep = np.zeros_like(mask)
    main = len(comps[0])
    for c in comps:
        if len(c) >= main * 0.06:  # 하트·느낌표 같은 작은 조각은 버림
            ys, xs = zip(*c)
            keep[list(ys), list(xs)] = True
    # 몸통 안쪽 구멍 채우기 (흰 몸통이 배경으로 빠지지 않도록)
    keep = ~flood_from_border(~keep)
    ys, xs = np.nonzero(keep)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    alpha = Image.fromarray((keep * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
    img = Image.fromarray(rgb).convert("RGBA")
    img.putalpha(alpha)
    img = img.crop((x0, y0, x1, y1))
    scale = TARGET_H / img.height
    if scale < 1:
        img = img.resize((max(1, round(img.width * scale)), TARGET_H), Image.LANCZOS)
    return img


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, files in SOURCES.items():
        for i, f in enumerate(files, 1):
            rgb = np.array(Image.open(ROOT / f).convert("RGB"))
            sprite = to_sprite(rgb, auto_mask(rgb))
            sprite.save(OUT / f"{name}_{i}.png", optimize=True)
            print(f"{f} -> {name}_{i}.png {sprite.size}")

    rgb = np.array(Image.open(ROOT / GROUP_PHOTO).convert("RGB"))
    mask = foreground_mask(rgb, gap=1)
    mask[int(rgb.shape[0] * 0.9):, :] = False  # 오른쪽 아래 저작권 표기 제외
    w = rgb.shape[1]
    # 세 캐릭터가 붙어 있어서, 예상 경계 근처에서 가장 비어 있는 세로줄로 자름
    cols = mask.sum(axis=0)
    cuts = [0]
    for a, b in ((0.33, 0.43), (0.55, 0.66)):
        lo, hi = int(w * a), int(w * b)
        cuts.append(lo + int(np.argmin(cols[lo:hi])))
    cuts.append(w)
    for name, a, b in zip(["usagi", "chiikawa", "hachiware"], cuts, cuts[1:]):
        sub = np.zeros_like(mask)
        sub[:, a:b] = mask[:, a:b]
        sprite = to_sprite(rgb, sub)
        sprite.save(OUT / f"{name}_picnic.png", optimize=True)
        print(f"{GROUP_PHOTO} -> {name}_picnic.png {sprite.size}")

    for name, (f, rect, dark_th) in MONSTERS.items():
        rgb = np.array(Image.open(ROOT / f).convert("RGB"))
        mask = scene_mask(rgb, rect, dark_th) if rect else auto_mask(rgb)
        sprite = to_sprite(rgb, mask)
        sprite.save(OUT / f"{name}.png", optimize=True)
        print(f"{f} -> {name}.png {sprite.size}")


if __name__ == "__main__":
    main()
