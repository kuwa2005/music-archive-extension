# Chrome Web Store 公開時の懸念事項

楽曲制作アーカイブ拡張（`music-archive-extension`）を Chrome Web Store に公開する際のリスク・不足物・対策をまとめたメモ。

**最終更新:** 2026-06-09  
**対象バージョン:** manifest `1.2.0`

---

## 総合評価

| 観点 | リスク | 概要 |
|------|--------|------|
| 単一目的（Single Purpose） | 低 | 楽曲制作データのアーカイブ・横断検索に収まっている |
| MV3 / リモートコード | 低 | バンドル済み JS のみ。外部からコード実行なし |
| データの外部送信 | 低 | IndexedDB + `chrome.storage.local` のみ |
| ユーザーデータ / プライバシー | **低〜中** | 手動保存のみに整理済み。ポリシー URL とストア説明の整合が残タスク |
| 権限（host_permissions 等） | **中** | 多数ドメインへのアクセスは justification 必須 |
| 第三者サービス ToS | **中**（CWS 外） | Suno / 各 AI の利用規約とは別問題だが現実リスクあり |

**結論:** 自動保存は廃止し**手動保存のみ**に統一。プライバシーポリシー（`docs/privacy-policy.md`）を整備済み。残りはストア掲載文・権限 justification・提出 ZIP 等の実務。

---

## 1. 審査で突っ込まれやすい懸念

### 1.1 手動保存のみ（自動保存は廃止）

**現状（2026-06-09）**

- データ取得は **ユーザーが明示的に保存操作をしたときのみ**（ポップアップ「現在のページを保存」、コンテキストメニュー）
- ページ読み込み・DOM 変更による **自動保存・MutationObserver による自動取得はない**
- 設定の自動保存 ON/OFF は廃止（`defaultSettings()` から autoSave 系を削除）

**関連ドキュメント**

- [privacy-policy.md](./privacy-policy.md) / [privacy-policy.ja.md](./privacy-policy.ja.md)
- ルート [README.md](../README.md)

**ストア向け**

- [ ] ストア説明文に「手動保存のみ」「自動収集なし」を明記
- [x] プライバシーポリシーに手動保存のみを記載


---

### 1.2 AI 会話の取得範囲

**現状**

- `pickBestLyrics()` は歌詞らしいブロックを優先するが、見つからない場合は**最長の AI 応答テキスト**を保存する
- 自動保存条件は `lyrics` **または** `title` があれば実行（タイトルのみでも保存されうる）

**関連ファイル**

- `src/lib/ai-extract.js` — `pickBestLyrics()`
- `src/content/ai-chat.js` — 保存条件 `(!data.lyrics && !data.title)`

**ポリシー上の懸念**

- 「歌詞アーカイブ」と説明しつつ、**歌詞と無関係な会話内容**がローカルに残る可能性
- プライバシーポリシーで収集範囲を過小申告していると問題視されうる

**推奨対策**

- [ ] ポリシーに「会話の一部（主に歌詞・制作関連テキスト）をローカル保存」と正直に記載
- [ ] （推奨）歌詞検出（`looksLikeLyrics` 等）に該当する場合のみ自動保存
- [ ] （任意）保存前確認 UI

---

### 1.3 プライバシーポリシー

**現状**

- [docs/privacy-policy.md](./privacy-policy.md)（英語・CWS 掲載用 URL 推奨）
- [docs/privacy-policy.ja.md](./privacy-policy.ja.md)（日本語）
- 索引: [docs/README.md](./README.md)

**残タスク**

- [ ] Chrome デベロッパーダッシュボードの Privacy practices に URL を登録
- [ ] （任意）GitHub Pages で `/docs` を公開


---

### 1.4 多数の host_permissions

**現状（manifest.json）**

| ドメイン | 用途 |
|----------|------|
| `suno.com` / `*.suno.com` | 曲・リスト・ワークスペースから情報取得 |
| `chatgpt.com` / `chat.openai.com` | ChatGPT 会話から歌詞等取得 |
| `claude.ai` | Claude 会話 |
| `gemini.google.com` | Gemini 会話 |
| `copilot.microsoft.com` / `copilot.com` | Copilot 会話 |
| `perplexity.ai` / `www.perplexity.ai` | Perplexity 会話 |
| `poe.com` | Poe 会話 |

**ポリシー上の懸念**

- 審査フォームで**各権限の justification（用途説明）**を求められる
- 「なぜこのドメインすべてが必要か」が説明できないと権限削減を指示される可能性

**推奨対策**

- [ ] ダッシュボード用に権限説明文を日本語で下書きしておく（後述「付録」を参照）
- [ ] 将来対応 AI を増やす場合は、必要ドメインだけに絞る

---

## 2. リスクは低いが注意したい点

### 2.1 コンテキストメニューが全サイトに表示

**現状**

- 「アーカイブを検索」メニューは `documentUrlPatterns` 未指定のため**すべての Web ページ**に表示

**関連ファイル**

- `src/background/service-worker.js` — `open-dashboard` メニュー

**懸念**

- 拒否理由になる可能性は低いが、最小権限・UX の観点では Suno / AI ドメインに限定した方が無難

**推奨対策**

- [ ] （任意）`documentUrlPatterns` を Suno + 各 AI ドメインに限定

---

### 2.2 商標・非公式表記

**現状**

- 説明文・機能説明で ChatGPT / Claude / Gemini / Suno 等の名称を使用

**懸念**

- 各社の商標。公式ツールと誤認されないよう**非公式・非提携**である旨の記載が望ましい

**推奨対策**

- [ ] ストア説明・ポリシーに免責文を追加  
  例: 「本拡張は Google / OpenAI / Anthropic / Microsoft / Suno 等とは無関係の非公式ツールです。各名称は権利者の商標です。」

---

### 2.3 manifest / package のバージョン不一致

**現状**

- `manifest.json`: `1.2.0`
- `package.json`: `1.0.0`

**懸念**

- 審査自体には直接影響しないが、リリース管理の混乱要因

**推奨対策**

- [ ] 公開前にバージョン番号を揃える運用ルールを決める

---

## 3. 問題になりにくい点（強み）

- データは**端末内のみ**保存（外部 API 送信・広告・分析なし）
- **Manifest V3** 準拠
- `eval` / 動的リモート script 読み込みなし
- ログイン資格情報・Cookie の取得なし
- JSON エクスポート / インポート、エントリ削除が可能
- 拡張の目的が単一で説明しやすい

---

## 4. Chrome Web Store 外の注意（参考）

### 4.1 第三者サービスの利用規約

Suno や各 AI プロバイダの ToS では、自動スクレイピングや DOM 抽出が制限されている場合がある。  
これは **Google の審査拒否理由とは別**だが、以下のリスクはあり得る。

- サービス側 UI 変更による機能停止（技術的リスク）
- ToS 上のグレーゾーン（法的・契約リスク）

公開前に各サービスの利用規約を確認し、必要なら説明文で「ユーザー自身の制作データの個人利用向けバックアップ」と位置づける。

---

## 5. 公開前チェックリスト

### アカウント・登録

- [ ] Google デベロッパーアカウント登録（$5 一回）
- [ ] 連絡先メール認証
- [ ] 公開者名の決定

### 提出物

- [ ] `npm run build` 後の ZIP 作成（`manifest.json` がルート、`node_modules` 除外）
- [ ] アイコン 16 / 48 / 128 確認
- [ ] manifest の `name` / `version` / `description`（132 文字以内）最終確認

### ストア掲載

- [ ] 説明文（日本語、必要なら英語）
- [ ] スクリーンショット 1 枚以上（1280×800 または 640×400）
- [ ] 小アイコン 128×128
- [ ] （推奨）プロモーション用タイル 440×280
- [ ] カテゴリ選定（例: Productivity）
- [ ] プライバシーポリシー URL
- [ ] 権限 justification 各項目

### 品質・動作確認

- [ ] ZIP を `chrome://extensions` に読み込み、主要フロー手動テスト
  - Suno 曲 / リスト / ワークスpace 保存
  - 各 AI 手動・自動保存
  - 検索・リンク・エクスポート / インポート
  - 設定（自動保存 OFF）の反映
- [ ] Dexie（Apache 2.0）等の OSS ライセンス表記

---

## 6. 公開後の運用懸念

| 項目 | 内容 |
|------|------|
| UI 変更 | Suno / 各 AI の DOM 変更で content script が動かなくなる。更新版の継続提出が必要 |
| 審査時間 | 初回・権限が多い場合は数時間〜数日 |
| バージョン管理 | 再提出のたびに manifest `version` を必ず増やす |
| ポリシー変更 | Google / 各 AI のポリシー変更に追随 |

---

## 付録 A: 権限 justification 文案（下書き）

審査フォーム・ストア説明用。必要に応じて編集して使用。

| 権限 | 説明（案） |
|------|------------|
| `storage` | ユーザー設定（自動保存 ON/OFF 等）を保存するため |
| `unlimitedStorage` | 大量の楽曲・歌詞アーカイブを IndexedDB に保存するため |
| `activeTab` | ユーザーが操作中のタブから手動でデータを保存するため |
| `tabs` | アーカイブ詳細画面から元の Suno / AI ページ URL を新規タブで開くため |
| `contextMenus` | 右クリックメニューから保存・検索ダッシュボードを開くため |
| `notifications` | 手動保存完了・自動リンク完了をユーザーに通知するため |
| `host_permissions`（Suno） | Suno の曲ページ・プレイリスト等からタイトル・歌詞・プロンプトを読み取りローカル保存するため |
| `host_permissions`（各 AI） | ユーザーが利用中の AI チャットから歌詞・会話タイトルを読み取り、Suno 曲との関連付けに使うため |

---

## 付録 B: プライバシーポリシーに書く項目チェック

- [ ] 拡張名・開発者名・連絡先
- [ ] 収集データの一覧
- [x] 収集方法（**手動保存のみ**、自動収集なし）
- [ ] 保存場所（ローカルのみ）
- [ ] 第三者提供・広告・分析なし
- [ ] データ削除方法
- [ ] 最終更新日
- [ ] 非公式ツールである旨（任意だが推奨）

---

## 付録 C: 関連リンク

- [Chrome Web Store デベロッパー登録](https://developer.chrome.com/docs/webstore/register)
- [拡張の準備](https://developer.chrome.com/docs/webstore/prepare)
- [プログラムポリシー](https://developer.chrome.com/docs/webstore/program-policies/policies)
- [Single Purpose FAQ](https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines-faq)

---

## 改訂履歴

| 日付 | 内容 |
|------|------|
| 2026-06-07 | 初版作成（コードベース manifest 1.2.0 時点の分析） |
| 2026-06-09 | 手動保存のみへ方針更新、プライバシーポリシー整備を反映 |
