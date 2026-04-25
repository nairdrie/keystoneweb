// FAQ accordion — single-open behavior.

const FAQ = () => {
  const items = [
    ["Will I get a surprise bill?",
      "No surprises. Your monthly fee is fixed at $15 (Basic) or $30 (Pro). If your traffic exceeds your plan's allowance, we charge $1.00 per 1,000 extra visitors at month-end — and you'll see it coming in your dashboard before it bills."],
    ["Can you build my site for me?",
      "Yes — that's our Launch Service. We meet for a 45-minute call to map out your business, build your site in about a week, and share a private preview link before going live. One-time fee, then your normal monthly plan."],
    ["What if I'm not technical at all?",
      "That's exactly who we built this for. The AI builder asks you a few questions about your business, then generates the whole site. You edit anything visually — click on text to change it, click on photos to swap them. No code."],
    ["Do I own my domain and content?",
      "Yes, completely. If you ever leave Keystone, your domain is yours, and we'll export all your content for you. No lock-in."],
    ["Is hosting included?",
      "Yes. SSL, hosting, automatic backups, and CDN are all included in every plan. There's nothing extra to set up or pay for."],
  ];
  const [open, setOpen] = React.useState(0);

  return (
    <section style={{ padding: "96px 24px", background: "#f8fafc" }}>
      <div style={{ maxWidth: 768, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{
            fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 900, color: "#0f172a",
            letterSpacing: "-0.015em", lineHeight: 1.1, margin: "0 0 16px",
          }}>Frequently Asked Questions</h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map(([q, a], i) => (
            <div key={i} style={{
              background: "#fff", border: "1px solid #e2e8f0",
              borderRadius: 16, overflow: "hidden",
            }}>
              <button onClick={() => setOpen(open === i ? -1 : i)} style={{
                width: "100%", display: "flex", justifyContent: "space-between",
                alignItems: "center", padding: "20px 24px", background: "none",
                border: 0, cursor: "pointer", fontFamily: "inherit",
                fontSize: 16, fontWeight: 700, color: "#0f172a", textAlign: "left",
              }}>
                {q}
                <ChevronDown size={18} color="#94a3b8" style={{
                  transform: open === i ? "rotate(180deg)" : "none",
                  transition: "transform .3s",
                }} />
              </button>
              {open === i && (
                <div style={{ padding: "0 24px 24px", fontSize: 15, color: "#475569", lineHeight: 1.7 }}>
                  {a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

window.FAQ = FAQ;
