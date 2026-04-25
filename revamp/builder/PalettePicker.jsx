// 3-color palette grid + custom picker.

const PALETTES = [
  { name: "Classic", primary: "#0f172a", secondary: "#64748b", accent: "#cbd5e1" },
  { name: "Brand",   primary: "#fe4545", secondary: "#0f172a", accent: "#f8fafc" },
  { name: "Forest",  primary: "#166534", secondary: "#16a34a", accent: "#dcfce7" },
  { name: "Ocean",   primary: "#1e40af", secondary: "#3b82f6", accent: "#dbeafe" },
  { name: "Sunset",  primary: "#9a3412", secondary: "#f59e0b", accent: "#fed7aa" },
  { name: "Plum",    primary: "#581c87", secondary: "#a855f7", accent: "#e9d5ff" },
];

const PalettePicker = ({ selected, onSelect, customColors, onCustomChange }) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
        {PALETTES.map((p) => (
          <button key={p.name} onClick={() => onSelect(p.name)} style={{
            background: "#fff",
            border: `1px solid ${selected === p.name ? "#fe4545" : "#e2e8f0"}`,
            borderRadius: 10, padding: 10, cursor: "pointer",
            display: "flex", flexDirection: "column", gap: 8,
            outline: selected === p.name ? "2px solid #ffcccc" : "none",
            outlineOffset: -1, transition: "all .2s",
          }}>
            <div style={{ display: "flex", gap: 0, height: 28, borderRadius: 6, overflow: "hidden" }}>
              <div style={{ flex: 1, background: p.primary }} />
              <div style={{ flex: 1, background: p.secondary }} />
              <div style={{ flex: 1, background: p.accent }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", textAlign: "left" }}>{p.name}</div>
          </button>
        ))}
      </div>
      {/* Custom */}
      <div style={{
        background: "#fff", border: `1px solid ${selected === "custom" ? "#fe4545" : "#e2e8f0"}`,
        borderRadius: 10, padding: 12,
        outline: selected === "custom" ? "2px solid #ffcccc" : "none", outlineOffset: -1,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Custom</span>
          <button onClick={() => onSelect("custom")} style={{
            background: selected === "custom" ? "#fe4545" : "#f1f5f9",
            color: selected === "custom" ? "#fff" : "#475569",
            border: 0, padding: "3px 10px", borderRadius: 9999,
            fontSize: 11, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
          }}>{selected === "custom" ? "Selected" : "Use"}</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {(["primary", "secondary", "accent"]).map((k) => (
            <label key={k} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 10, color: "#64748b", textTransform: "capitalize" }}>
              {k}
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "4px 6px" }}>
                <input type="color" value={customColors[k]} onChange={(e) => onCustomChange(k, e.target.value)}
                  style={{ width: 22, height: 22, border: 0, padding: 0, background: "transparent", cursor: "pointer" }} />
                <span style={{ fontFamily: "var(--ksw-font-mono)", fontSize: 10, color: "#475569" }}>{customColors[k]}</span>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

window.PalettePicker = PalettePicker;
window.PALETTES = PALETTES;
