import { pickBestLyrics, parseIdFromUrl, titleFromDocument } from './ai-extract.js';

/**
 * @typedef {Object} PlatformAdapter
 * @property {import('./ai-sources.js').AiSource} id
 * @property {(url: string) => boolean} match
 * @property {() => string|null} parseConversationId
 * @property {() => string} extractAssistantName
 * @property {() => string} extractTitle
 * @property {() => Partial<import('../types.js').Entry>}
 */

/** @type {PlatformAdapter[]} */
export const PLATFORMS = [
  {
    id: 'chatgpt',
    match: (url) => /chatgpt\.com|chat\.openai\.com/i.test(url),
    parseConversationId: () => parseIdFromUrl([/\/c\/([a-z0-9-]+)/i]),
    extractAssistantName: () => {
      const selectors = [
        '[data-testid="gpt-name"]',
        'nav img[alt] + div',
        'header h1',
        '.text-token-text-primary.truncate',
      ];
      for (const sel of selectors) {
        const t = document.querySelector(sel)?.textContent?.trim();
        if (t && t.length > 1 && t.length < 120 && !/^ChatGPT$/i.test(t)) return t;
      }
      const title = document.title.replace(/\s*-\s*ChatGPT\s*$/i, '').trim();
      return title && !/^ChatGPT$/i.test(title) ? title : 'ChatGPT';
    },
    extractTitle: () => {
      const active = document.querySelector(
        'nav a[href*="/c/"].bg-token-sidebar-surface-secondary, nav a.selected',
      );
      if (active?.textContent?.trim()) return active.textContent.trim();
      return titleFromDocument([/\s*-\s*ChatGPT\s*$/i], 'ChatGPT 会話');
    },
    extract: function extractChatGPT() {
      const conversationId = this.parseConversationId();
      const assistantName = this.extractAssistantName();
      const title = this.extractTitle();
      const lyrics = pickBestLyrics(
        [
          '[data-message-author-role="assistant"]',
          'article[data-testid^="conversation-turn"]',
          '.agent-turn',
        ],
        title,
      );
      const sourceUrl = conversationId
        ? `${window.location.origin}/c/${conversationId}`
        : window.location.href.split('?')[0];
      return {
        source: 'chatgpt',
        title,
        lyrics,
        gptName: assistantName,
        conversationId: conversationId || undefined,
        sourceUrl,
        capturedAt: new Date().toISOString(),
      };
    },
  },
  {
    id: 'claude',
    match: (url) => /claude\.ai/i.test(url),
    parseConversationId: () =>
      parseIdFromUrl([/\/chat\/([a-f0-9-]{36})/i, /\/chat\/([a-z0-9-]+)/i]),
    extractAssistantName: () => {
      const selectors = [
        '[data-testid="model-selector"]',
        'button[aria-label*="Claude"]',
        'header a[href*="/projects"] + div',
        'nav [class*="truncate"]',
      ];
      for (const sel of selectors) {
        const t = document.querySelector(sel)?.textContent?.trim();
        if (t && t.length > 1 && t.length < 120) return t;
      }
      return titleFromDocument([/\s*-\s*Claude\s*$/i, /\s*\|\s*Claude\s*$/i], 'Claude');
    },
    extractTitle: () => {
      const active = document.querySelector('a[href*="/chat/"][aria-current="page"], nav a.font-semibold');
      if (active?.textContent?.trim()) return active.textContent.trim();
      return titleFromDocument([/\s*-\s*Claude\s*$/i, /\s*\|\s*Claude\s*$/i], 'Claude 会話');
    },
    extract: function extractClaude() {
      const conversationId = this.parseConversationId();
      const assistantName = this.extractAssistantName();
      const title = this.extractTitle();
      const lyrics = pickBestLyrics(
        [
          '[data-testid="assistant-message"]',
          '[data-is-streaming="false"]',
          'div.font-claude-message',
          'div[class*="Assistant"]',
          'div[data-test-render-count]',
        ],
        title,
      );
      const sourceUrl = conversationId
        ? `${window.location.origin}/chat/${conversationId}`
        : window.location.href.split('?')[0];
      return {
        source: 'claude',
        title,
        lyrics,
        gptName: assistantName,
        conversationId: conversationId || undefined,
        sourceUrl,
        capturedAt: new Date().toISOString(),
      };
    },
  },
  {
    id: 'gemini',
    match: (url) => /gemini\.google\.com/i.test(url),
    parseConversationId: () => parseIdFromUrl([/\/app\/([a-f0-9-]{36})/i, /\/app\/([a-z0-9-]+)/i]),
    extractAssistantName: () => {
      const selectors = [
        '[data-test-id="model-selector"]',
        'button[aria-label*="Gemini"]',
        '.model-picker',
        'mat-select',
      ];
      for (const sel of selectors) {
        const t = document.querySelector(sel)?.textContent?.trim();
        if (t && t.length > 1 && t.length < 120) return t;
      }
      return 'Gemini';
    },
    extractTitle: () =>
      titleFromDocument([/\s*-\s*Gemini\s*$/i, /\s*\|\s*Google Gemini\s*$/i], 'Gemini 会話'),
    extract: function extractGemini() {
      const conversationId = this.parseConversationId();
      const assistantName = this.extractAssistantName();
      const title = this.extractTitle();
      const lyrics = pickBestLyrics(
        [
          'message-content.model-response-text',
          'message-content',
          '[data-message-author="model"]',
          '.model-response-text',
          'model-response',
        ],
        title,
      );
      const sourceUrl = conversationId
        ? `${window.location.origin}/app/${conversationId}`
        : window.location.href.split('?')[0];
      return {
        source: 'gemini',
        title,
        lyrics,
        gptName: assistantName,
        conversationId: conversationId || undefined,
        sourceUrl,
        capturedAt: new Date().toISOString(),
      };
    },
  },
  {
    id: 'copilot',
    match: (url) => /copilot\.microsoft\.com|copilot\.com/i.test(url),
    parseConversationId: () =>
      parseIdFromUrl([/\/chats\/([a-f0-9-]{36})/i, /\/chats\/([a-z0-9-]+)/i, /\/c\/([a-z0-9-]+)/i]),
    extractAssistantName: () => {
      const selectors = ['[data-testid="chat-mode-name"]', 'header h1', '.conversation-title'];
      for (const sel of selectors) {
        const t = document.querySelector(sel)?.textContent?.trim();
        if (t && t.length > 1 && t.length < 120) return t;
      }
      return 'Copilot';
    },
    extractTitle: () =>
      titleFromDocument([/\s*-\s*Copilot\s*$/i, /\s*\|\s*Microsoft Copilot\s*$/i], 'Copilot 会話'),
    extract: function extractCopilot() {
      const conversationId = this.parseConversationId();
      const assistantName = this.extractAssistantName();
      const title = this.extractTitle();
      const lyrics = pickBestLyrics(
        [
          '[data-content="assistant"]',
          '[data-testid="conversation-turn"] [data-content="assistant"]',
          '.group\\/ai-message-item',
          'cib-message[type="ai"]',
        ],
        title,
      );
      const sourceUrl = conversationId
        ? `${window.location.origin}/chats/${conversationId}`
        : window.location.href.split('?')[0];
      return {
        source: 'copilot',
        title,
        lyrics,
        gptName: assistantName,
        conversationId: conversationId || undefined,
        sourceUrl,
        capturedAt: new Date().toISOString(),
      };
    },
  },
  {
    id: 'perplexity',
    match: (url) => /perplexity\.ai/i.test(url),
    parseConversationId: () =>
      parseIdFromUrl([/\/search\/([^/?#]+)/i, /\/thread\/([^/?#]+)/i]),
    extractAssistantName: () => 'Perplexity',
    extractTitle: () => {
      const q = document.querySelector('h1, [data-testid="query-text"]');
      if (q?.textContent?.trim()) return q.textContent.trim();
      return titleFromDocument([/\s*-\s*Perplexity\s*$/i], 'Perplexity 会話');
    },
    extract: function extractPerplexity() {
      const conversationId = this.parseConversationId();
      const title = this.extractTitle();
      const lyrics = pickBestLyrics(
        [
          '[data-testid="answer"]',
          '.prose',
          'div[class*="answer"]',
          'main article',
        ],
        title,
      );
      const sourceUrl = window.location.href.split('#')[0];
      return {
        source: 'perplexity',
        title,
        lyrics,
        gptName: this.extractAssistantName(),
        conversationId: conversationId || undefined,
        sourceUrl,
        capturedAt: new Date().toISOString(),
      };
    },
  },
  {
    id: 'poe',
    match: (url) => /poe\.com/i.test(url),
    parseConversationId: () => parseIdFromUrl([/\/chat\/([^/?#]+)/i]),
    extractAssistantName: () => {
      const bot = document.querySelector('[class*="BotHeader"], header h1, .ChatHeaderBotName');
      const t = bot?.textContent?.trim();
      return t && t.length < 120 ? t : 'Poe';
    },
    extractTitle: () => {
      const bot = document.querySelector('[class*="BotHeader"], .ChatHeaderBotName');
      if (bot?.textContent?.trim()) return `${bot.textContent.trim()} 会話`;
      return titleFromDocument([/\s*-\s*Poe\s*$/i], 'Poe 会話');
    },
    extract: function extractPoe() {
      const conversationId = this.parseConversationId();
      const assistantName = this.extractAssistantName();
      const title = this.extractTitle();
      const lyrics = pickBestLyrics(
        [
          '[class*="BotMessage"]',
          '[class*="Message_bot"]',
          '[data-complete="true"]',
          '.Markdown_markdown',
        ],
        title,
      );
      const sourceUrl = window.location.href.split('?')[0];
      return {
        source: 'poe',
        title,
        lyrics,
        gptName: assistantName,
        conversationId: conversationId || undefined,
        sourceUrl,
        capturedAt: new Date().toISOString(),
      };
    },
  },
];

/**
 * @returns {PlatformAdapter|null}
 */
export function detectPlatform() {
  const url = window.location.href;
  return PLATFORMS.find((p) => p.match(url)) || null;
}
