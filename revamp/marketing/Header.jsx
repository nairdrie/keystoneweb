// Sticky marketing header — logo, nav, red pill CTA.
// Industries dropdown opens on hover.

const Header = ({ active = "home", onNav = () => {} }) => {
  const [openDropdown, setOpenDropdown] = React.useState(false);

  const link = (id, label) => (
    <button
      onClick={() => onNav(id)}
      style={{
        background: "none", border: 0, cursor: "pointer",
        fontFamily: "inherit", fontSize: 14, fontWeight: 500,
        color: active === id ? "#0f172a" : "#475569",
        padding: "8px 4px", transition: "color .2s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "#0f172a")}
      onMouseLeave={(e) => (e.currentTarget.style.color = active === id ? "#0f172a" : "#475569")}
    >
      {label}
    </button>
  );

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 50,
      background: "#fff", borderBottom: "1px solid #e2e8f0",
    }}>
      <div style={{
        maxWidth: 1152, margin: "0 auto", padding: "14px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <button onClick={() => onNav("home")} style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }}>
          <img src="../../assets/logo/keystone-logo.png" alt="Keystone Web Design" style={{ height: 40 }} />
        </button>

        <nav style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {link("templates", "Templates")}
          <div
            style={{ position: "relative" }}
            onMouseEnter={() => setOpenDropdown(true)}
            onMouseLeave={() => setOpenDropdown(false)}
          >
            <button style={{
              background: "none", border: 0, cursor: "pointer",
              fontFamily: "inherit", fontSize: 14, fontWeight: 500, color: "#475569",
              padding: "8px 4px", display: "inline-flex", alignItems: "center", gap: 4,
            }}>
              Industries <ChevronDown size={14} />
            </button>
            {openDropdown && (
              <div style={{
                position: "absolute", top: "100%", left: 0, marginTop: 8,
                background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16,
                padding: 8, minWidth: 240, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
              }}>
                {[
                  ["Trades & Home Services", Hammer, "#f59e0b"],
                  ["E-Commerce & Retail", TrendingUp, "#a855f7"],
                  ["Health & Wellness", Shield, "#10b981"],
                  ["Food & Hospitality", Star, "#eab308"],
                  ["Professional Services", PhoneCall, "#3b82f6"],
                  ["Creative & Portfolio", PenTool, "#ec4899"],
                ].map(([label, Ic, color]) => (
                  <button key={label} onClick={() => onNav("industry-" + label)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12, width: "100%",
                      background: "none", border: 0, cursor: "pointer", padding: "10px 12px",
                      borderRadius: 10, fontFamily: "inherit", fontSize: 14, fontWeight: 500,
                      color: "#334155", textAlign: "left",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.color = "#fe4545"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#334155"; }}
                  >
                    <Ic size={18} color={color} />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {link("pricing", "Pricing")}
          {link("contact", "Contact")}
          <button
            onClick={() => onNav("get-started")}
            style={{
              background: "#fe4545", color: "#fff", border: 0,
              padding: "10px 22px", borderRadius: 9999,
              fontFamily: "inherit", fontWeight: 700, fontSize: 14,
              cursor: "pointer", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              transition: "all .2s cubic-bezier(.16,1,.3,1)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#ff2525"; e.currentTarget.style.boxShadow = "0 10px 15px -3px rgb(0 0 0 / 0.15)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#fe4545"; e.currentTarget.style.boxShadow = "0 4px 6px -1px rgb(0 0 0 / 0.1)"; }}
          >
            Get Started
          </button>
        </nav>
      </div>
    </header>
  );
};

window.Header = Header;
