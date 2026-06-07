## 概要

多数の `host_permissions` に対し、Chrome Web Store 審査用の**用途説明（justification）**を整備する必要があります。

## リスク

- **中** — 説明不足だと権限削減を求められる可能性

## 対象ドメイン

| ドメイン | 用途 |
|----------|------|
| `suno.com` / `*.suno.com` | 曲・リスト・ワークスペース |
| `chatgpt.com` / `chat.openai.com` | ChatGPT |
| `claude.ai` | Claude |
| `gemini.google.com` | Gemini |
| `copilot.microsoft.com` / `copilot.com` | Copilot |
| `perplexity.ai` | Perplexity |
| `poe.com` | Poe |

## 推奨対策

- [ ] 審査フォーム用に各 permission の説明文を確定（付録 A をベースに）
- [ ] ストア説明で「対応サイト一覧」と目的を明記
- [ ] 将来 AI 追加時は必要ドメインのみに絞る方針を決める

## 参照

- [docs/ChromeWebStoreへ公開する際の懸念事項.md](../docs/ChromeWebStoreへ公開する際の懸念事項.md) §1.4, 付録 A
- `manifest.json`
