# Chrome Web Store 登録メモ

Chrome ウェブストアに MakeMarkdown 0.1.0 を登録するときの入力内容と確認事項です。

## アップロードするファイル

```sh
sh tools/build.sh chrome
```

```text
dist/makemarkdown-0.1.0-chrome.zip
```

Chrome 版は `manifest.chrome.json` を `manifest.json` として同梱します。Firefox 専用の
`browser_specific_settings` を含まず、バックグラウンドは `service_worker` です。

動作確認のときも、Chrome に読み込むのは `dist/chrome` です。リポジトリ直下を読み込むと
Firefox 用の `background.scripts` が警告になり、バックグラウンドが動かないまま
「アイコンを押しても無反応」になります。

## デベロッパーアカウント

<https://chrome.google.com/webstore/devconsole>

公開には Chrome ウェブストアのデベロッパー登録 (初回のみ登録料) が必要です。

## ストアの掲載情報

言語は「日本語」を既定にし、英語も追加すると `_locales/en` の内容と揃います。

名前:

```text
MakeMarkdown
```

概要 (132 文字以内):

```text
表示中のページをMarkdownに変換し、リーダービュー風に表示・ダウンロードできます。
```

```text
Convert the current page to Markdown, read it in a reader-style view, and download the .md file.
```

説明:

```text
MakeMarkdown は、いま見ているページの本文だけを Markdown に変換して、リーダービューのような画面で読み、.md ファイルとして保存できる拡張機能です。

できること:
- ツールバーのボタン (または Alt+Shift+M) でページを Markdown に変換する。
- 見出し・リスト・表・コードブロック・引用・リンク・画像を Markdown (GFM 相当) として書き出す。
- 変換結果をプレビュー表示と Markdown ソース表示で切り替える。
- テーマ (自動/ライト/セピア/ダーク)、書体、文字サイズ、本文の幅を変えて読む。
- タイトル見出し、出典リンク、フロントマターを出力に含めるかどうかを選ぶ。
- ページ内で文字を選択しているときは、その範囲だけを変換する。
- Markdown をクリップボードにコピーする、または .md ファイルとしてダウンロードする。

本文が JavaScript で切り取られるページへの対策:
- 変換ボタンを押した時点の DOM、DOM の変化が落ち着いたあとの状態、ページを開いた直後から記録していた状態、サーバーから取得した元の HTML を比べ、いちばん内容が多いものを採用します。
- 「続きを読む」などで隠されている本文も、十分な分量があれば残します。

この拡張機能は、ページの内容や設定を外部に送信しません。広告も、アクセス解析も、外部から読み込むコードもありません。変換結果はブラウザ内に一時保存されるだけで、ブラウザを終了すると消えます。
```

カテゴリ:

```text
仕事効率化 (Productivity)
```

## 単一用途 (Single purpose)

```text
Convert the web page the user is viewing into Markdown, display it in a reader-style viewer, and let the user copy or download the Markdown.
```

## 権限の理由

`activeTab`:

```text
Used to read the page in the active tab when the user starts a conversion from the toolbar button or the keyboard shortcut. The extension does not read any page until the user asks for a conversion.
```

`scripting`:

```text
Used to inject the conversion scripts into the page the user asked to convert, and to register the optional content script that records the state of a page while it has the most content.
```

`storage`:

```text
Used to store the user's display and conversion settings, and to hand the conversion result to the extension's own viewer tab. Results are kept in session storage and are cleared when the browser closes.
```

ホストへのアクセス (`*://*/*`, optional):

```text
Requested only when the user turns on "Record the moment the page had the most content". That feature needs a content script that runs from document_start on the pages the user visits, so that content later removed by the page's own scripts can still be converted. The permission is revoked when the user turns the feature off, and the extension works without it.
```

## リモートコードの申告

```text
No. The extension does not load or execute remotely hosted code. All scripts are included in the package.
```

## データ使用の申告

```text
The extension does not collect or transmit user data. Page content is converted locally in the browser, settings are stored in local extension storage, and conversion results are stored in session extension storage until the browser closes.
```

ダッシュボードのデータ収集の項目は、すべて「収集しない」を選びます。

プライバシーポリシーの URL には次を入力します (GitHub 上で公開済み)。

```text
https://github.com/fukuyori/MakeMarkdown/blob/main/PRIVACY_POLICY.md
```

HTML 版を使いたい場合は、GitHub Pages を有効にすると
`https://fukuyori.github.io/MakeMarkdown/privacy-policy.html` でも公開できます
(Settings → Pages → Source を main / root)。内容はどちらも同じです。

## 画像

パッケージに含まれているもの:

- `icons/icon-128.png` (128x128)

ストアの掲載情報に登録するもの (`node tools/make-screenshots.mjs` で作成済み):

- スクリーンショット (1280x800)
  - `screenshots/makemarkdown-ja-1-viewer-1280x800.png`
  - `screenshots/makemarkdown-ja-2-markdown-1280x800.png`
  - `screenshots/makemarkdown-ja-3-options-1280x800.png`
  - 英語版は `makemarkdown-en-*`
- 小さいプロモーションタイル (440x280)
  - `screenshots/makemarkdown-ja-promo-440x280.png` / `makemarkdown-en-promo-440x280.png`

スクリーンショットの本文は example.com のサンプル記事で、実在の記事やサイトは写っていません。

## 提出前の確認

- [ ] `sh tools/build.sh chrome` で zip を作り直した。
- [ ] `chrome://extensions` の「パッケージ化されていない拡張機能を読み込む」で `dist/chrome/` を読み込み、動作を確認した。
- [ ] ツールバーのボタンでページが変換され、ビューアが開く。
- [ ] `Alt+Shift+M` でも変換できる。
- [ ] 文字を選択した状態で変換すると、その範囲だけが変換される。
- [ ] プレビューと Markdown 表示を切り替えられる。
- [ ] コピーとダウンロードができ、ファイル名がページタイトルになる。
- [ ] 表示設定 (テーマ・書体・文字サイズ・幅・出力内容) が保存され、次に開いたときも保たれる。
- [ ] 設定ページで「本文が最も多かった時点を記録する」を on にすると権限を求められ、off にすると取り消される。
- [ ] ブラウザの内部ページ (`chrome://extensions` など) で変換すると、その旨が表示される。
- [ ] zip に不要なファイル (dist、tools、スクリーンショット、バージョン管理のファイル) が入っていない。
