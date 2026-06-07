## 概要

Chrome Web Store 公開に**必須**のプライバシーポリシーが未整備です。

## リスク

- **高** — ユーザーデータ（歌詞・会話・URL 等）を扱う拡張は、公開 URL のポリシーが実質必須
- ダッシュボードの Privacy practices でも URL 入力が必要

## 現状

- 公開 URL のプライバシーポリシーが未作成

## 記載すべき内容（最低限）

- [ ] 拡張名・開発者名・連絡先
- [ ] 収集データの一覧（タイトル、歌詞、style プロンプト、会話 URL、AI 名、Suno clip ID 等）
- [ ] 収集方法（content script による DOM 読み取り、自動 / 手動）
- [ ] 自動保存は**既定 OFF**、設定で有効化可能であること
- [ ] 保存場所（ブラウザ内 IndexedDB `MusicArchiveDB`、ローカルのみ）
- [ ] 第三者への送信・共有なし
- [ ] 広告・分析用途なし
- [ ] データ削除方法（アンインストール、エントリ削除等）
- [ ] 非公式ツールである旨（推奨）
- [ ] 最終更新日

## 推奨対策

- [ ] HTTPS でアクセス可能な URL に公開（GitHub Pages / リポジトリ `docs/` 等）
- [ ] 開発者ダッシュボードに URL を登録

## 参照

- [docs/ChromeWebStoreへ公開する際の懸念事項.md](../docs/ChromeWebStoreへ公開する際の懸念事項.md) §1.3
- [Chrome Web Store プログラムポリシー](https://developer.chrome.com/docs/webstore/program-policies/policies)
