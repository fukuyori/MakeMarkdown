# Firefox Add-ons (AMO) 登録メモ

addons.mozilla.org に MakeMarkdown 0.1.0 を登録するときの入力内容と確認事項です。

## アップロードするファイル

```sh
sh tools/build.sh firefox
```

```text
dist/makemarkdown-0.1.0-firefox.zip
```

- [ ] zip のルート直下に `manifest.json` がある。
- [ ] `browser_specific_settings.gecko.id` が `makemarkdown@example.com` になっている。
      別の ID で公開したい場合は、最初の提出前に変更する (公開後は変更できない)。
- [ ] `strict_min_version` が `140.0`、`gecko_android.strict_min_version` が `142.0`。
- [ ] `data_collection_permissions.required` が `["none"]`。
- [ ] コードを縮小 (minify) していないので、ソースコードの提出は不要。

```sh
npx web-ext lint --source-dir dist/firefox   # パッケージの中身を検証する
```

## 掲載情報

名前:

```text
MakeMarkdown
```

要約 (Summary):

```text
表示中のページをMarkdownに変換し、リーダービュー風に表示・ダウンロードできます。
```

```text
Convert the current page to Markdown, read it in a reader-style view, and download the .md file.
```

説明 (Description):

```text
MakeMarkdown は、いま見ているページの本文だけを Markdown に変換して、リーダービューのような画面で読み、.md ファイルとして保存できるアドオンです。

- ツールバーのボタン (または Alt+Shift+M) でページを Markdown に変換します。
- 見出し・リスト・表・コードブロック・引用・リンク・画像を Markdown (GFM 相当) として書き出します。
- プレビュー表示と Markdown ソース表示を切り替えられます。
- テーマ (自動/ライト/セピア/ダーク)、書体、文字サイズ、本文の幅を変えて読めます。
- タイトル見出し・出典リンク・フロントマターを出力に含めるか選べます。
- ページ内で文字を選択しているときは、その範囲だけを変換します。
- Markdown のコピーと .md ファイルのダウンロードができます。

本文を JavaScript であとから削除・折りたたみするページに備えて、変換時の DOM、変化が落ち着いたあとの DOM、ページを開いた直後から記録していた状態、サーバーから取得した元の HTML を比べ、いちばん内容が多いものを採用します。

ページの内容や設定を外部に送信することはありません。変換結果はブラウザ内に一時保存されるだけで、ブラウザを終了すると消えます。
```

- [ ] カテゴリ (3 つまで): 「ダウンロード管理」と「フィード／ニュース／ブログ」。
      3 つ目を選ぶなら「ブックマーク」。AMO に「仕事効率化」の分類は無い。
- [ ] タグ: markdown, reader, export など。
- [ ] ライセンス: **MIT License** を選ぶ (`LICENSE` と一致させる)。
- [ ] サポート用のメールアドレス / サイトを入力する
      (サイトは https://github.com/fukuyori/MakeMarkdown が使える)。
- [ ] プライバシーポリシー欄に `PRIVACY_POLICY.md` の内容をそのまま貼り付ける
      (AMO は URL ではなくテキストを入力する)。公開版は
      https://github.com/fukuyori/MakeMarkdown/blob/main/PRIVACY_POLICY.md 。
- [ ] スクリーンショットを登録する。
      `screenshots/makemarkdown-ja-1-viewer-1280x800.png` など (英語版は `makemarkdown-en-*`)。

## 審査担当者へのメモ (Reviewer notes)

```text
No account or login is needed to test the add-on.

1. Open any article page and click the MakeMarkdown toolbar button (or press Alt+Shift+M).
2. A new tab opens with the article converted to Markdown. Use the "プレビュー / Markdown"
   buttons to switch between the rendered preview and the Markdown source, and "ダウンロード"
   to save the .md file.
3. Selecting text on the page before converting will convert only that selection.

The optional "*://*/*" permission is not requested at install time. It is requested only from
the options page when the user turns on "本文が最も多かった時点を記録する" (record the moment
the page had the most content), and it is removed again when the user turns that setting off.
That feature registers src/recorder.js at document_start; without the permission the add-on
works using only the DOM of the tab the user converted.

The add-on does not send any data to a server. The only network request it can make is a
re-fetch of the current page's own URL, and only when the user enables
"サーバーの元 HTML も取り寄せて比べる" in the options page.

No remote code is loaded. HTML is never assigned with innerHTML; the viewer builds its preview
with DOMParser and importNode from Markdown that the add-on generated itself.
```

## 動作確認

- [ ] `about:debugging#/runtime/this-firefox` で一時的に読み込める。
- [ ] ツールバーのボタンでページが変換され、ビューアが開く。
- [ ] `Alt+Shift+M` でも変換できる。
- [ ] 文字を選択した状態で変換すると、その範囲だけが変換される。
- [ ] プレビューと Markdown 表示を切り替えられる。
- [ ] コピーとダウンロード (`Ctrl/Cmd + S` を含む) ができる。
- [ ] 表示設定が保存され、次に開いたときも保たれる。
- [ ] 設定ページで「本文が最も多かった時点を記録する」を on にすると権限ダイアログが出て、
      off にすると `about:addons` の権限からも消える。
- [ ] 記録を有効にしたあと、本文をあとから削除するページで「本文が最も多かった時点の記録」
      が採用される (ビューア左上のバッジで確認)。
- [ ] `about:` などの内部ページで変換すると、変換できない旨が表示される。
- [ ] `npx web-ext lint` が 0 errors / 0 warnings。

## バージョンノート (0.1.0)

```text
最初の公開バージョン。
- ページを Markdown に変換し、リーダービュー風のビューアで表示する。
- Markdown のコピーと .md ファイルのダウンロード。
- テーマ・書体・文字サイズ・本文幅・出力内容の設定。
- 本文が JavaScript で切り取られるページに備えて、複数の状態から最も内容が多いものを採用する。
```
