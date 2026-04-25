// Homepage hero — bold headline, gradient red second line, italic word, two CTAs, stat card.
// Background is a static slate-200 grid at 8% opacity (real site animates 3 mockups on a 15s loop).

const Hero = ({ onCTA = () => {} }) => {
  return (
    <section style={{ position: "relative", padding: "128px 24px 80px", overflow: "hidden" }}>
      {/* Animated grid pattern (static rendering) */}
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.08, pointerEvents: "none" }}>
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#64748b" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      <div style={{ maxWidth: 1024, margin: "0 auto", textAlign: "center", position: "relative" }}>
        {/* Eyebrow pill */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "8px 16px", background: "#f1f5f9", color: "#334155",
          border: "1px solid #e2e8f0", borderRadius: 9999,
          fontSize: 13, fontWeight: 700, marginBottom: 28,
        }}>
          <img src="../../assets/maple-leaf.png" alt="" style={{ width: 14, height: 14 }} />
          Canadian-Made Website Builder
        </div>

        <h1 style={{
          fontWeight: 900, color: "#000", letterSpacing: "-0.02em",
          lineHeight: 1.05, fontSize: "clamp(40px, 6vw, 72px)", margin: "0 0 24px",
        }}>
          Your business deserves<br />
          <span style={{
            background: "linear-gradient(90deg, #cc2525, #fe4545, #f43f5e)",
            WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
          }}>
            a website that <em>actually</em> works.
          </span>
        </h1>

        <p style={{
          fontSize: 18, color: "#0f172a", fontWeight: 500, lineHeight: 1.65,
          maxWidth: 720, margin: "0 auto 36px",
        }}>
          No technical skills needed. Launch a professional website that turns visitors into customers. Get online, look professional, grow your business — starting today.
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", marginBottom: 56 }}>
          <button onClick={onCTA} style={{
            background: "#fe4545", color: "#fff", border: 0,
            padding: "16px 32px", borderRadius: 9999,
            fontFamily: "inherit", fontWeight: 700, fontSize: 16, cursor: "pointer",
            boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
            display: "inline-flex", alignItems: "center", gap: 8,
            transition: "all .2s cubic-bezier(.16,1,.3,1)",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 20px 25px -5px rgb(0 0 0 / 0.15)"; e.currentTarget.style.background = "#ff2525"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 10px 15px -3px rgb(0 0 0 / 0.1)"; e.currentTarget.style.background = "#fe4545"; }}
          >
            Create Your Website <ArrowRight size={18} />
          </button>
          <button style={{
            background: "#f1f5f9", color: "#0f172a", border: 0,
            padding: "16px 32px", borderRadius: 9999,
            fontFamily: "inherit", fontWeight: 700, fontSize: 16, cursor: "pointer",
          }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#e2e8f0")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#f1f5f9")}
          >
            See How It Works
          </button>
        </div>

        {/* Stat card */}
        <div style={{ position: "relative", maxWidth: 720, margin: "0 auto" }}>
          <div style={{
            position: "absolute", inset: 0, borderRadius: 24,
            background: "linear-gradient(90deg, #fe4545, #cc2525)",
            filter: "blur(24px)", opacity: 0.1,
          }} />
          <div style={{
            position: "relative",
            background: "#fff", border: "1px solid #e2e8f0", borderRadius: 24,
            padding: "28px 24px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
            gap: 24, boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.06)",
          }}>
            {[
              ["5 min", "To Launch"],
              ["$15", "Per Month"],
              [<InfinityIcon key="inf" size={42} color="#fe4545" strokeWidth={2.5} />, "Possibilities"],
            ].map(([n, label], i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{
                  fontSize: 42, fontWeight: 900, color: "#fe4545",
                  letterSpacing: "-0.02em", lineHeight: 1, height: 42,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{n}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginTop: 12 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

window.Hero = Hero;
