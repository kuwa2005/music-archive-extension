(() => {
  // src/lib/normalize.js
  var LYRIC_TAG_RE = /\[(?:intro|verse|chorus|bridge|outro|instrumental|pre-chorus|hook|refrain)\s*\d*\]/i;
  var JP_LYRIC_TAG_RE = /【(?:A|B|C|S|サビ|メロ|イントロ|間奏|アウトロ|フック)[^\】]*】/;
  function looksLikeLyrics(text) {
    if (!text || text.length < 20) return false;
    if (LYRIC_TAG_RE.test(text) || JP_LYRIC_TAG_RE.test(text)) return true;
    const lines = text.split(/\n/).filter((l) => l.trim().length > 0);
    if (lines.length >= 4 && text.length >= 80) return true;
    return false;
  }
  function extractLyricsFromPageText(fullText, titleHint = "") {
    if (!fullText || fullText.length < 20) {
      return { title: titleHint, lyrics: "", musicalStyle: "" };
    }
    const lyricStart = fullText.search(LYRIC_TAG_RE);
    const jpStart = fullText.search(JP_LYRIC_TAG_RE);
    const start = lyricStart >= 0 ? lyricStart : jpStart >= 0 ? jpStart : -1;
    const pre = start > 0 ? fullText.slice(0, start) : "";
    let title = titleHint;
    if (!title && pre) {
      const star = pre.match(/★\s*([^\n]+)/);
      if (star) title = star[1].trim();
    }
    let body = start >= 0 ? fullText.slice(start) : fullText;
    body = body.split("\n\u{1F525}\n")[0].split("\n\u{1F600}\n")[0].trim();
    let lyrics = body.split(/\r?\n/).filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (/^(Home|Explore|Create|Studio|Library|Search|Hooks|Labs|More|Sign In|Follow)$/i.test(t)) {
        return false;
      }
      if (/^v\d+\.\d+/.test(t)) return false;
      if (/^\d{4}年/.test(t)) return false;
      return true;
    }).join("\n").trim();
    const again = lyrics.search(LYRIC_TAG_RE);
    if (again > 0) lyrics = lyrics.slice(again);
    return {
      title: title || titleHint || "",
      lyrics: lyrics.trim(),
      musicalStyle: ""
    };
  }

  // src/lib/ai-extract.js
  function collectAssistantBlocks(selectors) {
    const blocks = [];
    const seen = /* @__PURE__ */ new Set();
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((el) => {
        const node = el.closest('article, [class*="turn"], [class*="message"]') || el;
        if (!seen.has(node)) {
          seen.add(node);
          blocks.push(
            /** @type {HTMLElement} */
            node
          );
        }
      });
    }
    if (blocks.length) return blocks;
    document.querySelectorAll("div.markdown, .markdown.prose, .prose").forEach((el) => {
      const turn = el.closest('article, [class*="turn"], [class*="message"]') || el;
      if (!seen.has(turn)) {
        seen.add(turn);
        blocks.push(
          /** @type {HTMLElement} */
          turn
        );
      }
    });
    return blocks;
  }
  function blockText(block) {
    return (block.innerText || block.textContent || "").trim();
  }
  function pickBestLyrics(assistantSelectors, titleHint = "") {
    const blocks = collectAssistantBlocks(assistantSelectors);
    let best = "";
    for (const block of blocks) {
      const text = blockText(block);
      if (looksLikeLyrics(text) && text.length > best.length) {
        best = text;
      }
    }
    if (best) return best;
    for (const block of blocks) {
      const text = blockText(block);
      if (text.length > best.length) best = text;
    }
    if (!best || best.length < 20) {
      const parsed = extractLyricsFromPageText(document.body?.innerText || "", titleHint);
      if (parsed.lyrics.length > best.length) best = parsed.lyrics;
    }
    return best;
  }
  function parseIdFromUrl(patterns) {
    for (const re of patterns) {
      const m = window.location.pathname.match(re);
      if (m?.[1]) return m[1];
    }
    return null;
  }
  function titleFromDocument(titleSuffixes, fallback) {
    let title = document.title.trim();
    for (const suffix of titleSuffixes) {
      title = title.replace(suffix, "").trim();
    }
    if (title && title.length > 1) return title;
    const h1 = document.querySelector("h1");
    if (h1?.textContent?.trim()) return h1.textContent.trim();
    return fallback;
  }

  // src/lib/ai-platforms.js
  var PLATFORMS = [
    {
      id: "chatgpt",
      match: (url) => /chatgpt\.com|chat\.openai\.com/i.test(url),
      parseConversationId: () => parseIdFromUrl([/\/c\/([a-z0-9-]+)/i]),
      extractAssistantName: () => {
        const selectors = [
          '[data-testid="gpt-name"]',
          "nav img[alt] + div",
          "header h1",
          ".text-token-text-primary.truncate"
        ];
        for (const sel of selectors) {
          const t = document.querySelector(sel)?.textContent?.trim();
          if (t && t.length > 1 && t.length < 120 && !/^ChatGPT$/i.test(t)) return t;
        }
        const title = document.title.replace(/\s*-\s*ChatGPT\s*$/i, "").trim();
        return title && !/^ChatGPT$/i.test(title) ? title : "ChatGPT";
      },
      extractTitle: () => {
        const active = document.querySelector(
          'nav a[href*="/c/"].bg-token-sidebar-surface-secondary, nav a.selected'
        );
        if (active?.textContent?.trim()) return active.textContent.trim();
        return titleFromDocument([/\s*-\s*ChatGPT\s*$/i], "ChatGPT \u4F1A\u8A71");
      },
      extract: function extractChatGPT() {
        const conversationId = this.parseConversationId();
        const assistantName = this.extractAssistantName();
        const title = this.extractTitle();
        const lyrics = pickBestLyrics(
          [
            '[data-message-author-role="assistant"]',
            'article[data-testid^="conversation-turn"]',
            ".agent-turn"
          ],
          title
        );
        const sourceUrl = conversationId ? `${window.location.origin}/c/${conversationId}` : window.location.href.split("?")[0];
        return {
          source: "chatgpt",
          title,
          lyrics,
          gptName: assistantName,
          conversationId: conversationId || void 0,
          sourceUrl,
          capturedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
    },
    {
      id: "claude",
      match: (url) => /claude\.ai/i.test(url),
      parseConversationId: () => parseIdFromUrl([/\/chat\/([a-f0-9-]{36})/i, /\/chat\/([a-z0-9-]+)/i]),
      extractAssistantName: () => {
        const selectors = [
          '[data-testid="model-selector"]',
          'button[aria-label*="Claude"]',
          'header a[href*="/projects"] + div',
          'nav [class*="truncate"]'
        ];
        for (const sel of selectors) {
          const t = document.querySelector(sel)?.textContent?.trim();
          if (t && t.length > 1 && t.length < 120) return t;
        }
        return titleFromDocument([/\s*-\s*Claude\s*$/i, /\s*\|\s*Claude\s*$/i], "Claude");
      },
      extractTitle: () => {
        const active = document.querySelector('a[href*="/chat/"][aria-current="page"], nav a.font-semibold');
        if (active?.textContent?.trim()) return active.textContent.trim();
        return titleFromDocument([/\s*-\s*Claude\s*$/i, /\s*\|\s*Claude\s*$/i], "Claude \u4F1A\u8A71");
      },
      extract: function extractClaude() {
        const conversationId = this.parseConversationId();
        const assistantName = this.extractAssistantName();
        const title = this.extractTitle();
        const lyrics = pickBestLyrics(
          [
            '[data-testid="assistant-message"]',
            '[data-is-streaming="false"]',
            "div.font-claude-message",
            'div[class*="Assistant"]',
            "div[data-test-render-count]"
          ],
          title
        );
        const sourceUrl = conversationId ? `${window.location.origin}/chat/${conversationId}` : window.location.href.split("?")[0];
        return {
          source: "claude",
          title,
          lyrics,
          gptName: assistantName,
          conversationId: conversationId || void 0,
          sourceUrl,
          capturedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
    },
    {
      id: "gemini",
      match: (url) => /gemini\.google\.com/i.test(url),
      parseConversationId: () => parseIdFromUrl([/\/app\/([a-f0-9-]{36})/i, /\/app\/([a-z0-9-]+)/i]),
      extractAssistantName: () => {
        const selectors = [
          '[data-test-id="model-selector"]',
          'button[aria-label*="Gemini"]',
          ".model-picker",
          "mat-select"
        ];
        for (const sel of selectors) {
          const t = document.querySelector(sel)?.textContent?.trim();
          if (t && t.length > 1 && t.length < 120) return t;
        }
        return "Gemini";
      },
      extractTitle: () => titleFromDocument([/\s*-\s*Gemini\s*$/i, /\s*\|\s*Google Gemini\s*$/i], "Gemini \u4F1A\u8A71"),
      extract: function extractGemini() {
        const conversationId = this.parseConversationId();
        const assistantName = this.extractAssistantName();
        const title = this.extractTitle();
        const lyrics = pickBestLyrics(
          [
            "message-content.model-response-text",
            "message-content",
            '[data-message-author="model"]',
            ".model-response-text",
            "model-response"
          ],
          title
        );
        const sourceUrl = conversationId ? `${window.location.origin}/app/${conversationId}` : window.location.href.split("?")[0];
        return {
          source: "gemini",
          title,
          lyrics,
          gptName: assistantName,
          conversationId: conversationId || void 0,
          sourceUrl,
          capturedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
    },
    {
      id: "copilot",
      match: (url) => /copilot\.microsoft\.com|copilot\.com/i.test(url),
      parseConversationId: () => parseIdFromUrl([/\/chats\/([a-f0-9-]{36})/i, /\/chats\/([a-z0-9-]+)/i, /\/c\/([a-z0-9-]+)/i]),
      extractAssistantName: () => {
        const selectors = ['[data-testid="chat-mode-name"]', "header h1", ".conversation-title"];
        for (const sel of selectors) {
          const t = document.querySelector(sel)?.textContent?.trim();
          if (t && t.length > 1 && t.length < 120) return t;
        }
        return "Copilot";
      },
      extractTitle: () => titleFromDocument([/\s*-\s*Copilot\s*$/i, /\s*\|\s*Microsoft Copilot\s*$/i], "Copilot \u4F1A\u8A71"),
      extract: function extractCopilot() {
        const conversationId = this.parseConversationId();
        const assistantName = this.extractAssistantName();
        const title = this.extractTitle();
        const lyrics = pickBestLyrics(
          [
            '[data-content="assistant"]',
            '[data-testid="conversation-turn"] [data-content="assistant"]',
            ".group\\/ai-message-item",
            'cib-message[type="ai"]'
          ],
          title
        );
        const sourceUrl = conversationId ? `${window.location.origin}/chats/${conversationId}` : window.location.href.split("?")[0];
        return {
          source: "copilot",
          title,
          lyrics,
          gptName: assistantName,
          conversationId: conversationId || void 0,
          sourceUrl,
          capturedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
    },
    {
      id: "perplexity",
      match: (url) => /perplexity\.ai/i.test(url),
      parseConversationId: () => parseIdFromUrl([/\/search\/([^/?#]+)/i, /\/thread\/([^/?#]+)/i]),
      extractAssistantName: () => "Perplexity",
      extractTitle: () => {
        const q = document.querySelector('h1, [data-testid="query-text"]');
        if (q?.textContent?.trim()) return q.textContent.trim();
        return titleFromDocument([/\s*-\s*Perplexity\s*$/i], "Perplexity \u4F1A\u8A71");
      },
      extract: function extractPerplexity() {
        const conversationId = this.parseConversationId();
        const title = this.extractTitle();
        const lyrics = pickBestLyrics(
          [
            '[data-testid="answer"]',
            ".prose",
            'div[class*="answer"]',
            "main article"
          ],
          title
        );
        const sourceUrl = window.location.href.split("#")[0];
        return {
          source: "perplexity",
          title,
          lyrics,
          gptName: this.extractAssistantName(),
          conversationId: conversationId || void 0,
          sourceUrl,
          capturedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
    },
    {
      id: "poe",
      match: (url) => /poe\.com/i.test(url),
      parseConversationId: () => parseIdFromUrl([/\/chat\/([^/?#]+)/i]),
      extractAssistantName: () => {
        const bot = document.querySelector('[class*="BotHeader"], header h1, .ChatHeaderBotName');
        const t = bot?.textContent?.trim();
        return t && t.length < 120 ? t : "Poe";
      },
      extractTitle: () => {
        const bot = document.querySelector('[class*="BotHeader"], .ChatHeaderBotName');
        if (bot?.textContent?.trim()) return `${bot.textContent.trim()} \u4F1A\u8A71`;
        return titleFromDocument([/\s*-\s*Poe\s*$/i], "Poe \u4F1A\u8A71");
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
            ".Markdown_markdown"
          ],
          title
        );
        const sourceUrl = window.location.href.split("?")[0];
        return {
          source: "poe",
          title,
          lyrics,
          gptName: assistantName,
          conversationId: conversationId || void 0,
          sourceUrl,
          capturedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
    }
  ];
  function detectPlatform() {
    const url = window.location.href;
    return PLATFORMS.find((p) => p.match(url)) || null;
  }

  // src/content/ai-chat.js
  function extractCurrentPlatformData() {
    const platform = detectPlatform();
    if (!platform) return null;
    return platform.extract();
  }
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request?._target === "background") return false;
    if (request.action === "captureAI" || request.action === "captureChatGPT") {
      const data = extractCurrentPlatformData();
      if (!data) {
        sendResponse({ success: false, error: "unsupported platform" });
        return true;
      }
      sendResponse({ success: true, data });
      return true;
    }
    return false;
  });
})();
//# sourceMappingURL=ai-chat.js.map
