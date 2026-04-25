// New homepage — opinionated revamp.
// Section order:
//   1. HeroSlab        — huge editorial headline + animated AI prompt → site demo
//   2. ProofStrip      — autoscroll of real customer logos / industries
//   3. BuilderDemo     — interactive: type into a fake builder, watch site change
//   4. BeforeAfter     — janky old site vs. Keystone site, slider
//   5. WhyCanadians    — 3 reasons, big numbers, bullet copy
//   6. Templates       — existing showcase
//   7. PriceSlab       — $15 owns the screen (red full-bleed)
//   8. ClosingCTA      — "stop waiting" voice
//   9. Footer

// ──────────────────────────────────────────────────────────────────────
// HERO SLAB
// ──────────────────────────────────────────────────────────────────────
const HeroSlab = ({ onCTA }) => {
  const [demoStep, setDemoStep] = React.useState(0);
  // 0: empty prompt, 1: typing, 2: building, 3: rendered

  React.useEffect(() => {
    const seq = [
      [800, 1],   // start typing
      [3200, 2],  // building
      [4400, 3],  // rendered
      [9000, 0],  // restart
    ];
    const timers = seq.map(([t, s]) => setTimeout(() => setDemoStep(s), t));
    return () => timers.forEach(clearTimeout);
  }, [demoStep === 0]);

  const PROMPT = "A site for my plumbing business in Sudbury";

  return (
    <section style={{ position: "relative", padding: "80px 24px 60px", overflow: "hidden", background: "#fff" }}>
      {/* very subtle grid */}
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.06, pointerEvents: "none" }}>
        <defs>
          <pattern id="grid2" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#0f172a" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid2)" />
      </svg>

      <div style={{ maxWidth: 1280, margin: "0 auto", position: "relative", display: "grid",
        gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 1fr)", gap: 56, alignItems: "center" }}>

        {/* LEFT: words */}
        <div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 14px", background: "#fff", color: "#0f172a",
            border: "1px solid #e2e8f0", borderRadius: 9999,
            fontSize: 12, fontWeight: 700, marginBottom: 28,
            boxShadow: "0 1px 2px rgba(0,0,0,.04)",
          }}>
            <img src="../../assets/maple-leaf.png" alt="" style={{ width: 13, height: 13 }} />
            Built in Canada · 5,200+ businesses online
          </div>

          <h1 style={{
            fontWeight: 900, color: "#000",
            letterSpacing: "-0.035em",
            lineHeight: 0.92,
            fontSize: "clamp(48px, 8.5vw, 116px)",
            margin: "0 0 28px",
          }}>
            Tell us<br/>
            what you do.<br/>
            <span style={{ color: "#fe4545" }}>We build the site.</span>
          </h1>

          <p style={{
            fontSize: 19, color: "#334155", fontWeight: 500, lineHeight: 1.55,
            maxWidth: 520, margin: "0 0 36px",
          }}>
            One sentence. Five minutes. A real website that books real customers — for <strong style={{ color: "#0f172a" }}>$15 a month</strong>, no surprises.
          </p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={onCTA} style={{
              background: "#fe4545", color: "#fff", border: 0,
              padding: "16px 28px", borderRadius: 9999,
              fontFamily: "inherit", fontWeight: 700, fontSize: 15, cursor: "pointer",
              boxShadow: "0 10px 25px -5px rgba(254,69,69,.45)",
              display: "inline-flex", alignItems: "center", gap: 8,
              transition: "all .2s",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.background = "#ff2525"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.background = "#fe4545"; }}
            >
              Start Your Site — Free <ArrowRight size={16} />
            </button>
            <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>
              No credit card. Keep it free until you publish.
            </span>
          </div>

          {/* Trust row */}
          <div style={{ display: "flex", gap: 28, marginTop: 44, flexWrap: "wrap" }}>
            {[
              ["5 min", "to launch"],
              ["$15", "/mo · all-in"],
              ["24/7", "support"],
            ].map(([n, l]) => (
              <div key={l}>
                <div style={{ fontSize: 26, fontWeight: 900, color: "#fe4545", letterSpacing: "-0.02em", lineHeight: 1 }}>{n}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginTop: 4 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: live builder demo */}
        <BuilderDemo prompt={PROMPT} step={demoStep} />
      </div>
    </section>
  );
};

// ──────────────────────────────────────────────────────────────────────
// BUILDER DEMO (used inside hero)
// ──────────────────────────────────────────────────────────────────────
const BuilderDemo = ({ prompt, step }) => {
  // step: 0 idle, 1 typing, 2 building, 3 rendered
  const typed = step === 0 ? "" :
    step === 1 ? prompt.slice(0, Math.min(prompt.length, Math.floor((Date.now() / 80) % (prompt.length + 1)))) :
    prompt;

  // For step 1, do an interval-driven typewriter
  const [tIdx, setTIdx] = React.useState(0);
  React.useEffect(() => {
    if (step !== 1) { setTIdx(step >= 2 ? prompt.length : 0); return; }
    setTIdx(0);
    let i = 0;
    const id = setInterval(() => {
      i++;
      if (i >= prompt.length) { clearInterval(id); }
      setTIdx(i);
    }, 60);
    return () => clearInterval(id);
  }, [step, prompt]);

  const showText = step === 0 ? "" : step === 1 ? prompt.slice(0, tIdx) : prompt;

  return (
    <div style={{
      position: "relative",
      transform: "perspective(1400px) rotateY(-3deg) rotateX(2deg)",
      transformOrigin: "center center",
    }}>
      {/* Glow */}
      <div style={{
        position: "absolute", inset: -32, borderRadius: 32,
        background: "radial-gradient(circle at 30% 30%, rgba(254,69,69,.18), transparent 60%)",
        filter: "blur(40px)", pointerEvents: "none",
      }} />

      {/* Browser window */}
      <div style={{
        position: "relative",
        background: "#fff", borderRadius: 16,
        boxShadow: "0 50px 100px -20px rgba(15,23,42,.25), 0 30px 60px -30px rgba(254,69,69,.12)",
        border: "1px solid #e2e8f0", overflow: "hidden",
      }}>
        {/* chrome */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid #f1f5f9", background: "#fafbfc" }}>
          <div style={{ display: "flex", gap: 5 }}>
            {["#fc615c", "#fdbe40", "#34c84a"].map(c => <span key={c} style={{ width: 11, height: 11, borderRadius: 9999, background: c }} />)}
          </div>
          <div style={{
            flex: 1, marginLeft: 8, padding: "4px 10px", background: "#fff",
            border: "1px solid #e2e8f0", borderRadius: 9999,
            fontSize: 11, fontFamily: "var(--ksw-font-mono)", color: "#64748b",
          }}>
            kswd.ca/builder
          </div>
        </div>

        {/* split: prompt / preview */}
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", height: 380 }}>
          {/* LEFT: chat */}
          <div style={{ background: "#f8fafc", borderRight: "1px solid #f1f5f9", padding: 14, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
              <Sparkles size={13} color="#fe4545" />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a" }}>AI Builder</span>
            </div>

            {/* user bubble */}
            <div style={{
              alignSelf: "flex-end", maxWidth: "92%",
              background: "#fe4545", color: "#fff",
              padding: "8px 11px", borderRadius: "12px 12px 3px 12px",
              fontSize: 11, lineHeight: 1.4, marginBottom: 10,
              minHeight: 18,
            }}>
              {showText}{step === 1 && <span style={{ animation: "ksw-blink 1s steps(2) infinite" }}>▋</span>}
            </div>

            {/* AI response */}
            {step >= 2 && (
              <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                <div style={{
                  flex: "none", width: 18, height: 18, borderRadius: 9999,
                  background: "linear-gradient(135deg, #fe4545, #fbbf24)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Sparkles size={9} color="#fff" />
                </div>
                <div style={{
                  background: "#fff", border: "1px solid #e2e8f0",
                  padding: "8px 10px", borderRadius: "3px 12px 12px 12px",
                  fontSize: 11, lineHeight: 1.4, color: "#0f172a", flex: 1,
                }}>
                  {step === 2 ? (
                    <span style={{ color: "#94a3b8" }}>
                      <span className="ksw-thinking-dot" />
                      <span className="ksw-thinking-dot" style={{ animationDelay: ".15s" }} />
                      <span className="ksw-thinking-dot" style={{ animationDelay: ".3s" }} />
                    </span>
                  ) : (
                    <>Built a starter for <strong>Sudbury Plumbing</strong>. Picked a warm palette and added a 24/7 callout.</>
                  )}
                </div>
              </div>
            )}

            {step >= 3 && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                {["select_template", "generate_copy", "set_palette"].map((t, i) => (
                  <div key={t} style={{
                    fontSize: 9, fontFamily: "var(--ksw-font-mono)", color: "#475569",
                    padding: "3px 7px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6,
                    display: "inline-flex", alignItems: "center", gap: 4, animation: `ksw-pop .3s ${i * .1}s both`,
                  }}>
                    <Check size={9} color="#16a34a" /> {t}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: preview */}
          <div style={{ position: "relative", overflow: "hidden", background: "#fff" }}>
            {step < 3 ? (
              <div style={{
                position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                color: "#cbd5e1", fontSize: 12, fontWeight: 600, gap: 8,
                background: step === 2 ? "linear-gradient(120deg, #f8fafc 0%, #fff5f5 50%, #f8fafc 100%)" : "#f8fafc",
                backgroundSize: step === 2 ? "200% 100%" : undefined,
                animation: step === 2 ? "ksw-shimmer 1.5s linear infinite" : "none",
              }}>
                {step === 2 ? <><Loader size={14} color="#fe4545" /> Generating…</> : "Preview will appear here"}
              </div>
            ) : (
              <div style={{ animation: "ksw-fadeIn .5s" }}>
                <FakeSitePreview />
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ksw-blink { 50% { opacity: 0; } }
        @keyframes ksw-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes ksw-fadeIn { from { opacity: 0; transform: translateY(6px);} to { opacity: 1; transform: none;} }
        @keyframes ksw-pop { from { opacity: 0; transform: translateY(4px);} to { opacity: 1; transform: none;} }
        .ksw-thinking-dot { width: 4px; height: 4px; border-radius: 9999px; background: #94a3b8; display: inline-block; margin-right: 3px; animation: ksw-bounce 1s infinite; }
        @keyframes ksw-bounce { 0%, 80%, 100% { transform: scale(.6); opacity: .5; } 40% { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
};

const Loader = (p) => (
  <svg width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke={p.color || "currentColor"}
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "ksw-spin 1s linear infinite" }}>
    <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
    <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
  </svg>
);

const FakeSitePreview = () => (
  <div style={{ fontFamily: "var(--ksw-font-sans)", fontSize: 11, lineHeight: 1.4, transform: "scale(.98)" }}>
    {/* nav */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid #f1f5f9" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 16, height: 16, background: "#0c4a6e", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Hammer size={9} color="#fff" />
        </div>
        <span style={{ fontWeight: 800, color: "#0c4a6e", fontSize: 11 }}>Sudbury Plumbing</span>
      </div>
      <button style={{ background: "#0c4a6e", color: "#fff", border: 0, padding: "4px 8px", borderRadius: 9999, fontSize: 9, fontWeight: 700, fontFamily: "inherit" }}>Call Now</button>
    </div>
    {/* hero */}
    <div style={{ padding: "16px 16px 18px", background: "linear-gradient(135deg, #e0f2fe 0%, #fff 100%)" }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#0c4a6e", marginBottom: 6 }}>● 24/7 EMERGENCY</div>
      <div style={{ fontSize: 18, fontWeight: 900, color: "#0c4a6e", lineHeight: 1.05, marginBottom: 6, letterSpacing: "-0.01em" }}>
        Plumbing in Sudbury,<br/>fixed today.
      </div>
      <div style={{ fontSize: 9, color: "#475569", marginBottom: 8 }}>Family-owned. Honest pricing. We answer the phone.</div>
      <div style={{ display: "flex", gap: 6 }}>
        <span style={{ background: "#0c4a6e", color: "#fff", padding: "4px 10px", borderRadius: 9999, fontSize: 9, fontWeight: 700 }}>Book Service</span>
        <span style={{ border: "1px solid #0c4a6e", color: "#0c4a6e", padding: "4px 10px", borderRadius: 9999, fontSize: 9, fontWeight: 700 }}>(705) 555-1212</span>
      </div>
    </div>
    {/* services */}
    <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
      {["Emergency", "Drain Care", "Water Heaters"].map(s => (
        <div key={s} style={{ background: "#fff", border: "1px solid #e2e8f0", padding: 8, borderRadius: 6 }}>
          <div style={{ width: 18, height: 18, background: "#e0f2fe", borderRadius: 4, marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Hammer size={10} color="#0c4a6e" />
          </div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#0c4a6e" }}>{s}</div>
        </div>
      ))}
    </div>
  </div>
);

// ──────────────────────────────────────────────────────────────────────
// PROOF STRIP
// ──────────────────────────────────────────────────────────────────────
const ProofStrip = () => {
  const items = [
    "Hargrove Plumbing · Boise",
    "Folk & Tide Cafe · Halifax",
    "Maple & Steel Studio · Toronto",
    "North Hill Florist · Calgary",
    "Bayview Pilates · Vancouver",
    "Fox & Falcon Books · Kingston",
    "Ridgeline Roofing · Kamloops",
    "Crescent Bakery · Montréal",
  ];
  const row = (
    <div style={{ display: "flex", gap: 48, padding: "24px 0", alignItems: "center", flexShrink: 0 }}>
      {items.map((n, i) => (
        <div key={n + i} style={{
          fontFamily: "var(--ksw-font-sans)", fontSize: 17, fontWeight: 700,
          color: "#475569", letterSpacing: "-0.01em",
          display: "flex", alignItems: "center", gap: 12, whiteSpace: "nowrap",
        }}>
          <span style={{ width: 6, height: 6, borderRadius: 9999, background: "#fe4545" }} />
          {n}
        </div>
      ))}
    </div>
  );
  return (
    <section style={{ background: "#0f172a", borderTop: "1px solid #1e293b", borderBottom: "1px solid #1e293b", overflow: "hidden", color: "#cbd5e1" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "20px 24px 8px", display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          5,200+ Canadian businesses online
        </span>
        <span style={{ fontSize: 11, color: "#475569" }}>·</span>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>From the trades to the table.</span>
      </div>
      <div style={{ position: "relative", width: "100%", overflow: "hidden", maskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)" }}>
        <div style={{ display: "flex", animation: "ksw-marquee 40s linear infinite" }}>
          {row}{row}
        </div>
      </div>
      <style>{`@keyframes ksw-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </section>
  );
};

// ──────────────────────────────────────────────────────────────────────
// THREE BIG REASONS
// ──────────────────────────────────────────────────────────────────────
const ThreeReasons = () => {
  const items = [
    {
      n: "01",
      title: "It actually launches.",
      body: "Most builders trap you in a half-finished draft. Tell us what you do and you'll have a real website by lunch — not a Pinterest board of intentions.",
      stat: "5 min",
      statLabel: "median time to first publish",
    },
    {
      n: "02",
      title: "It doesn't get expensive.",
      body: "Fifteen dollars a month. That includes hosting, the domain, the AI edits, and a real human if you get stuck. No tier creep, no per-seat surprises.",
      stat: "$15",
      statLabel: "per month, all-in",
    },
    {
      n: "03",
      title: "It books real customers.",
      body: "Every template ships with a working contact form, a Google Maps embed, click-to-call, and reviews — the boring stuff that actually moves the needle.",
      stat: "32%",
      statLabel: "average lift in inquiries (yr 1)",
    },
  ];

  return (
    <section style={{ background: "#fff", padding: "120px 24px" }}>
      <div style={{ maxWidth: 1152, margin: "0 auto" }}>
        <div style={{ maxWidth: 700, marginBottom: 64 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#fe4545", letterSpacing: "0.12em", marginBottom: 14 }}>
            WHY KEYSTONE
          </div>
          <h2 style={{
            fontSize: "clamp(36px, 5.5vw, 64px)", fontWeight: 900, color: "#000",
            letterSpacing: "-0.025em", lineHeight: 1.02, margin: 0,
          }}>
            Three reasons<br/>this <em style={{ color: "#fe4545" }}>actually</em> works.
          </h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 0, borderTop: "1px solid #e2e8f0" }}>
          {items.map((it) => (
            <div key={it.n} style={{
              display: "grid", gridTemplateColumns: "80px 1fr 240px",
              gap: 32, padding: "40px 0", borderBottom: "1px solid #e2e8f0",
              alignItems: "start",
            }}>
              <div style={{ fontSize: 14, fontFamily: "var(--ksw-font-mono)", color: "#94a3b8", fontWeight: 700, paddingTop: 6 }}>
                {it.n}
              </div>
              <div>
                <h3 style={{
                  fontSize: "clamp(22px, 2.6vw, 32px)", fontWeight: 900, color: "#000",
                  margin: "0 0 12px", letterSpacing: "-0.015em", lineHeight: 1.1,
                }}>{it.title}</h3>
                <p style={{ fontSize: 16, lineHeight: 1.6, color: "#475569", margin: 0, maxWidth: 560 }}>
                  {it.body}
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 56, fontWeight: 900, color: "#fe4545", letterSpacing: "-0.03em", lineHeight: 1 }}>{it.stat}</div>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginTop: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {it.statLabel}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ──────────────────────────────────────────────────────────────────────
// BEFORE / AFTER SLIDER
// ──────────────────────────────────────────────────────────────────────
const BeforeAfter = () => {
  const [pos, setPos] = React.useState(50);

  return (
    <section style={{ background: "#f8fafc", padding: "120px 24px" }}>
      <div style={{ maxWidth: 1152, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.5fr)", gap: 48, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#fe4545", letterSpacing: "0.12em", marginBottom: 14 }}>
              THE UPGRADE
            </div>
            <h2 style={{
              fontSize: "clamp(32px, 4.4vw, 56px)", fontWeight: 900, color: "#000",
              letterSpacing: "-0.025em", lineHeight: 1.02, margin: "0 0 20px",
            }}>
              From <em style={{ color: "#94a3b8", fontStyle: "italic" }}>oof</em><br/>
              to <span style={{ color: "#fe4545" }}>open for business.</span>
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.55, color: "#334155", margin: "0 0 24px", maxWidth: 460 }}>
              Most small-business sites haven't been touched since 2014. Drag the slider to see what fifteen minutes of Keystone looks like.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                "Real photos and copy, written by AI",
                "Fast on mobile (Lighthouse 95+)",
                "Live phone, map, and reviews block",
                "Ranks for your city + service",
              ].map(b => (
                <div key={b} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 9999, background: "#fe4545", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                    <Check size={12} color="#fff" />
                  </div>
                  <span style={{ fontSize: 14, color: "#0f172a", fontWeight: 500 }}>{b}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Slider */}
          <div style={{
            position: "relative", aspectRatio: "16 / 11", borderRadius: 16,
            overflow: "hidden", border: "1px solid #e2e8f0",
            boxShadow: "0 25px 50px -12px rgba(15,23,42,.18)",
            userSelect: "none",
          }}
          onMouseDown={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const move = (ev) => {
              const x = (ev.clientX - rect.left) / rect.width * 100;
              setPos(Math.max(2, Math.min(98, x)));
            };
            const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
            window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
            move(e);
          }}
          >
            {/* AFTER (full) */}
            <div style={{ position: "absolute", inset: 0 }}>
              <KeystoneSiteMock />
            </div>
            {/* BEFORE (clipped) */}
            <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
              <OldSiteMock />
            </div>
            {/* labels */}
            <div style={{
              position: "absolute", top: 16, left: 16, padding: "6px 12px",
              background: "#0f172a", color: "#fff", borderRadius: 9999,
              fontSize: 10, fontWeight: 800, letterSpacing: "0.08em",
            }}>BEFORE</div>
            <div style={{
              position: "absolute", top: 16, right: 16, padding: "6px 12px",
              background: "#fe4545", color: "#fff", borderRadius: 9999,
              fontSize: 10, fontWeight: 800, letterSpacing: "0.08em",
            }}>AFTER · KEYSTONE</div>
            {/* divider */}
            <div style={{
              position: "absolute", top: 0, bottom: 0, left: `${pos}%`,
              width: 2, background: "#fff", boxShadow: "0 0 0 1px rgba(0,0,0,.1)",
              cursor: "ew-resize",
            }}>
              <div style={{
                position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                width: 44, height: 44, borderRadius: 9999, background: "#fff",
                boxShadow: "0 4px 12px rgba(0,0,0,.18)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#0f172a", fontSize: 14, fontWeight: 800,
              }}>‹›</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const OldSiteMock = () => (
  <div style={{
    width: "100%", height: "100%", background: "#fefce8",
    fontFamily: "Times New Roman, serif", color: "#1e1b4b",
    padding: 18, position: "relative",
  }}>
    {/* old-school header w/ visited-link blue underlines */}
    <div style={{
      background: "linear-gradient(180deg, #1e3a8a, #1e40af)", color: "#fde047",
      padding: "8px 12px", marginBottom: 12, fontSize: 22, fontWeight: 700,
      fontStyle: "italic", textShadow: "1px 1px 0 #000",
      border: "3px ridge #fde047",
    }}>
      ★ HARGROVE PLUMBING ★
    </div>
    <div style={{ fontSize: 11, marginBottom: 6 }}>
      <span style={{ color: "#1d4ed8", textDecoration: "underline" }}>Home</span> | {" "}
      <span style={{ color: "#7c3aed", textDecoration: "underline" }}>About Us</span> | {" "}
      <span style={{ color: "#1d4ed8", textDecoration: "underline" }}>Services</span> | {" "}
      <span style={{ color: "#1d4ed8", textDecoration: "underline" }}>Contact</span>
    </div>
    <div style={{ padding: 10, background: "#fff", border: "2px solid #94a3b8", marginTop: 8 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, color: "#7f1d1d" }}>
        Welcome to our website!!
      </div>
      <div style={{ fontSize: 11, lineHeight: 1.4, color: "#1e1b4b" }}>
        We are family owned plumbers serving the area since 1987. Please call us at <span style={{ color: "#1d4ed8", textDecoration: "underline" }}>(555) 010-2244</span> for all your plumbing needs! We do drains, water heaters, toilets, sinks, and MORE!
      </div>
      <div style={{
        marginTop: 10, display: "inline-block", padding: "4px 8px",
        background: "linear-gradient(180deg, #fef08a, #facc15)",
        border: "2px outset #ca8a04", fontSize: 10, fontWeight: 700,
      }}>► Click Here for Estimate ◄</div>
    </div>
    <div style={{
      position: "absolute", bottom: 8, left: 12, right: 12,
      fontSize: 9, fontStyle: "italic", color: "#475569",
      textAlign: "center",
    }}>
      ★ Best viewed in Internet Explorer 6 ★ © 2008 ★ Hit Counter: 04127 ★
    </div>
  </div>
);

const KeystoneSiteMock = () => (
  <div style={{ width: "100%", height: "100%", background: "#fff", fontFamily: "var(--ksw-font-sans)", display: "flex", flexDirection: "column" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 22px", borderBottom: "1px solid #f1f5f9" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 26, height: 26, background: "#fe4545", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Hammer size={14} color="#fff" />
        </div>
        <span style={{ fontWeight: 800, color: "#0f172a", fontSize: 14 }}>Hargrove Plumbing</span>
      </div>
      <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#475569", fontWeight: 500 }}>
        <span>Services</span><span>About</span><span>Reviews</span><span>Contact</span>
      </div>
      <button style={{ background: "#fe4545", color: "#fff", border: 0, padding: "6px 14px", borderRadius: 9999, fontSize: 11, fontWeight: 700, fontFamily: "inherit" }}>Get Quote</button>
    </div>
    <div style={{ flex: 1, padding: "32px 22px", background: "linear-gradient(135deg, #fff5f5 0%, #fff 100%)", display: "flex", gap: 20, alignItems: "center" }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", background: "#fff", border: "1px solid #fecaca", borderRadius: 9999, fontSize: 9, fontWeight: 700, color: "#fe4545", marginBottom: 12 }}>
          <span style={{ width: 5, height: 5, borderRadius: 9999, background: "#fe4545" }} /> 24/7 EMERGENCY
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.02em", lineHeight: 1.05, marginBottom: 8 }}>
          Plumbing fixed right,<br/>the first time.
        </div>
        <div style={{ fontSize: 11, color: "#475569", marginBottom: 12, lineHeight: 1.4 }}>
          Family-owned plumbing in Boise. Same-day service, fair prices, no surprises.
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ background: "#fe4545", color: "#fff", padding: "6px 12px", borderRadius: 9999, fontSize: 10, fontWeight: 700 }}>Book Service</span>
          <span style={{ border: "1px solid #0f172a", color: "#0f172a", padding: "6px 12px", borderRadius: 9999, fontSize: 10, fontWeight: 700 }}>(555) 010-2244</span>
        </div>
      </div>
      <div style={{ flex: 1, aspectRatio: "4/3", borderRadius: 10, background: "linear-gradient(135deg, #fee2e2, #fff)", border: "1px solid #fecaca", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Hammer size={48} color="#fe4545" strokeWidth={1.4} />
      </div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, padding: "0 22px 22px" }}>
      {["Emergency", "Drain Cleaning", "Water Heaters"].map(s => (
        <div key={s} style={{ background: "#fff", border: "1px solid #e2e8f0", padding: 10, borderRadius: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#0f172a" }}>{s}</div>
          <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>From $89</div>
        </div>
      ))}
    </div>
  </div>
);

// ──────────────────────────────────────────────────────────────────────
// PRICE SLAB — full bleed red
// ──────────────────────────────────────────────────────────────────────
const PriceSlab = ({ onCTA }) => (
  <section style={{
    background: "#fe4545", color: "#fff",
    padding: "120px 24px", position: "relative", overflow: "hidden",
  }}>
    {/* decorative blur circles */}
    <div style={{ position: "absolute", top: -100, left: -100, width: 400, height: 400, borderRadius: 9999, background: "#ff8585", filter: "blur(80px)", opacity: 0.5 }} />
    <div style={{ position: "absolute", bottom: -150, right: -150, width: 500, height: 500, borderRadius: 9999, background: "#cc2525", filter: "blur(100px)", opacity: 0.5 }} />

    <div style={{ maxWidth: 1152, margin: "0 auto", position: "relative", textAlign: "center" }}>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.18em", marginBottom: 24, opacity: 0.85 }}>
        ONE PRICE · NO TIERS · NO TRICKS
      </div>
      <div style={{
        fontSize: "clamp(120px, 22vw, 280px)", fontWeight: 900,
        letterSpacing: "-0.05em", lineHeight: 0.85, margin: "0 0 12px",
        textShadow: "0 8px 30px rgba(0,0,0,.15)",
      }}>
        $15<span style={{ fontSize: "0.35em", letterSpacing: "0", fontWeight: 700, opacity: 0.7, marginLeft: 8, verticalAlign: "top" }}>/mo</span>
      </div>
      <div style={{
        fontSize: "clamp(20px, 2.5vw, 28px)", fontWeight: 600, lineHeight: 1.4,
        maxWidth: 720, margin: "0 auto 36px", opacity: 0.95, fontStyle: "italic",
      }}>
        Hosting, domain, AI edits, and an actual person on the other end of an email. Cancel anytime — really.
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 16, maxWidth: 760, margin: "0 auto 40px",
      }}>
        {[
          "Custom domain",
          "Unlimited AI edits",
          "Mobile-first design",
          "Forms + reviews",
          "Lighthouse 95+ speed",
          "Real human support",
          "Daily backups",
          "No ad surprises",
        ].map(f => (
          <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
            <div style={{ width: 20, height: 20, borderRadius: 9999, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
              <Check size={12} color="#fe4545" />
            </div>
            <span style={{ textAlign: "left" }}>{f}</span>
          </div>
        ))}
      </div>
      <button onClick={onCTA} style={{
        background: "#fff", color: "#fe4545", border: 0,
        padding: "18px 36px", borderRadius: 9999,
        fontFamily: "inherit", fontWeight: 800, fontSize: 17, cursor: "pointer",
        boxShadow: "0 20px 40px -10px rgba(0,0,0,.3)",
        display: "inline-flex", alignItems: "center", gap: 10,
        transition: "transform .2s",
      }}
      onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"}
      onMouseLeave={(e) => e.currentTarget.style.transform = "none"}
      >
        Start Building — Free <ArrowRight size={18} />
      </button>
    </div>
  </section>
);

// ──────────────────────────────────────────────────────────────────────
// CLOSING
// ──────────────────────────────────────────────────────────────────────
const Closing = ({ onCTA }) => (
  <section style={{ background: "#0f172a", color: "#fff", padding: "120px 24px", position: "relative", overflow: "hidden" }}>
    <div style={{ position: "absolute", top: -200, left: "50%", transform: "translateX(-50%)", width: 600, height: 600, borderRadius: 9999, background: "#fe4545", filter: "blur(140px)", opacity: 0.18 }} />

    <div style={{ maxWidth: 900, margin: "0 auto", position: "relative", textAlign: "center" }}>
      <h2 style={{
        fontSize: "clamp(40px, 6.5vw, 88px)", fontWeight: 900,
        letterSpacing: "-0.03em", lineHeight: 0.98, margin: "0 0 28px",
      }}>
        Stop waiting.<br/>
        <span style={{ color: "#fe4545" }}>Get online today.</span>
      </h2>
      <p style={{ fontSize: 19, color: "#cbd5e1", lineHeight: 1.55, margin: "0 0 36px", maxWidth: 560, marginInline: "auto" }}>
        The customers looking for you right now are finding someone else. Ten minutes from now, that doesn't have to be true.
      </p>
      <button onClick={onCTA} style={{
        background: "#fe4545", color: "#fff", border: 0,
        padding: "18px 36px", borderRadius: 9999,
        fontFamily: "inherit", fontWeight: 800, fontSize: 16, cursor: "pointer",
        boxShadow: "0 20px 40px -10px rgba(254,69,69,.5)",
        display: "inline-flex", alignItems: "center", gap: 10,
      }}>
        Start Your Free Website <ArrowRight size={17} />
      </button>
      <div style={{ marginTop: 24, fontSize: 13, color: "#64748b" }}>
        No credit card. Free until you publish.
      </div>
    </div>
  </section>
);

Object.assign(window, {
  HeroSlab, BuilderDemo, FakeSitePreview, ProofStrip, ThreeReasons,
  BeforeAfter, OldSiteMock, KeystoneSiteMock, PriceSlab, Closing, Loader,
});
