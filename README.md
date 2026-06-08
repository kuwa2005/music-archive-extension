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

1. Suno / 主要 AI にログインした状態で対象ページを開く
2. 拡張アイコン →「現在のページを保存」で手動保存
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

### 開発運用

- 不具合修正・機能改善は **`issues.md`** にコミット単位で記録する（種別・症状・原因・対応・GitHub Issue #）
- 変更後は **ローカル git コミット**（日本語メッセージ）。`src/` 変更時はコミット前に `npm run build`
- GitHub への push は区切りがついたタイミングでまとめて行う（毎回 push 不要）
- 詳細ルール: ワークスペース `.cursor/rules/music-archive-extension-workflow.mdc`

## データ

- 保存先: ブラウザ内 IndexedDB (`MusicArchiveDB`)
- バックアップ: 設定 → **データ管理** タブから JSON エクスポート

## 注意

- Suno / 各 AI サービスの UI 変更により DOM 抽出が失敗する場合があります。その場合は手動保存を試してください。
- 自動リンクは類似度閾値（既定 0.75）以上の場合のみ作成されます。ダッシュボードの設定で調整できます。
