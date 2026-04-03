import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// ═══════════════════════════════════════════
// SUPABASE CLOUD SYNC
// ═══════════════════════════════════════════
const cloud = {
  clean(url) { return url.replace(/\/+$/, ""); },
  async save(url, key, userId, data) {
    const base = cloud.clean(url);
    const res = await fetch(`${base}/rest/v1/flashcard_state`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({ user_id: userId, data: JSON.stringify(data), updated_at: new Date().toISOString() }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Save failed (${res.status}): ${err}`);
    }
    return true;
  },
  async load(url, key, userId) {
    const base = cloud.clean(url);
    const res = await fetch(`${base}/rest/v1/flashcard_state?user_id=eq.${userId}&select=data,updated_at`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Load failed (${res.status}): ${err}`);
    }
    const rows = await res.json();
    if (rows.length === 0) return null;
    return { data: JSON.parse(rows[0].data), updatedAt: rows[0].updated_at };
  },
  async test(url, key) {
    const base = cloud.clean(url);
    const res = await fetch(`${base}/rest/v1/flashcard_state?select=user_id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Connection failed (${res.status}): ${err}`);
    }
    return true;
  },
};

// ═══════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════
const CATS = [
  { id: "allergy-immunology", name: "Allergy & Immunology", icon: "🛡", color: "#E9C46A", short: "Immuno" },
  { id: "anatomy", name: "Anatomy", icon: "🦴", color: "#8D99AE", short: "Anat" },
  { id: "biochemistry", name: "Biochemistry", icon: "⚗", color: "#F4A261", short: "Biochem" },
  { id: "cardiology", name: "Cardiology", icon: "♥", color: "#E63946", short: "Cardio" },
  { id: "dermatology", name: "Dermatology", icon: "🩹", color: "#DDA0DD", short: "Derm" },
  { id: "ent", name: "Ear, Nose & Throat", icon: "👂", color: "#C8B6A6", short: "ENT" },
  { id: "embryology", name: "Embryology", icon: "🧬", color: "#A8DADC", short: "Embryo" },
  { id: "endocrinology", name: "Endocrinology", icon: "⚖", color: "#6D6875", short: "Endo" },
  { id: "gastroenterology", name: "Gastroenterology", icon: "🫁", color: "#E07A5F", short: "GI" },
  { id: "gynecology", name: "Gynecology", icon: "♀", color: "#F28482", short: "Gyn" },
  { id: "hematology-oncology", name: "Hematology & Oncology", icon: "🩸", color: "#D62828", short: "HemOnc" },
  { id: "infectious-diseases", name: "Infectious Diseases", icon: "🦠", color: "#90BE6D", short: "ID" },
  { id: "male-reproductive", name: "Male Reproductive", icon: "♂", color: "#577590", short: "MaleRep" },
  { id: "nephrology", name: "Nephrology", icon: "🫘", color: "#2A9D8F", short: "Renal" },
  { id: "neurology", name: "Neurology", icon: "🧠", color: "#457B9D", short: "Neuro" },
  { id: "obstetrics", name: "Obstetrics", icon: "🤰", color: "#FFB4A2", short: "OB" },
  { id: "ophthalmology", name: "Ophthalmology", icon: "👁", color: "#48CAE4", short: "Ophtho" },
  { id: "osteopathic", name: "Osteopathic Principles", icon: "🤲", color: "#B5838D", short: "OMM" },
  { id: "pharmacology", name: "Pharmacology", icon: "💊", color: "#7209B7", short: "Pharm" },
  { id: "preclinical", name: "Preclinical/Basic Sciences", icon: "🔬", color: "#3A86A7", short: "Basic" },
  { id: "psychiatry", name: "Psychiatry", icon: "🧩", color: "#9B5DE5", short: "Psych" },
  { id: "pulmonary", name: "Pulmonary & Critical Care", icon: "🌬", color: "#43AA8B", short: "Pulm" },
  { id: "rheumatology", name: "Rheumatology/Orthopedics", icon: "🦿", color: "#F8961E", short: "Rheum" },
  { id: "toxicology", name: "Toxicology", icon: "☠", color: "#FF6B6B", short: "Tox" },
];
const getCat = (id) => CATS.find(c => c.id === id) || CATS[19];

// ═══════════════════════════════════════════
// SRS ENGINE
// ═══════════════════════════════════════════
const SRS = {
  next(c, r) {
    const now = Date.now(), base = { hard: 3600000, good: 86400000, easy: 604800000 }, mult = { hard: 1, good: 1.5, easy: 2.5 };
    const rc = (c.reviewCount || 0) + 1;
    return { ...c, lastReviewed: now, nextReview: now + base[r] * Math.pow(mult[r], Math.min(rc - 1, 6)), reviewCount: rc, lastRating: r, ratings: [...(c.ratings || []), { rating: r, ts: now }], streak: r === "hard" ? 0 : (c.streak || 0) + 1 };
  },
  isDue: (c) => !c.nextReview || Date.now() >= c.nextReview,
  isOverdue: (c) => c.nextReview && Date.now() > c.nextReview + 86400000,
};

// ═══════════════════════════════════════════
// SAMPLE CARDS (1 per category)
// ═══════════════════════════════════════════
const SAMPLES = [
  { id:"s01", front:"What are the 4 types of hypersensitivity reactions?", back:"Type I: IgE-mediated (anaphylaxis)\nType II: Cytotoxic IgG/IgM (autoimmune hemolytic anemia)\nType III: Immune complex (SLE, serum sickness)\nType IV: Delayed T-cell (TB test, contact dermatitis)", category:"allergy-immunology", tags:["hypersensitivity","high-yield"], difficulty:"medium" },
  { id:"s02", front:"What passes through the foramen ovale of the skull?", back:"CN V3 (mandibular branch of trigeminal), accessory meningeal artery, lesser petrosal nerve.", category:"anatomy", tags:["cranial-nerves","skull-foramina"], difficulty:"hard" },
  { id:"s03", front:"What enzyme is deficient in PKU?", back:"Phenylalanine hydroxylase (PAH) — converts Phe → Tyr. Requires BH4 cofactor. AR. Musty odor. Tx: Phe-restricted diet.", category:"biochemistry", tags:["metabolism","amino-acids","high-yield"], difficulty:"easy" },
  { id:"s04", front:"What murmur is heard with mitral valve prolapse?", back:"Mid-systolic click + late systolic crescendo murmur. Standing/Valsalva → earlier click. Squatting → later click.", category:"cardiology", tags:["murmurs","valvular","high-yield"], difficulty:"medium" },
  { id:"s05", front:"Pathognomonic finding in dermatitis herpetiformis?", back:"Granular IgA deposits at dermal papillae on DIF. Pruritic vesicles on extensors. Associated with celiac. Tx: dapsone.", category:"dermatology", tags:["autoimmune","celiac"], difficulty:"medium" },
  { id:"s06", front:"Most common cause of epistaxis?", back:"Anterior from Kiesselbach's plexus (Little's area). Posterior bleeds (sphenopalatine a.) are more dangerous.", category:"ent", tags:["epistaxis"], difficulty:"easy" },
  { id:"s07", front:"From which branchial arch does the stapes derive?", back:"2nd arch (Reichert's). Also: styloid process, lesser horn hyoid, CN VII.", category:"embryology", tags:["branchial-arches","high-yield"], difficulty:"hard" },
  { id:"s08", front:"How distinguish primary from secondary adrenal insufficiency?", back:"Primary (Addison): ↓cortisol, ↑ACTH, hyperpigmentation, ↓aldosterone → hyperK\nSecondary: ↓cortisol, ↓ACTH, NO pigmentation, aldosterone preserved.", category:"endocrinology", tags:["adrenal","high-yield"], difficulty:"medium" },
  { id:"s09", front:"Zones of hepatic injury in acetaminophen toxicity?", back:"Zone 3 (centrilobular) — highest CYP450 (CYP2E1). Tx: N-acetylcysteine (replenishes glutathione).", category:"gastroenterology", tags:["liver","toxicology","high-yield"], difficulty:"medium" },
  { id:"s10", front:"Most common cause of secondary amenorrhea?", back:"Pregnancy! Then: hypothalamic amenorrhea, PCOS, hyperprolactinemia, thyroid disease.", category:"gynecology", tags:["amenorrhea","high-yield"], difficulty:"easy" },
  { id:"s11", front:"Peripheral blood smear finding in DIC?", back:"Schistocytes (helmet cells) from MAHA. Also: ↑PT/PTT, ↓plt, ↓fibrinogen, ↑D-dimer.", category:"hematology-oncology", tags:["coagulopathy","smear","high-yield"], difficulty:"medium" },
  { id:"s12", front:"What organism causes rice-water stools?", back:"Vibrio cholerae — cholera toxin activates Gs → ↑cAMP → Cl⁻ secretion. Tx: ORS, doxycycline.", category:"infectious-diseases", tags:["diarrhea","toxins","high-yield"], difficulty:"easy" },
  { id:"s13", front:"Most common cause of male infertility?", back:"Varicocele — dilated pampiniform plexus (usually left). 'Bag of worms' on exam.", category:"male-reproductive", tags:["infertility"], difficulty:"medium" },
  { id:"s14", front:"How calculate FeNa?", back:"FeNa = (UNa × PCr)/(PNa × UCr) × 100\n<1% = prerenal\n>2% = intrinsic (ATN)\nDiuretics invalidate → use FeUrea.", category:"nephrology", tags:["AKI","formulas","high-yield"], difficulty:"hard" },
  { id:"s15", front:"Classic triad of normal pressure hydrocephalus?", back:"Wet, Wacky, Wobbly: urinary incontinence, dementia, gait apraxia. Tx: VP shunt.", category:"neurology", tags:["hydrocephalus","dementia","high-yield"], difficulty:"medium" },
  { id:"s16", front:"What defines preeclampsia vs eclampsia?", back:"Preeclampsia: HTN ≥140/90 + proteinuria after 20wk.\nEclampsia: + seizures. Tx: MgSO4, delivery.", category:"obstetrics", tags:["hypertension","pregnancy","high-yield"], difficulty:"medium" },
  { id:"s17", front:"Most common cause of painless vision loss in elderly?", back:"AMD. Dry (90%): drusen. Wet (10%): choroidal neovasc → anti-VEGF.", category:"ophthalmology", tags:["vision-loss","retina"], difficulty:"medium" },
  { id:"s18", front:"What is the Still technique in OMM?", back:"Articulatory: position at tissue balance (indirect) then quick thrust through restriction (direct).", category:"osteopathic", tags:["OMT-techniques"], difficulty:"hard" },
  { id:"s19", front:"Mechanism of action of digoxin?", back:"Inhibits Na⁺/K⁺ ATPase → ↑Na⁺ → ↓Na⁺/Ca²⁺ exchange → ↑Ca²⁺ → ↑contractility. Also ↑vagal tone.", category:"pharmacology", tags:["cardiac-glycosides","mechanisms","high-yield"], difficulty:"medium" },
  { id:"s20", front:"What blotting technique detects DNA?", back:"SNoW DRoP: Southern=DNA, Northern=RNA, Western=Protein (confirms HIV).", category:"preclinical", tags:["molecular-biology","lab-techniques","high-yield"], difficulty:"easy" },
  { id:"s21", front:"Neurotransmitter changes in depression?", back:"↓Serotonin, ↓NE, ↓Dopamine. SSRIs/SNRIs/TCAs/MAOIs increase monoamine availability.", category:"psychiatry", tags:["mood-disorders","neurotransmitters"], difficulty:"easy" },
  { id:"s22", front:"What is the A-a gradient formula?", back:"A-a = PAO₂ - PaO₂. PAO₂ = FiO₂(Patm-PH₂O) - PaCO₂/0.8.\nElevated: V/Q mismatch, diffusion impairment, shunt.", category:"pulmonary", tags:["blood-gases","formulas","high-yield"], difficulty:"hard" },
  { id:"s23", front:"Most specific autoantibody for RA?", back:"Anti-CCP. RF (IgM vs IgG Fc) is sensitive but not specific.", category:"rheumatology", tags:["autoantibodies","arthritis","high-yield"], difficulty:"medium" },
  { id:"s24", front:"Antidote for organophosphate poisoning?", back:"Atropine + Pralidoxime/2-PAM.\nDUMBBELSS: Diarrhea, Urination, Miosis, Bradycardia, Bronchospasm, Emesis, Lacrimation, Salivation, Sweating.", category:"toxicology", tags:["antidotes","cholinergic","high-yield"], difficulty:"medium" },
];

// ═══════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════
const uid = () => Math.random().toString(36).slice(2, 10);
const fmtDate = (ts) => { if (!ts) return "Never"; const d = Date.now() - ts; if (d < 60000) return "Just now"; if (d < 3600000) return `${Math.floor(d / 60000)}m ago`; if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`; if (d < 604800000) return `${Math.floor(d / 86400000)}d ago`; return new Date(ts).toLocaleDateString(); };

const store = {
  save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  load(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
};

// ═══════════════════════════════════════════
// SUPABASE CONFIG (hardcoded — anon key is safe, RLS handles security)
// ═══════════════════════════════════════════
const SUPABASE_URL = "https://gqlmwdhpznxwdebnwnoq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxbG13ZGhwem54d2RlYm53bm9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTk1NjgsImV4cCI6MjA5MDczNTU2OH0.CJHSEAhXzhqpW9BPyumbzS3yth8RevhnsM-kVOY59lk";

// ═══════════════════════════════════════════
// APP
// ═══════════════════════════════════════════
export default function App() {
  const [view, setView] = useState("dashboard");
  const [cards, setCards] = useState([]);
  const [log, setLog] = useState([]);
  const [ready, setReady] = useState(false);
  const [queue, setQueue] = useState([]);
  const [qi, setQi] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [session, setSession] = useState({ n: 0, ok: 0, t: 0 });
  const [selCat, setSelCat] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [dailyTarget, setDailyTarget] = useState(30);
  const [newCard, setNewCard] = useState({ front: "", back: "", category: "", tags: "", difficulty: "medium" });
  const [importPreview, setImportPreview] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [cloudUser, setCloudUser] = useState("khalid");
  const [syncStatus, setSyncStatus] = useState("off");
  const [showSetup, setShowSetup] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const syncTimer = useRef(null);
  const fileRef = useRef(null);
  const touchRef = useRef({ x: 0, y: 0, t: 0 });

  // ── Load (local + try cloud) ──
  useEffect(() => {
    (async () => {
      const s = store.load("usmle-v3");
      if (s) {
        setCards(s.cards || []); setLog(s.log || []); setDailyTarget(s.dailyTarget || 30);
        if (s.cloudUser) setCloudUser(s.cloudUser);
        setLastSync(s.lastSync || null);
      } else {
        // First load: try pulling from cloud first
        try {
          const r = await cloud.load(SUPABASE_URL, SUPABASE_KEY, "khalid");
          if (r && r.data.cards?.length) {
            setCards(r.data.cards); setLog(r.data.log || []);
            if (r.data.dailyTarget) setDailyTarget(r.data.dailyTarget);
            setLastSync(Date.now()); setSyncStatus("synced");
          } else {
            setCards(SAMPLES.map(c => ({ ...c, nextReview: null, lastReviewed: null, reviewCount: 0, ratings: [], streak: 0 })));
          }
        } catch {
          setCards(SAMPLES.map(c => ({ ...c, nextReview: null, lastReviewed: null, reviewCount: 0, ratings: [], streak: 0 })));
        }
      }
      setReady(true);
    })();
  }, []);

  // ── Local persist ──
  useEffect(() => {
    if (!ready) return;
    store.save("usmle-v3", { cards, log, dailyTarget, cloudUser, lastSync });
  }, [cards, log, dailyTarget, cloudUser, lastSync, ready]);

  // ── Auto cloud sync (always on) ──
  const cloudSync = useCallback(async (cd, lg) => {
    if (!cloudUser) return;
    setSyncStatus("syncing");
    try {
      await cloud.save(SUPABASE_URL, SUPABASE_KEY, cloudUser, { cards: cd, log: lg, dailyTarget, syncedAt: Date.now() });
      setSyncStatus("synced"); setLastSync(Date.now());
    } catch (e) { console.error("Sync:", e); setSyncStatus("error"); }
  }, [cloudUser, dailyTarget]);

  useEffect(() => {
    if (!ready || !cloudUser) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => cloudSync(cards, log), 3000);
    return () => { if (syncTimer.current) clearTimeout(syncTimer.current); };
  }, [cards, log, ready, cloudUser, cloudSync]);

  const pullFromCloud = useCallback(async () => {
    setSyncStatus("syncing");
    try {
      const r = await cloud.load(SUPABASE_URL, SUPABASE_KEY, cloudUser);
      if (!r) { notify("No cloud data found"); setSyncStatus("synced"); return; }
      setCards(r.data.cards || []); setLog(r.data.log || []);
      if (r.data.dailyTarget) setDailyTarget(r.data.dailyTarget);
      setSyncStatus("synced"); setLastSync(Date.now()); notify("Pulled from cloud!");
    } catch (e) { setSyncStatus("error"); notify("Pull failed: " + (e.message || "").slice(0, 60)); }
  }, [cloudUser]);

  const pushToCloud = useCallback(async () => {
    await cloudSync(cards, log);
    notify(syncStatus === "synced" ? "Pushed to cloud!" : "Push failed");
  }, [cloudSync, cards, log, syncStatus]);

  // ── Computed ──
  const due = useMemo(() => cards.filter(SRS.isDue), [cards]);
  const overdue = useMemo(() => cards.filter(SRS.isOverdue), [cards]);
  const todayN = useMemo(() => { const t = new Date().toDateString(); return log.filter(l => new Date(l.ts).toDateString() === t).length; }, [log]);
  const weekData = useMemo(() => { const d = []; for (let i = 6; i >= 0; i--) { const dt = new Date(); dt.setDate(dt.getDate() - i); const ds = dt.toDateString(); d.push({ day: dt.toLocaleDateString("en", { weekday: "narrow" }), n: log.filter(l => new Date(l.ts).toDateString() === ds).length }); } return d; }, [log]);
  const retention = useMemo(() => { const r = log.slice(-100); return r.length ? Math.round(r.filter(l => l.r !== "hard").length / r.length * 100) : 0; }, [log]);
  const catStats = useMemo(() => { const m = {}; CATS.forEach(c => { m[c.id] = { total: 0, due: 0, mastered: 0 }; }); cards.forEach(c => { if (m[c.category]) { m[c.category].total++; if (SRS.isDue(c)) m[c.category].due++; if ((c.streak || 0) >= 3) m[c.category].mastered++; } }); return m; }, [cards]);
  const weakTopics = useMemo(() => { const ts = {}; cards.forEach(c => (c.tags || []).forEach(tag => { if (!ts[tag]) ts[tag] = { t: 0, h: 0 }; ts[tag].t += c.reviewCount || 0; ts[tag].h += (c.ratings || []).filter(r => r.rating === "hard").length; })); return Object.entries(ts).filter(([, v]) => v.t > 0).map(([tag, v]) => ({ tag, rate: Math.round(v.h / v.t * 100), t: v.t })).sort((a, b) => b.rate - a.rate).slice(0, 10); }, [cards]);

  // ── Actions ──
  const notify = (m) => { setToast(m); setTimeout(() => setToast(null), 2500); };
  const startReview = useCallback((cs) => { if (!cs.length) { notify("No cards to review!"); return; } setQueue([...cs].sort(() => Math.random() - 0.5)); setQi(0); setFlipped(false); setSession({ n: 0, ok: 0, t: Date.now() }); setView("review"); }, []);
  const rate = useCallback((r) => { const c = queue[qi]; if (!c) return; setCards(prev => prev.map(x => x.id === c.id ? SRS.next(x, r) : x)); setLog(prev => [...prev, { cid: c.id, r, ts: Date.now() }]); setSession(prev => ({ ...prev, n: prev.n + 1, ok: r !== "hard" ? prev.ok + 1 : prev.ok })); setFlipped(false); if (qi < queue.length - 1) setTimeout(() => setQi(p => p + 1), 150); else setView("done"); }, [queue, qi]);

  const createCard = useCallback(() => {
    if (!newCard.front.trim() || !newCard.back.trim()) { notify("Front and back required"); return; }
    setCards(prev => [...prev, { id: uid(), front: newCard.front.trim(), back: newCard.back.trim(), category: newCard.category || "preclinical", tags: newCard.tags.split(",").map(t => t.trim().toLowerCase()).filter(Boolean), difficulty: newCard.difficulty, nextReview: null, lastReviewed: null, reviewCount: 0, ratings: [], streak: 0 }]);
    setNewCard({ front: "", back: "", category: "", tags: "", difficulty: "medium" }); setShowCreate(false); notify("Card created!");
  }, [newCard]);

  const handleFile = useCallback((e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const raw = Array.isArray(data) ? data : data.cards;
        if (!Array.isArray(raw) || !raw.length) { notify("No cards found"); return; }
        const preview = raw.map(c => ({ id: uid(), front: c.front || c.question || "", back: c.back || c.answer || "", category: c.category || c.subject || "preclinical", tags: Array.isArray(c.tags) ? c.tags.map(t => t.toLowerCase()) : (c.tags || "").split(",").map(t => t.trim().toLowerCase()).filter(Boolean), difficulty: c.difficulty || "medium", nextReview: null, lastReviewed: null, reviewCount: 0, ratings: [], streak: 0 })).filter(c => c.front && c.back);
        setImportPreview({ cards: preview, meta: { source: data.source || file.name, topic: data.topic || "", count: preview.length } }); setShowImport(true);
      } catch { notify("Invalid JSON file"); }
    };
    reader.readAsText(file); e.target.value = "";
  }, []);

  const confirmImport = useCallback(() => { if (!importPreview) return; setCards(prev => [...prev, ...importPreview.cards]); notify(`${importPreview.cards.length} cards imported!`); setImportPreview(null); setShowImport(false); }, [importPreview]);

  // Navigation
  const goNext = useCallback(() => { if (qi < queue.length - 1) { setQi(p => p + 1); setFlipped(false); } }, [qi, queue.length]);
  const goPrev = useCallback(() => { if (qi > 0) { setQi(p => p - 1); setFlipped(false); } }, [qi]);

  // Keyboard: Space=flip, ←→=nav, 1/2/3=rate
  useEffect(() => {
    const h = (e) => {
      if (view !== "review") return;
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); setFlipped(f => !f); }
      if (e.key === "ArrowRight") { e.preventDefault(); goNext(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
      if (flipped) { if (e.key === "1") rate("hard"); if (e.key === "2") rate("good"); if (e.key === "3") rate("easy"); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [view, flipped, rate, goNext, goPrev]);

  // Swipe: left=next, right=prev, tap=flip (mobile)
  const onTouchStart = useCallback((e) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  }, []);
  const onTouchEnd = useCallback((e) => {
    const t = e.changedTouches[0];
    const dx = t.clientX - touchRef.current.x;
    const dy = t.clientY - touchRef.current.y;
    const dt = Date.now() - touchRef.current.t;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) && dt < 400) {
      if (dx < 0) goNext(); else goPrev();
    }
  }, [goNext, goPrev]);

  if (!ready) return <div style={S.loading}><div style={{ fontSize: 48, animation: "pulse 1.5s infinite" }}>🩺</div><p style={S.loadText}>STEP 1 PREP</p></div>;

  const syncDot = syncStatus === "synced" ? "#2A9D8F" : syncStatus === "syncing" ? "#F4A261" : syncStatus === "error" ? "#E63946" : "#5A6478";

  return (
    <div style={S.app}>
      {toast && <div style={S.toast}>{toast}</div>}
      <input ref={fileRef} type="file" accept=".json" style={{ display: "none" }} onChange={handleFile} />

      {/* HEADER */}
      <header style={S.header}>
        <div style={S.hLeft}>
          {view !== "dashboard" && <button style={S.backBtn} onClick={() => { setView("dashboard"); setSelCat(null); }}>‹</button>}
          <h1 style={S.logo}><span style={{ color: "#2A9D8F" }}>STEP</span>1</h1>
          <div style={{ ...S.syncDot, background: syncDot }} title={`Cloud: ${syncStatus}`}>{syncStatus === "syncing" ? <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>↻</span> : syncStatus === "synced" ? "☁" : syncStatus === "error" ? "⚠" : "☁"}</div>
        </div>
        <div style={S.hRight}>
          <div style={S.badge}>🔥 {cards.filter(c => (c.streak || 0) >= 3).length}</div>
          <div style={{ ...S.badge, background: "rgba(42,157,143,0.12)", color: "#2A9D8F" }}>{todayN}/{dailyTarget}</div>
        </div>
      </header>

      <main style={{ padding: 0 }}>
        {/* DASHBOARD */}
        {view === "dashboard" && (
          <div style={S.page}>
            <button style={S.hero} onClick={() => startReview(due)}>
              <div style={S.heroGrid}>
                <div><div style={S.heroNum}>{due.length}</div><div style={S.heroLabel}>DUE NOW</div></div>
                <div style={S.heroDiv} /><div><div style={S.heroNum2}>{overdue.length}</div><div style={S.heroLabel}>OVERDUE</div></div>
                <div style={S.heroDiv} /><div><div style={S.heroNum2}>{retention}%</div><div style={S.heroLabel}>RETENTION</div></div>
              </div>
              <div style={S.heroCta}>▶ START REVIEW</div>
            </button>
            <div style={S.weekRow}>{weekData.map((d, i) => (<div key={i} style={S.weekCol}><div style={S.weekWrap}><div style={{ ...S.weekBar, height: `${Math.min(d.n / Math.max(dailyTarget, 1) * 100, 100)}%`, background: d.n >= dailyTarget ? "#2A9D8F" : d.n > 0 ? "#457B9D" : "rgba(255,255,255,0.06)" }} /></div><span style={S.weekLbl}>{d.day}</span></div>))}</div>
            <div style={S.actions}>
              <button style={S.actBtn} onClick={() => setShowCreate(true)}><span style={{ fontSize: 20 }}>✏️</span><span style={S.actLbl}>Create</span></button>
              <button style={S.actBtn} onClick={() => fileRef.current?.click()}><span style={{ fontSize: 20 }}>📥</span><span style={S.actLbl}>Import</span></button>
              <button style={S.actBtn} onClick={() => setView("analytics")}><span style={{ fontSize: 20 }}>📊</span><span style={S.actLbl}>Stats</span></button>
              <button style={S.actBtn} onClick={() => setShowSetup(true)}><span style={{ fontSize: 20 }}>☁️</span><span style={S.actLbl}>Sync</span></button>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><h3 style={S.secTitle}>SUBJECTS</h3><span style={{ fontSize: 11, color: "#5A6478" }}>{cards.length} cards</span></div>
            <div style={S.catGrid}>{CATS.map(cat => { const st = catStats[cat.id] || {}; return (<button key={cat.id} style={S.catCard} onClick={() => { setSelCat(cat.id); setView("category"); }}><div style={{ ...S.catStripe, background: cat.color }} /><div style={S.catBody}><div style={S.catTop}><span style={{ fontSize: 13 }}>{cat.icon}</span><span style={S.catName}>{cat.short}</span></div><div style={S.catBot}><span style={{ fontSize: 10, color: "#5A6478" }}>{st.total || 0}</span>{(st.due || 0) > 0 && <span style={S.catDue}>{st.due}</span>}</div></div></button>); })}</div>
          </div>
        )}

        {/* REVIEW */}
        {view === "review" && queue.length > 0 && (() => { const c = queue[qi]; const cat = getCat(c?.category); return (
          <div style={S.revWrap} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            <div style={S.revProg}><div style={S.revProgBar}><div style={{ ...S.revProgFill, width: `${(qi + 1) / queue.length * 100}%` }} /></div><span style={{ fontSize: 12, color: "#5A6478", fontWeight: 700 }}>{qi + 1}/{queue.length}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "#5A6478" }}><span style={{ width: 8, height: 8, borderRadius: 4, background: cat.color, display: "inline-block" }} />{cat.short}</div>
              <div style={S.navRow}>
                <button style={{ ...S.navArrow, opacity: qi > 0 ? 1 : 0.25 }} onClick={(e) => { e.stopPropagation(); goPrev(); }}>←</button>
                <button style={{ ...S.navArrow, opacity: qi < queue.length - 1 ? 1 : 0.25 }} onClick={(e) => { e.stopPropagation(); goNext(); }}>→</button>
              </div>
            </div>
            <div style={{ ...S.card, ...(flipped ? S.cardFlip : {}) }} onClick={() => setFlipped(f => !f)}>
              {!flipped ? (<div style={S.cardFace}><div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "center" }}>{(c?.tags || []).slice(0, 3).map(t => <span key={t} style={S.cardTag}>{t}</span>)}</div><div style={S.cardQ}>{c?.front}</div><div style={{ fontSize: 11, color: "#5A6478", letterSpacing: 1.5, textAlign: "center", textTransform: "uppercase" }}>tap or space to flip · swipe ← →</div></div>)
                : (<div style={S.cardFace}><div style={S.cardA}>{c?.back}</div></div>)}
            </div>
            {flipped && (<div style={S.rateRow}><button style={S.rHard} onClick={() => rate("hard")}><span style={{ fontSize: 22 }}>😓</span><b>Hard</b><small style={{ opacity: .6 }}>1h</small></button><button style={S.rGood} onClick={() => rate("good")}><span style={{ fontSize: 22 }}>🤔</span><b>Good</b><small style={{ opacity: .6 }}>1d</small></button><button style={S.rEasy} onClick={() => rate("easy")}><span style={{ fontSize: 22 }}>😎</span><b>Easy</b><small style={{ opacity: .6 }}>1w</small></button></div>)}
          </div>); })()}

        {/* DONE */}
        {view === "done" && (<div style={S.doneWrap}><div style={{ fontSize: 56 }}>🎯</div><h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>Session Complete</h2><div style={{ display: "flex", gap: 24, margin: "16px 0" }}><div style={{ textAlign: "center" }}><div style={S.doneNum}>{session.n}</div><div style={S.doneLbl}>Reviewed</div></div><div style={{ textAlign: "center" }}><div style={S.doneNum}>{session.n ? Math.round(session.ok / session.n * 100) : 0}%</div><div style={S.doneLbl}>Accuracy</div></div><div style={{ textAlign: "center" }}><div style={S.doneNum}>{session.t ? Math.round((Date.now() - session.t) / 60000) : 0}m</div><div style={S.doneLbl}>Time</div></div></div><button style={S.btnP} onClick={() => setView("dashboard")}>Dashboard</button>{due.length > 0 && <button style={S.btnS} onClick={() => startReview(due)}>Review {due.length} More</button>}</div>)}

        {/* CATEGORY */}
        {view === "category" && selCat && (() => { const cat = getCat(selCat); const cs = cards.filter(c => c.category === selCat); const csDue = cs.filter(SRS.isDue); return (
          <div style={S.page}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, paddingLeft: 12, position: "relative" }}><div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, borderRadius: 3, background: cat.color }} /><span style={{ fontSize: 36 }}>{cat.icon}</span><div><h2 style={{ fontSize: 20, fontWeight: 800, color: "#fff", margin: 0 }}>{cat.name}</h2><p style={{ fontSize: 12, color: "#5A6478", marginTop: 2 }}>{cs.length} cards · {csDue.length} due · {cs.filter(c => (c.streak || 0) >= 3).length} mastered</p></div></div>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}><button style={S.btnP} onClick={() => startReview(csDue)}>Review Due ({csDue.length})</button><button style={S.btnS} onClick={() => startReview(cs)}>All</button><button style={S.btnO} onClick={() => { const d = cards.filter(c => c.category === selCat); const b = new Blob([JSON.stringify({ source: "STEP1 Export", category: cat.name, cards: d.map(c => ({ front: c.front, back: c.back, category: c.category, tags: c.tags, difficulty: c.difficulty })) }, null, 2)], { type: "application/json" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = `step1-${selCat}.json`; a.click(); }}>↓</button></div>
            {cs.map(c => (<div key={c.id} style={S.listCard}><div style={{ fontSize: 13, color: "#D5D3CF", fontWeight: 500, lineHeight: 1.4 }}>{c.front.length > 90 ? c.front.slice(0, 90) + "…" : c.front}</div><div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}><span style={{ fontSize: 10, color: "#5A6478" }}>×{c.reviewCount || 0}</span><span style={{ fontSize: 10, color: "#5A6478" }}>{fmtDate(c.lastReviewed)}</span>{SRS.isDue(c) && <span style={S.catDue}>DUE</span>}</div></div>))}
          </div>); })()}

        {/* BROWSE */}
        {view === "browse" && (<div style={S.page}><h2 style={S.pageTitle}>Browse Cards</h2><input style={S.searchInput} placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} /><div style={S.filterRow}><button style={{ ...S.filterChip, ...(!filterCat ? S.filterAct : {}) }} onClick={() => setFilterCat("")}>All</button>{CATS.map(c => <button key={c.id} style={{ ...S.filterChip, ...(filterCat === c.id ? { ...S.filterAct, borderColor: c.color, color: c.color } : {}) }} onClick={() => setFilterCat(filterCat === c.id ? "" : c.id)}>{c.icon} {c.short}</button>)}</div>
          {cards.filter(c => { const ms = !search || c.front.toLowerCase().includes(search.toLowerCase()) || c.back.toLowerCase().includes(search.toLowerCase()); return ms && (!filterCat || c.category === filterCat); }).slice(0, 40).map(c => { const cat = getCat(c.category); return (<div key={c.id} style={S.browseCard}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><span style={{ fontSize: 11, fontWeight: 600, border: "1px solid " + cat.color, color: cat.color, borderRadius: 8, padding: "1px 6px" }}>{cat.icon} {cat.short}</span><button style={{ background: "none", border: "none", color: "#5A6478", cursor: "pointer", fontSize: 14 }} onClick={() => { setCards(prev => prev.filter(x => x.id !== c.id)); notify("Deleted"); }}>✕</button></div><div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 6, lineHeight: 1.4 }}>{c.front}</div><div style={{ fontSize: 12, color: "#7A8494", lineHeight: 1.5, whiteSpace: "pre-line", marginBottom: 8 }}>{c.back}</div><div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{(c.tags || []).map(t => <span key={t} style={S.tinyTag}>{t}</span>)}</div></div>); })}</div>)}

        {/* ANALYTICS */}
        {view === "analytics" && (<div style={S.page}><h2 style={S.pageTitle}>Analytics</h2>
          <div style={S.statGrid}><div style={S.statBox}><div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>{log.length}</div><div style={S.statLbl}>Reviews</div></div><div style={S.statBox}><div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>{retention}%</div><div style={S.statLbl}>Retention</div></div><div style={S.statBox}><div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>{cards.filter(c => (c.streak || 0) >= 3).length}</div><div style={S.statLbl}>Mastered</div></div></div>
          <h3 style={S.secTitle}>WEAK TOPICS</h3>
          {weakTopics.length === 0 ? <p style={S.muted}>Review more cards first</p> : weakTopics.map(w => (<div key={w.tag} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}><span style={{ fontSize: 12, color: "#D5D3CF", fontWeight: 600, width: 100, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.tag}</span><div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.04)", borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 3, width: `${w.rate}%`, background: w.rate > 50 ? "#E63946" : w.rate > 25 ? "#F4A261" : "#2A9D8F", transition: "width .5s" }} /></div><span style={{ fontSize: 11, fontWeight: 700, color: "#5A6478", width: 32, textAlign: "right" }}>{w.rate}%</span></div>))}
          <h3 style={{ ...S.secTitle, marginTop: 28 }}>BY SUBJECT</h3>
          {CATS.filter(c => (catStats[c.id]?.total || 0) > 0).map(cat => { const st = catStats[cat.id]; return (<div key={cat.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}><span style={{ fontSize: 14, width: 20, textAlign: "center", color: cat.color }}>{cat.icon}</span><span style={{ fontSize: 11, fontWeight: 600, color: "#D5D3CF", width: 50 }}>{cat.short}</span><div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.04)", borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 3, width: `${st.total ? Math.round(st.mastered / st.total * 100) : 0}%`, background: cat.color }} /></div><span style={{ fontSize: 10, color: "#5A6478", fontWeight: 700, width: 36, textAlign: "right" }}>{st.mastered}/{st.total}</span></div>); })}
          <h3 style={{ ...S.secTitle, marginTop: 28 }}>SETTINGS</h3>
          <div style={S.settingRow}><span style={{ color: "#ccc" }}>Daily target</span><div style={{ display: "flex", alignItems: "center", gap: 10 }}><button style={S.tBtn} onClick={() => setDailyTarget(Math.max(5, dailyTarget - 5))}>−</button><span style={{ fontWeight: 800, color: "#fff", minWidth: 32, textAlign: "center" }}>{dailyTarget}</span><button style={S.tBtn} onClick={() => setDailyTarget(dailyTarget + 5)}>+</button></div></div>
          <button style={{ ...S.btnO, color: "#E63946", borderColor: "rgba(230,57,70,0.3)", marginTop: 16, width: "100%" }} onClick={() => { localStorage.removeItem("usmle-v3"); window.location.reload(); }}>Reset All Data</button>
        </div>)}
      </main>

      {/* CREATE MODAL */}
      {showCreate && (<div style={S.overlay} onClick={() => setShowCreate(false)}><div style={S.modal} onClick={e => e.stopPropagation()}><div style={S.modalBar} /><h3 style={S.modalTitle}>New Flashcard</h3><label style={S.label}>Subject</label><select style={S.inp} value={newCard.category} onChange={e => setNewCard(p => ({ ...p, category: e.target.value }))}><option value="">Select…</option>{CATS.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</select><label style={S.label}>Front (Question)</label><textarea style={{ ...S.inp, minHeight: 70 }} value={newCard.front} onChange={e => setNewCard(p => ({ ...p, front: e.target.value }))} placeholder="What is…?" /><label style={S.label}>Back (Answer)</label><textarea style={{ ...S.inp, minHeight: 100 }} value={newCard.back} onChange={e => setNewCard(p => ({ ...p, back: e.target.value }))} placeholder="The mechanism…" /><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><div><label style={S.label}>Difficulty</label><select style={S.inp} value={newCard.difficulty} onChange={e => setNewCard(p => ({ ...p, difficulty: e.target.value }))}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div><div><label style={S.label}>Tags</label><input style={S.inp} value={newCard.tags} onChange={e => setNewCard(p => ({ ...p, tags: e.target.value }))} placeholder="high-yield,…" /></div></div><div style={{ display: "flex", gap: 10, marginTop: 18 }}><button style={{ ...S.btnS, flex: 1 }} onClick={() => setShowCreate(false)}>Cancel</button><button style={{ ...S.btnP, flex: 1 }} onClick={createCard}>Create</button></div></div></div>)}

      {/* IMPORT PREVIEW */}
      {showImport && importPreview && (<div style={S.overlay} onClick={() => { setShowImport(false); setImportPreview(null); }}><div style={S.modal} onClick={e => e.stopPropagation()}><div style={S.modalBar} /><h3 style={S.modalTitle}>Import Preview</h3><div style={S.importMeta}>{importPreview.meta.source && <div style={{ fontSize: 13, marginBottom: 4 }}><span style={S.muted}>Source: </span><span style={{ color: "#fff" }}>{importPreview.meta.source}</span></div>}{importPreview.meta.topic && <div style={{ fontSize: 13, marginBottom: 4 }}><span style={S.muted}>Topic: </span><span style={{ color: "#fff" }}>{importPreview.meta.topic}</span></div>}<div style={{ fontSize: 13 }}><span style={S.muted}>Cards: </span><span style={{ color: "#2A9D8F", fontWeight: 700 }}>{importPreview.cards.length}</span></div></div><div style={{ maxHeight: 260, overflowY: "auto" }}>{importPreview.cards.slice(0, 5).map((c, i) => { const cat = getCat(c.category); return (<div key={i} style={{ background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: 10, border: "1px solid rgba(255,255,255,0.04)", marginBottom: 6 }}><div style={{ display: "flex", gap: 6, marginBottom: 4, alignItems: "center" }}><span style={{ fontSize: 10, fontWeight: 600, border: "1px solid " + cat.color, color: cat.color, borderRadius: 6, padding: "0 5px" }}>{cat.icon} {cat.short}</span><span style={{ ...S.tinyTag, background: "rgba(42,157,143,0.15)", color: "#2A9D8F" }}>{c.difficulty}</span></div><div style={{ fontSize: 12, color: "#D5D3CF", lineHeight: 1.4 }}>{c.front.length > 100 ? c.front.slice(0, 100) + "…" : c.front}</div><div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 4 }}>{(c.tags || []).map(t => <span key={t} style={S.tinyTag}>{t}</span>)}</div></div>); })}{importPreview.cards.length > 5 && <p style={S.muted}>+ {importPreview.cards.length - 5} more</p>}</div><div style={{ display: "flex", gap: 10, marginTop: 16 }}><button style={{ ...S.btnS, flex: 1 }} onClick={() => { setShowImport(false); setImportPreview(null); }}>Cancel</button><button style={{ ...S.btnP, flex: 1 }} onClick={confirmImport}>Import All ({importPreview.cards.length})</button></div></div></div>)}

      {/* CLOUD SYNC */}
      {showSetup && (<div style={S.overlay} onClick={() => setShowSetup(false)}><div style={S.modal} onClick={e => e.stopPropagation()}><div style={S.modalBar} /><h3 style={S.modalTitle}>☁️ Cloud Sync</h3>
          <div style={S.importMeta}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><div style={{ width: 10, height: 10, borderRadius: 5, background: syncDot }} /><span style={{ color: "#fff", fontWeight: 700 }}>{syncStatus === "synced" ? "Connected" : syncStatus === "syncing" ? "Syncing…" : syncStatus === "error" ? "Error" : "Ready"}</span></div>
            <div style={{ fontSize: 12, color: "#5A6478" }}>Last sync: {fmtDate(lastSync)}</div>
            <div style={{ fontSize: 12, color: "#5A6478", marginTop: 2 }}>User: {cloudUser}</div>
            <div style={{ fontSize: 12, color: "#5A6478", marginTop: 2 }}>Cards: {cards.length} · Reviews: {log.length}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button style={{ ...S.btnP, width: "100%" }} onClick={() => { pushToCloud(); setShowSetup(false); }}>⬆ Push to Cloud</button>
            <button style={{ ...S.btnS, width: "100%" }} onClick={() => { pullFromCloud(); setShowSetup(false); }}>⬇ Pull from Cloud (load on other devices)</button>
          </div>
          <label style={S.label}>Change User ID</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input style={{ ...S.inp, flex: 1 }} value={cloudUser} onChange={e => setCloudUser(e.target.value.trim())} placeholder="khalid" />
          </div>
      </div></div>)}

      {/* NAV */}
      {view !== "review" && (<nav style={S.nav}>
        <button style={{ ...S.navBtn, ...(view === "dashboard" ? S.navAct : {}) }} onClick={() => { setView("dashboard"); setSelCat(null); }}><span style={S.navIco}>🏠</span><span style={S.navLbl}>Home</span></button>
        <button style={{ ...S.navBtn, ...(["category", "browse"].includes(view) ? S.navAct : {}) }} onClick={() => setView("browse")}><span style={S.navIco}>📚</span><span style={S.navLbl}>Cards</span></button>
        <button style={S.navCenter} onClick={() => startReview(due)}><span style={{ color: "#fff", fontSize: 20, marginLeft: 2 }}>▶</span></button>
        <button style={S.navBtn} onClick={() => fileRef.current?.click()}><span style={S.navIco}>📥</span><span style={S.navLbl}>Import</span></button>
        <button style={{ ...S.navBtn, ...(view === "analytics" ? S.navAct : {}) }} onClick={() => setView("analytics")}><span style={S.navIco}>📊</span><span style={S.navLbl}>Stats</span></button>
      </nav>)}
    </div>
  );
}

// ═══════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════
const S = {
  app: { fontFamily: "'DM Sans',sans-serif", background: "#080C14", color: "#D5D3CF", minHeight: "100vh", maxWidth: 480, margin: "0 auto", position: "relative", paddingBottom: 80 },
  loading: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "#080C14" },
  loadText: { color: "#5A6478", fontSize: 12, letterSpacing: 4, marginTop: 16, fontWeight: 700 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px 10px", borderBottom: "1px solid rgba(255,255,255,0.04)", position: "sticky", top: 0, background: "#080C14", zIndex: 100 },
  hLeft: { display: "flex", alignItems: "center", gap: 10 }, hRight: { display: "flex", alignItems: "center", gap: 8 },
  backBtn: { background: "none", border: "none", color: "#5A6478", fontSize: 26, cursor: "pointer", padding: "2px 6px", lineHeight: 1 },
  logo: { fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: 2, lineHeight: 1, margin: 0 },
  syncDot: { width: 24, height: 24, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", fontWeight: 700 },
  badge: { background: "rgba(255,152,0,0.12)", color: "#FFB74D", padding: "3px 10px", borderRadius: 10, fontSize: 12, fontWeight: 700 },
  page: { padding: "14px 18px" }, pageTitle: { fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 16 },
  hero: { width: "100%", background: "linear-gradient(135deg,#0F1524,#0A0F1C)", border: "1px solid rgba(42,157,143,0.2)", borderRadius: 16, padding: "22px 20px", cursor: "pointer", display: "block", color: "inherit", marginBottom: 16, textAlign: "center" },
  heroGrid: { display: "flex", justifyContent: "space-around", alignItems: "center", marginBottom: 14 },
  heroNum: { fontSize: 42, fontWeight: 900, color: "#2A9D8F", lineHeight: 1 }, heroNum2: { fontSize: 24, fontWeight: 800, color: "#fff", lineHeight: 1 }, heroLabel: { fontSize: 9, color: "#5A6478", letterSpacing: 2, marginTop: 4, fontWeight: 700 }, heroDiv: { width: 1, height: 40, background: "rgba(255,255,255,0.06)" }, heroCta: { fontSize: 12, fontWeight: 800, color: "#2A9D8F", letterSpacing: 3 },
  weekRow: { display: "flex", gap: 4, marginBottom: 18, padding: "0 2px" }, weekCol: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }, weekWrap: { height: 40, width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center" }, weekBar: { width: "100%", borderRadius: "3px 3px 0 0", minHeight: 2, transition: "height .3s" }, weekLbl: { fontSize: 9, color: "#5A6478", fontWeight: 700 },
  actions: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 22 }, actBtn: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: "12px 4px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: "#D5D3CF" }, actLbl: { fontSize: 11, fontWeight: 600 },
  secTitle: { fontSize: 11, fontWeight: 700, color: "#5A6478", letterSpacing: 2.5, marginBottom: 10 },
  catGrid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 20 }, catCard: { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 10, cursor: "pointer", overflow: "hidden", display: "block", color: "inherit", padding: 0, textAlign: "left" }, catStripe: { height: 3 }, catBody: { padding: "10px 8px 8px" }, catTop: { display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }, catName: { fontSize: 11, fontWeight: 700, color: "#fff" }, catBot: { display: "flex", justifyContent: "space-between", alignItems: "center" }, catDue: { fontSize: 9, color: "#2A9D8F", fontWeight: 700, background: "rgba(42,157,143,0.12)", padding: "1px 5px", borderRadius: 6 },
  revWrap: { padding: "14px 18px", display: "flex", flexDirection: "column", minHeight: "calc(100vh - 60px)" }, revProg: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }, revProgBar: { flex: 1, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }, revProgFill: { height: "100%", background: "#2A9D8F", borderRadius: 3, transition: "width .3s" },
  card: { flex: 1, background: "linear-gradient(145deg,#111828,#0B1018)", borderRadius: 18, border: "1px solid rgba(69,123,157,0.15)", padding: "26px 22px", display: "flex", flexDirection: "column", justifyContent: "center", cursor: "pointer", minHeight: 280, transition: "all .15s", userSelect: "none" }, cardFlip: { background: "linear-gradient(145deg,#0C1A1E,#081216)", borderColor: "rgba(42,157,143,0.2)" }, cardFace: { display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, gap: 16 }, cardTag: { background: "rgba(69,123,157,0.12)", color: "#457B9D", padding: "2px 8px", borderRadius: 8, fontSize: 10, fontWeight: 600 }, cardQ: { fontSize: 18, fontWeight: 600, lineHeight: 1.55, color: "#fff", textAlign: "center" }, cardA: { fontSize: 15, lineHeight: 1.7, color: "#B8C6C0", whiteSpace: "pre-line" },
  rateRow: { display: "flex", gap: 8, marginTop: 18 }, rHard: { flex: 1, background: "rgba(230,57,70,0.08)", border: "1px solid rgba(230,57,70,0.25)", borderRadius: 14, padding: "12px 6px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: "#E63946", fontSize: 13 }, rGood: { flex: 1, background: "rgba(69,123,157,0.08)", border: "1px solid rgba(69,123,157,0.25)", borderRadius: 14, padding: "12px 6px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: "#457B9D", fontSize: 13 }, rEasy: { flex: 1, background: "rgba(42,157,143,0.08)", border: "1px solid rgba(42,157,143,0.25)", borderRadius: 14, padding: "12px 6px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: "#2A9D8F", fontSize: 13 },
  navRow: { display: "flex", gap: 6, alignItems: "center" }, navArrow: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, width: 36, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#D5D3CF", fontSize: 16, fontWeight: 600, transition: "all .15s" },
  doneWrap: { padding: "60px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }, doneNum: { fontSize: 26, fontWeight: 900, color: "#2A9D8F" }, doneLbl: { fontSize: 10, color: "#5A6478", letterSpacing: 1, textTransform: "uppercase", marginTop: 2 },
  listCard: { background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: 12, border: "1px solid rgba(255,255,255,0.04)", marginBottom: 6 },
  searchInput: { width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "10px 14px", color: "#D5D3CF", fontSize: 14, outline: "none", marginBottom: 10, boxSizing: "border-box" }, filterRow: { display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 14, maxHeight: 80, overflowY: "auto" }, filterChip: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "4px 10px", color: "#5A6478", fontSize: 11, cursor: "pointer", fontWeight: 500, whiteSpace: "nowrap" }, filterAct: { background: "rgba(42,157,143,0.12)", borderColor: "#2A9D8F", color: "#2A9D8F" },
  browseCard: { background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: 14, border: "1px solid rgba(255,255,255,0.04)", marginBottom: 8 }, tinyTag: { background: "rgba(255,255,255,0.05)", color: "#5A6478", padding: "1px 6px", borderRadius: 6, fontSize: 10 },
  statGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 24 }, statBox: { background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: "16px 8px", textAlign: "center", border: "1px solid rgba(255,255,255,0.04)" }, statLbl: { fontSize: 9, color: "#5A6478", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 3 },
  settingRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }, tBtn: { background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 7, width: 28, height: 28, color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  muted: { fontSize: 12, color: "#5A6478", fontStyle: "italic" },
  btnP: { background: "#2A9D8F", color: "#fff", border: "none", borderRadius: 12, padding: "12px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", flex: 1 }, btnS: { background: "rgba(69,123,157,0.12)", color: "#457B9D", border: "1px solid rgba(69,123,157,0.2)", borderRadius: 12, padding: "12px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer" }, btnO: { background: "transparent", color: "#5A6478", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 200, animation: "fadeIn .2s" }, modal: { background: "#111828", borderRadius: "20px 20px 0 0", padding: "12px 22px 30px", width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", animation: "slideUp .25s ease-out" }, modalBar: { width: 36, height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 4, margin: "0 auto 16px" }, modalTitle: { fontSize: 17, fontWeight: 800, color: "#fff", marginBottom: 14 }, label: { display: "block", fontSize: 10, fontWeight: 700, color: "#5A6478", letterSpacing: 1.5, marginBottom: 5, marginTop: 12, textTransform: "uppercase" }, inp: { width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 9, padding: "10px 12px", color: "#D5D3CF", fontSize: 14, outline: "none", resize: "vertical", boxSizing: "border-box" },
  importMeta: { background: "rgba(42,157,143,0.06)", borderRadius: 10, padding: 12, marginBottom: 14, border: "1px solid rgba(42,157,143,0.12)" },
  setupBox: { background: "rgba(42,157,143,0.06)", borderRadius: 12, padding: 14, marginBottom: 16, border: "1px solid rgba(42,157,143,0.12)" }, setupStep: { display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8, fontSize: 13, color: "#B8C6C0", lineHeight: 1.4 }, stepNum: { background: "#2A9D8F", color: "#fff", width: 20, height: 20, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 },
  sqlBox: { background: "rgba(0,0,0,0.3)", borderRadius: 10, padding: 12, marginBottom: 16, border: "1px solid rgba(255,255,255,0.06)" }, sqlPre: { fontSize: 11, color: "#2A9D8F", lineHeight: 1.5, whiteSpace: "pre-wrap", margin: 0, fontFamily: "monospace" },
  nav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#0B1018", borderTop: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "space-around", padding: "6px 0 10px", zIndex: 100 }, navBtn: { background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", padding: "3px 10px", color: "#5A6478" }, navAct: { color: "#2A9D8F" }, navIco: { fontSize: 18 }, navLbl: { fontSize: 9, fontWeight: 700, letterSpacing: .5, textTransform: "uppercase" }, navCenter: { background: "#2A9D8F", border: "none", borderRadius: "50%", width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginTop: -22, boxShadow: "0 4px 18px rgba(42,157,143,0.35)" },
  toast: { position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: "#2A9D8F", color: "#fff", padding: "8px 22px", borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 300, animation: "toastIn .25s ease-out", boxShadow: "0 6px 24px rgba(0,0,0,0.3)" },
};
