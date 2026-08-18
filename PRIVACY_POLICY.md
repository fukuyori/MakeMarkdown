# MakeMarkdown プライバシーポリシー

最終更新日: 2026年8月18日

（AMO のプライバシーポリシー欄にはこのファイルの内容をそのまま貼り付けられます。
Chrome ウェブストアは URL の指定が必要なので、`privacy-policy.html` を公開してその URL を指定してください。）

## この拡張機能が扱うデータ

MakeMarkdown がページの内容を読み取るのは、ツールバーのボタンを押したときとキーボードショートカットを使ったときだけです。読み取った内容はブラウザ内で Markdown に変換され、拡張機能のビューアタブに表示されます。

「本文が最も多かった時点を記録する」を有効にしている場合は、そのページが開いている間だけ、本文の複製をそのページのメモリ上に保持します。あとからページ側のスクリプトが本文を削除しても変換できるようにするためです。この複製がディスクに書き込まれることはなく、ページを閉じると消えます。

## この拡張機能が保存するデータ

- 設定 (テーマ、書体、文字サイズ、本文の幅、出力の内容、待ち時間、2 つの任意機能の on/off) をブラウザのローカル拡張機能ストレージに保存します。
- 変換結果は、ビューアタブが表示するためにブラウザのセッション拡張機能ストレージに保存します。保持するのは新しいものから 10 件までで、ブラウザを終了するとすべて消えます。

## 開発者や第三者に送信されるデータ

ありません。ページの内容も設定もその他のデータも、開発者や第三者に送信することはありません。アクセス解析も広告も、外部から読み込むコードもありません。

拡張機能が行いうる唯一の通信は、変換対象のページの URL への再取得だけで、これは「サーバーの元 HTML も取り寄せて比べる」を有効にしたときに限られます。通信先は利用者がすでに開いているサイトと同じです。

## 権限

- `activeTab` — 変換を開始したタブのページを読み取るため。
- `scripting` — そのページで変換スクリプトを実行するため。
- `storage` — 上記の設定と変換結果を保存するため。
- `*://*/*` (任意) — 「本文が最も多かった時点を記録する」を有効にしたときだけ要求し、無効にすると取り消します。

## ダウンロードしたファイル

Markdown ファイルはブラウザ内で作られ、ブラウザの設定に従った場所に保存されます。どこかにアップロードされることはありません。

## 問い合わせ

このポリシーについての問い合わせは、アドオンの掲載ページからお願いします。

---

# MakeMarkdown Privacy Policy

Last updated: August 18, 2026

## Data processed by this extension

MakeMarkdown reads the content of a web page only when the user asks for it, by clicking the toolbar button or pressing the keyboard shortcut. The page content is converted to Markdown inside the browser and shown in the extension's own viewer tab.

If the user has enabled "Record the moment the page had the most content", the extension also keeps a copy of the page body in the memory of that page while it is open, so that content later removed by the page's own scripts can still be converted. This copy is never written to disk and disappears when the page is closed.

## Data stored by this extension

- Settings (theme, typeface, font size, content width, output options, waiting time, and the two optional conversion features) are stored in the browser's local extension storage.
- Conversion results are stored in the browser's session extension storage so the viewer tab can display them. At most the 10 most recent results are kept, and all of them are deleted when the browser is closed.

## Data sent to the developer or to third parties

None. MakeMarkdown does not send page content, settings, or any other data to the developer or to any third party. It contains no analytics, no advertising, and no remotely hosted code.

The only network request the extension can make is to the address of the page being converted, and only when the user has enabled "Also fetch the original HTML from the server and compare". That request goes to the same site the user is already visiting.

## Permissions

- `activeTab` — read the page in the tab where the user started a conversion.
- `scripting` — run the conversion scripts in that page.
- `storage` — store the settings and the conversion results described above.
- `*://*/*` (optional) — requested only when the user turns on "Record the moment the page had the most content", and revoked when the user turns it off.

## Downloaded files

Markdown files are created in the browser and saved to the location the user's browser is configured to use. They are not uploaded anywhere.

## Contact

Questions about this policy can be sent to the developer through the add-on listing.
