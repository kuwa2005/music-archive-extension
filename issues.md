# issues.md — 不具合・改善の記録

ローカル git コミット単位で、不具合修正と機能改善を追跡する。GitHub Issue とは独立した開発メモ。

**更新方針:** コミットごとに 1 セクション（新しい順）。1 コミットに複数件含む場合は小見出しで区切る。

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
