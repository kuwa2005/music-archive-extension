# 楽曲制作アーカイブ Chrome 拡張

Suno の曲ページ・ワークスペース/プレイリスト、および **主要 AI**（ChatGPT / Claude / Gemini / Copilot / Perplexity / Poe）から情報を収集し、IndexedDB に保存。拡張機能内の検索ダッシュボードで歌詞の一部やタイトルから、関連する AI 会話 URL と Suno 曲 URL を横断検索できます。

## 機能

- **Suno 曲ページ** (`/song/{uuid}`): タイトル・歌詞・style プロンプトを保存
- **Suno ワークスペース** (`/create?wid=...`): 曲 URL・タイトル・プロンプトを `suno_workspace` として保存
- **Suno リスト** (playlist / me): 曲 URL・タイトル・プロンプトを `suno_list` として保存
- **主要 AI チャット**: ChatGPT / Claude / Gemini / Copilot / Perplexity / Poe — AI名・会話・歌詞を保存
- **自動リンク**: 歌詞/タイトル類似度で AI チャット ↔ Suno を関連付け
- **検索ダッシュボード**: 歌詞の一部から横断検索、手動リンク、JSON エクスポート/インポート

## セットアップ

```powershell
cd d:\00_project\music-archive-extension
npm install
npm run icons
npm run build
```

Chrome で `chrome://extensions` →「デベロッパーモード」→「パッケージ化されていない拡張機能を読み込む」→ このフォルダを選択。

## 使い方

1. Suno / 主要 AI にログインした状態でページを開く（設定で自動保存を ON にした場合は自動で DB に保存）
2. 拡張アイコン →「現在のページを保存」で手動保存も可能
3. 右クリックメニューからも保存・検索ダッシュボードを開けます
4. 拡張のオプション（検索ダッシュボード）で歌詞の一部を検索

### 限定配布（Store 公開前）

テスター向けの詳細手順:

- [docs/限定配布-インストールマニュアル.md](docs/限定配布-インストールマニュアル.md)
- [docs/限定配布-使用方法マニュアル.md](docs/限定配布-使用方法マニュアル.md)

## 開発

```powershell
npm run watch
```

`src/` を編集後、Chrome の拡張機能ページで「更新」を押してください。

## データ

- 保存先: ブラウザ内 IndexedDB (`MusicArchiveDB`)
- バックアップ: 設定 → **データ管理** タブから JSON エクスポート

## 注意

- Suno / 各 AI サービスの UI 変更により DOM 抽出が失敗する場合があります。その場合は手動保存を試してください。
- 自動リンクは類似度閾値（既定 0.75）以上の場合のみ作成されます。ダッシュボードの設定で調整できます。
