// Single-row footer strip. Brand mark + Made in Canada + legal.

const Footer = () => {
  return (
    <footer style={{
      background: "#020617", color: "#cbd5e1",
      padding: "32px 24px", borderTop: "1px solid #1e293b",
    }}>
      <div style={{
        maxWidth: 1152, margin: "0 auto",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <img src="../../assets/logo/small-logo.png" alt="" style={{ height: 28 }} />
          <span style={{ fontSize: 13, color: "#94a3b8" }}>© 2026 Keystone Web Design</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#cbd5e1" }}>
          <span>Proudly Canadian</span>
          <img src="../../assets/maple-leaf.png" alt="" style={{ width: 18, height: 18 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24, fontSize: 13 }}>
          <a href="#" style={{ color: "#cbd5e1", textDecoration: "none" }}>Privacy</a>
          <a href="#" style={{ color: "#cbd5e1", textDecoration: "none" }}>Terms</a>
          <a href="#" style={{ color: "#cbd5e1", textDecoration: "none" }}>Contact</a>
        </div>
      </div>
    </footer>
  );
};

window.Footer = Footer;
