// Single feature card. Hover lifts border to red-300 + shadow-lg + icon scale-110.

const FeatureCard = ({ Icon, color, title, body }) => {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "#fff",
        border: `1px solid ${hover ? "#ffcccc" : "#e2e8f0"}`,
        borderRadius: 16,
        padding: 28,
        boxShadow: hover
          ? "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)"
          : "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        transition: "all .3s cubic-bezier(.16,1,.3,1)",
        cursor: "pointer",
      }}
    >
      <div style={{
        width: 56, height: 56, borderRadius: 12,
        background: "#f8fafc", border: "1px solid #f1f5f9",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 20,
        transform: hover ? "scale(1.1)" : "scale(1)",
        transition: "transform .3s cubic-bezier(.16,1,.3,1)",
      }}>
        <Icon size={28} color={color} />
      </div>
      <h3 style={{
        fontSize: 18, fontWeight: 700, color: "#0f172a",
        margin: "0 0 8px", lineHeight: 1.3,
      }}>{title}</h3>
      <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.6, margin: 0 }}>{body}</p>
    </div>
  );
};

const FeatureGrid = () => {
  const features = [
    [Sparkles, "#8b5cf6", "AI Website Builder", "Describe what you want and our AI builds your entire site in seconds. No design skills needed."],
    [Smartphone, "#10b981", "Mobile Ready", "Your site looks perfect on phones, tablets, and computers — automatically."],
    [PenTool, "#f59e0b", "Fully Customizable", "Edit anything visually. Change colors, fonts, layouts. No code, no headaches."],
    [TrendingUp, "#a855f7", "Built to Convert", "Pages designed to turn visitors into customers — booking forms, contact CTAs, reviews."],
    [CircleDollarSign, "#16a34a", "Honest Pricing", "Starts at $15/month. No surprise fees. Cancel anytime — really."],
    [InfinityIcon, "#fe4545", "Worry-Free Scaling", "If traffic spikes, your site never goes down. Just $1.00 per 1,000 extra visitors."],
  ];

  return (
    <section style={{ padding: "80px 24px", background: "#fff" }}>
      <div style={{ maxWidth: 1152, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <h2 style={{
            fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 900, color: "#0f172a",
            letterSpacing: "-0.015em", lineHeight: 1.1, margin: "0 0 16px",
          }}>Built for Your Success</h2>
          <p style={{
            fontSize: 18, color: "#475569", lineHeight: 1.6,
            maxWidth: 640, margin: "0 auto",
          }}>
            Everything you need to launch a website that grows your business. Nothing you don't.
          </p>
        </div>
        <div style={{
          display: "grid", gap: 24,
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        }}>
          {features.map(([Ic, c, t, b]) => <FeatureCard key={t} Icon={Ic} color={c} title={t} body={b} />)}
        </div>
      </div>
    </section>
  );
};

Object.assign(window, { FeatureCard, FeatureGrid });
