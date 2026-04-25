// Floating left sidebar with site settings + AI builder.

const Section = ({ title, children, defaultOpen = true }) => {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
      overflow: "hidden", marginBottom: 10,
    }}>
      <button onClick={() => setOpen(!open)} style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        width: "100%", padding: "12px 14px",
        background: "transparent", border: 0, cursor: "pointer",
        fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: "#0f172a",
      }}>
        {title}
        <EChevronDown size={14} color="#94a3b8" style={{ transform: open ? "" : "rotate(-90deg)", transition: "transform .2s" }} />
      </button>
      {open && <div style={{ padding: "0 14px 14px", borderTop: "1px solid #f1f5f9" }}>{children}</div>}
    </div>
  );
};

const Field = ({ label, children }) => (
  <label style={{ display: "block", marginTop: 12 }}>
    <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
    <div style={{ marginTop: 4 }}>{children}</div>
  </label>
);

const TextInput = (props) => (
  <input {...props} style={{
    width: "100%", padding: "8px 12px",
    border: "1px solid #e2e8f0", borderRadius: 8,
    background: "#fff", fontFamily: "inherit", fontSize: 13, color: "#0f172a",
    outline: "none",
  }} />
);

const FONTS = [
  { label: "Geist (default)", value: "Geist, sans-serif" },
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "Playfair Display", value: "'Playfair Display', serif" },
  { label: "Space Grotesk", value: "'Space Grotesk', sans-serif" },
  { label: "DM Serif Display", value: "'DM Serif Display', serif" },
];

const FloatingSidebar = ({
  open, onClose,
  site, onSiteChange,
  selectedPalette, onSelectPalette, customColors, onCustomColorChange,
  selectedFont, onSelectFont,
  messages, onSend, busy, isPro,
  isPublished, publishedUrl,
}) => {
  if (!open) return null;
  return (
    <aside style={{
      position: "absolute", top: 12, left: 12, bottom: 12,
      width: 352, background: "#f8fafc",
      border: "1px solid #e2e8f0", borderRadius: 16,
      boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.10), 0 8px 10px -6px rgb(0 0 0 / 0.10)",
      display: "flex", flexDirection: "column",
      overflow: "hidden", zIndex: 50,
    }}>
      {/* Header */}
      <div style={{
        flex: "none", padding: "14px 14px 12px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: "1px solid #e2e8f0", background: "#fff",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ESparkles size={16} color="#fe4545" />
          <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Site Builder</span>
        </div>
        <button onClick={onClose} style={{
          background: "#f1f5f9", border: 0, width: 28, height: 28, borderRadius: 8,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <EClose size={14} color="#64748b" />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 12 }}>
        {/* AI Chat */}
        <div style={{
          background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
          padding: 12, marginBottom: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <ESparkles size={14} color="#fe4545" />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>AI Builder</span>
            </div>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
              padding: "2px 7px", borderRadius: 9999,
              background: isPro ? "#fee2e2" : "#f1f5f9",
              color: isPro ? "#fe4545" : "#64748b",
            }}>
              {isPro ? "PRO" : "FREE"}
            </span>
          </div>
          <AIBuilderChat messages={messages} onSend={onSend} isPro={isPro} busy={busy} />
        </div>

        {/* Site identity */}
        <Section title="Site Identity">
          <Field label="Business Name">
            <TextInput value={site.name} onChange={(e) => onSiteChange("name", e.target.value)} />
          </Field>
          <Field label="Tagline">
            <TextInput value={site.tagline} onChange={(e) => onSiteChange("tagline", e.target.value)} />
          </Field>
          <Field label="Logo">
            <button style={{
              width: "100%", padding: "10px 12px",
              background: "#fff", border: "1px dashed #cbd5e1", borderRadius: 8,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              gap: 6, fontFamily: "inherit", fontSize: 12, color: "#64748b",
            }}>
              <EImage size={14} /> Upload logo
            </button>
          </Field>
        </Section>

        {/* Palette */}
        <Section title="Color Palette">
          <div style={{ marginTop: 12 }}>
            <PalettePicker
              selected={selectedPalette}
              onSelect={onSelectPalette}
              customColors={customColors}
              onCustomChange={onCustomColorChange}
            />
          </div>
        </Section>

        {/* Font */}
        <Section title="Typography" defaultOpen={false}>
          <Field label="Heading Font">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {FONTS.map((f) => (
                <button key={f.value} onClick={() => onSelectFont(f.value)} style={{
                  background: selectedFont === f.value ? "#fff5f5" : "#fff",
                  border: `1px solid ${selectedFont === f.value ? "#fe4545" : "#e2e8f0"}`,
                  borderRadius: 8, padding: "8px 12px",
                  textAlign: "left", fontFamily: f.value, fontSize: 14,
                  color: selectedFont === f.value ? "#fe4545" : "#0f172a", fontWeight: 600,
                  cursor: "pointer",
                }}>{f.label}</button>
              ))}
            </div>
          </Field>
        </Section>

        {/* Publish */}
        <Section title="Publish" defaultOpen={false}>
          <div style={{ marginTop: 12, padding: "10px 12px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>Status</span>
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: isPublished ? "#16a34a" : "#94a3b8",
                display: "flex", alignItems: "center", gap: 5,
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: 9999,
                  background: isPublished ? "#16a34a" : "#cbd5e1",
                }} />
                {isPublished ? "Live" : "Draft"}
              </span>
            </div>
            {isPublished && (
              <a href="#" style={{
                fontSize: 12, fontFamily: "var(--ksw-font-mono)",
                color: "#fe4545", textDecoration: "none", wordBreak: "break-all",
              }}>{publishedUrl}</a>
            )}
          </div>
        </Section>
      </div>
    </aside>
  );
};

window.FloatingSidebar = FloatingSidebar;
