## 概要

ストア提出用 **ZIP パッケージ**の作成手順・自動化が未整備です。

## チェックリスト

- [ ] `npm run build` 後の ZIP 作成手順を文書化
- [ ] （推奨）`npm run package` 等のスクリプト追加
- [ ] ZIP に `manifest.json` がルートにあること
- [ ] `node_modules/` / 不要ファイルを除外
- [ ] アイコン 16 / 48 / 128 を含むこと
- [ ] manifest の `name` / `version` / `description`（132 文字以内）最終確認

## 注意

- `dist/` は `.gitignore` 対象のため、提出前に必ずビルドが必要

## 参照

- [docs/ChromeWebStoreへ公開する際の懸念事項.md](../docs/ChromeWebStoreへ公開する際の懸念事項.md) §5 提出物
- [Prepare your extension](https://developer.chrome.com/docs/webstore/prepare)
