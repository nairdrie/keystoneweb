// Pricing cards — Basic (light) + Pro (dark).
// Pro has a red "Most Popular" pill above the card and a brand-glow shadow on hover.

const PricingCards = () => {
  const [hover, setHover] = React.useState(null);
  const basicFeatures = [
    "AI website builder", "Custom domain", "Mobile-optimized",
    "Unlimited pages", "SSL & hosting included", "Email support",
  ];
  const proFeatures = [
    "Everything in Basic, plus:", "Online booking & forms",
    "Advanced SEO tools", "Priority support",
    "1,000 extra visitors / month included", "Premium templates",
  ];

  return (
    <section style={{ padding: "96px 24px", background: "#fff" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <h2 style={{
            fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 900, color: "#0f172a",
            letterSpacing: "-0.015em", lineHeight: 1.1, margin: "0 0 16px",
          }}>Simple, Honest Pricing</h2>
          <p style={{ fontSize: 18, color: "#475569", lineHeight: 1.6, maxWidth: 560, margin: "0 auto" }}>
            No bait-and-switch. No dark patterns. No surprise fees.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* Basic */}
          <div
            onMouseEnter={() => setHover("basic")}
            onMouseLeave={() => setHover(null)}
            style={{
              background: "#fff", border: "1px solid #e2e8f0", borderRadius: 24,
              padding: 36,
              boxShadow: hover === "basic"
                ? "0 25px 50px -12px rgb(0 0 0 / 0.18)"
                : "0 10px 15px -3px rgb(0 0 0 / 0.08)",
              transition: "all .3s cubic-bezier(.16,1,.3,1)",
              transform: hover === "basic" ? "translateY(-4px)" : "none",
            }}
          >
            <h3 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: "0 0 4px" }}>Basic</h3>
            <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 24px" }}>Ideal for local shops and contractors.</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 28 }}>
              <span style={{ fontSize: 56, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.02em", lineHeight: 1 }}>$15</span>
              <span style={{ color: "#64748b", fontWeight: 500, fontSize: 16 }}>/month</span>
            </div>
            <button style={{
              width: "100%", background: "#f1f5f9", color: "#0f172a", border: 0,
              padding: "14px", borderRadius: 12, fontFamily: "inherit",
              fontWeight: 700, fontSize: 14, cursor: "pointer", marginBottom: 28,
            }}>Choose Basic</button>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              {basicFeatures.map((f) => (
                <li key={f} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, color: "#334155" }}>
                  <Check size={18} color="#fe4545" strokeWidth={2.5} /> {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Pro */}
          <div
            onMouseEnter={() => setHover("pro")}
            onMouseLeave={() => setHover(null)}
            style={{
              position: "relative",
              background: "#020617", border: "1px solid #1e293b", borderRadius: 24,
              padding: 36, color: "#fff",
              boxShadow: hover === "pro"
                ? "0 25px 50px -12px rgb(254 69 69 / 0.25)"
                : "0 25px 50px -12px rgb(0 0 0 / 0.25)",
              transition: "all .3s cubic-bezier(.16,1,.3,1)",
              transform: hover === "pro" ? "translateY(-4px)" : "none",
            }}
          >
            <span style={{
              position: "absolute", top: -14, right: 32,
              background: "#fe4545", color: "#fff", padding: "5px 14px",
              borderRadius: 9999, fontSize: 12, fontWeight: 700,
              outline: "3px solid #fff",
            }}>Most Popular</span>
            <h3 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>Pro</h3>
            <p style={{ fontSize: 14, color: "#cbd5e1", margin: "0 0 24px" }}>For growing businesses with more traffic.</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 28 }}>
              <span style={{ fontSize: 56, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1 }}>$30</span>
              <span style={{ color: "#cbd5e1", fontWeight: 500, fontSize: 16 }}>/month</span>
            </div>
            <button style={{
              width: "100%", background: "#fe4545", color: "#fff", border: 0,
              padding: "14px", borderRadius: 12, fontFamily: "inherit",
              fontWeight: 700, fontSize: 14, cursor: "pointer", marginBottom: 28,
              boxShadow: "0 10px 15px -3px rgb(254 69 69 / 0.3)",
            }}>Choose Pro</button>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              {proFeatures.map((f, i) => (
                <li key={f} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, color: i === 0 ? "#fff" : "#cbd5e1", fontWeight: i === 0 ? 700 : 400 }}>
                  <Check size={18} color="#fe4545" strokeWidth={2.5} /> {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p style={{ textAlign: "center", marginTop: 28, fontSize: 13, color: "#64748b" }}>
          Cancel anytime. No long-term contract. No setup fees.
        </p>
      </div>
    </section>
  );
};

window.PricingCards = PricingCards;
