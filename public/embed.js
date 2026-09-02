/**
 * ChatBotAI Embeddable Widget — v2 (advanced)
 * Modules: voice (STT/TTS), image upload + vision, message feedback (thumbs up/down)
 *
 * Works on: HTML, React, Next.js, Vue, WordPress, Shopify — anything with a browser.
 * Usage:
 *   <script src="https://YOUR_HOST/embed.js" data-bot-id="PUBLIC_ID" defer></script>
 */
(function () {
  if (window.__ChatBotAI_loaded) return;
  window.__ChatBotAI_loaded = true;

  function fmtChatTime(iso) {
    try {
      const d = iso ? new Date(iso) : new Date();
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch (e) { return ""; }
  }

  function findScript() {
    const scripts = document.getElementsByTagName("script");
    for (let i = scripts.length - 1; i >= 0; i--) {
      const s = scripts[i];
      const src = s.getAttribute("src") || "";
      if (src.indexOf("/embed.js") !== -1 || src.indexOf("/widget.js") !== -1) return s;
    }
    return null;
  }

  const tag = findScript();
  const autoBotId = tag ? tag.getAttribute("data-bot-id") : null;
  const autoFullscreen = tag ? tag.getAttribute("data-fullscreen") === "1" : false;
  const autoHost = tag
    ? new URL(tag.getAttribute("src"), window.location.href).origin
    : window.location.origin;
  // Visitor auth-token sources: read from localStorage key, sessionStorage key,
  // or a cookie — whichever the host site uses for its login session.
  const autoTokenLSKey = tag ? tag.getAttribute("data-auth-token-key") : null;
  const autoTokenSSKey = tag ? tag.getAttribute("data-auth-token-session-key") : null;
  const autoTokenCookie = tag ? tag.getAttribute("data-auth-token-cookie") : null;

  function readCookie(name) {
    if (!name) return "";
    const m = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/[$()*+./?[\\\]^{|}-]/g, "\\$&") + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : "";
  }
  function readAutoToken() {
    try {
      if (autoTokenLSKey) {
        const v = localStorage.getItem(autoTokenLSKey);
        if (v) return v;
      }
      if (autoTokenSSKey) {
        const v = sessionStorage.getItem(autoTokenSSKey);
        if (v) return v;
      }
      if (autoTokenCookie) {
        const v = readCookie(autoTokenCookie);
        if (v) return v;
      }
    } catch (e) { /* storage blocked, ignore */ }
    return "";
  }

  const SESSION_KEY = "chatbotai_session";
  function getSession() {
    let s = localStorage.getItem(SESSION_KEY);
    if (!s) {
      s = "s_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(SESSION_KEY, s);
    }
    return s;
  }

  // Lightweight visitor context sent with the first message (shown in the agent's
  // visitor info panel) — referrer, language, timezone, screen size.
  function visitorMeta() {
    try {
      return {
        referrer: document.referrer || "",
        language: navigator.language || "",
        timezone: (Intl.DateTimeFormat().resolvedOptions().timeZone) || "",
        screen: (window.screen ? window.screen.width + "x" + window.screen.height : ""),
      };
    } catch (e) { return {}; }
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Minimal-but-safe markdown renderer for bot/agent replies. We escape the
  // raw string FIRST and then promote a small whitelist of patterns to HTML:
  //   **bold**, *italic*, `code`, [link](url), bulleted lines (* / - / +),
  //   numbered lines, and blank-line paragraph breaks.
  // Everything else stays as-is, so model output that uses markdown looks
  // formatted, but no untrusted HTML can sneak through.
  function renderMarkdown(raw) {
    if (!raw) return "";
    let s = escapeHtml(raw);

    // Code spans first so their content is exempt from later transforms.
    const codes = [];
    s = s.replace(/`([^`\n]+)`/g, (_, c) => {
      codes.push(c);
      return ` C${codes.length - 1} `;
    });

    // Links — [text](url) where url is http(s) or relative/anchor.
    s = s.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*|#[^\s)]*)\)/g,
      (_, text, href) =>
        `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`
    );

    // Bold (** or __) then italic (* or _). Bold must run first so the *
    // characters in **x** aren't eaten by the italic rule.
    s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
    s = s.replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    s = s.replace(/(^|[\s(])_([^_\n]+)_/g, "$1<em>$2</em>");

    // Lists — group consecutive lines starting with bullet markers into a
    // <ul>; nested bullets (+ or indented) become a nested <ul>.
    const lines = s.split("\n");
    const out = [];
    let listOpen = false, nestedOpen = false;
    const closeNested = () => { if (nestedOpen) { out.push("</ul>"); nestedOpen = false; } };
    const closeList = () => { closeNested(); if (listOpen) { out.push("</ul>"); listOpen = false; } };

    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      const topBullet = ln.match(/^\s*[*\-]\s+(.*)$/);
      const subBullet = ln.match(/^\s*[+]\s+(.*)$/) || ln.match(/^\s{2,}[*\-]\s+(.*)$/);
      const numBullet = ln.match(/^\s*\d+\.\s+(.*)$/);

      if (topBullet) {
        closeNested();
        if (!listOpen) { out.push("<ul>"); listOpen = true; }
        out.push(`<li>${topBullet[1]}</li>`);
      } else if (subBullet && listOpen) {
        if (!nestedOpen) { out.push("<ul>"); nestedOpen = true; }
        out.push(`<li>${subBullet[1]}</li>`);
      } else if (numBullet) {
        closeNested();
        if (!listOpen) { out.push("<ol>"); listOpen = true; }
        out.push(`<li>${numBullet[1]}</li>`);
      } else if (ln.trim() === "") {
        closeList();
        out.push("");
      } else {
        closeNested();
        if (listOpen) { closeList(); }
        out.push(ln);
      }
    }
    closeList();
    s = out.join("\n");

    // Paragraphs: blank line => </p><p>; single newline => <br>.
    s = s
      .split(/\n{2,}/)
      .map((blk) => {
        // Block-level tags shouldn't be wrapped in <p>.
        if (/^<(ul|ol|h\d|pre|blockquote)/.test(blk.trim())) return blk;
        return blk.trim() ? `<p>${blk.replace(/\n/g, "<br>")}</p>` : "";
      })
      .join("");

    // Restore code spans.
    s = s.replace(/ C(\d+) /g, (_, idx) => `<code>${codes[+idx]}</code>`);

    return s;
  }

  function ChatBotAI(opts) {
    this.botId = opts.botId;
    this.host = (opts.host || autoHost).replace(/\/$/, "");
    this.fullscreen = !!opts.fullscreen;
    this.config = null;
    this.history = [];
    this.open = false;
    this.ttsOn = false;
    this.recognizing = false;
    this.recognition = null;
    this.mode = "ai";
    this.lastSeenId = 0;
    this._pollTimer = null;
    // Visitor's logged-in token (host website's auth). Forwarded to APIs the
    // bot owner has flagged "use visitor token" — see _sendText.
    this._authToken = opts.authToken || "";
    this._tokenProvider = typeof opts.getAuthToken === "function" ? opts.getAuthToken : null;
    this._build();
    this._loadConfig();
  }

  ChatBotAI.prototype.setAuthToken = function (token) {
    this._authToken = token || "";
  };

  ChatBotAI.prototype._currentToken = function () {
    if (this._tokenProvider) {
      try {
        const v = this._tokenProvider();
        if (v) return v;
      } catch (e) { /* provider threw, fall through */ }
    }
    return this._authToken || readAutoToken();
  };

  ChatBotAI.prototype._build = function () {
    const mount = document.createElement("div");
    mount.id = "chatbotai-root";
    document.body.appendChild(mount);
    const root = mount.attachShadow({ mode: "open" });
    this.root = root;

    const style = document.createElement("style");
    style.textContent = WIDGET_CSS;
    root.appendChild(style);

    const wrap = document.createElement("div");
    wrap.className = "cb-wrap";
    if (this.fullscreen) wrap.classList.add("cb-fullscreen", "cb-open");
    wrap.innerHTML = WIDGET_HTML;
    root.appendChild(wrap);
    this.wrap = wrap;
    this.$ = (sel) => wrap.querySelector(sel);
    this.$$ = (sel) => wrap.querySelectorAll(sel);

    this.$(".cb-bubble").addEventListener("click", () => this.toggle());
    this.$(".cb-close").addEventListener("click", () => this.toggle(false));
    this.$(".cb-send").addEventListener("click", () => this._sendText());
    this.$(".cb-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this._sendText();
      }
    });
    this.$(".cb-mic").addEventListener("click", () => this._toggleMic());
    this.$(".cb-speaker").addEventListener("click", () => this._toggleTTS());
    this.$(".cb-attach").addEventListener("click", () => this.$(".cb-file").click());
    this.$(".cb-file").addEventListener("change", (e) => this._sendImage(e.target.files[0]));
    this.$(".cb-handoff").addEventListener("click", () => this._requestHuman());
    this.$(".cb-contact-btn").addEventListener("click", () => this._openContactForm(false));
    this.$(".cb-contact-close").addEventListener("click", () => this._closeContactForm());
    this.$(".cb-contact-submit").addEventListener("click", () => this._submitContactForm());
  };

  ChatBotAI.prototype._loadConfig = async function () {
    try {
      const r = await fetch(`${this.host}/api/public/bot/${this.botId}/config`);
      if (!r.ok) {
        // Surface a clear, actionable message instead of silently hiding the widget.
        const why =
          r.status === 404 ? "bot not found / wrong publicId" :
          r.status === 403 ? "domain not allowed (check the bot's allowed domains)" :
          r.status === 423 ? "bot disabled or account subscription inactive" :
          "unknown";
        console.error(
          "[ChatBotAI] config failed for bot '" + this.botId + "' on '" + this.host +
          "' -> HTTP " + r.status + " (" + why + ")"
        );
        throw new Error("config http " + r.status);
      }
      this.config = await r.json();
      this._applyConfig();
    } catch (e) {
      console.warn("[ChatBotAI] config load failed:", e);
      // Keep the launcher bubble (with its default chat icon) visible. Never
      // nuke the whole widget on a config failure — otherwise the launch
      // button and icon silently disappear.
      if (this.wrap) {
        this.wrap.style.display = "";
        this.wrap.classList.add("cb-wrap-config-error");
      }
    }
  };

  ChatBotAI.prototype._applyConfig = function () {
    const c = this.config;
    const f = c.features || {};
    this.wrap.classList.toggle("cb-left", c.position === "bottom-left");
    this.wrap.style.setProperty("--cb-color", c.primary_color || "#e60012");
    this.$(".cb-header-title").textContent = c.header_title || c.name || "Chat";
    this.$(".cb-header-sub").textContent = c.header_subtitle || "";
    const cfTitle = this.$(".cb-contact-title");
    if (cfTitle) cfTitle.textContent = c.contact_form_title || "Send us a message";
    const cfSub = this.$(".cb-contact-subtitle");
    if (cfSub) cfSub.textContent = c.contact_form_subtitle || "";

    // Bubble icon (launcher) — drop solid background so transparent PNGs don't get a halo
    if (c.bubble_icon) {
      const bubble = this.$(".cb-bubble");
      const DEFAULT_BUBBLE = bubble.innerHTML;
      bubble.innerHTML = "";
      bubble.classList.add("cb-bubble-has-img");
      const img = document.createElement("img");
      img.src = c.bubble_icon;
      img.alt = "";
      img.referrerPolicy = "no-referrer";
      img.onerror = function () {
        bubble.classList.remove("cb-bubble-has-img");
        bubble.innerHTML = DEFAULT_BUBBLE;
      };
      bubble.appendChild(img);
    }

    // Module toggles → show/hide buttons
    this.$(".cb-mic").style.display = f.voice ? "" : "none";
    this.$(".cb-speaker").style.display = f.voice ? "" : "none";
    this.$(".cb-attach").style.display = f.image_upload ? "" : "none";
    this.$(".cb-contact-btn").style.display = f.contact_form ? "" : "none";
    const showHandoffRow = f.human_handoff || f.contact_form;
    this.$(".cb-handoff-row").style.display = showHandoffRow ? "" : "none";
    this.$(".cb-handoff").style.display = f.human_handoff ? "" : "none";

    this._addMessage("bot", c.welcome_message || "Hi!", { options: c.menu || [], silent: true });

    // Auto-open if configured (small delay so DOM settles)
    if (f.auto_open) {
      setTimeout(() => { this.toggle(true); }, 800);
    }

    // Proactive triggers (Crisp/tawk style)
    this._initTriggers();
  };

  ChatBotAI.prototype._fireTrigger = function (t) {
    if (this._firedTriggers && this._firedTriggers[t.id]) return;
    if (t.once_per_session) {
      const key = "cbai_trig_" + this.botId + "_" + t.id + "_" + getSession();
      if (localStorage.getItem(key)) return;
      try { localStorage.setItem(key, "1"); } catch (e) {}
    }
    this._firedTriggers = this._firedTriggers || {};
    this._firedTriggers[t.id] = true;
    this.toggle(true);
    if (this.config && this.config.features && this.config.features.sound) this._playChime();
    this._addMessage("bot", t.message, null);
  };

  ChatBotAI.prototype._initTriggers = function () {
    const triggers = (this.config && this.config.triggers) || [];
    if (!triggers.length) return;
    const self = this;
    triggers.forEach(function (t) {
      const delay = (Number(t.delay_seconds) || 0) * 1000;
      if (t.condition_type === "time_on_page") {
        const secs = (Number(t.condition_value) || Number(t.delay_seconds) || 5) * 1000;
        setTimeout(function () { self._fireTrigger(t); }, secs);
      } else if (t.condition_type === "page_url") {
        const needle = String(t.condition_value || "").trim();
        if (needle && location.href.indexOf(needle) !== -1) {
          setTimeout(function () { self._fireTrigger(t); }, delay);
        }
      } else if (t.condition_type === "scroll") {
        const pct = Number(t.condition_value) || 50;
        const onScroll = function () {
          const h = document.documentElement.scrollHeight - window.innerHeight;
          const scrolled = h > 0 ? (window.scrollY / h) * 100 : 100;
          if (scrolled >= pct) {
            window.removeEventListener("scroll", onScroll);
            setTimeout(function () { self._fireTrigger(t); }, delay);
          }
        };
        window.addEventListener("scroll", onScroll, { passive: true });
      } else if (t.condition_type === "exit_intent") {
        const onLeave = function (e) {
          if (e.clientY <= 0) {
            document.removeEventListener("mouseleave", onLeave);
            self._fireTrigger(t);
          }
        };
        document.addEventListener("mouseleave", onLeave);
      }
    });
  };

  ChatBotAI.prototype.toggle = function (force) {
    this.open = typeof force === "boolean" ? force : !this.open;
    this.wrap.classList.toggle("cb-open", this.open);
  };

  ChatBotAI.prototype._addMessage = function (role, content, opts) {
    opts = opts || {};
    const c = this.config || {};
    const msgs = this.$(".cb-messages");

    // System notices render as a centered chip, not a bubble.
    if (role === "system") {
      const sys = document.createElement("div");
      sys.className = "cb-system";
      sys.textContent = content || "";
      msgs.appendChild(sys);
      msgs.scrollTop = msgs.scrollHeight;
      if (opts.messageId && opts.messageId > this.lastSeenId) this.lastSeenId = opts.messageId;
      return;
    }

    const row = document.createElement("div");
    row.className = "cb-msg cb-msg-" + role;
    if (opts.messageId) row.dataset.id = opts.messageId;

    const avatar = document.createElement("div");
    avatar.className = "cb-avatar";
    let avatarUrl = null;
    if (role === "user") avatarUrl = c.user_avatar;
    else if (role === "bot") avatarUrl = c.bot_avatar;
    // role === "agent" → no custom avatar, fallback shows "AGT"
    if (avatarUrl) {
      avatar.style.backgroundImage = `url('${avatarUrl}')`;
    } else {
      avatar.classList.add("cb-avatar-fallback");
      avatar.textContent = role === "bot" ? "AI" : role === "agent" ? "AGT" : "You";
      if (role === "agent") avatar.classList.add("cb-avatar-agent");
    }

    const bubble = document.createElement("div");
    bubble.className = "cb-bubble-msg";
    let inner = "";
    if (opts.imageUrl) {
      inner += `<img class="cb-img" src="${escapeHtml(opts.imageUrl)}" alt="">`;
    }
    if (content) {
      // Bot and agent replies often contain markdown (the LLM emits **bold**,
      // bullets, links, code spans). Render those so output looks formatted.
      // User messages stay plain-escaped — no rendering of markdown that the
      // visitor types.
      inner += (role === "bot" || role === "agent")
        ? renderMarkdown(content)
        : escapeHtml(content);
    }
    bubble.innerHTML = inner || "&nbsp;";
    if (role === "bot" || role === "agent") bubble.classList.add("cb-md");

    row.appendChild(avatar);
    row.appendChild(bubble);

    // Chained Q&A options (Airtel-style click-tree)
    if ((role === "bot" || role === "agent") && Array.isArray(opts.options) && opts.options.length) {
      const optBox = document.createElement("div");
      optBox.className = "cb-options";
      const intro = document.createElement("div");
      intro.className = "cb-options-intro";
      intro.textContent =
        (this.config && this.config.menu_prompt) ||
        "Select one of the options below or type your query:";
      optBox.appendChild(intro);
      opts.options.forEach((o) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cb-option";
        btn.textContent = o.question;
        btn.addEventListener("click", () => this._sendText(o.question));
        optBox.appendChild(btn);
      });
      bubble.appendChild(optBox);
    }

    // Feedback buttons (M5) — only on bot replies
    if (role === "bot" && opts.messageId && (c.features || {}).feedback) {
      const fb = document.createElement("div");
      fb.className = "cb-fb";
      const SVG_UP = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7V10l4.34-9a1.45 1.45 0 0 1 2.61 1.21z"/></svg>';
      const SVG_DOWN = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H17v12l-4.34 9a1.45 1.45 0 0 1-2.61-1.21z"/></svg>';
      fb.innerHTML = `
        <button class="cb-fb-up" title="Helpful">${SVG_UP}</button>
        <button class="cb-fb-down" title="Not helpful">${SVG_DOWN}</button>
      `;
      const send = (score) => {
        fb.classList.add("cb-fb-done");
        fb.innerHTML = `<span class="cb-fb-thanks">Thanks for the feedback</span>`;
        fetch(`${this.host}/api/public/bot/${this.botId}/rate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message_id: opts.messageId, score }),
        }).catch(() => {});
      };
      fb.querySelector(".cb-fb-up").addEventListener("click", () => send(1));
      fb.querySelector(".cb-fb-down").addEventListener("click", () => send(-1));
      bubble.appendChild(fb);
    }

    const timeEl = document.createElement("div");
    timeEl.className = "cb-time";
    timeEl.textContent = fmtChatTime(opts.createdAt);
    bubble.appendChild(timeEl);

    msgs.appendChild(row);
    msgs.scrollTop = msgs.scrollHeight;
    if (content) this.history.push({ role, content });
    if (opts.messageId && opts.messageId > this.lastSeenId) this.lastSeenId = opts.messageId;
    // Chime for incoming bot/agent messages (skip the welcome message)
    const features = (c.features || {});
    if ((role === "bot" || role === "agent") && features.sound && !opts.silent) {
      this._playChime();
    }

    // TTS (M1) — speak bot OR agent replies
    if ((role === "bot" || role === "agent") && this.ttsOn && content) this._speak(content);
  };

  ChatBotAI.prototype._playChime = function () {
    try {
      if (!this._chime) {
        this._chime = new Audio(
          "data:audio/wav;base64,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"
        );
      }
      this._chime.currentTime = 0;
      this._chime.play().catch(() => {});
    } catch (e) {}
  };

  ChatBotAI.prototype._setTyping = function (on) {
    this.$(".cb-typing").style.display = on ? "" : "none";
    if (on) this.$(".cb-messages").scrollTop = this.$(".cb-messages").scrollHeight;
  };

  ChatBotAI.prototype._sendText = async function (forcedText) {
    const input = this.$(".cb-input");
    const txt = (forcedText || input.value || "").trim();
    if (!txt) return;
    if (!forcedText) input.value = "";
    this._addMessage("user", txt, null);
    this._setTyping(true);
    try {
      const r = await fetch(`${this.host}/api/public/bot/${this.botId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({
          message: txt,
          session_id: getSession(),
          page_url: location.href,
          history: this.history.slice(-10),
          visitor_token: this._currentToken() || undefined,
        }, visitorMeta())),
      });
      const data = await r.json();
      this._setTyping(false);
      // Track the user-message id (returned in human mode) so polling skips it
      if (data.message_id && data.message_id > this.lastSeenId) {
        this.lastSeenId = data.message_id;
      }
      if (data.mode) {
        // Keep the banner/polling state in sync with the server. When the agent
        // goes idle the server flips the chat back to "ai", which hides the
        // banner and stops polling — the reply below is then shown normally.
        this._setMode(data.mode);
      }
      if (data.reply) {
        this._addMessage("bot", data.reply, {
          messageId: data.message_id,
          createdAt: data.created_at,
          options: data.options || [],
        });
      }
      if (data.suggest_contact_form && ((this.config.features || {}).contact_form)) {
        setTimeout(() => this._openContactForm(true), 600);
      }
    } catch (e) {
      this._setTyping(false);
      this._addMessage("bot", "Network error. Please try again.", null);
    }
  };

  // ---------- Contact form ----------
  ChatBotAI.prototype._openContactForm = function (autoShown) {
    const f = this.$(".cb-contact-form");
    if (!f) return;
    f.style.display = "block";
    if (autoShown && !f.dataset.notice) {
      this._addMessage("system", "It looks like I couldn't help with that. Please leave your details and we'll get back to you.", null);
      f.dataset.notice = "1";
    }
    setTimeout(() => {
      const name = f.querySelector(".cb-contact-name");
      if (name) name.focus();
    }, 100);
  };

  ChatBotAI.prototype._closeContactForm = function () {
    const f = this.$(".cb-contact-form");
    if (f) f.style.display = "none";
  };

  ChatBotAI.prototype._submitContactForm = async function () {
    const f = this.$(".cb-contact-form");
    const name = f.querySelector(".cb-contact-name").value.trim();
    const email = f.querySelector(".cb-contact-email").value.trim();
    const phoneEl = f.querySelector(".cb-contact-phone");
    const phone = phoneEl ? phoneEl.value.trim() : "";
    const message = f.querySelector(".cb-contact-message").value.trim();
    const status = f.querySelector(".cb-contact-status");
    const submit = f.querySelector(".cb-contact-submit");

    if (!name || !email || !message) {
      status.textContent = "Please fill in all fields.";
      status.style.display = "block";
      status.style.color = "#b91c1c";
      return;
    }
    submit.disabled = true;
    status.textContent = "Sending…";
    status.style.color = "#555";
    status.style.display = "block";

    try {
      const r = await fetch(`${this.host}/api/public/bot/${this.botId}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, email, phone, message,
          session_id: getSession(),
          page_url: location.href,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        status.textContent = data.error || "Failed to send. Please try again.";
        status.style.color = "#b91c1c";
        submit.disabled = false;
        return;
      }
      this._addMessage("system", "Thanks! Your message has been sent. We'll be in touch soon.", null);
      f.querySelector(".cb-contact-name").value = "";
      f.querySelector(".cb-contact-email").value = "";
      if (phoneEl) phoneEl.value = "";
      f.querySelector(".cb-contact-message").value = "";
      this._closeContactForm();
    } catch (e) {
      status.textContent = "Network error. Please try again.";
      status.style.color = "#b91c1c";
      submit.disabled = false;
    }
  };

  // ---------- Module 6: Human handoff ----------
  ChatBotAI.prototype._requestHuman = async function () {
    if (this.mode !== "ai") return;
    try {
      const r = await fetch(`${this.host}/api/public/bot/${this.botId}/handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: getSession(), page_url: location.href }),
      });
      const data = await r.json();
      if (!r.ok) {
        this._addMessage("system", data.error || "Couldn't request a human right now.", null);
        return;
      }
      this._setMode(data.mode || "awaiting");
      this._addMessage("system", "Connecting you to a human agent…", null);
    } catch (e) {
      this._addMessage("system", "Network error while requesting a human.", null);
    }
  };

  ChatBotAI.prototype._setMode = function (mode) {
    const prev = this.mode;
    this.mode = mode;
    const banner = this.$(".cb-mode-banner");
    if (mode === "ai") {
      banner.style.display = "none";
      banner.textContent = "";
      this._stopPolling();
    } else if (mode === "awaiting") {
      banner.style.display = "";
      banner.innerHTML = '<span class="cb-pulse"></span> Waiting for an agent to join…';
      this._startPolling();
    } else if (mode === "human") {
      banner.style.display = "";
      banner.innerHTML = '<span class="cb-dot-live"></span> You are chatting with an agent.';
      this._startPolling();
    }
    if (prev === "ai" && mode !== "ai") {
      this.$(".cb-handoff").disabled = true;
    } else if (mode === "ai") {
      this.$(".cb-handoff").disabled = false;
    }
  };

  ChatBotAI.prototype._startPolling = function () {
    if (this._pollTimer) return;
    const poll = async () => {
      try {
        const r = await fetch(
          `${this.host}/api/public/bot/${this.botId}/poll?session_id=${encodeURIComponent(getSession())}&after_id=${this.lastSeenId}`
        );
        const data = await r.json();
        (data.messages || []).forEach((m) => {
          if (m.role === "user") return; // already shown locally
          this._addMessage(m.role, m.content || "", {
            messageId: m.id,
            createdAt: m.created_at,
            imageUrl: m.image_url || null,
          });
        });
        if (data.mode && data.mode !== this.mode) {
          this._setMode(data.mode);
        }
      } catch (e) { /* ignore */ }
    };
    this._pollTimer = setInterval(poll, 4000);
    poll();
  };

  ChatBotAI.prototype._stopPolling = function () {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  };

  // ---------- Module 1: Voice ----------
  ChatBotAI.prototype._toggleMic = function () {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert("Voice input is not supported in this browser. Try Chrome.");
      return;
    }
    if (this.recognizing) {
      this.recognition && this.recognition.stop();
      return;
    }
    const rec = new SR();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => {
      this.recognizing = true;
      this.$(".cb-mic").classList.add("cb-mic-on");
    };
    rec.onend = () => {
      this.recognizing = false;
      this.$(".cb-mic").classList.remove("cb-mic-on");
    };
    rec.onerror = () => {
      this.recognizing = false;
      this.$(".cb-mic").classList.remove("cb-mic-on");
    };
    rec.onresult = (ev) => {
      const t = ev.results[0][0].transcript;
      this.$(".cb-input").value = t;
      this._sendText();
    };
    this.recognition = rec;
    rec.start();
  };

  ChatBotAI.prototype._toggleTTS = function () {
    if (!window.speechSynthesis) {
      alert("Text-to-speech is not supported in this browser.");
      return;
    }
    this.ttsOn = !this.ttsOn;
    this.$(".cb-speaker").classList.toggle("cb-speaker-on", this.ttsOn);
    if (!this.ttsOn) window.speechSynthesis.cancel();
  };

  ChatBotAI.prototype._speak = function (text) {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.0;
      u.pitch = 1.0;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  };

  // ---------- Module 2: Image upload ----------
  ChatBotAI.prototype._sendImage = async function (file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be under 5 MB.");
      return;
    }
    const localUrl = URL.createObjectURL(file);
    this._addMessage("user", "(image)", { imageUrl: localUrl });
    this._setTyping(true);

    const fd = new FormData();
    fd.append("image", file);
    fd.append("session_id", getSession());
    fd.append("page_url", location.href);
    fd.append("prompt", "Describe this image and answer briefly.");

    try {
      const r = await fetch(`${this.host}/api/public/bot/${this.botId}/image`, {
        method: "POST",
        body: fd,
      });
      const data = await r.json();
      this._setTyping(false);
      if (!r.ok) {
        this._addMessage("bot", data.error || "Image upload failed.", null);
        return;
      }
      this._addMessage("bot", data.reply || "(no reply)", { messageId: data.message_id });
    } catch (e) {
      this._setTyping(false);
      this._addMessage("bot", "Could not upload image. Try again.", null);
    } finally {
      this.$(".cb-file").value = "";
    }
  };

  const WIDGET_HTML = `
    <button class="cb-bubble" aria-label="Open chat">
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="white" stroke-width="2">
        <path d="M21 12a8 8 0 0 1-12.6 6.6L3 20l1.4-5.4A8 8 0 1 1 21 12z"/>
      </svg>
    </button>
    <div class="cb-panel" role="dialog" aria-label="Chat">
      <div class="cb-header">
        <div>
          <div class="cb-header-title">Chat</div>
          <div class="cb-header-sub"></div>
        </div>
        <button class="cb-close" aria-label="Close">×</button>
      </div>
      <div class="cb-mode-banner" style="display:none"></div>
      <div class="cb-messages"></div>
      <div class="cb-typing" style="display:none">
        <div class="cb-msg cb-msg-bot">
          <div class="cb-avatar cb-avatar-fallback">AI</div>
          <div class="cb-bubble-msg cb-typing-dots"><span></span><span></span><span></span></div>
        </div>
      </div>
      <div class="cb-handoff-row" style="display:none">
        <button class="cb-handoff" type="button">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-5h3v3z"/><path d="M3 19a2 2 0 0 0 2 2h1v-5H3v3z"/></svg>
          Talk to a human
        </button>
        <button class="cb-contact-btn" type="button" style="display:none">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z"/><path d="M4 4l8 8 8-8"/></svg>
          Contact us
        </button>
      </div>
      <div class="cb-contact-form" style="display:none">
        <div class="cb-contact-head">
          <div class="cb-contact-head-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>
          </div>
          <div class="cb-contact-head-text">
            <strong class="cb-contact-title">Send us a message</strong>
            <small class="cb-contact-subtitle">We'll reply by email shortly</small>
          </div>
          <button type="button" class="cb-contact-close" aria-label="Close">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="cb-contact-body">
          <label class="cb-contact-field">
            <span class="cb-contact-label">Name</span>
            <div class="cb-contact-input-wrap">
              <svg class="cb-contact-input-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <input class="cb-contact-name" type="text" placeholder="Your name" maxlength="120">
            </div>
          </label>
          <label class="cb-contact-field">
            <span class="cb-contact-label">Email</span>
            <div class="cb-contact-input-wrap">
              <svg class="cb-contact-input-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>
              <input class="cb-contact-email" type="email" placeholder="you@example.com" maxlength="255">
            </div>
          </label>
          <label class="cb-contact-field">
            <span class="cb-contact-label">Phone</span>
            <div class="cb-contact-input-wrap">
              <svg class="cb-contact-input-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z"/></svg>
              <input class="cb-contact-phone" type="tel" placeholder="+1 234 567 8900" maxlength="40" autocomplete="tel">
            </div>
          </label>
          <label class="cb-contact-field">
            <span class="cb-contact-label">Message</span>
            <textarea class="cb-contact-message" placeholder="How can we help?" rows="3" maxlength="2000"></textarea>
          </label>
          <button class="cb-contact-submit" type="button">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>
            <span>Send message</span>
          </button>
          <div class="cb-contact-status" style="display:none"></div>
        </div>
      </div>
      <div class="cb-input-row">
        <button class="cb-icon-btn cb-attach" title="Attach image" style="display:none">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12.5l-9.2 9.2a5 5 0 0 1-7.1-7.1L13 5.3a3.5 3.5 0 0 1 5 5L9.7 18.5a2 2 0 0 1-2.8-2.8l8-8"/>
          </svg>
        </button>
        <button class="cb-icon-btn cb-mic" title="Voice input" style="display:none">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="3" width="6" height="12" rx="3"/>
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>
          </svg>
        </button>
        <button class="cb-icon-btn cb-speaker" title="Read replies aloud" style="display:none">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 5L6 9H2v6h4l5 4V5z"/>
            <path d="M15 9a3 3 0 0 1 0 6"/>
          </svg>
        </button>
        <input type="file" class="cb-file" accept="image/*" hidden>
        <textarea class="cb-input" rows="1" placeholder="Type a message..."></textarea>
        <button class="cb-send" aria-label="Send">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>
        </button>
      </div>
      <div class="cb-foot">Powered by ChatBotAI</div>
    </div>
  `;

  const WIDGET_CSS = `
    :host, .cb-wrap { all: initial; }
    .cb-wrap { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; --cb-color: #e60012; }
    .cb-wrap *, .cb-wrap *::before, .cb-wrap *::after { box-sizing: border-box; }
    .cb-bubble {
      position: fixed; right: 20px; bottom: 20px; width: 60px; height: 60px;
      border-radius: 50%; background: var(--cb-color); border: none; cursor: pointer;
      box-shadow: 0 8px 24px rgba(0,0,0,.2); z-index: 2147483646; display: flex;
      align-items: center; justify-content: center; overflow: hidden;
      transition: transform .15s ease;
    }
    .cb-bubble:hover { transform: scale(1.06); }
    .cb-bubble.cb-bubble-has-img { background: transparent !important; padding: 0; }
    .cb-bubble img { width: 100%; height: 100%; object-fit: cover; display: block; border-radius: 50%; }
    .cb-left .cb-bubble { right: auto; left: 20px; }
    .cb-panel {
      position: fixed; right: 20px; bottom: 90px; width: 380px; max-width: calc(100vw - 30px);
      height: 580px; max-height: calc(100vh - 110px); background: #fff; border-radius: 16px;
      box-shadow: 0 16px 48px rgba(0,0,0,.18); display: none; flex-direction: column; overflow: hidden;
      z-index: 2147483647;
      animation: cb-pop .18s ease-out;
    }
    .cb-left .cb-panel { right: auto; left: 20px; }
    .cb-wrap.cb-open .cb-panel { display: flex; }
    @keyframes cb-pop { from { transform: translateY(8px) scale(.98); opacity: 0 } to { transform: none; opacity: 1 } }
    .cb-header {
      background: var(--cb-color); color: #fff; padding: 14px 16px;
      display: flex; align-items: center; justify-content: space-between;
    }
    .cb-header-title { font-size: 16px; font-weight: 600; }
    .cb-header-sub { font-size: 12px; opacity: .85; margin-top: 2px; }
    .cb-close { background: transparent; border: none; color: #fff; font-size: 22px; cursor: pointer; }

    .cb-messages { flex: 1; overflow-y: auto; padding: 14px; background: #f7f8fa; }
    .cb-msg { display: flex; gap: 8px; margin-bottom: 10px; align-items: flex-end; }
    .cb-msg-user { flex-direction: row-reverse; }
    .cb-avatar {
      width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
      background-size: cover; background-position: center; background-color: #ddd;
    }
    .cb-avatar-fallback {
      display: flex; align-items: center; justify-content: center;
      font-size: 10px; font-weight: 600; color: #fff; background: var(--cb-color);
    }
    .cb-msg-user .cb-avatar-fallback { background: #555; }
    .cb-bubble-msg {
      max-width: 78%; padding: 10px 12px; border-radius: 14px; font-size: 14px;
      line-height: 1.4; word-wrap: break-word; white-space: pre-wrap;
    }
    .cb-msg-bot .cb-bubble-msg { background: #fff; color: #222; border: 1px solid #eee; border-bottom-left-radius: 4px; }
    .cb-msg-user .cb-bubble-msg { background: var(--cb-color); color: #fff; border-bottom-right-radius: 4px; }
    .cb-msg-agent .cb-bubble-msg { background: #fff8e6; color: #333; border: 1px solid #ffd699; border-bottom-left-radius: 4px; }
    .cb-avatar-agent { background: #f59e0b !important; }
    .cb-img { display: block; max-width: 220px; max-height: 220px; border-radius: 8px; margin-bottom: 6px; }

    .cb-system { text-align: center; font-size: 11px; color: #888; padding: 6px 14px; margin: 4px 0; }
    .cb-mode-banner { padding: 8px 14px; background: #fff8e6; border-bottom: 1px solid #ffd699; font-size: 12px; color: #7a4a00; display: flex; align-items: center; gap: 6px; }
    .cb-pulse { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; animation: cb-blink 1.2s infinite; }
    .cb-dot-live { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #16a34a; }

    .cb-handoff-row { padding: 6px 14px; background: #f7f8fa; display: flex; gap: 8px; flex-wrap: wrap; }
    .cb-handoff { background: transparent; color: var(--cb-color); border: 1px dashed var(--cb-color); padding: 6px 10px; border-radius: 999px; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
    .cb-handoff:hover:not(:disabled) { background: var(--cb-color); color: #fff; }
    .cb-contact-btn { background: transparent; color: var(--cb-color); border: 1px dashed var(--cb-color); padding: 6px 10px; border-radius: 999px; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-family: inherit; }
    .cb-contact-btn:hover { background: var(--cb-color); color: #fff; }

    /* ---- Contact form (in-widget) ---- */
    .cb-contact-form {
      display: flex; flex-direction: column;
      background: #fff;
      border-top: 1px solid #eee;
      animation: cb-slide-up .25s ease;
    }
    @keyframes cb-slide-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    .cb-contact-head {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 14px;
      background: linear-gradient(135deg, color-mix(in srgb, var(--cb-color) 14%, #fff), #fff);
      border-bottom: 1px solid #eef0f3;
    }
    .cb-contact-head-icon {
      width: 36px; height: 36px; border-radius: 10px;
      background: var(--cb-color); color: #fff;
      display: inline-flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .cb-contact-head-text { flex: 1; min-width: 0; line-height: 1.25; }
    .cb-contact-head-text strong { display: block; font-size: 14px; color: #1a1a1a; }
    .cb-contact-head-text small { display: block; font-size: 11px; color: #6b7280; margin-top: 2px; }
    .cb-contact-close {
      background: transparent; border: none; cursor: pointer;
      width: 28px; height: 28px; border-radius: 8px;
      display: inline-flex; align-items: center; justify-content: center;
      color: #6b7280; padding: 0;
    }
    .cb-contact-close:hover { background: #f0f2f7; color: #1a1a1a; }

    .cb-contact-body { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 10px; }
    .cb-contact-field { display: flex; flex-direction: column; gap: 5px; }
    .cb-contact-label {
      font-size: 11px; font-weight: 600; color: #4b5563;
      text-transform: uppercase; letter-spacing: .3px;
    }
    .cb-contact-input-wrap {
      position: relative; display: flex; align-items: center;
    }
    .cb-contact-input-icon {
      position: absolute; left: 10px;
      color: #9ca3af; pointer-events: none;
    }
    .cb-contact-form input,
    .cb-contact-form textarea {
      width: 100%; box-sizing: border-box;
      padding: 9px 12px; border: 1px solid #e2e5eb; border-radius: 8px;
      font-size: 13px; font-family: inherit;
      background: #fafbfc; color: #1a1a1a;
      transition: border-color .15s, background .15s, box-shadow .15s;
      outline: none;
    }
    .cb-contact-input-wrap input { padding-left: 32px; }
    .cb-contact-form input::placeholder,
    .cb-contact-form textarea::placeholder { color: #9ca3af; }
    .cb-contact-form input:hover,
    .cb-contact-form textarea:hover { border-color: #cbd2db; }
    .cb-contact-form input:focus,
    .cb-contact-form textarea:focus {
      border-color: var(--cb-color); background: #fff;
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--cb-color) 18%, transparent);
    }
    .cb-contact-form textarea { resize: vertical; min-height: 76px; line-height: 1.4; }

    .cb-contact-submit {
      margin-top: 2px;
      display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      width: 100%;
      padding: 11px 14px; border: none; border-radius: 8px;
      background: var(--cb-color); color: #fff;
      font-size: 13px; font-weight: 600; font-family: inherit;
      cursor: pointer; letter-spacing: .2px;
      transition: filter .15s, transform .1s, box-shadow .15s;
      box-shadow: 0 4px 12px color-mix(in srgb, var(--cb-color) 30%, transparent);
    }
    .cb-contact-submit:hover:not(:disabled) { filter: brightness(1.05); transform: translateY(-1px); }
    .cb-contact-submit:active:not(:disabled) { transform: translateY(0); }
    .cb-contact-submit:disabled { opacity: .55; cursor: not-allowed; box-shadow: none; }
    .cb-contact-status {
      font-size: 12px; padding: 6px 10px; border-radius: 6px;
      background: #f3f4f6; color: #374151;
    }
    .cb-handoff:disabled { opacity: .5; cursor: not-allowed; }

    .cb-fb { margin-top: 6px; display: flex; gap: 4px; }
    .cb-fb button { background: transparent; border: 1px solid #ddd; border-radius: 999px; padding: 2px 8px; cursor: pointer; font-size: 13px; }
    .cb-fb button:hover { background: #f0f0f5; }
    .cb-fb-done .cb-fb-thanks { font-size: 11px; color: #888; }

    .cb-typing { padding: 0 14px 8px; }
    .cb-typing-dots { display: inline-flex; gap: 4px; }
    .cb-typing-dots span { width: 6px; height: 6px; background:#bbb; border-radius:50%; animation: cb-blink 1.2s infinite; }
    .cb-typing-dots span:nth-child(2){ animation-delay: .2s }
    .cb-typing-dots span:nth-child(3){ animation-delay: .4s }
    @keyframes cb-blink { 0%,80%,100%{ opacity:.2 } 40%{ opacity:1 } }

    .cb-input-row { display: flex; align-items: center; padding: 8px 10px; gap: 6px; border-top: 1px solid #eee; background: #fff; }
    .cb-icon-btn { background: transparent; border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; color: #666; display:flex; align-items:center; justify-content:center; }
    .cb-icon-btn:hover { background: #f0f0f5; color: var(--cb-color); }
    .cb-mic-on { color: #fff !important; background: var(--cb-color) !important; animation: cb-pulse 1.2s infinite; }
    .cb-speaker-on { color: var(--cb-color); }
    @keyframes cb-pulse { 0%, 100% { opacity: 1 } 50% { opacity: .55 } }
    .cb-input { flex: 1; resize: none; border: 1px solid #ddd; border-radius: 18px; padding: 8px 12px; font-size: 14px; outline: none; font-family: inherit; max-height: 90px; }
    .cb-input:focus { border-color: var(--cb-color); }
    .cb-send { background: var(--cb-color); border: none; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; flex-shrink: 0; }

    .cb-foot { text-align: center; font-size: 11px; color: #aaa; padding: 6px; background: #fafafa; border-top: 1px solid #eee; }

    /* Chained option buttons (Airtel-style decision tree) */
    .cb-options { margin-top: 8px; display: flex; flex-direction: column; gap: 6px; }
    .cb-options-intro { font-size: 12px; color: #666; padding-bottom: 2px; }
    .cb-option {
      display: block; width: 100%; text-align: left; padding: 10px 12px;
      background: #f0f4ff; color: var(--cb-color); border: 1px solid #dfe5ff;
      border-radius: 8px; font-size: 13px; cursor: pointer; font-family: inherit;
      transition: background .15s, transform .1s;
    }
    .cb-option:hover { background: #e3eaff; }
    .cb-option:active { transform: scale(.98); }

    /* Fullscreen mode (Android WebView / React Native WebView) */
    .cb-fullscreen .cb-bubble { display: none !important; }
    .cb-fullscreen .cb-panel {
      display: flex !important;
      position: fixed !important; inset: 0 !important;
      width: 100% !important; height: 100% !important;
      max-width: 100% !important; max-height: 100% !important;
      border-radius: 0; box-shadow: none;
      animation: none;
    }
    .cb-fullscreen .cb-close { display: none; }

    /* Markdown rendering inside bot/agent bubbles —
       lets **bold**, bullets, links, code-spans, paragraphs look formatted
       instead of dumped as raw asterisks/pluses. */
    .cb-md > *:first-child { margin-top: 0; }
    .cb-md > *:last-child { margin-bottom: 0; }
    .cb-md p { margin: 0; }
    .cb-md p + p { margin-top: 6px; }
    .cb-md strong { font-weight: 600; color: inherit; }
    .cb-md em { font-style: italic; }
    .cb-md a { color: var(--cb-color); text-decoration: underline; word-break: break-word; }
    .cb-md a:hover { opacity: .85; }
    .cb-md code {
      font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      background: rgba(0,0,0,.06); color: inherit;
      padding: 1px 5px; border-radius: 4px; font-size: .92em;
    }
    .cb-md ul, .cb-md ol { margin: 6px 0 6px 18px; padding: 0; }
    .cb-md ul ul, .cb-md ol ol, .cb-md ul ol, .cb-md ol ul { margin: 2px 0 2px 16px; }
    .cb-md li { margin: 2px 0; line-height: 1.45; }
    .cb-md ul { list-style: disc; }
    .cb-md ul ul { list-style: circle; }
    .cb-md ol { list-style: decimal; }
    .cb-time { font-size: 10px; line-height: 1.4; color: #9aa; margin-top: 3px; text-align: right; }
    .cb-msg-user .cb-time { color: rgba(255,255,255,.65); }
    /* In user-style bubbles (dark backgrounds) recolor links/code for contrast */
    .cb-msg-user .cb-md a { color: #fff; }
    .cb-msg-user .cb-md code { background: rgba(255,255,255,.18); }
  `;

  window.ChatBotAI = {
    init: function (opts) {
      if (!opts || !opts.botId) {
        console.warn("[ChatBotAI] botId is required");
        return null;
      }
      const inst = new ChatBotAI(opts);
      this._instance = inst;
      return inst;
    },
    // Convenience: host page can call window.ChatBotAI.setAuthToken(jwt)
    // after the user logs in, without needing to keep a reference to the
    // instance returned by init().
    setAuthToken: function (token) {
      if (this._instance) this._instance.setAuthToken(token);
      else this._pendingToken = token || "";
    },
  };

  if (autoBotId) {
    const initOpts = { botId: autoBotId, host: autoHost, fullscreen: autoFullscreen };
    const fire = () => {
      window.ChatBotAI.init(initOpts);
      if (window.ChatBotAI._pendingToken && window.ChatBotAI._instance) {
        window.ChatBotAI._instance.setAuthToken(window.ChatBotAI._pendingToken);
        window.ChatBotAI._pendingToken = "";
      }
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fire);
    } else {
      fire();
    }
  }
})();
