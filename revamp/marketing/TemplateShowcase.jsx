// Templates showcase — dark slate-950 section, two auto-scrolling rows.
// Real site uses Framer's animate-scroll-left/right keyframes; we use a CSS animation.

const TemplateShowcase = () => {
  const templates = [
    [1, "Luxe", "Premium feel"],
    [2, "Vivid", "Bold. Energetic."],
    [3, "Airy", "Clean. Spacious."],
    [4, "Edge", "Modern. Sharp."],
    [5, "Classic", "Timeless"],
    [6, "Organic", "Warm. Natural."],
    [7, "Sleek", "Minimal"],
    [8, "Vibrant", "Punchy"],
  ];
  // Duplicate for seamless loop
  const row1 = [...templates, ...templates];
  const row2 = [...templates.slice().reverse(), ...templates.slice().reverse()];

  return (
    <section style={{ padding: "80px 0", background: "#020617", overflow: "hidden", position: "relative" }}>
      <style>{`
        @keyframes scroll-left { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes scroll-right { from { transform: translateX(-50%); } to { transform: translateX(0); } }
        .ksw-scroll-row { display: flex; gap: 20px; width: max-content; }
        .ksw-row-1 { animation: scroll-left 40s linear infinite; }
        .ksw-row-2 { animation: scroll-right 40s linear infinite; }
        .ksw-tmpl-card:hover { transform: scale(1.04); }
      `}</style>

      <div style={{ textAlign: "center", marginBottom: 48, padding: "0 24px" }}>
        <h2 style={{
          fontSize: "clamp(32px, 4vw, 48px)", fontWeight: 900, color: "#fff",
          letterSpacing: "-0.015em", lineHeight: 1.1, margin: "0 0 16px",
        }}>Designed to Sell</h2>
        <p style={{ fontSize: 18, color: "#cbd5e1", maxWidth: 640, margin: "0 auto", lineHeight: 1.6 }}>
          Templates crafted for trades, restaurants, retail, and every kind of small business.
        </p>
      </div>

      {[row1, row2].map((row, ri) => (
        <div key={ri} style={{ marginBottom: ri === 0 ? 20 : 0, maskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)" }}>
          <div className={`ksw-scroll-row ksw-row-${ri + 1}`}>
            {row.map(([n, name, desc], i) => (
              <div key={i} className="ksw-tmpl-card" style={{
                width: 280, flexShrink: 0,
                background: "#0f172a", border: "1px solid #1e293b", borderRadius: 16,
                overflow: "hidden", transition: "transform .3s cubic-bezier(.16,1,.3,1)", cursor: "pointer",
              }}>
                <div style={{
                  aspectRatio: "16 / 10",
                  backgroundImage: `url(../../assets/templates/${n}.png)`,
                  backgroundSize: "cover", backgroundPosition: "top",
                }} />
                <div style={{ padding: "14px 18px" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{name}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{ textAlign: "center", marginTop: 56 }}>
        <button style={{
          background: "#fff", color: "#0f172a", border: 0,
          padding: "14px 28px", borderRadius: 9999,
          fontFamily: "inherit", fontWeight: 700, fontSize: 15, cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 8,
        }}>Browse All Templates <ArrowRight size={16} /></button>
      </div>
    </section>
  );
};

window.TemplateShowcase = TemplateShowcase;
