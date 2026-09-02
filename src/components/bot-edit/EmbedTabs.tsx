"use client";

import { useState } from "react";

export default function EmbedTabs({ base, publicId }: { base: string; publicId: string }) {
  const [tab, setTab] = useState("html");
  const tabs = [
    { id: "html", icon: "fa-brands fa-html5", label: "HTML" },
    { id: "react", icon: "fa-brands fa-react", label: "React" },
    { id: "next", icon: "fa-solid fa-n", label: "Next.js" },
    { id: "rn", icon: "fa-brands fa-react", label: "React Native" },
    { id: "kotlin", icon: "fa-brands fa-android", label: "Kotlin" },
    { id: "java", icon: "fa-brands fa-android", label: "Java" },
  ];

  const html = `<script src="${base}/embed.js"
        data-bot-id="${publicId}" defer></script>`;
  const react = `import { useEffect } from "react";

export default function ChatWidget() {
  useEffect(() => {
    const s = document.createElement("script");
    s.src = "${base}/embed.js";
    s.dataset.botId = "${publicId}";
    s.defer = true;
    document.body.appendChild(s);
    return () => s.remove();
  }, []);
  return null;
}`;
  const next = `// app/layout.tsx
import Script from "next/script";

export default function RootLayout({ children }) {
  return (
    <html><body>
      {children}
      <Script
        src="${base}/embed.js"
        data-bot-id="${publicId}"
        strategy="lazyOnload" />
    </body></html>
  );
}`;
  const rn = `// React Native — uses react-native-webview
import { WebView } from "react-native-webview";

export default function ChatScreen() {
  return (
    <WebView
      source={{ uri: "${base}/widget/${publicId}" }}
      javaScriptEnabled
      domStorageEnabled
      mediaPlaybackRequiresUserAction={false}
      allowsInlineMediaPlayback
      style={{ flex: 1 }}
    />
  );
}`;
  const kotlin = `// Kotlin — Android WebView
class ChatActivity : AppCompatActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val webView = WebView(this)
    setContentView(webView)
    webView.settings.javaScriptEnabled = true
    webView.settings.domStorageEnabled = true
    webView.settings.mediaPlaybackRequiresUserGesture = false
    webView.loadUrl("${base}/widget/${publicId}")
  }
}

<!-- AndroidManifest.xml -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />`;
  const java = `// Java — Android WebView
public class ChatActivity extends AppCompatActivity {
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    WebView webView = new WebView(this);
    setContentView(webView);
    WebSettings s = webView.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setMediaPlaybackRequiresUserGesture(false);
    webView.loadUrl("${base}/widget/${publicId}");
  }
}

<!-- AndroidManifest.xml -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />`;

  const snippets: Record<string, string> = { html, react, next, rn, kotlin, java };
  const token1 = `<!-- token is read from localStorage["userToken"] on every chat send -->
<script src="${base}/embed.js"
        data-bot-id="${publicId}"
        data-auth-token-key="userToken" defer></script>

<!-- or from a cookie -->
<script src="${base}/embed.js"
        data-bot-id="${publicId}"
        data-auth-token-cookie="auth_token" defer></script>`;
  const token2 = `// after user logs in, push the token into the widget
window.ChatBotAI.setAuthToken(localStorage.getItem("userToken"));

// or initialize manually with a getter so refresh-tokens stay fresh:
window.ChatBotAI.init({
  botId: "${publicId}",
  getAuthToken: () => localStorage.getItem("userToken"),
});`;

  return (
    <>
      <h2>Embed snippet</h2>
      <p className="muted">Pick your platform and copy the snippet.</p>
      <div className="tabs">
        {tabs.map((t) => (
          <button key={t.id} type="button" className={`tab-btn${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>
            <i className={t.icon} /> {t.label}
          </button>
        ))}
      </div>
      <div className="tab-pane active">
        <pre><code>{snippets[tab]}</code></pre>
      </div>

      <p className="muted" style={{ marginTop: 8 }}>
        <small>
          <i className="fa-solid fa-info-circle" /> Mobile apps load <code>{base}/widget/{publicId}</code> — a fullscreen page
          that uses the same backend.
        </small>
      </p>

      <details style={{ marginTop: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>
          <i className="fa-solid fa-user-lock" /> Pass logged-in user&apos;s token (for &quot;my orders / my profile&quot; questions)
        </summary>
        <p className="muted" style={{ marginTop: 8 }}>
          Required only for APIs above with <strong>Use visitor&apos;s login token</strong> ticked. Choose whichever method
          matches how your site stores the auth token.
        </p>
        <h4 style={{ marginTop: 12 }}>Option 1 — declarative (HTML)</h4>
        <pre><code>{token1}</code></pre>
        <h4>Option 2 — programmatic (React / Next.js)</h4>
        <pre><code>{token2}</code></pre>
        <p className="muted">
          <small>
            <i className="fa-solid fa-shield-halved" /> Tokens are sent over HTTPS to ChatBotAI and forwarded only to the API
            URL you configured. Nothing is stored on our servers.
          </small>
        </p>
      </details>
    </>
  );
}
