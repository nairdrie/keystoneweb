// 3-step onboarding flow: industry pick → describe business → AI prompt.

const INDUSTRIES = [
  { id: "trades",    label: "Trades & Home Services", emoji: "🔧" },
  { id: "food",      label: "Restaurant or Cafe",     emoji: "🍽️" },
  { id: "wellness",  label: "Health & Wellness",      emoji: "💆" },
  { id: "retail",    label: "Local Retail",           emoji: "🛍️" },
  { id: "creative",  label: "Creative & Studio",      emoji: "🎨" },
  { id: "other",     label: "Something else",         emoji: "✨" },
];

const Step = ({ n, total, title, sub, children, onBack, onNext, nextLabel = "Continue", canNext = true }) => (
  <div style={{
    width: "min(640px, 92vw)", margin: "0 auto",
    background: "#fff", border: "1px solid #e2e8f0", borderRadius: 20,
    padding: "32px 36px",
    boxShadow: "0 25px 50px -12px rgb(0 0 0 / 0.15)",
  }}>
    <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          flex: 1, height: 4, borderRadius: 9999,
          background: i < n ? "#fe4545" : "#e2e8f0",
        }} />
      ))}
    </div>
    <div style={{ fontSize: 11, fontWeight: 700, color: "#fe4545", letterSpacing: "0.08em", marginBottom: 6 }}>
      STEP {n} OF {total}
    </div>
    <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", margin: "0 0 8px", letterSpacing: "-0.01em" }}>{title}</h1>
    <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 24px" }}>{sub}</p>
    {children}
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
      <button onClick={onBack} disabled={!onBack} style={{
        background: "transparent", border: 0, padding: "10px 16px",
        fontFamily: "inherit", fontSize: 13, fontWeight: 600,
        color: onBack ? "#475569" : "#cbd5e1",
        cursor: onBack ? "pointer" : "not-allowed",
      }}>← Back</button>
      <button onClick={onNext} disabled={!canNext} style={{
        background: canNext ? "#fe4545" : "#cbd5e1",
        color: "#fff", border: 0, padding: "10px 22px", borderRadius: 9999,
        fontFamily: "inherit", fontSize: 13, fontWeight: 700,
        cursor: canNext ? "pointer" : "not-allowed",
        display: "flex", alignItems: "center", gap: 6,
      }}>{nextLabel} <EArrowRight size={14} /></button>
    </div>
  </div>
);

const OnboardingWizard = ({ onComplete }) => {
  const [step, setStep] = React.useState(1);
  const [industry, setIndustry] = React.useState(null);
  const [name, setName] = React.useState("");
  const [city, setCity] = React.useState("");
  const [prompt, setPrompt] = React.useState("");
  const [generating, setGenerating] = React.useState(false);

  const generate = () => {
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      onComplete({ industry, name, city, prompt });
    }, 1800);
  };

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "linear-gradient(135deg, #fff5f5 0%, #fff 50%, #fff7ed 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 32, zIndex: 2000, overflow: "auto",
    }}>
      {generating ? (
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 64, height: 64, borderRadius: 9999,
            background: "linear-gradient(135deg, #fe4545, #fbbf24)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
            boxShadow: "0 20px 40px -10px rgba(254, 69, 69, 0.5)",
            animation: "ksw-spin 2s linear infinite",
          }}>
            <ESparkles size={32} color="#fff" />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: "0 0 8px" }}>Building your site…</h2>
          <p style={{ color: "#64748b", margin: 0 }}>Picking a template, generating copy, and choosing colors.</p>
        </div>
      ) : step === 1 ? (
        <Step n={1} total={3}
          title="What kind of business?"
          sub="We'll suggest a template and copy that fit."
          onNext={() => setStep(2)} canNext={!!industry}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            {INDUSTRIES.map((ind) => (
              <button key={ind.id} onClick={() => setIndustry(ind.id)} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 16px",
                background: industry === ind.id ? "#fff5f5" : "#fff",
                border: `1px solid ${industry === ind.id ? "#fe4545" : "#e2e8f0"}`,
                borderRadius: 12, cursor: "pointer",
                fontFamily: "inherit", fontSize: 14, fontWeight: 600,
                color: industry === ind.id ? "#fe4545" : "#0f172a",
                textAlign: "left",
                outline: industry === ind.id ? "2px solid #ffcccc" : "none",
                outlineOffset: -1,
              }}>
                <span style={{ fontSize: 22 }}>{ind.emoji}</span>
                {ind.label}
              </button>
            ))}
          </div>
        </Step>
      ) : step === 2 ? (
        <Step n={2} total={3}
          title="Tell us about your business"
          sub="Two quick fields. You can change everything later."
          onBack={() => setStep(1)} onNext={() => setStep(3)}
          canNext={name.trim() && city.trim()}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>Business Name</div>
              <input value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Hargrove Plumbing" style={{
                  width: "100%", padding: "12px 14px",
                  border: "1px solid #cbd5e1", borderRadius: 10,
                  fontFamily: "inherit", fontSize: 15, outline: "none",
                }} />
            </label>
            <label>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>City or Region</div>
              <input value={city} onChange={(e) => setCity(e.target.value)}
                placeholder="Boise, ID" style={{
                  width: "100%", padding: "12px 14px",
                  border: "1px solid #cbd5e1", borderRadius: 10,
                  fontFamily: "inherit", fontSize: 15, outline: "none",
                }} />
            </label>
          </div>
        </Step>
      ) : (
        <Step n={3} total={3}
          title="What should the site say?"
          sub="One sentence is fine. The AI will fill in the rest."
          onBack={() => setStep(2)} onNext={generate}
          nextLabel="Build my site" canNext={prompt.trim().length > 5}
        >
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
            placeholder="Family-owned plumber, 24/7 emergency service, focus on fair pricing and same-day visits."
            rows={5}
            style={{
              width: "100%", padding: "12px 14px",
              border: "1px solid #cbd5e1", borderRadius: 10,
              fontFamily: "inherit", fontSize: 14, lineHeight: 1.5,
              outline: "none", resize: "vertical",
            }} />
          <div style={{
            marginTop: 12, padding: "10px 12px",
            background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 10,
            fontSize: 12, color: "#9a3412",
            display: "flex", gap: 8, alignItems: "flex-start",
          }}>
            <ESparkles size={14} color="#fe4545" style={{ flex: "none", marginTop: 1 }} />
            <span>The AI will generate a hero, services list, about section, and contact page from this.</span>
          </div>
        </Step>
      )}
    </div>
  );
};

window.OnboardingWizard = OnboardingWizard;
