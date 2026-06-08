# issues.md — 不具合・改善の記録

ローカル git コミット単位で、不具合修正と機能改善を追跡する。GitHub Issue とは独立した開発メモ。

**更新方針:** コミットごとに 1 セクション（新しい順）。1 コミットに複数件含む場合は小見出しで区切る。

---

## （未コミット）— 2026-06-09 — sunoCreatedAt: RSC 埋め込み JSON からの抽出

| 項目 | 内容 |
|------|------|
| **種別** | bug |
| **症状** | c1a694e 後も「映らないものを流して」等で生成日時が未取得。ページには Custom 付近に「2026年5月10日 12:10」が見えるが DB に `sunoCreatedAt` が入らない |
| **原因** | (1) Suno 2026 UI は日本語日時をクライアント描画のみで SSR HTML に含めない。(2) 生成日時は `self.__next_f.push` の RSC ペイロードに `\"created_at\":\"…\"` とエスケープされており、従来の `"created_at":"…"` 正規表現が 0 件。(3) `GET studio-api.prod.suno.com/api/clips/{id}` は未認証で 404（Cookie 必須）。(4) SSR 段階では `main`/`h1`/`Add to Playlist` が無くヒーロースコープも空 |
| **対応内容** | `extractCreatedAtFromText` でエスケープ JSON と clipId 近傍を解析。`extractCreatedAtFromPageState` を追加し script / document HTML を走査。ヒーロー探索を `climbAncestors` で拡張、テキストノード TreeWalker で日本語日時を検出。`extractSunoCreatedAtFromDom(doc, clipId)` に clipId 連携。実ページ SSR フィクスチャ `fixtures/song-a4ed4df5.html` と `scripts/test-suno-date.mjs` を追加。`upsertEntry` は抽出済み ISO 文字列を明示保存 |
| **関連ファイル** | `src/lib/suno-selectors.js`, `src/content/suno-song.js`, `src/db/repository.js`, `fixtures/song-a4ed4df5.html`, `scripts/test-suno-date.mjs`, `scripts/_tmp-parse-song-date.mjs`, `package.json`, `dist/suno-song.js`, `dist/service-worker.js` |

---

## c1a694e — 2026-06-09 — sunoCreatedAt 再保存時の補完と DOM 抽出強化

| 項目 | 内容 |
|------|------|
| **種別** | bug |
| **症状** | fe7809d 後も Suno 曲ページ保存→ダッシュボード詳細で「生成日時」が表示されない（例: Custom 付近の「2026年5月10日 12:10」） |
| **原因** | (1) `extractSunoSongData` が歌詞タブクリック後に日時抽出しており、タブ切替でヒーロー付近の日時 DOM が消えるケースで `sunoCreatedAt` が空のまま。(2) `upsertEntry` が `existing?.sunoCreatedAt \|\| data.sunoCreatedAt` で再保存時に新規抽出値が入りにくい。(3) 2026 UI では日時が `div.text-foreground-secondary` 等に載ることがあり、`p`/`span` 限定セレクタでは取りこぼし |
| **対応内容** | 日時抽出を歌詞タブ切替前に実行（失敗時は後段でも再試行）。`upsertEntry` を `data.sunoCreatedAt \|\| existing?.sunoCreatedAt` に変更し再保存で補完可能に。`div`・広義 `foreground-secondary`・スコープ `innerText` フォールバック、NFKC 正規化を追加。詳細メタに未取得時の案内文を表示。検証スクリプトに div フィクスチャを追加 |
| **関連ファイル** | `src/content/suno-song.js`, `src/lib/suno-selectors.js`, `src/db/repository.js`, `src/ui/dashboard/dashboard.js`, `scripts/_tmp-parse-song-date.mjs`, `dist/suno-song.js`, `dist/service-worker.js`, `dist/dashboard.js` |

---

## a9d3475 — 2026-06-09 — ポップアップフォールバック保存ダイアログのスクロール除去

| 項目 | 内容 |
|------|------|
| **種別** | bug |
| **症状** | タブ中央モーダル失敗時のポップアップ内フォールバックで「お知らせ」「保存しました」が小さく表示され、縦スクロールバーが出る |
| **原因** | 共有 `modal.css` の `.modal` 余白（24px）と `.modal-panel` の `max-height: 85vh` + `overflow: auto` が約 320px 幅のポップアップビューポートに対して過大。短い 1 行メッセージでもパネル全体がスクロール対象になっていた |
| **対応内容** | `dialog.css` で `#message-dialog` 専用にパネル `overflow: visible`・各セクションのパディング縮小・長文時のみ body に `overflow-y: auto`。`popup.css` でフォールバック向けにさらにコンパクト化（modal 余白 6px、body の max-height 解除）。`dialog-host-page.css`（タブ中央モーダル）は変更なし。`popup.html` の `#message-dialog` 構造は問題なし |
| **関連ファイル** | `ui/shared/dialog.css`, `ui/popup/popup.css`, `ui/popup/index.html` |

---

## fe7809d — 2026-06-09 — 日本語表示の Suno 生成日時を DOM から取得

| 項目 | 内容 |
|------|------|
| **種別** | bug |
| **症状** | Suno 曲ページで「2026年5月10日 12:10」のように日本語ロケールで表示される生成日時が `sunoCreatedAt` に保存されない（Custom バッジ付近の `text-foreground-secondary`） |
| **原因** | `extractDateFromScope` が `time[datetime]` と GMT `title` 付き相対日付（`4 hours ago`）のみ対象。日本語の絶対日時テキストをパースする処理が無かった |
| **対応内容** | `parseJapaneseDateTimeToIso` を追加（`YYYY年M月D日 H:mm`）。`text-foreground-secondary` 要素・Custom バッジ近傍・ヒーロー内の短い日時テキストから抽出。既存の GMT／API フォールバックは維持。検証用 `scripts/_tmp-parse-song-date.mjs` を追加 |
| **関連ファイル** | `src/lib/suno-selectors.js`, `scripts/_tmp-parse-song-date.mjs`, `package.json`, `dist/suno-song.js`, `dist/suno-list.js` |

---

## 96bd0cc — 2026-06-09 — ポップアップ保存通知をタブ中央モーダルに表示

| 項目 | 内容 |
|------|------|
| **種別** | bug |
| **症状** | Suno 曲ページからポップアップで保存すると「お知らせ」「保存しました」ダイアログが画面上部に小さく表示され、設定ダイアログのような中央の大きなウィンドウにならない |
| **原因** | `showAlert` が拡張ポップアップ（幅約 320px）内の `#message-dialog` に描画され、ビューポート全体ではなくポップアップ内で中央揃えされていた。コンテキストメニュー保存は `chrome.notifications` 経由で別 UI だった |
| **対応内容** | 対応ホスト全ページに `dialog-host` コンテンツスクリプトを注入し、`showExtensionDialog` メッセージで `dialog.js` 同一のモーダルをページ上に表示（`fixed inset-0`・パネル幅 480px・バックドロップ）。ポップアップ保存・エラー通知は `showTabDialog` 経由でタブ側を優先、フォールバックでポップアップ内表示。右クリック保存もタブ中央モーダルに統一（失敗時のみ通知）。ダッシュボードの `showAlert` はフルタブ上の既存 `modal.css` のまま中央表示を確認 |
| **関連ファイル** | `src/content/dialog-host.js`, `src/lib/tab-dialog.js`, `ui/shared/dialog-host-page.css`, `src/ui/popup/popup.js`, `src/background/service-worker.js`, `manifest.json`, `build.mjs`, `dist/*` |

---

## 19193aa — 2026-06-09 — Suno 曲の生成日時を保存・表示

| 項目 | 内容 |
|------|------|
| **種別** | enhancement |
| **症状** | Suno 曲ページを保存しても、楽曲の生成日時（Suno 上の `created_at`）が記録・表示されず、拡張の保存日時（`capturedAt`）しか分からなかった |
| **原因** | `extractSunoSongData` がタイトル・歌詞・スタイルのみ抽出。曲ページの DOM では通知欄以外に日時要素が無いケースがあり、API フォールバックも未実装だった |
| **対応内容** | `Entry.sunoCreatedAt`（ISO 8601・任意）を追加。`suno-selectors.js` で DOM 抽出（`time[datetime]`、`p.text-xs.text-foreground-secondary[title*=GMT]` の相対日付、Created ラベル、ページ内 `created_at` JSON）を実装。DOM で取れない場合は `https://studio-api.prod.suno.com/api/clips/{clipId}` の `created_at` をフォールバック取得。`upsertEntry` は初回取得値を保持。ダッシュボード詳細メタと検索カード（生成日＋保存日の2行）に表示。リスト保存時は行 DOM からも試行。`manifest.json` に studio-api の host_permissions を追加 |
| **関連ファイル** | `src/types.js`, `src/lib/suno-selectors.js`, `src/content/suno-song.js`, `src/content/suno-list.js`, `src/db/repository.js`, `src/ui/dashboard/dashboard.js`, `ui/dashboard/dashboard.css`, `manifest.json`, `dist/*` |

### 生成日時取得のフォールバック順

1. 曲ヒーロー（Add to Playlist / h1 付近）→ `main` 内の `time[datetime]` または `title` に GMT 日時を持つ要素
2. ページ内スクリプト／HTML の `"created_at":"…"` 文字列
3. Suno 公開 API `GET /api/clips/{clipId}` の `created_at`（非公開曲などで失敗する場合は未設定のまま）

---

## b06f304 — 2026-06-09 — メッセージダイアログを設定モーダルと同一スタイルに統一

| 項目 | 内容 |
|------|------|
| **種別** | enhancement |
| **症状** | showAlert/showConfirm の CSS ダイアログが設定・手動リンクの中央ウィンドウと見た目が微妙に異なり、ポップアップ側は `.popup-page` スコープの重複スタイルだった |
| **原因** | `dialog.css` に message-dialog 専用の header 上書きと、ポップアップ向けモーダルシェルの重複定義があった |
| **対応内容** | 設定ダイアログと同じ `.modal` / `.modal-backdrop` / `.modal-panel` / header-body-footer を `ui/shared/modal.css` に集約。`dashboard.css` から重複を除去。message-dialog に × 閉じるボタンを追加し z-index 1100 で最前面表示。ポップアップも同一 modal.css を読み込み画面中央のウィンドウ形式に統一 |
| **関連ファイル** | `ui/shared/modal.css`, `ui/shared/dialog.css`, `ui/dashboard/dashboard.css`, `ui/dashboard/index.html`, `ui/popup/index.html`, `src/lib/dialog.js` |

---

## f5200dd — 2026-06-09 — native alert/confirm を CSS モーダルに置換

| 項目 | 内容 |
|------|------|
| **種別** | enhancement |
| **症状** | ダッシュボード・ポップアップで `alert()` / `confirm()` のネイティブダイアログが使われ、設定・手動リンクの CSS モーダルと UI が不統一だった |
| **原因** | 各操作でブラウザ標準 API を直接呼んでいた |
| **対応内容** | `src/lib/dialog.js` に `showAlert` / `showConfirm`（Promise API）を追加。既存 `.modal` パターンに合わせた `#message-dialog` を dashboard / popup に配置。`ui/shared/dialog.css` でメッセージ表示・ポップアップ用モーダルシェルを共通化。フォーカストラップ・Escape・aria-modal 対応。削除確認・一括整理・インポート・設定保存・手動リンク・ポップアップ保存の全 alert/confirm を置換 |
| **関連ファイル** | `src/lib/dialog.js`, `src/ui/dashboard/dashboard.js`, `src/ui/popup/popup.js`, `ui/shared/dialog.css`, `ui/dashboard/index.html`, `ui/popup/index.html`, `dist/dashboard.js`, `dist/popup.js` |

---

## 088a785 — 2026-06-09 — 詳細ヘッダーに削除アイコンを配置

| 項目 | 内容 |
|------|------|
| **種別** | enhancement |
| **症状** | 詳細パネル下部の「このエントリを削除」テキストボタンが歌詞スクロール領域と分離され、プロテクト操作（鍵アイコン）と離れていた |
| **原因** | 削除 UI が `.detail-actions` に独立配置されていた |
| **対応内容** | 下部の削除ボタンと `.detail-actions` を削除。タイトル行の鍵アイコン横にゴミ箱アイコンボタン（`#delete-entry-btn`）を追加。既存の confirm ロジック（プロテクト中は強い確認）は維持。`.delete-btn` は `.protect-btn` と同サイズでホバー時に危険色 |
| **関連ファイル** | `ui/dashboard/index.html`, `ui/dashboard/dashboard.css` |

---

## cba43fa — 2026-06-09 — 自動保存機能を完全削除

| 項目 | 内容 |
|------|------|
| **種別** | enhancement |
| **症状** | 自動保存は UI 上無効化されていたが、設定キー・コンテンツスクリプト・ストレージ処理にコードが残存していた |
| **原因** | 段階的無効化（7b9ff9d）で UI のみ止め、バックエンドと自動トリガーは温存していた |
| **対応内容** | `autoSaveSuno` / `autoSaveAI` / `autoSaveChatGPT` / `autoSaveList` を型・既定設定・ストレージから削除。`suno-song` / `suno-list` / `ai-chat` の自動キャプチャと DOM 監視を削除（手動保存・コンテキストメニューは維持）。ダッシュボード設定タブから「自動保存」を除去（自動リンク｜データ管理｜データ整理）。ポップアップの自動保存フッターを削除。README の自動保存記述を更新 |
| **関連ファイル** | `src/types.js`, `src/background/service-worker.js`, `src/content/*.js`, `src/ui/popup/popup.js`, `src/ui/dashboard/dashboard.js`, `ui/popup/*`, `ui/dashboard/*`, `README.md`, `dist/*` |

---

## a9250f2 — 2026-06-08 — ダッシュボードを2ペイン構成に変更

| 項目 | 内容 |
|------|------|
| **種別** | enhancement |
| **症状** | 検索・フィルタが全幅の上ペイン、結果一覧が左、詳細が右の3ゾーン構成で、横方向の画面利用が分断されていた |
| **原因** | `search-panel` が `main.layout` の外に独立配置されていた |
| **対応内容** | 検索・フィルタを左ペイン（`.results-panel`）内に移動し、縦積み（検索 → 結果一覧）に。右ペインは詳細のみで全高表示。`.results-body` で結果リストのみスクロール。900px 以下は従来どおり縦積み。split-pane は変更なし |
| **関連ファイル** | `ui/dashboard/index.html`, `ui/dashboard/dashboard.css` |

---

## 475946a — 2026-06-08 — 詳細ヘッダーに関連リンクを集約（複数件表示）

| 項目 | 内容 |
|------|------|
| **種別** | enhancement |
| **症状** | 詳細パネルの「関連 AI チャット」「関連 Suno」がスクロール本文内に縦に並び歌詞領域を圧迫。1 エントリに複数リンクがある場合も、見出し付きリストで見づらかった |
| **原因** | リンクブロックが `.detail-scroll` 内の `links-block` に配置されていた。表示側で自エントリや URL なしを除外する整理が不十分 |
| **対応内容** | `.detail-header` にタイトル・メタ・関連リンクを集約。`getLinked` の `chatgpt[]` / `suno[]` をすべてチップ表示（自エントリ除外、保存日降順）。横並び折り返し、件数が多いときはヘッダー内スクロール（`max-height: 7.5rem`）。リンクなし行は非表示。URL なしは静的チップ |
| **関連ファイル** | `ui/dashboard/index.html`, `ui/dashboard/dashboard.css`, `src/ui/dashboard/dashboard.js`, `dist/dashboard.js` |

---

## de88105 — 2026-06-08 — テキスト検索をスペース区切り AND 条件に

| 項目 | 内容 |
|------|------|
| **種別** | enhancement |
| **症状** | 検索欄に「foo bar」のように複数語を入力しても、連続文字列として部分一致するだけで、両方の語が含まれるエントリに絞り込めなかった |
| **原因** | `searchEntries` がクエリ全体を 1 つの needle として `matchesQuery` に渡していた |
| **対応内容** | `splitSearchQuery` で半角・全角スペース区切りのトークンに分割。各トークンが title / lyrics / stylePrompt / gptName / searchText のいずれかに含まれることを `entryMatchesSearchTokens` で AND 判定。空クエリ・単一トークンは従来どおり |
| **関連ファイル** | `src/lib/similarity.js`, `src/db/repository.js`, `dist/service-worker.js` |

---

## 9da7987 — 2026-06-08 — 詳細パネルのスクロール領域を画面高さいっぱいに

| 項目 | 内容 |
|------|------|
| **種別** | enhancement |
| **症状** | 詳細パネル全体がページスクロールになり、歌詞エリアは `max-height: 240px` で固定されていたため、ビューポートの残り高さを活かせなかった |
| **原因** | `.layout` が `min-height: 60vh` のみで body 高さを使い切っておらず、`.detail-panel` に `overflow: auto` が付いていた。歌詞 `<pre>` に独自の最大高さ制限があった |
| **対応内容** | body を flex 列（`height: 100vh`）にし `.layout` を `flex: 1; min-height: 0` で残り高さを占有。詳細パネルを flex 列化し、タイトル・メタ・削除ボタンは固定、歌詞と関連リンクを `.detail-scroll` で囲んで内部スクロール。レスポンシブ（900px 以下）でも各ペインが `min-height: 0` で均等分割 |
| **関連ファイル** | `ui/dashboard/index.html`, `ui/dashboard/dashboard.css` |

---

## d88f570 — 2026-06-08 — 検索結果に保存日時とリンク状態を表示

| 項目 | 内容 |
|------|------|
| **種別** | enhancement |
| **概要** | 保存日時（`capturedAt` / `updatedAt`）を検索結果カードで活用し、日付グループ・ハイライト・リンク状態バッジを追加 |
| **症状** | データ保存時には `capturedAt` / `updatedAt` が記録されているが、検索結果一覧では日付が表示されず、いつ保存したか判別しづらかった。詳細パネルのみ ISO 文字列の先頭19文字を表示していた |
| **原因** | `renderResults` がソースバッジ・タイトル・スニペットのみ描画。検索 API もリンク状態を返していなかった |
| **対応内容** | `src/lib/date-format.js` を追加（相対日付・グループ見出し・フル日時）。検索結果カードに保存日（相対表示＋ツールチップ）、リンク済みバッジ、プロテクト表示、クエリ一致ハイライト（`<mark>`）を追加。複数日にまたがる結果は日付グループ見出しを表示。詳細メタも読みやすい日時表記に変更。`search` API で `linkedIds` を返却。`upsertEntry` は既に初回 `capturedAt` 保持・毎回 `updatedAt` 更新のため変更なし |
| **関連ファイル** | `src/lib/date-format.js`, `src/lib/normalize.js`, `src/ui/dashboard/dashboard.js`, `src/background/service-worker.js`, `ui/dashboard/dashboard.css`, `dist/dashboard.js`, `dist/service-worker.js` |

### 日時フィールド仕様メモ

| フィールド | 設定タイミング | 形式 | 常に存在 |
|-----------|--------------|------|---------|
| `capturedAt` | 初回保存時（既存があれば保持） | ISO 8601（`toISOString()`） | はい（`upsertEntry` で未指定時は保存時刻） |
| `updatedAt` | 毎回の upsert・プロテクト切替 | ISO 8601 | upsert 経路では常に設定（型上は optional） |

---

## 7b9ff9d — 2026-06-08 — 自動保存 UI を無効化し設定タブを並べ替え

| 項目 | 内容 |
|------|------|
| **種別** | enhancement |
| **概要** | ダッシュボード設定・ポップアップの自動保存チェックボックスを `disabled` で表示のみにし、設定タブの既定表示を「自動リンク」に変更 |
| **症状** | 自動保存機能は当面提供しない方針だが、UI 上は ON/OFF できてしまいユーザーが誤って有効化しうる状態だった。設定ダイアログは自動保存タブが先頭で開いていた |
| **原因** | チェックボックスに `disabled` がなく change リスナーで設定保存できていた。タブ順・既定タブが自動保存優先のままだった |
| **対応内容** | ダッシュボード・ポップアップの 3 チェックボックスに `disabled` と「現在無効」注記を追加。ポップアップの change リスナーと `saveSetting` を削除。設定タブ順を「自動リンク｜自動保存｜データ管理｜データ整理」に変更し、ダイアログ開閉時の既定タブを自動リンクに。自動保存タブでは保存ボタン非表示・保存処理スキップ。無効状態用 CSS を追加 |
| **関連ファイル** | `ui/dashboard/index.html`, `ui/dashboard/dashboard.css`, `src/ui/dashboard/dashboard.js`, `ui/popup/index.html`, `ui/popup/popup.css`, `src/ui/popup/popup.js`, `dist/dashboard.js`, `dist/popup.js` |

---

## e615db3 — 2026-06-08 — データ整理の危険チェックを自動リセット

| 項目 | 内容 |
|------|------|
| **種別** | enhancement |
| **概要** | 設定ダイアログの「全データ」「プロテクト中のデータも削除する」チェックを、閉じて再表示したときおよび一括削除成功後に自動でオフに戻す |
| **症状** | 全データ削除実行後や設定を閉じて再度開いたあとも、危険なチェックがオンのまま残り誤操作のリスクがあった |
| **原因** | チェック状態が DOM に保持されたまま、ダイアログ再表示時・削除成功時にリセットする処理がなかった |
| **対応内容** | `resetCleanupDangerChecks()` を追加。`openSettingsDialog` / `closeSettingsDialog` および `bulkDeleteCleanup` 成功後に呼び出し、両チェックをオフに戻す |
| **関連ファイル** | `src/ui/dashboard/dashboard.js`, `dist/dashboard.js` |

---

## 53ebc51 — 2026-06-08 — ポップアップ起動時の SW 接続エラー修正（v1.2.3）

| 項目 | 内容 |
|------|------|
| **種別** | bug |
| **概要** | ポップアップを開いた直後に `Could not establish connection. Receiving end does not exist.` が未捕捉で表示される問題を修正 |
| **症状** | `ui/popup/index.html` / `dist/popup.js` で `refreshCount`・`loadSettings` 初期化時に Uncaught (in promise) Error。Service Worker がスリープ中だと件数・設定取得が失敗 |
| **原因** | `sendToBackground` が `sendMessage` / Port の接続失敗時に `reject`・`throw` しうる実装だった。ポップアップ側も `refreshCount()` / `loadSettings()` を await せず try/catch もなく、SW コールドスタート時に未捕捉の Promise rejection になっていた |
| **対応内容** | `sendToBackground` を全面非 throw 化（`failureResponse` で `{ success: false, error }` を返却）。`ping` による SW ウェイクアップ、リトライ増（既定 4 回）、Port `onDisconnect` の確実な settle。ポップアップ初期化に try/catch と件数ラベルのフォールバック表示。SW `onMessage` で content script 横取りを `_target` + `sender.tab` で除外。manifest **1.2.3** |
| **関連ファイル** | `src/lib/extension-messaging.js`, `src/ui/popup/popup.js`, `src/background/service-worker.js`, `manifest.json`, `dist/popup.js`, `dist/service-worker.js` |

### ユーザー向け：拡張機能の再読み込み手順（v1.2.3 適用）

1. `chrome://extensions` を開く（「デベロッパー モード」をオン）
2. 「楽曲制作アーカイブ」の **再読み込み**（↻）をクリック  
   - バージョンが **1.2.3** になっていることを確認
3. ツールバーの拡張アイコンからポップアップを開き、**保存件数** が表示されること（一時的に「取得できません（再読み込み）」と出た場合は手順 2 を繰り返す）
4. 開発中にソースを直した場合は `cd music-archive-extension` → `npm run build` 後に手順 2 を繰り返す

---

## 7d1abb7 — 2026-06-08 — データ整理プレビューの SW 誤検知を根本修正（v1.2.2）

| 項目 | 内容 |
|------|------|
| **種別** | bug |
| **GitHub Issue** | #13 再発 |
| **概要** | 811dafd 後も「全データ」選択時に「Service Worker が古い状態」と表示される問題を根本修正 |
| **症状** | 設定 → データ整理 → 全データで「削除対象: 0 件」のまま「プレビュー取得に失敗しました: バックグラウンド（Service Worker）が古い状態です…」 |
| **原因** | `chrome.runtime.sendMessage` は拡張内の**全** `onMessage` リスナー（開いている Suno / AI タブの content script 含む）に配信され、**最初に `sendResponse` した側だけ**が応答として返る。旧 content script や応答競合で SW の `previewCleanup` 結果が届かず `unknown action` / 空応答になり、ダッシュボードが stale SW と誤判定していた。811dafd は `getExtensionInfo` 事前チェックのみ除去し、配信経路の問題は残っていた |
| **対応内容** | `sendToBackground`（`_target: 'background'` 付与・リトライ・Port フォールバック）を追加。SW に `dispatchAction` 共通化と `onConnect`（`ma-background`）を追加。content script は `_target === 'background'` を即 `return false`。エラー文言を診断付きに改善。manifest **1.2.2** |
| **関連ファイル** | `src/lib/extension-messaging.js`, `src/ui/dashboard/dashboard.js`, `src/ui/popup/popup.js`, `src/background/service-worker.js`, `src/content/*.js`, `manifest.json`, `scripts/package-extension.mjs` |

### ユーザー向け：拡張機能の再読み込み手順（v1.2.2 適用）

開発・限定配布とも、**読み込み元はリポジトリ直下の `music-archive-extension/` フォルダ**（`manifest.json` があるディレクトリ）。zip 配布の場合は解凍先をそのまま指定。

1. `chrome://extensions` を開く（「デベロッパー モード」をオン）
2. 「楽曲制作アーカイブ」の **再読み込み**（↻）をクリック  
   - バージョンが **1.2.2** になっていることを確認
3. **開いている Suno / ChatGPT / Claude 等のタブをすべて F5 で更新**（古い content script を破棄するため。省略するとプレビューが再び失敗することがある）
4. ダッシュボード（オプション画面）を **閉じて開き直す**（古い `dist/dashboard.js` をキャッシュしないため）
5. 設定 → データ整理 → **全データ** をオンにし、削除対象件数とプレビューが表示されることを確認

開発中にソースを直した場合は、追加で `cd music-archive-extension` → `npm run build` を実行してから手順 2 を繰り返す。

---

## 1082545 — 2026-06-08 — 配布 zip 用 npm run package スクリプトを追加

| 項目 | 内容 |
|------|------|
| **種別** | enhancement |
| **概要** | 限定配布向けに `npm run package` でビルド・検証・zip 生成を一括実行できるようにした |
| **症状・原因** | 手動で dist / icons / ui / manifest をコピーして zip 化しており、古い Service Worker が混入するとデータ整理機能が動かないリスクがあった |
| **対応内容** | `scripts/package-extension.mjs` を追加。`npm run build` 後に staging し、`previewCleanup` / `getExtensionInfo` の存在を検証してから `release/music-archive-extension-v{version}.zip` を生成 |
| **関連ファイル** | `package.json`, `scripts/package-extension.mjs` |

---

## 811dafd — 2026-06-08 — データ整理・インポート・Suno保存の不具合修正とインポート種別追加

**GitHub Issue:** Fixes #13, #14, #16 / Closes #15

### 811dafd-1: データ整理 SW/getExtensionInfo 誤検知

| 項目 | 内容 |
|------|------|
| **種別** | bug |
| **GitHub Issue** | #13 |
| **概要** | データ整理「全データ」選択時に、正常な SW でも「古いバックグラウンド」と誤表示される問題を修正 |
| **症状・原因** | `ensureCleanupBackendReady` が `getExtensionInfo` で事前チェックし、応答形式やタイミングにより false positive が発生。実際には `previewCleanup` は利用可能だった |
| **対応内容** | 事前チェックを削除。`send()` で `chrome.runtime.lastError` と空応答を正しく reject。SW に `getExtensionInfo` ハンドラを追加（バージョン確認・`supportsCleanup` 返却） |
| **関連ファイル** | `src/ui/dashboard/dashboard.js`, `src/background/service-worker.js`, `manifest.json`（1.2.1） |

### 811dafd-2: データ整理プレビュー改善

| 項目 | 内容 |
|------|------|
| **種別** | bug |
| **GitHub Issue** | #14 |
| **概要** | データ整理タブのプレビューがタブ切替後に更新されない・競合で古い結果が残る問題を修正 |
| **症状・原因** | `panel.hidden` 判定では設定タブの `currentSettingsTab` と不一致。debounce 中の非同期応答が後から上書き。エラー時のメッセージが不親切 |
| **対応内容** | `currentSettingsTab === 'data-cleanup'` でガード。`cleanupPreviewRequestId` で競合防止。即時/ debounce 入力を分離。`cleanupBackendErrorMessage` で SW  stale 時の再読み込み案内 |
| **関連ファイル** | `src/ui/dashboard/dashboard.js`, `ui/dashboard/dashboard.css`, `ui/dashboard/index.html` |

### 811dafd-3: インポート種別（追加 / 全件クリア・プロテクト保持）

| 項目 | 内容 |
|------|------|
| **種別** | enhancement |
| **GitHub Issue** | Closes #15 |
| **概要** | JSON インポートに「追加」と「プロテクト除く全件クリア後に取り込み」の 2 モードを追加 |
| **症状・原因** | 従来は常に upsert のみで、DB を空にしてからリストアする手段がなかった |
| **対応内容** | UI にラジオボタン（`append` / `replace_except_protected`）。`importAll(data, mode)` で非プロテクト分を削除してから取り込み。確認ダイアログと結果サマリ表示 |
| **関連ファイル** | `src/db/repository.js`, `src/background/service-worker.js`, `src/ui/dashboard/dashboard.js`, `ui/dashboard/index.html` |

### 811dafd-4: suno-song メッセージ干渉修正

| 項目 | 内容 |
|------|------|
| **種別** | bug |
| **GitHub Issue** | #16 |
| **概要** | Suno 曲ページの content script が `captureSunoSong` 以外のメッセージも `{ success: false }` で応答し、他機能を妨害していた |
| **症状・原因** | `onMessage` が全 action を受け取り、未対応 action でも `sendResponse({ success: false })` を返していたため、バックグラウンド側の他リスナーと競合 |
| **対応内容** | `captureSunoSong` 以外は `return false` で委譲。対象 action のみ async で応答 |
| **関連ファイル** | `src/content/suno-song.js` |

---

## b6105cf — 2026-06-08 — データ整理のクイック整理に全データオプションを追加

| 項目 | 内容 |
|------|------|
| **種別** | enhancement |
| **概要** | クイック整理プリセットに「全データ」を追加 |
| **症状・原因** | 条件を細かく指定しない一括削除の入口がなかった |
| **対応内容** | `presetAll` フィルタと UI チェックボックスを追加。プロテクト除外は従来どおり。全データ選択時は確認メッセージを強化 |
| **関連ファイル** | `src/lib/cleanup-filter.js`, `src/ui/dashboard/dashboard.js`, `ui/dashboard/index.html` |

---

## 8333a78 — 2026-06-08 — データ整理の詳細条件を折りたたみ可能に（初期は閉じる）

| 項目 | 内容 |
|------|------|
| **種別** | enhancement |
| **概要** | データ整理タブの詳細条件セクションを `<details>` で折りたたみ、初期非表示に |
| **症状・原因** | 詳細条件が常時表示で UI が冗長 |
| **対応内容** | `details/summary` と CSS で折りたたみ。クイック整理を前面に |
| **関連ファイル** | `ui/dashboard/dashboard.css`, `ui/dashboard/index.html` |

---

## b7a88e1 — 2026-06-08 — 手動リンクをトップバーのダイアログに移動

| 項目 | 内容 |
|------|------|
| **種別** | enhancement |
| **概要** | 手動リンク追加 UI を詳細パネルからトップバーのダイアログへ移動 |
| **症状・原因** | 詳細パネル内だと操作導線が分かりにくい |
| **対応内容** | 設定ボタン左に「手動リンク追加」ボタンと `<dialog>` を配置。詳細パネル内の旧 UI を削除 |
| **関連ファイル** | `src/ui/dashboard/dashboard.js`, `ui/dashboard/dashboard.css`, `ui/dashboard/index.html` |

---

## f177494 — 2026-06-08 — データ整理タブとプロテクト機能を追加

| 項目 | 内容 |
|------|------|
| **種別** | enhancement |
| **概要** | 設定にデータ整理タブ（条件付き一括削除・プレビュー）とエントリのプロテクト機能を新規実装 |
| **症状・原因** | 古いデータやリンクなしエントリの整理手段がなく、誤削除を防ぐロックもなかった |
| **対応内容** | `cleanup-filter.js` でフィルタ定義。`previewCleanup` / `bulkDeleteByCleanupFilters` / `setEntryProtected` を repository と SW に追加。ダッシュボード UI・詳細の鍵アイコン |
| **関連ファイル** | `src/background/service-worker.js`, `src/db/repository.js`, `src/lib/cleanup-filter.js`, `src/types.js`, `src/ui/dashboard/dashboard.js`, `ui/dashboard/dashboard.css`, `ui/dashboard/index.html` |

---

## 参照

- コミット履歴: `git log --oneline`
- 配布 zip: `npm run package` → `release/music-archive-extension-v*.zip`
- 現行バージョン: `manifest.json` の `version`（1.2.1）
