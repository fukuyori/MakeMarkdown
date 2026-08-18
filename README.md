# MakeMarkdown

表示中のページを Markdown に変換し、リーダービューのような画面で読み、`.md`
ファイルとしてダウンロードできるブラウザ拡張機能です。Firefox と Chrome
(Manifest V3) の両方に対応しています。

## 使い方

1. 変換したいページでツールバーの MakeMarkdown ボタンを押す (または `Alt+Shift+M`)
2. 新しいタブでビューアが開き、変換結果が表示される
3. 「プレビュー / Markdown」で表示を切り替え、「ダウンロード」で `.md` を保存

- ページ内で文字を**選択**しているときは、その範囲だけを変換します。
- ビューアの「表示設定」で、テーマ (自動/ライト/セピア/ダーク)、書体、文字サイズ、
  本文の幅、出力に含める要素 (タイトル見出し・出典リンク・フロントマター) を変えられます。
- `Ctrl/Cmd + S` でもダウンロードできます。
- 表示はブラウザの言語に合わせて日本語と英語を切り替えます (既定は日本語)。

## 本文が JavaScript で切り取られるページへの対策

サイトによっては、いったん表示した本文をあとから JavaScript が削除・折りたたみ
します。MakeMarkdown は次の状態から Markdown を作り、**いちばん内容が多いもの**
を採用します (ビューア右上のバッジで、どれを採用したかを確認できます)。

| ソース | 内容 |
| --- | --- |
| 表示中の DOM | 変換ボタンを押した時点の DOM |
| 表示中の DOM (読み込み完了後) | DOM の変化が落ち着くまで待ってから見た状態 |
| 本文が最も多かった時点の記録 | ページを開いた直後から監視して覚えていた状態 (要設定) |
| サーバーから取得した元 HTML | JavaScript が動く前の HTML (要設定) |

また、`display:none` などで隠されている要素でも、十分な分量があってリンクが少ない
ものは本文とみなして残します (「続きを読む」で畳まれた本文の救済)。

「本文が最も多かった時点の記録」と「元 HTML の取り寄せ」は、拡張機能の設定ページ
から有効にします。前者はすべてのサイトを読み取る権限が必要なため、既定では無効です。

## パッケージの作成

```
sh tools/build.sh            # 両方
sh tools/build.sh firefox
sh tools/build.sh chrome
```

共通のソースに、ブラウザごとの manifest を組み合わせて `dist/` に置きます。

- `dist/<target>/` … 未パッケージで読み込む用
- `dist/makemarkdown-<version>-<target>.zip` … ストアにアップロードする用

| | Firefox | Chrome |
| --- | --- | --- |
| manifest | `manifest.json` | `manifest.chrome.json` |
| バックグラウンド | `background.scripts` (イベントページ) | `background.service_worker` |
| 対応バージョン | Firefox 140 以上 / Android 142 以上 | Chrome 102 以上 |

`browser` 名前空間は Chrome に無いため、`src/i18n.js` と `background.js` の先頭で
`chrome` を割り当てています。

## インストール (開発版)

Firefox:

```
about:debugging#/runtime/this-firefox → 「一時的なアドオンを読み込む」→ manifest.json
```

Chrome:

```
sh tools/build.sh chrome
chrome://extensions → 「デベロッパー モード」→ 「パッケージ化されていない拡張機能を読み込む」→ dist/chrome
```

> **リポジトリ直下を Chrome に読み込まないこと。** 直下の `manifest.json` は Firefox 用で、
> `background.scripts` を使っています。Chrome はこれを警告として扱うため拡張機能自体は
> 読み込まれますが、**バックグラウンドが動かず、ツールバーのボタンを押しても無反応**になります
> (`'background.scripts' requires manifest version of 2 or lower.`)。
> Chrome では必ず `dist/chrome` を読み込んでください。

`web-ext` を使う場合:

```
npx web-ext run                            # 開発用 Firefox で起動
npx web-ext lint --source-dir dist/firefox # パッケージの中身を検証
```

## ストアへの登録

- Firefox Add-ons: `FIREFOX_SUBMISSION.md`
- Chrome Web Store: `STORE_SUBMISSION.md`

掲載用のスクリーンショットとプロモーション画像は `screenshots/` にあります。作り直すには:

```
node tools/make-screenshots.mjs
```

サンプル記事を流し込んだビューアと設定画面を、ヘッドレス Chrome で撮り直します。

## 構成

| ファイル | 役割 |
| --- | --- |
| `manifest.json` | 拡張機能の定義 (MV3・Firefox 用) |
| `manifest.chrome.json` | 拡張機能の定義 (MV3・Chrome 用) |
| `_locales/ja` / `_locales/en` | 表示文言 (既定は日本語) |
| `src/i18n.js` | 拡張機能ページの文言差し替え |
| `tools/build.sh` | ブラウザごとの zip と展開済みディレクトリを作る |
| `tools/make-screenshots.mjs` | ストア掲載用のスクリーンショットを作る |
| `background.js` | 変換の実行、結果の受け渡し、記録スクリプトの登録 |
| `src/recorder.js` | 本文が最も多かった時点の記録 (document_start で動作) |
| `src/readability-lite.js` | 本文らしい要素の抽出とメタデータ取得 |
| `src/html-to-markdown.js` | DOM から Markdown への変換 |
| `src/extract.js` | 複数の状態を比べて最長の Markdown を返す |
| `src/markdown-to-html.js` | ビューアのプレビュー描画 (HTML は生成側で限定) |
| `viewer.html` / `viewer.css` / `viewer.js` | ビューア画面 |
| `options.html` / `options.css` / `options.js` | 設定画面 |
| `icons/` | アイコン (`icon.svg` が原本、PNG はそこから書き出したもの) |
| `screenshots/` | ストア掲載用の画像 |
| `privacy-policy.html` | プライバシーポリシー (公開・URL 指定用) |
| `PRIVACY_POLICY.md` | プライバシーポリシー (AMO の入力欄に貼る用) |
| `FIREFOX_SUBMISSION.md` / `STORE_SUBMISSION.md` | ストア登録時の入力内容と確認事項 |

## 権限

| 権限 | 用途 |
| --- | --- |
| `activeTab` | ボタンを押したタブのページを読み取る |
| `scripting` | 変換スクリプトの実行、記録スクリプトの登録 |
| `storage` | 設定と変換結果 (セッション中のみ) の保存 |
| `*://*/*` (任意) | 「本文が最も多かった時点の記録」を使うときのみ |

変換結果は外部に送信しません。ページの内容はブラウザ内 (`storage.session`) に
一時保存されるだけで、ブラウザを終了すると消えます。
