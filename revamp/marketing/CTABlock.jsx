// Closing red CTA section. Two blurred decorative red circles.

const CTABlock = ({
  title = "Stop waiting. Get online today.",
  body = "Join thousands of Canadian small businesses already growing with Keystone Web.",
  cta = "Start Your Free Website",
}) => {
  return (
    <section style={{ padding: "96px 24px", background: "#fe4545", position: "relative", overflow: "hidden" }}>
      {/* Decorative blurred circles */}
      <div style={{
        position: "absolute", top: -80, left: -80, width: 320, height: 320,
        background: "#ff7e7e", borderRadius: "50%", filter: "blur(64px)", opacity: 0.5,
      }} />
      <div style={{
        position: "absolute", bottom: -80, right: -80, width: 320, height: 320,
        background: "#ff7e7e", borderRadius: "50%", filter: "blur(64px)", opacity: 0.5,
      }} />

      <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center", position: "relative" }}>
        <h2 style={{
          fontSize: "clamp(32px, 4vw, 56px)", fontWeight: 900, color: "#fff",
          letterSpacing: "-0.02em", lineHeight: 1.1, margin: "0 0 20px",
        }}>{title}</h2>
        <p style={{
          fontSize: 18, color: "#fff", lineHeight: 1.6, opacity: 0.95,
          margin: "0 0 36px", maxWidth: 560, marginLeft: "auto", marginRight: "auto",
        }}>{body}</p>
        <button style={{
          background: "#fff", color: "#fe4545", border: 0,
          padding: "16px 36px", borderRadius: 9999,
          fontFamily: "inherit", fontWeight: 700, fontSize: 16, cursor: "pointer",
          boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.15)",
          display: "inline-flex", alignItems: "center", gap: 8,
          transition: "all .2s cubic-bezier(.16,1,.3,1)",
        }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 25px 35px -5px rgb(0 0 0 / 0.25)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 20px 25px -5px rgb(0 0 0 / 0.15)"; }}
        >
          {cta} <ArrowRight size={18} />
        </button>
      </div>
    </section>
  );
};

window.CTABlock = CTABlock;
