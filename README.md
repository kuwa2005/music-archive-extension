# Music Production Archive / 楽曲制作アーカイブ

Chrome extension to save Suno songs and major AI chats (ChatGPT, Claude, Gemini, Copilot, Perplexity, Poe) locally, link related entries, and search across lyrics and titles.

Suno の曲ページ・ワークスペース/プレイリスト、および主要 AI から情報を**手動保存**し、IndexedDB 上で横断検索できる Chrome 拡張機能です。

**Repository:** https://github.com/kuwa2005/music-archive-extension

---

## English

### Features

- **Suno song pages** (`/song/{uuid}`): title, lyrics, style prompt
- **Suno workspace** (`/create?wid=...`): song URLs, titles, prompts
- **Suno lists** (playlist / me): batch save from list pages
- **Major AI chats**: ChatGPT, Claude, Gemini, Copilot, Perplexity, Poe
- **Auto-link** (local): similar lyrics/titles between saved AI chats and Suno entries
- **Search dashboard**: cross-search, manual links, JSON export/import, bulk cleanup
- **Manual save only**: data is captured **only when you click Save** or use the context menu — no automatic background collection

### Privacy

- [Privacy Policy (English)](docs/privacy-policy.md)
- [プライバシーポリシー（日本語）](docs/privacy-policy.ja.md)

For Chrome Web Store listing, use the GitHub raw or Pages URL of `docs/privacy-policy.md` (see below).

### Setup

**From GitHub (developer mode / sideload):**

```powershell
git clone https://github.com/kuwa2005/music-archive-extension.git
cd music-archive-extension
npm install
npm run icons
npm run build
```

Then open `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the **repository root folder** (the folder that contains `manifest.json`). Do **not** select a parent folder, `src/`, `ui/`, or `release/`.

> **Note:** `dist/` (built JavaScript) is **not** committed to Git. A fresh clone includes `manifest.json` but **will not load in Chrome until you run `npm run build`**. If Chrome reports a manifest or load error, confirm `dist/service-worker.js` exists after the build step.

**Local workspace path example:**

```powershell
cd d:\00_project\music-archive-extension
npm install
npm run icons
npm run build
```

### Usage

1. Open a supported Suno or AI page while logged in
2. Extension icon → **Save current page**, or use the right-click context menu
3. Open **Search dashboard** from the popup or context menu
4. Search by lyrics snippet, title, AI name, or prompt; manage links and backups in **Settings**

### Development

```powershell
npm run watch
```

After editing `src/`, run `npm run build` and click **Reload** on `chrome://extensions`.

### Data

- Storage: browser IndexedDB (`MusicArchiveDB`) + `chrome.storage.local` for settings
- Backup: **Settings → Data management → Export** (JSON)

### Notes

- DOM extraction may break when Suno or AI sites change their UI. Retry manual save after reloading the page.
- Auto-link uses a similarity threshold (default 0.75), configurable in Settings.
- UI language follows the browser locale: **English** or **Japanese** (`chrome.i18n`).

---

## 日本語

### 機能

- **Suno 曲ページ** (`/song/{uuid}`): タイトル・歌詞・style プロンプト
- **Suno ワークスペース** (`/create?wid=...`): 曲 URL・タイトル・プロンプト
- **Suno リスト** (playlist / me): リストから一括保存
- **主要 AI チャット**: ChatGPT / Claude / Gemini / Copilot / Perplexity / Poe
- **自動リンク**（ローカル）: 保存済み AI チャット ↔ Suno の歌詞・タイトル類似マッチ
- **検索ダッシュボード**: 横断検索、手動リンク、JSON エクスポート/インポート、データ整理
- **手動保存のみ**: ポップアップまたはコンテキストメニューで保存したときだけデータ取得（自動収集なし）

### プライバシー

- [Privacy Policy (English)](docs/privacy-policy.md)
- [プライバシーポリシー（日本語）](docs/privacy-policy.ja.md)

### セットアップ

**GitHub から clone して開発者モードで読み込む場合:**

```powershell
git clone https://github.com/kuwa2005/music-archive-extension.git
cd music-archive-extension
npm install
npm run icons
npm run build
```

Chrome で `chrome://extensions` →「デベロッパーモード」→「パッケージ化されていない拡張機能を読み込む」→ **`manifest.json` があるリポジトリ直下のフォルダ**を選択（親フォルダや `src/`・`ui/`・`release/` ではない）。

> **注意:** ビルド成果物の `dist/` は Git に含まれていません。clone 直後は `manifest.json` はありますが、**`npm run build` するまで Chrome では読み込めません**。マニフェスト関連のエラーが出たら、ビルド後に `dist/service-worker.js` があるか確認してください。

**ローカル作業パスの例:**

```powershell
cd d:\00_project\music-archive-extension
npm install
npm run icons
npm run build
```

### 使い方

1. Suno / 主要 AI にログインした状態で対象ページを開く
2. 拡張アイコン →「現在のページを保存」または右クリックメニュー
3. ポップアップまたは右クリックから検索ダッシュボードを開く
4. 設定タブで自動リンク閾値・バックアップ・データ整理

### 限定配布（Store 公開前）

- [限定配布-インストールマニュアル.md](docs/限定配布-インストールマニュアル.md)
- [限定配布-使用方法マニュアル.md](docs/限定配布-使用方法マニュアル.md)

### 開発

- 変更記録: [issues.md](issues.md)
- 詳細ルール: ワークスペース `.cursor/rules/music-archive-extension-workflow.mdc`
- UI 言語: ブラウザ UI 言語が日本語のとき日本語、それ以外は英語

---

## Chrome Web Store / GitHub Pages

**Privacy policy URLs (after push to `master`):**

| Language | GitHub blob |
|----------|-------------|
| English | https://github.com/kuwa2005/music-archive-extension/blob/master/docs/privacy-policy.md |
| Japanese | https://github.com/kuwa2005/music-archive-extension/blob/master/docs/privacy-policy.ja.md |

Optional GitHub Pages (Settings → Pages → branch `master`, folder `/docs`):

- English: `https://kuwa2005.github.io/music-archive-extension/privacy-policy`
- Japanese: `https://kuwa2005.github.io/music-archive-extension/privacy-policy.ja`

For the Chrome Web Store **Privacy policy** field, the English GitHub blob URL (or Pages URL) is recommended.

### Documentation index

- [docs/README.md](docs/README.md) — all project docs (privacy, CWS checklist, sideload guides)

