// AI Builder chat — suggested prompts, message thread, composer.

const SUGGESTED = [
  "Make my hero more bold",
  "Add a testimonials section",
  "Use a warmer color palette",
  "Write better copy for my services",
];

const ToolCallChip = ({ label, status }) => (
  <div style={{
    display: "inline-flex", alignItems: "center", gap: 6,
    background: "#f8fafc", border: "1px solid #e2e8f0",
    borderRadius: 8, padding: "5px 9px",
    fontSize: 11, fontFamily: "var(--ksw-font-mono)", color: "#475569",
  }}>
    {status === "running" ? (
      <ELoader size={11} color="#fe4545" style={{ animation: "ksw-spin 1s linear infinite" }} />
    ) : (
      <ECheck size={11} color="#16a34a" />
    )}
    {label}
  </div>
);

const Bubble = ({ role, text, tools }) => {
  if (role === "user") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <div style={{
          background: "#fe4545", color: "#fff",
          padding: "9px 14px", borderRadius: "16px 16px 4px 16px",
          fontSize: 13, lineHeight: 1.45, maxWidth: "85%",
        }}>{text}</div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
      <div style={{
        flex: "none", width: 26, height: 26, borderRadius: 9999,
        background: "linear-gradient(135deg, #fe4545, #fbbf24)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 2px 4px rgba(254, 69, 69, 0.3)",
      }}>
        <ESparkles size={13} color="#fff" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          background: "#fff", border: "1px solid #e2e8f0",
          padding: "9px 12px", borderRadius: "4px 16px 16px 16px",
          fontSize: 13, lineHeight: 1.5, color: "#0f172a",
        }}>{text}</div>
        {tools && tools.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
            {tools.map((t, i) => <ToolCallChip key={i} {...t} />)}
          </div>
        )}
      </div>
    </div>
  );
};

const AIBuilderChat = ({ messages, onSend, isPro, busy }) => {
  const [input, setInput] = React.useState("");
  const scrollRef = React.useRef(null);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  const send = (text) => {
    const t = (text ?? input).trim();
    if (!t || busy) return;
    onSend(t);
    setInput("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: 360 }}>
      {/* Messages */}
      <div ref={scrollRef} style={{
        flex: 1, minHeight: 0, overflowY: "auto",
        padding: "4px 2px", display: "flex", flexDirection: "column",
      }}>
        {messages.length === 0 && (
          <div style={{ padding: "16px 4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <ESparkles size={14} color="#fe4545" />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                Try one of these:
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {SUGGESTED.map((s) => (
                <button key={s} onClick={() => send(s)} style={{
                  background: "#fff", border: "1px solid #e2e8f0",
                  borderRadius: 10, padding: "9px 12px",
                  textAlign: "left", fontFamily: "inherit", fontSize: 12,
                  color: "#475569", cursor: "pointer", lineHeight: 1.4,
                }}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => <Bubble key={i} {...m} />)}
        {busy && (
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <div style={{
              flex: "none", width: 26, height: 26, borderRadius: 9999,
              background: "linear-gradient(135deg, #fe4545, #fbbf24)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <ESparkles size={13} color="#fff" />
            </div>
            <div style={{
              background: "#fff", border: "1px solid #e2e8f0",
              padding: "9px 14px", borderRadius: "4px 16px 16px 16px",
              fontSize: 13, color: "#94a3b8",
            }}>
              <span style={{ display: "inline-flex", gap: 3 }}>
                <span className="ksw-dot" />
                <span className="ksw-dot" style={{ animationDelay: ".15s" }} />
                <span className="ksw-dot" style={{ animationDelay: ".3s" }} />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div style={{
        flex: "none",
        background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14,
        padding: 8, marginTop: 8,
        boxShadow: "0 1px 2px rgba(0,0,0,.04)",
      }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Tell the AI builder what to change…"
          rows={2}
          style={{
            width: "100%", border: 0, resize: "none", outline: "none",
            fontFamily: "inherit", fontSize: 13, color: "#0f172a",
            padding: "4px 6px", background: "transparent",
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "var(--ksw-font-mono)" }}>
            {isPro ? "PRO · unlimited" : "Free · 3 / day"}
          </span>
          <button onClick={() => send()} disabled={!input.trim() || busy} style={{
            width: 32, height: 32, borderRadius: 9999, border: 0,
            background: input.trim() && !busy ? "#fe4545" : "#cbd5e1",
            color: "#fff", cursor: input.trim() && !busy ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <EArrowUp size={15} />
          </button>
        </div>
      </div>

      {!isPro && (
        <div style={{
          flex: "none",
          marginTop: 8, padding: "9px 12px",
          background: "linear-gradient(135deg, #fff7ed, #fef2f2)",
          border: "1px solid #fecaca", borderRadius: 10,
          fontSize: 11, color: "#9a3412",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
        }}>
          <span><strong>Upgrade to Pro</strong> for unlimited AI edits.</span>
          <button style={{
            background: "#fe4545", color: "#fff", border: 0,
            padding: "4px 10px", borderRadius: 9999,
            fontFamily: "inherit", fontSize: 11, fontWeight: 700, cursor: "pointer",
          }}>Upgrade</button>
        </div>
      )}

      <style>{`
        .ksw-dot { width: 5px; height: 5px; border-radius: 9999px; background: #94a3b8;
          display: inline-block; animation: ksw-bounce 1s infinite; }
        @keyframes ksw-bounce { 0%, 80%, 100% { transform: scale(0.6); opacity: .5; } 40% { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
};

window.AIBuilderChat = AIBuilderChat;
