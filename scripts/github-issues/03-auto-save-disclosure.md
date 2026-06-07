## 概要

自動保存の既定は OFF に変更済みですが、**ストア説明・プライバシーポリシーへの明記**が未完了です。

## リスク

- **中** — 説明と実装の不一致は審査差し戻しの典型原因

## 完了済み

- [x] 自動保存の既定を OFF に変更（`src/types.js` `defaultSettings()`）

## 残タスク

- [ ] プライバシーポリシーに「自動保存は既定 OFF。設定で有効化可能」と明記
- [ ] ストア説明文にも同内容を記載
- [ ] （任意）初回インストール時のオンボーディング画面で説明

## 関連ファイル

- `src/content/suno-song.js`
- `src/content/suno-list.js`
- `src/content/ai-chat.js`
- `src/types.js`

## 参照

- [docs/ChromeWebStoreへ公開する際の懸念事項.md](../docs/ChromeWebStoreへ公開する際の懸念事項.md) §1.1
