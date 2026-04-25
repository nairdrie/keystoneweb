// Live site preview — renders user's site using their palette, font, and copy.
// Shows edit affordances (dashed outlines + section labels) when editMode=true.

const SitePreview = ({ site, palette, font, editMode, viewport }) => {
  const { primary, secondary, accent } = palette;

  // viewport: 'desktop' | 'mobile'
  const wrapperStyle = viewport === "mobile"
    ? { maxWidth: 390, margin: "0 auto", border: "1px solid #cbd5e1", borderRadius: 24, overflow: "hidden", boxShadow: "0 25px 50px -12px rgb(0 0 0 / 0.25)" }
    : { width: "100%", height: "100%" };

  const editOutline = editMode ? "2px dashed rgba(254, 69, 69, 0.45)" : "2px dashed transparent";
  const editLabel = (label) => editMode ? (
    <span style={{
      position: "absolute", top: -10, left: 12,
      background: "#fe4545", color: "#fff",
      padding: "2px 8px", borderRadius: 9999,
      fontSize: 10, fontWeight: 700,
      fontFamily: "var(--ksw-font-mono)", letterSpacing: "0.04em",
    }}>{label}</span>
  ) : null;

  const editableText = (s) => editMode ? {
    outline: "1px dashed rgba(254,69,69,0.6)",
    outlineOffset: 4,
    cursor: "text",
    ...s,
  } : s;

  return (
    <div style={wrapperStyle}>
      <div style={{ background: "#fff", fontFamily: "var(--ksw-font-sans)", overflow: "hidden" }}>
        {/* NAV */}
        <div style={{ position: "relative", outline: editOutline, outlineOffset: -2 }}>
          {editLabel("Header")}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: viewport === "mobile" ? "14px 18px" : "20px 48px",
            background: "#fff", borderBottom: `1px solid ${accent}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: primary, display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <EHammer size={16} color="#fff" />
              </div>
              <span style={{ fontFamily: font, fontSize: 16, fontWeight: 800, color: secondary }}>{site.name}</span>
            </div>
            {viewport !== "mobile" && (
              <div style={{ display: "flex", gap: 24, fontSize: 13, color: secondary, fontWeight: 500 }}>
                <span>Services</span><span>About</span><span>Reviews</span><span>Contact</span>
              </div>
            )}
            <button style={{
              background: primary, color: "#fff", border: 0,
              padding: viewport === "mobile" ? "6px 12px" : "8px 16px", borderRadius: 9999,
              fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>Get Quote</button>
          </div>
        </div>

        {/* HERO */}
        <div style={{ position: "relative", outline: editOutline, outlineOffset: -2 }}>
          {editLabel("Hero")}
          <div style={{
            padding: viewport === "mobile" ? "40px 20px" : "80px 48px",
            background: `linear-gradient(135deg, ${accent} 0%, #fff 100%)`,
            display: "flex", flexDirection: viewport === "mobile" ? "column" : "row",
            gap: 32, alignItems: "center",
          }}>
            <div style={{ flex: 1 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "#fff", border: `1px solid ${accent}`,
                padding: "5px 12px", borderRadius: 9999,
                fontSize: 11, fontWeight: 700, color: primary,
                marginBottom: 16,
                ...editableText({}),
              }}>
                <span style={{ width: 6, height: 6, borderRadius: 9999, background: primary }} />
                LICENSED & INSURED · 24/7
              </div>
              <h1 style={editableText({
                fontFamily: font, fontSize: viewport === "mobile" ? 36 : 56,
                fontWeight: 900, color: secondary, lineHeight: 1.05,
                margin: "0 0 16px", letterSpacing: "-0.02em",
              })}>
                {site.tagline}
              </h1>
              <p style={editableText({
                fontSize: viewport === "mobile" ? 14 : 17, color: "#475569",
                lineHeight: 1.55, margin: "0 0 24px", maxWidth: 480,
              })}>
                Family-owned plumbing in {site.city}. Same-day service, fair prices, no surprises on the bill.
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button style={{
                  background: primary, color: "#fff", border: 0,
                  padding: "12px 22px", borderRadius: 9999,
                  fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer",
                }}>Book Service</button>
                <button style={{
                  background: "transparent", color: secondary, border: `1px solid ${secondary}`,
                  padding: "12px 22px", borderRadius: 9999,
                  fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer",
                }}>Call (555) 010-2244</button>
              </div>
            </div>
            <div style={{
              flex: viewport === "mobile" ? "none" : 1,
              width: viewport === "mobile" ? "100%" : "auto",
              aspectRatio: "4 / 3",
              background: `linear-gradient(135deg, ${primary}22, ${secondary}11)`,
              borderRadius: 16, position: "relative",
              border: `1px solid ${accent}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <EHammer size={64} color={primary} strokeWidth={1.4} />
            </div>
          </div>
        </div>

        {/* SERVICES */}
        <div style={{ position: "relative", outline: editOutline, outlineOffset: -2 }}>
          {editLabel("Services")}
          <div style={{
            padding: viewport === "mobile" ? "40px 20px" : "64px 48px",
            background: "#fff",
          }}>
            <h2 style={{
              fontFamily: font, fontSize: viewport === "mobile" ? 26 : 36,
              fontWeight: 800, color: secondary, margin: "0 0 6px",
              ...editableText({}),
            }}>What We Do Best</h2>
            <p style={{ color: "#64748b", margin: "0 0 32px", fontSize: 14 }}>From dripping faucets to full repipes.</p>
            <div style={{
              display: "grid",
              gridTemplateColumns: viewport === "mobile" ? "1fr" : "repeat(3, 1fr)",
              gap: 16,
            }}>
              {[
                { t: "Emergency Repairs", d: "Burst pipes, no hot water, sewer backups — we're there in 60 min." },
                { t: "Drain Cleaning", d: "Hydro-jetting and snaking. Cleared the first time, guaranteed." },
                { t: "Water Heater Service", d: "Repair, replacement, and tankless installs from $1,899." },
              ].map((s, i) => (
                <div key={i} style={{
                  background: "#fff", border: `1px solid ${accent}`,
                  padding: 20, borderRadius: 12,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: `${primary}15`, color: primary,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginBottom: 12,
                  }}>
                    <EHammer size={18} />
                  </div>
                  <h3 style={{ fontFamily: font, fontSize: 16, fontWeight: 700, color: secondary, margin: "0 0 6px" }}>{s.t}</h3>
                  <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.5, margin: 0 }}>{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA STRIP */}
        <div style={{ position: "relative", outline: editOutline, outlineOffset: -2 }}>
          {editLabel("CTA")}
          <div style={{
            padding: viewport === "mobile" ? "32px 20px" : "48px",
            background: secondary, color: "#fff", textAlign: "center",
          }}>
            <h2 style={{ fontFamily: font, fontSize: viewport === "mobile" ? 22 : 30, fontWeight: 800, margin: "0 0 8px" }}>
              Need a plumber today?
            </h2>
            <p style={{ color: "rgba(255,255,255,0.75)", margin: "0 0 18px", fontSize: 14 }}>
              We answer the phone 24/7. Free estimates on bigger jobs.
            </p>
            <button style={{
              background: primary, color: "#fff", border: 0,
              padding: "12px 28px", borderRadius: 9999,
              fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>Call Now</button>
          </div>
        </div>
      </div>
    </div>
  );
};

window.SitePreview = SitePreview;
