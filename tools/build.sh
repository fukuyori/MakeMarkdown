#!/bin/sh
# MakeMarkdown - パッケージ作成
#
#   sh tools/build.sh            # Firefox 版と Chrome 版の両方
#   sh tools/build.sh firefox    # Firefox 版だけ
#   sh tools/build.sh chrome     # Chrome 版だけ
#
# 共通のソースに、ブラウザごとの manifest を組み合わせて dist/ に置く。
#   dist/<target>/                       未パッケージで読み込む用
#   dist/makemarkdown-<version>-<target>.zip  ストアにアップロードする用
#   Firefox: manifest.json        (background.scripts / browser_specific_settings)
#   Chrome : manifest.chrome.json (background.service_worker)

set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"

VERSION=$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' manifest.json | head -1)
[ -n "$VERSION" ] || { echo "manifest.json から version を読めませんでした" >&2; exit 1; }

# パッケージに入れるもの (manifest は後からブラウザごとに置く)
FILES="background.js viewer.html viewer.css viewer.js options.html options.css options.js src icons _locales"

# dist/<target>/ に展開したもの (未パッケージの読み込み用) と zip の両方を作る
pack() {
  target=$1
  manifest=$2
  out="dist/makemarkdown-$VERSION-$target.zip"
  stage="dist/$target"

  rm -rf "$stage" "$out"
  mkdir -p "$stage"
  for f in $FILES; do
    cp -R "$f" "$stage/"
  done
  cp "$manifest" "$stage/manifest.json"
  # 余計なファイルが混ざらないように掃除しておく
  find "$stage" -name ".DS_Store" -delete

  (cd "$stage" && zip -q -r -X "../../$out" .)
  echo "$out ($(du -h "$out" | cut -f1 | tr -d ' '))"
  if [ "$target" = "chrome" ]; then
    echo "  Chrome に読み込むのは $ROOT/$stage (リポジトリ直下ではない)"
  else
    echo "  Firefox は $ROOT/manifest.json をそのまま読み込める"
  fi
}

mkdir -p dist

case "${1:-all}" in
  firefox) pack firefox manifest.json ;;
  chrome)  pack chrome manifest.chrome.json ;;
  all)
    pack firefox manifest.json
    pack chrome manifest.chrome.json
    ;;
  *) echo "使い方: sh tools/build.sh [firefox|chrome|all]" >&2; exit 1 ;;
esac
