# ページで使う字だけを抜き出したフォント（woff2）を作る。
# Google Fonts から読むと、日本語のフォントは字の範囲ごとに数十のファイルに分かれて届き、
# リクエストの数が増えるので、使う字だけを1ファイルにまとめて自前で配る。
# scripts/build-site.mjs が、使う字を書いたファイルを渡して呼ぶ。
#
# 使い方: python scripts/subset-fonts.py 使う字のファイル 出力先のフォルダ
# 要るもの: pip install fonttools==4.67.0 brotli==1.2.0

import hashlib
import sys
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

# 元のフォントは Google Fonts のリポジトリから取る。中身が差し替わっても気づけるよう、
# コミットを固定し、SHA-256 を確かめる。上げるときは、新しいコミットで取り直してハッシュを書き換える
FONTS_COMMIT = 'ddf386ba1b9fbc6b2c818f1ddcd9148f54ced94b'
FONTS = [
    {
        'source': 'ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf',
        'sha256': 'c2f3b4d463500a2ddcd3849cded1fceeb9fd6d1c32e6cbecd568453ba50fc68f',
        'output': 'noto-sans-jp.woff2',
        # 太さを変えられるフォントなので、ページで使う 400 から 700 の間だけを残す
        'weights': (400, 700),
    },
    {
        'source': 'ofl/dotgothic16/DotGothic16-Regular.ttf',
        'sha256': '3ad9af88726d42b40f7f365f0dcac785af73cf20ea6f1d5b44e57cc21150b8f1',
        'output': 'dotgothic16.woff2',
        'weights': None,
    },
]
CACHE = Path(__file__).resolve().parent.parent / '.cache' / 'fonts'


def download(font):
    path = CACHE / f"{font['sha256']}.ttf"
    if not path.exists():
        url = f"https://raw.githubusercontent.com/google/fonts/{FONTS_COMMIT}/{font['source']}"
        with urllib.request.urlopen(url) as response:
            data = response.read()
        if hashlib.sha256(data).hexdigest() != font['sha256']:
            sys.exit(f'{url} の中身が想定と違います')
        CACHE.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    return path


def main():
    text = Path(sys.argv[1]).read_text(encoding='utf-8')
    out_dir = Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)

    for font in FONTS:
        tt = TTFont(download(font))
        options = subset.Options()
        options.flavor = 'woff2'
        subsetter = subset.Subsetter(options)
        subsetter.populate(text=text)
        subsetter.subset(tt)
        # 太さを絞るのは字を抜き出したあとにする（先に絞ると、抜き出しで字形の表が欠けて止まる）
        if font['weights']:
            tt = instancer.instantiateVariableFont(tt, {'wght': font['weights']})
        output = out_dir / font['output']
        tt.flavor = 'woff2'
        tt.save(output)
        print(f"{output}: {output.stat().st_size // 1024} KB")


main()
