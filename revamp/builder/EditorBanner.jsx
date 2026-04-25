// Top red banner — hamburger, page selector, undo/redo, edit-preview toggle, save, publish.

const PageSelector = ({ pages, current, onChange, onCreate }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "rgba(0,0,0,0.18)", color: "#fff", border: 0,
        padding: "7px 14px", borderRadius: 9999,
        fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer",
      }}>
        <EFile size={14} /> {current}
        <EChevronDown size={14} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, marginTop: 6,
          background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
          boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.15)",
          minWidth: 220, padding: 6, zIndex: 100,
        }}>
          {pages.map((p) => (
            <button key={p} onClick={() => { onChange(p); setOpen(false); }} style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%",
              padding: "9px 12px", border: 0, background: p === current ? "#fff5f5" : "transparent",
              borderRadius: 8, fontFamily: "inherit", fontSize: 14,
              color: p === current ? "#fe4545" : "#0f172a", fontWeight: p === current ? 700 : 500,
              cursor: "pointer", textAlign: "left",
            }}>
              <EFile size={14} color={p === current ? "#fe4545" : "#94a3b8"} /> {p}
            </button>
          ))}
          <div style={{ height: 1, background: "#e2e8f0", margin: "4px 8px" }} />
          <button onClick={() => { onCreate(); setOpen(false); }} style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%",
            padding: "9px 12px", border: 0, background: "transparent",
            borderRadius: 8, fontFamily: "inherit", fontSize: 13,
            color: "#475569", fontWeight: 500, cursor: "pointer",
          }}>
            <EPlus size={13} /> Add page
          </button>
        </div>
      )}
    </div>
  );
};

const EditorBanner = ({
  sidebarOpen, onToggleSidebar,
  currentPage, pages, onPageChange, onCreatePage,
  editMode, onSetEditMode,
  onUndo, onRedo, canUndo, canRedo,
  onSave, saving, onPublish, isPublished,
}) => {
  return (
    <div style={{
      flex: "none", background: "#fe4545", color: "#fff",
      padding: "10px 16px", display: "flex", alignItems: "center",
      justifyContent: "space-between", gap: 24,
      borderBottom: "1px solid rgba(0,0,0,0.1)",
      boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
      zIndex: 1000, position: "relative",
    }}>
      {/* Left */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={onToggleSidebar} style={{
          background: "rgba(0,0,0,0.18)", color: "#fff", border: 0,
          width: 36, height: 36, borderRadius: 10, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} title={sidebarOpen ? "Close settings" : "Open settings"}>
          {sidebarOpen ? <EClose size={18} /> : <EMenu size={18} />}
        </button>
        <img src="../../assets/logo/small-logo.png" alt="" style={{ height: 24, filter: "brightness(0) invert(1)", opacity: 0.9 }} />
        <PageSelector pages={pages} current={currentPage} onChange={onPageChange} onCreate={onCreatePage} />
      </div>

      {/* Center: edit/preview toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(0,0,0,0.22)", borderRadius: 9999, padding: 3 }}>
        <button onClick={() => onSetEditMode(true)} style={{
          padding: "6px 16px", border: 0, borderRadius: 9999, cursor: "pointer",
          background: editMode ? "#fff" : "transparent", color: editMode ? "#fe4545" : "#fff",
          fontFamily: "inherit", fontSize: 13, fontWeight: 700,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <EType size={13} /> Edit
        </button>
        <button onClick={() => onSetEditMode(false)} style={{
          padding: "6px 16px", border: 0, borderRadius: 9999, cursor: "pointer",
          background: !editMode ? "#fff" : "transparent", color: !editMode ? "#fe4545" : "#fff",
          fontFamily: "inherit", fontSize: 13, fontWeight: 700,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <EPlay size={13} /> Preview
        </button>
      </div>

      {/* Right */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={onUndo} disabled={!canUndo} style={{
          background: "rgba(0,0,0,0.18)", border: 0, color: "#fff",
          width: 34, height: 34, borderRadius: 10, cursor: canUndo ? "pointer" : "not-allowed",
          opacity: canUndo ? 1 : 0.35,
          display: "flex", alignItems: "center", justifyContent: "center",
        }} title="Undo">
          <EUndo size={16} />
        </button>
        <button onClick={onRedo} disabled={!canRedo} style={{
          background: "rgba(0,0,0,0.18)", border: 0, color: "#fff",
          width: 34, height: 34, borderRadius: 10, cursor: canRedo ? "pointer" : "not-allowed",
          opacity: canRedo ? 1 : 0.35,
          display: "flex", alignItems: "center", justifyContent: "center",
        }} title="Redo">
          <ERedo size={16} />
        </button>
        <button onClick={onSave} style={{
          background: "rgba(0,0,0,0.18)", color: "#fff", border: 0,
          padding: "8px 16px", borderRadius: 9999, cursor: "pointer",
          fontFamily: "inherit", fontSize: 13, fontWeight: 700,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          {saving ? <ELoader size={14} style={{ animation: "ksw-spin 1s linear infinite" }} /> : <ESave size={14} />}
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={onPublish} style={{
          background: "#fff", color: "#fe4545", border: 0,
          padding: "8px 18px", borderRadius: 9999, cursor: "pointer",
          fontFamily: "inherit", fontSize: 13, fontWeight: 700,
          display: "flex", alignItems: "center", gap: 6,
          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.18)",
        }}>
          <EGlobe size={14} /> {isPublished ? "Published" : "Publish"}
        </button>
      </div>
      <style>{`@keyframes ksw-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

window.EditorBanner = EditorBanner;
