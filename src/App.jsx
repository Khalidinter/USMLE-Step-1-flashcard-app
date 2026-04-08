import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import CogniVaultLogo, { CogniVaultIcon } from "./CogniVaultLogo";

const SB="https://gqlmwdhpznxwdebnwnoq.supabase.co";
const SK="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxbG13ZGhwem54d2RlYm53bm9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTk1NjgsImV4cCI6MjA5MDczNTU2OH0.CJHSEAhXzhqpW9BPyumbzS3yth8RevhnsM-kVOY59lk";
const UID="khalid";
const hdrs={apikey:SK,Authorization:`Bearer ${SK}`,"Content-Type":"application/json"};
async function cloudPush(d){await fetch(`${SB}/rest/v1/flashcard_state`,{method:"POST",headers:{...hdrs,Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({user_id:UID,data:JSON.stringify(d),updated_at:new Date().toISOString()})})}
async function cloudPull(){const r=await fetch(`${SB}/rest/v1/flashcard_state?user_id=eq.${UID}&select=data`,{headers:hdrs});const rows=await r.json();if(!rows?.length)return null;return JSON.parse(rows[0].data)}
function fp(t){return(t||"").toLowerCase().replace(/[^a-z0-9]/g,"")}
function mergeCards(a,b){const m=new Map(),fps=new Set();(a||[]).forEach(c=>{m.set(c.id,c);fps.add(fp(c.front))});(b||[]).forEach(c=>{const lc=m.get(c.id);if(lc){if((c.lastReviewed||0)>(lc.lastReviewed||0))m.set(c.id,c);return}const f=fp(c.front);if(fps.has(f))return;fps.add(f);m.set(c.id,c)});return[...m.values()]}
function mergeLogs(a,b){const s=new Set((a||[]).map(l=>`${l.cid}-${l.ts}`));const m=[...(a||[])];(b||[]).forEach(r=>{if(!s.has(`${r.cid}-${r.ts}`))m.push(r)});return m.sort((a,b)=>a.ts-b.ts)}
function findDupes(nc,ec){const ex=new Set((ec||[]).map(c=>fp(c.front)));const seen=new Set();const u=[],d=[];(nc||[]).forEach(c=>{const f=fp(c.front);if(ex.has(f)||seen.has(f))d.push(c);else{u.push(c);seen.add(f)}});return{unique:u,dupes:d}}

const CATS=[
  {id:"allergy-immunology",name:"Allergy & Immunology",icon:"🛡",color:"#E9C46A",short:"Immuno"},
  {id:"anatomy",name:"Anatomy",icon:"🦴",color:"#8D99AE",short:"Anat"},
  {id:"biochemistry",name:"Biochemistry",icon:"⚗",color:"#F4A261",short:"Biochem"},
  {id:"cardiology",name:"Cardiology",icon:"♥",color:"#E63946",short:"Cardio"},
  {id:"dermatology",name:"Dermatology",icon:"🩹",color:"#DDA0DD",short:"Derm"},
  {id:"ent",name:"Ear, Nose & Throat",icon:"👂",color:"#C8B6A6",short:"ENT"},
  {id:"embryology",name:"Embryology",icon:"🧬",color:"#A8DADC",short:"Embryo"},
  {id:"endocrinology",name:"Endocrinology",icon:"⚖",color:"#6D6875",short:"Endo"},
  {id:"gastroenterology",name:"Gastroenterology",icon:"🫁",color:"#E07A5F",short:"GI"},
  {id:"genetics",name:"Genetics",icon:"🧬",color:"#00B4D8",short:"Genetics"},
  {id:"gynecology",name:"Gynecology",icon:"♀",color:"#F28482",short:"Gyn"},
  {id:"hematology-oncology",name:"Hematology & Oncology",icon:"🩸",color:"#D62828",short:"HemOnc"},
  {id:"infectious-diseases",name:"Infectious Diseases",icon:"🦠",color:"#90BE6D",short:"ID"},
  {id:"male-reproductive",name:"Male Reproductive",icon:"♂",color:"#577590",short:"MaleRep"},
  {id:"nephrology",name:"Nephrology",icon:"🫘",color:"#2A9D8F",short:"Renal"},
  {id:"neurology",name:"Neurology",icon:"🧠",color:"#457B9D",short:"Neuro"},
  {id:"obstetrics",name:"Obstetrics",icon:"🤰",color:"#FFB4A2",short:"OB"},
  {id:"ophthalmology",name:"Ophthalmology",icon:"👁",color:"#48CAE4",short:"Ophtho"},
  {id:"osteopathic",name:"Osteopathic Principles",icon:"🤲",color:"#B5838D",short:"OMM"},
  {id:"pediatrics",name:"Pediatrics",icon:"👶",color:"#FFD166",short:"Peds"},
  {id:"pharmacology",name:"Pharmacology",icon:"💊",color:"#7209B7",short:"Pharm"},
  {id:"preclinical",name:"Preclinical/Basic Sciences",icon:"🔬",color:"#3A86A7",short:"Basic"},
  {id:"psychiatry",name:"Psychiatry",icon:"🧩",color:"#9B5DE5",short:"Psych"},
  {id:"pulmonary",name:"Pulmonary & Critical Care",icon:"🌬",color:"#43AA8B",short:"Pulm"},
  {id:"rheumatology",name:"Rheumatology/Orthopedics",icon:"🦿",color:"#F8961E",short:"Rheum"},
  {id:"statistics",name:"Biostatistics & Epidemiology",icon:"📐",color:"#4CC9F0",short:"Stats"},
  {id:"toxicology",name:"Toxicology",icon:"☠",color:"#FF6B6B",short:"Tox"},
];
const getCat=id=>CATS.find(c=>c.id===id)||CATS[21];
const SRS={
  next(c,r){const now=Date.now(),base={hard:3600000,good:86400000,easy:604800000},mult={hard:1,good:1.5,easy:2.5};const rc=(c.reviewCount||0)+1;return{...c,lastReviewed:now,nextReview:now+base[r]*Math.pow(mult[r],Math.min(rc-1,6)),reviewCount:rc,lastRating:r,ratings:[...(c.ratings||[]),{rating:r,ts:now}],streak:r==="hard"?0:(c.streak||0)+1}},
  isDue:c=>!c.nextReview||Date.now()>=c.nextReview,
  isOverdue:c=>c.nextReview&&Date.now()>c.nextReview+86400000,
  hardRate:c=>{const r=(c.ratings||[]);return r.length?Math.round(r.filter(x=>x.rating==="hard").length/r.length*100):0},
};

const SAMPLES=[
  {id:"s01",front:"What are the 4 types of hypersensitivity reactions?",back:"Type I: IgE (anaphylaxis)\nType II: Cytotoxic IgG/IgM\nType III: Immune complex (SLE)\nType IV: Delayed T-cell (TB test)",category:"allergy-immunology",tags:["hypersensitivity","high-yield"],difficulty:"medium"},
  {id:"s02",front:"What passes through the foramen ovale of the skull?",back:"CN V3, accessory meningeal artery, lesser petrosal nerve.",category:"anatomy",tags:["cranial-nerves"],difficulty:"hard"},
  {id:"s03",front:"What enzyme is deficient in PKU?",back:"Phenylalanine hydroxylase (PAH). AR. Musty odor. Tx: Phe-restricted diet.",category:"biochemistry",tags:["metabolism","high-yield"],difficulty:"easy"},
  {id:"s04",front:"What murmur is heard with mitral valve prolapse?",back:"Mid-systolic click + late systolic crescendo murmur.",category:"cardiology",tags:["murmurs","high-yield"],difficulty:"medium"},
];
const uid=()=>Math.random().toString(36).slice(2,10);
const fmtDate=ts=>{if(!ts)return"Never";const d=Date.now()-ts;if(d<60000)return"Just now";if(d<3600000)return`${Math.floor(d/60000)}m ago`;if(d<86400000)return`${Math.floor(d/3600000)}h ago`;return`${Math.floor(d/86400000)}d ago`};
const todayStr=()=>new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local timezone

export default function App(){
  const [view,setView]=useState("dashboard");
  const [cards,setCards]=useState([]);
  const [log,setLog]=useState([]);
  const [ready,setReady]=useState(false);
  const [queue,setQueue]=useState([]);
  const [qi,setQi]=useState(0);
  const [flipped,setFlipped]=useState(false);
  const [session,setSession]=useState({n:0,ok:0,t:0});
  const [selCat,setSelCat]=useState(null);
  const [showCreate,setShowCreate]=useState(false);
  const [toast,setToast]=useState(null);
  const [search,setSearch]=useState("");
  const [filterCat,setFilterCat]=useState("");
  const [dailyTarget,setDailyTarget]=useState(30);
  const [newCard,setNewCard]=useState({front:"",back:"",category:"",tags:"",difficulty:"medium"});
  const [importPreview,setImportPreview]=useState(null);
  const [showImport,setShowImport]=useState(false);
  const [syncIcon,setSyncIcon]=useState("☁");
  const [expandedCard,setExpandedCard]=useState(null);
  const [splash,setSplash]=useState(true);
  const [reviewMode,setReviewMode]=useState(null); // null=picker, "subject","weakest","random","overdue"
  const [showModePicker,setShowModePicker]=useState(false);
  const [weakViewCat,setWeakViewCat]=useState(null); // for progress drill-down
  const syncTimer=useRef(null);
  const fileRef=useRef(null);
  const touchRef=useRef({x:0});
  const notify=m=>{setToast(m);setTimeout(()=>setToast(null),2500)};

  // BOOT
  useEffect(()=>{(async()=>{
    let lc=[],ll=[],lt=30;
    try{const s=JSON.parse(localStorage.getItem("usmle-v5")||"null");if(s){lc=s.cards||[];ll=s.log||[];lt=s.dailyTarget||30;}}catch{}
    try{
      setSyncIcon("↻");const r=await cloudPull();
      if(r?.cards?.length){const mc=mergeCards(lc,r.cards);const ml=mergeLogs(ll,r.log||[]);setCards(mc);setLog(ml);setDailyTarget(r.dailyTarget||lt);await cloudPush({cards:mc,log:ml,dailyTarget:r.dailyTarget||lt});setSyncIcon("☁")}
      else if(lc.length){setCards(lc);setLog(ll);setDailyTarget(lt);await cloudPush({cards:lc,log:ll,dailyTarget:lt});setSyncIcon("☁")}
      else{const d=SAMPLES.map(c=>({...c,nextReview:null,lastReviewed:null,reviewCount:0,ratings:[],streak:0}));setCards(d);await cloudPush({cards:d,log:[],dailyTarget:30});setSyncIcon("☁")}
    }catch(e){console.error("Boot:",e);if(lc.length){setCards(lc);setLog(ll);setDailyTarget(lt)}else setCards(SAMPLES.map(c=>({...c,nextReview:null,lastReviewed:null,reviewCount:0,ratings:[],streak:0})));setSyncIcon("⚠")}
    setReady(true);
  })()},[]);

  useEffect(()=>{if(ready&&splash){const t=setTimeout(()=>setSplash(false),1200);return()=>clearTimeout(t)}},[ready,splash]);

  // Auto push
  useEffect(()=>{if(!ready)return;localStorage.setItem("usmle-v5",JSON.stringify({cards,log,dailyTarget}));if(syncTimer.current)clearTimeout(syncTimer.current);syncTimer.current=setTimeout(async()=>{try{setSyncIcon("↻");await cloudPush({cards,log,dailyTarget});setSyncIcon("☁")}catch{setSyncIcon("⚠")}},2000);return()=>{if(syncTimer.current)clearTimeout(syncTimer.current)}},[cards,log,dailyTarget,ready]);

  // Periodic pull 30s
  useEffect(()=>{if(!ready)return;const iv=setInterval(async()=>{try{const r=await cloudPull();if(r?.cards){setCards(p=>{const m=mergeCards(p,r.cards);return m.length!==p.length||m.some((c,i)=>c.lastReviewed!==p[i]?.lastReviewed)?m:p});setLog(p=>{const m=mergeLogs(p,r.log||[]);return m.length!==p.length?m:p})}}catch{}},30000);return()=>clearInterval(iv)},[ready]);

  // ═══ COMPUTED ═══
  const due=useMemo(()=>cards.filter(SRS.isDue),[cards]);
  const overdue=useMemo(()=>cards.filter(SRS.isOverdue),[cards]);
  const reviewed=useMemo(()=>cards.filter(c=>c.reviewCount>0),[cards]);
  const mastered=useMemo(()=>cards.filter(c=>(c.streak||0)>=3),[cards]);
  const todayKey=todayStr();
  const todayN=useMemo(()=>log.filter(l=>new Date(l.ts).toLocaleDateString("en-CA")===todayKey).length,[log,todayKey]);
  const weekData=useMemo(()=>{const d=[];for(let i=6;i>=0;i--){const dt=new Date();dt.setDate(dt.getDate()-i);const ds=dt.toLocaleDateString("en-CA");d.push({day:dt.toLocaleDateString("en",{weekday:"narrow"}),n:log.filter(l=>new Date(l.ts).toLocaleDateString("en-CA")===ds).length})}return d},[log]);
  const retention=useMemo(()=>{const r=log.slice(-100);return r.length?Math.round(r.filter(l=>l.r!=="hard").length/r.length*100):0},[log]);

  const catStats=useMemo(()=>{
    const m={};CATS.forEach(c=>{m[c.id]={total:0,due:0,mastered:0,reviewed:0,hardCount:0,totalReviews:0}});
    cards.forEach(c=>{const s=m[c.category];if(!s)return;s.total++;if(SRS.isDue(c))s.due++;if((c.streak||0)>=3)s.mastered++;if(c.reviewCount>0)s.reviewed++;s.hardCount+=(c.ratings||[]).filter(r=>r.rating==="hard").length;s.totalReviews+=c.reviewCount||0});
    Object.values(m).forEach(s=>{s.weakness=s.totalReviews>0?Math.round(s.hardCount/s.totalReviews*100):0;s.completion=s.total>0?Math.round(s.reviewed/s.total*100):0});
    return m;
  },[cards]);

  const overallProgress=useMemo(()=>{const t=cards.length;return t?Math.round(reviewed.length/t*100):0},[cards,reviewed]);

  // Streak calculation
  const streak=useMemo(()=>{let s=0;const today=new Date();for(let i=0;i<30;i++){const d=new Date(today);d.setDate(d.getDate()-i);const ds=d.toLocaleDateString("en-CA");if(log.some(l=>new Date(l.ts).toLocaleDateString("en-CA")===ds))s++;else if(i>0)break}return s},[log]);

  // ═══ SMART REVIEW ═══
  const sortForReview=useCallback((cardList)=>{
    return[...cardList].sort((a,b)=>{
      const aOver=SRS.isOverdue(a)?1:0,bOver=SRS.isOverdue(b)?1:0;
      if(bOver!==aOver)return bOver-aOver; // overdue first
      const aHard=a.lastRating==="hard"?1:0,bHard=b.lastRating==="hard"?1:0;
      if(bHard!==aHard)return bHard-aHard; // hard-rated next
      const aNew=a.reviewCount===0?1:0,bNew=b.reviewCount===0?1:0;
      if(bNew!==aNew)return bNew-aNew; // never reviewed next
      return(a.nextReview||0)-(b.nextReview||0); // earliest due next
    });
  },[]);

  const startReview=useCallback((cs,mode)=>{
    if(!cs.length){notify("No cards to review!");return}
    const sorted=sortForReview(cs);
    setQueue(mode==="random"?[...cs].sort(()=>Math.random()-0.5):sorted);
    setQi(0);setFlipped(false);setSession({n:0,ok:0,t:Date.now()});setView("review");
  },[sortForReview]);

  const startSmartReview=useCallback((mode)=>{
    setReviewMode(mode);setShowModePicker(false);
    if(mode==="subject"){setView("pick-subject");return}
    if(mode==="weakest"){
      const weak=cards.filter(SRS.isDue).sort((a,b)=>SRS.hardRate(b)-SRS.hardRate(a));
      startReview(weak.slice(0,50),"weakest");
    }else if(mode==="overdue"){
      startReview(overdue,"overdue");
    }else{
      startReview(due,"random");
    }
  },[cards,due,overdue,startReview]);

  const goNext=useCallback(()=>{if(qi<queue.length-1){setQi(p=>p+1);setFlipped(false)}},[qi,queue.length]);
  const goPrev=useCallback(()=>{if(qi>0){setQi(p=>p-1);setFlipped(false)}},[qi]);
  const rate=useCallback(r=>{const c=queue[qi];if(!c)return;setCards(prev=>prev.map(x=>x.id===c.id?SRS.next(x,r):x));setLog(prev=>[...prev,{cid:c.id,r,ts:Date.now()}]);setSession(prev=>({...prev,n:prev.n+1,ok:r!=="hard"?prev.ok+1:prev.ok}));setFlipped(false);if(qi<queue.length-1)setTimeout(()=>setQi(p=>p+1),150);else setView("done")},[queue,qi]);

  const createCard=useCallback(()=>{
    if(!newCard.front.trim()||!newCard.back.trim()){notify("Front and back required");return}
    if(cards.some(c=>fp(c.front)===fp(newCard.front))){notify("Duplicate card exists");return}
    setCards(prev=>[...prev,{id:uid(),front:newCard.front.trim(),back:newCard.back.trim(),category:newCard.category||"preclinical",tags:newCard.tags.split(",").map(t=>t.trim().toLowerCase()).filter(Boolean),difficulty:newCard.difficulty,nextReview:null,lastReviewed:null,reviewCount:0,ratings:[],streak:0}]);
    setNewCard({front:"",back:"",category:"",tags:"",difficulty:"medium"});setShowCreate(false);notify("Card created!");
  },[newCard,cards]);

  const handleFile=useCallback(e=>{const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=ev=>{try{const data=JSON.parse(ev.target.result);const raw=Array.isArray(data)?data:data.cards;if(!Array.isArray(raw)||!raw.length){notify("No cards");return}const parsed=raw.map(c=>({id:uid(),front:c.front||c.question||"",back:c.back||c.answer||"",category:c.category||c.subject||"preclinical",tags:Array.isArray(c.tags)?c.tags.map(t=>t.toLowerCase()):(c.tags||"").split(",").map(t=>t.trim().toLowerCase()).filter(Boolean),difficulty:c.difficulty||"medium",nextReview:null,lastReviewed:null,reviewCount:0,ratings:[],streak:0})).filter(c=>c.front&&c.back);const{unique,dupes}=findDupes(parsed,cards);setImportPreview({cards:unique,dupes,total:parsed.length,meta:{source:data.source||file.name,topic:data.topic||""}});setShowImport(true)}catch{notify("Invalid JSON")}};reader.readAsText(file);e.target.value=""},[cards]);
  const confirmImport=useCallback(()=>{if(!importPreview||!importPreview.cards.length){notify("No new cards");setShowImport(false);setImportPreview(null);return}setCards(prev=>[...prev,...importPreview.cards]);const dc=importPreview.dupes?.length||0;notify(`${importPreview.cards.length} imported${dc?` · ${dc} dupes skipped`:""}`);setImportPreview(null);setShowImport(false)},[importPreview]);

  // Keyboard + touch
  useEffect(()=>{const h=e=>{if(view!=="review")return;if(e.key===" "||e.key==="Enter"){e.preventDefault();setFlipped(f=>!f)}if(e.key==="ArrowRight"){e.preventDefault();goNext()}if(e.key==="ArrowLeft"){e.preventDefault();goPrev()}if(flipped){if(e.key==="1")rate("hard");if(e.key==="2")rate("good");if(e.key==="3")rate("easy")}};window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h)},[view,flipped,rate,goNext,goPrev]);
  const onTS=useCallback(e=>{touchRef.current={x:e.touches[0].clientX}},[]);
  const onTE=useCallback(e=>{const dx=e.changedTouches[0].clientX-touchRef.current.x;if(Math.abs(dx)>60){dx<0?goNext():goPrev()}},[goNext,goPrev]);

  if(!ready||splash)return<div style={S.loading}><CogniVaultLogo size={120}/><h1 style={{fontSize:28,fontWeight:900,color:"#fff",marginTop:20,letterSpacing:1}}>Cogni<span style={{color:"#7B2FF7"}}>V</span>ault<span style={{fontWeight:400,color:"#5A6478",fontSize:14,display:"block",letterSpacing:3,marginTop:2}}>Labs</span></h1><div style={{marginTop:28,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}><span style={{fontSize:18,fontWeight:800,color:"#2A9D8F",letterSpacing:2}}>USMLE RECALL</span><span style={{fontSize:10,color:"#5A6478",letterSpacing:1}}>Spaced Repetition · Cloud Synced</span></div>{!ready&&<div style={{marginTop:24,display:"flex",alignItems:"center",gap:8}}><span style={{color:"#F4A261",animation:"spin .8s linear infinite",display:"inline-block"}}>↻</span><span style={{fontSize:12,color:"#5A6478"}}>Syncing...</span></div>}</div>;

  // ═══ RENDER ═══
  return(
    <div style={S.app}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700;9..40,800;9..40,900&display=swap');*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}@keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}@keyframes toastIn{from{transform:translate(-50%,-20px);opacity:0}to{transform:translate(-50%,0);opacity:1}}@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}input,textarea,select{font-family:inherit}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:4px}`}</style>
      {toast&&<div style={S.toast}>{toast}</div>}
      <input ref={fileRef} type="file" accept=".json" style={{display:"none"}} onChange={handleFile}/>

      <header style={S.header}>
        <div style={S.hLeft}>
          {!["dashboard"].includes(view)&&<button style={S.backBtn} onClick={()=>{setView("dashboard");setSelCat(null);setExpandedCard(null);setWeakViewCat(null)}}>‹</button>}
          <CogniVaultIcon size={22}/><h1 style={S.logo}><span style={{color:"#2A9D8F"}}>USMLE</span> Recall</h1>
          <div style={{fontSize:14,color:syncIcon==="☁"?"#2A9D8F":syncIcon==="⚠"?"#E63946":"#F4A261"}}>{syncIcon==="↻"?<span style={{animation:"spin .8s linear infinite",display:"inline-block"}}>↻</span>:syncIcon}</div>
        </div>
        <div style={S.hRight}>
          <div style={S.badge}>🔥{streak}</div>
          <div style={{...S.badge,background:"rgba(42,157,143,0.12)",color:"#2A9D8F"}}>{todayN}/{dailyTarget}</div>
        </div>
      </header>

      <main style={{padding:0}}>

        {/* ══ DASHBOARD ══ */}
        {view==="dashboard"&&(<div style={S.page}>
          <button style={S.hero} onClick={()=>setShowModePicker(true)}>
            <div style={S.heroGrid}><div><div style={S.heroNum}>{due.length}</div><div style={S.heroLabel}>DUE NOW</div></div><div style={S.heroDiv}/><div><div style={S.heroNum2}>{overdue.length}</div><div style={S.heroLabel}>OVERDUE</div></div><div style={S.heroDiv}/><div><div style={S.heroNum2}>{retention}%</div><div style={S.heroLabel}>RETENTION</div></div></div>
            <div style={S.heroCta}>▶ START REVIEW</div>
          </button>

          {/* Today progress ring */}
          <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:18,padding:"12px 16px",background:"rgba(255,255,255,0.02)",borderRadius:12,border:"1px solid rgba(255,255,255,0.04)"}}>
            <div style={{position:"relative",width:48,height:48}}>
              <svg width={48} height={48} viewBox="0 0 48 48"><circle cx={24} cy={24} r={20} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={4}/><circle cx={24} cy={24} r={20} fill="none" stroke="#2A9D8F" strokeWidth={4} strokeDasharray={`${Math.min(todayN/Math.max(dailyTarget,1),1)*125.6} 125.6`} strokeLinecap="round" transform="rotate(-90 24 24)"/></svg>
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#fff"}}>{Math.round(Math.min(todayN/Math.max(dailyTarget,1),1)*100)}%</div>
            </div>
            <div><div style={{fontSize:14,fontWeight:700,color:"#fff"}}>{todayN} reviewed today</div><div style={{fontSize:11,color:"#5A6478"}}>{Math.max(0,dailyTarget-todayN)} remaining · {dailyTarget} target</div></div>
          </div>

          <div style={S.weekRow}>{weekData.map((d,i)=>(<div key={i} style={S.weekCol}><div style={S.weekWrap}><div style={{...S.weekBar,height:`${Math.min(d.n/Math.max(dailyTarget,1)*100,100)}%`,background:d.n>=dailyTarget?"#2A9D8F":d.n>0?"#457B9D":"rgba(255,255,255,0.06)"}}/></div><span style={S.weekLbl}>{d.day}</span></div>))}</div>

          <div style={S.secHeader}><h3 style={S.secTitle}>SUBJECTS</h3><span style={{fontSize:11,color:"#5A6478"}}>{cards.length} cards · {reviewed.length} done</span></div>
          <div style={S.catGrid}>{CATS.map(cat=>{const st=catStats[cat.id]||{};if(!st.total)return null;return(<button key={cat.id} style={S.catCard} onClick={()=>{setSelCat(cat.id);setView("category")}}>
            <div style={{...S.catStripe,background:cat.color}}/><div style={S.catBody}>
              <div style={S.catTop}><span style={{fontSize:12}}>{cat.icon}</span><span style={S.catName}>{cat.short}</span></div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
                <span style={{fontSize:9,color:"#5A6478"}}>{st.reviewed}/{st.total} done</span>
                {st.due>0&&<span style={S.catDue}>{st.due}</span>}
              </div>
              {st.total>0&&<div style={{height:2,background:"rgba(255,255,255,0.06)",borderRadius:1,marginTop:4}}><div style={{height:2,borderRadius:1,background:cat.color,width:`${st.completion}%`,opacity:.7}}/></div>}
            </div>
          </button>)}).filter(Boolean)}</div>

          {/* Empty categories */}
          {CATS.filter(c=>!(catStats[c.id]?.total)).length>0&&<details style={{marginTop:8}}><summary style={{fontSize:11,color:"#5A6478",cursor:"pointer"}}>Empty subjects ({CATS.filter(c=>!(catStats[c.id]?.total)).length})</summary>
            <div style={{...S.catGrid,marginTop:8}}>{CATS.filter(c=>!(catStats[c.id]?.total)).map(cat=>(<div key={cat.id} style={{...S.catCard,opacity:.4}}><div style={{...S.catStripe,background:cat.color}}/><div style={S.catBody}><div style={S.catTop}><span style={{fontSize:12}}>{cat.icon}</span><span style={S.catName}>{cat.short}</span></div><div style={{fontSize:9,color:"#5A6478"}}>0 cards</div></div></div>))}</div>
          </details>}
        </div>)}

        {/* ══ REVIEW MODE PICKER ══ */}
        {showModePicker&&(<div style={S.overlay} onClick={()=>setShowModePicker(false)}><div style={S.modal} onClick={e=>e.stopPropagation()}><div style={S.modalBar}/><h3 style={S.modalTitle}>How do you want to study?</h3>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <button style={S.modeBtn} onClick={()=>startSmartReview("subject")}><span style={{fontSize:22}}>📚</span><div><b style={{color:"#fff"}}>By Subject</b><div style={{fontSize:11,color:"#5A6478"}}>Pick a category, review in order</div></div></button>
            <button style={S.modeBtn} onClick={()=>startSmartReview("weakest")}><span style={{fontSize:22}}>🎯</span><div><b style={{color:"#fff"}}>Weakest First</b><div style={{fontSize:11,color:"#5A6478"}}>Cards you struggle with most ({cards.filter(c=>SRS.isDue(c)&&SRS.hardRate(c)>0).length} weak)</div></div></button>
            <button style={S.modeBtn} onClick={()=>startSmartReview("overdue")}><span style={{fontSize:22}}>⏰</span><div><b style={{color:"#fff"}}>Overdue Only</b><div style={{fontSize:11,color:"#5A6478"}}>Catch up on missed reviews ({overdue.length} overdue)</div></div></button>
            <button style={S.modeBtn} onClick={()=>startSmartReview("random")}><span style={{fontSize:22}}>🔀</span><div><b style={{color:"#fff"}}>Random Mix</b><div style={{fontSize:11,color:"#5A6478"}}>All {due.length} due cards, shuffled</div></div></button>
          </div>
        </div></div>)}

        {/* ══ PICK SUBJECT (for subject mode) ══ */}
        {view==="pick-subject"&&(<div style={S.page}><h2 style={S.pageTitle}>Pick a Subject to Review</h2>
          {CATS.filter(c=>(catStats[c.id]?.due||0)>0).map(cat=>{const st=catStats[cat.id];return(
            <button key={cat.id} style={{...S.expandCard,display:"flex",alignItems:"center",gap:12}} onClick={()=>{const cs=cards.filter(c=>c.category===cat.id&&SRS.isDue(c));startReview(cs,"subject")}}>
              <span style={{fontSize:24}}>{cat.icon}</span>
              <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:"#fff"}}>{cat.name}</div><div style={{fontSize:11,color:"#5A6478"}}>{st.due} due · {st.total} total</div></div>
              <span style={{fontSize:13,color:"#2A9D8F",fontWeight:700}}>{st.due} →</span>
            </button>
          )})}
          {CATS.filter(c=>(catStats[c.id]?.due||0)>0).length===0&&<p style={S.muted}>No due cards in any subject!</p>}
        </div>)}

        {/* ══ REVIEW ══ */}
        {view==="review"&&queue.length>0&&(()=>{const c=queue[qi];const cat=getCat(c?.category);return(
          <div style={S.revWrap} onTouchStart={onTS} onTouchEnd={onTE}>
            <div style={S.revProg}><div style={S.revProgBar}><div style={{...S.revProgFill,width:`${(qi+1)/queue.length*100}%`}}/></div><span style={{fontSize:12,color:"#5A6478",fontWeight:700}}>{qi+1}/{queue.length}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{display:"flex",gap:6,alignItems:"center",fontSize:12,color:"#5A6478"}}><span style={{width:8,height:8,borderRadius:4,background:cat.color,display:"inline-block"}}/>{cat.short}{c.reviewCount>0&&<span>· ×{c.reviewCount}</span>}</div>
              <div style={{display:"flex",gap:6}}><button style={{...S.navArrow,opacity:qi>0?1:.25}} onClick={e=>{e.stopPropagation();goPrev()}}>←</button><button style={{...S.navArrow,opacity:qi<queue.length-1?1:.25}} onClick={e=>{e.stopPropagation();goNext()}}>→</button></div>
            </div>
            <div style={{...S.card,...(flipped?S.cardFlip:{})}} onClick={()=>setFlipped(f=>!f)}>
              {!flipped?(<div style={S.cardFace}><div style={{display:"flex",gap:5,flexWrap:"wrap",justifyContent:"center"}}>{(c?.tags||[]).slice(0,3).map(t=><span key={t} style={S.cardTag}>{t}</span>)}</div><div style={S.cardQ}>{c?.front}</div><div style={{fontSize:11,color:"#5A6478",letterSpacing:1,textAlign:"center"}}>tap · space · swipe</div></div>)
              :(<div style={S.cardFace}><div style={S.cardA}>{c?.back}</div></div>)}
            </div>
            {flipped&&(<div style={S.rateRow}><button style={S.rHard} onClick={()=>rate("hard")}><span style={{fontSize:22}}>😓</span><b>Hard</b><small style={{opacity:.6}}>1h</small></button><button style={S.rGood} onClick={()=>rate("good")}><span style={{fontSize:22}}>🤔</span><b>Good</b><small style={{opacity:.6}}>1d</small></button><button style={S.rEasy} onClick={()=>rate("easy")}><span style={{fontSize:22}}>😎</span><b>Easy</b><small style={{opacity:.6}}>1w</small></button></div>)}
          </div>)})()}

        {/* ══ DONE ══ */}
        {view==="done"&&(<div style={S.doneWrap}><div style={{fontSize:56}}>🎯</div><h2 style={{fontSize:22,fontWeight:800,color:"#fff"}}>Session Complete</h2><div style={{display:"flex",gap:24,margin:"16px 0"}}><div style={{textAlign:"center"}}><div style={S.doneNum}>{session.n}</div><div style={S.doneLbl}>Reviewed</div></div><div style={{textAlign:"center"}}><div style={S.doneNum}>{session.n?Math.round(session.ok/session.n*100):0}%</div><div style={S.doneLbl}>Accuracy</div></div><div style={{textAlign:"center"}}><div style={S.doneNum}>{session.t?Math.round((Date.now()-session.t)/60000):0}m</div><div style={S.doneLbl}>Time</div></div></div><button style={{...S.btnP,width:"100%"}} onClick={()=>setView("dashboard")}>Dashboard</button>{due.length>0&&<button style={{...S.btnS,marginTop:8,width:"100%"}} onClick={()=>setShowModePicker(true)}>Review More ({due.length})</button>}</div>)}

        {/* ══ CATEGORY ══ */}
        {view==="category"&&selCat&&(()=>{const cat=getCat(selCat);const cs=cards.filter(c=>c.category===selCat);const csDue=cs.filter(SRS.isDue);const csReviewed=cs.filter(c=>c.reviewCount>0);const csMastered=cs.filter(c=>(c.streak||0)>=3);const csHard=cs.filter(c=>c.lastRating==="hard").sort((a,b)=>SRS.hardRate(b)-SRS.hardRate(a));return(
          <div style={S.page}>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16,paddingLeft:12,position:"relative"}}><div style={{position:"absolute",left:0,top:0,bottom:0,width:3,borderRadius:3,background:cat.color}}/><span style={{fontSize:36}}>{cat.icon}</span><div><h2 style={{fontSize:20,fontWeight:800,color:"#fff",margin:0}}>{cat.name}</h2><p style={{fontSize:12,color:"#5A6478",marginTop:2}}>{cs.length} total · {csDue.length} due · {csMastered.length} mastered</p></div></div>

            {/* Progress bar */}
            <div style={{marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#5A6478",marginBottom:4}}><span>{csReviewed.length}/{cs.length} reviewed</span><span>{cs.length?Math.round(csReviewed.length/cs.length*100):0}%</span></div>
              <div style={{height:6,background:"rgba(255,255,255,0.06)",borderRadius:3}}><div style={{height:6,borderRadius:3,background:cat.color,width:`${cs.length?Math.round(csReviewed.length/cs.length*100):0}%`,transition:"width .3s"}}/></div>
            </div>

            {/* Stat chips */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,marginBottom:16}}>
              <div style={S.miniStat}><div style={{fontSize:16,fontWeight:800,color:"#fff"}}>{cs.length}</div><div style={{fontSize:9,color:"#5A6478"}}>TOTAL</div></div>
              <div style={S.miniStat}><div style={{fontSize:16,fontWeight:800,color:"#2A9D8F"}}>{csReviewed.length}</div><div style={{fontSize:9,color:"#5A6478"}}>DONE</div></div>
              <div style={S.miniStat}><div style={{fontSize:16,fontWeight:800,color:"#F4A261"}}>{csDue.length}</div><div style={{fontSize:9,color:"#5A6478"}}>DUE</div></div>
              <div style={S.miniStat}><div style={{fontSize:16,fontWeight:800,color:"#7FFF00"}}>{csMastered.length}</div><div style={{fontSize:9,color:"#5A6478"}}>MASTERED</div></div>
            </div>

            <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}><button style={S.btnP} onClick={()=>startReview(csDue,"subject")}>Review Due ({csDue.length})</button><button style={S.btnS} onClick={()=>startReview(cs,"subject")}>All</button></div>

            {csHard.length>0&&<><h4 style={{fontSize:11,color:"#E63946",fontWeight:700,letterSpacing:1.5,marginBottom:8}}>⚠ WEAK CARDS ({csHard.length})</h4>{csHard.slice(0,5).map(c=>(<div key={c.id} style={{...S.expandCard,borderColor:"rgba(230,57,70,0.15)"}} onClick={()=>setExpandedCard(expandedCard===c.id?null:c.id)}><div style={{fontSize:13,color:"#D5D3CF",lineHeight:1.4}}>{c.front}</div>{expandedCard===c.id&&<div style={{marginTop:8,fontSize:12,color:"#B8C6C0",whiteSpace:"pre-line",padding:10,background:"rgba(230,57,70,0.04)",borderRadius:8}}>{c.back}</div>}</div>))}</>}

            <h4 style={{fontSize:11,color:"#5A6478",fontWeight:700,letterSpacing:1.5,marginBottom:8,marginTop:16}}>ALL CARDS ({cs.length})</h4>
            {cs.map(c=>(<div key={c.id} style={S.expandCard} onClick={()=>setExpandedCard(expandedCard===c.id?null:c.id)}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div style={{fontSize:13,color:"#D5D3CF",fontWeight:500,lineHeight:1.4,flex:1}}>{c.front}</div><span style={{fontSize:10,color:"#5A6478",flexShrink:0,marginLeft:8}}>{expandedCard===c.id?"▲":"▼"}</span></div>
              <div style={{display:"flex",gap:6,marginTop:4,alignItems:"center",flexWrap:"wrap"}}>
                <span style={{fontSize:10,color:"#5A6478"}}>×{c.reviewCount||0}</span>
                {c.lastRating&&<span style={{fontSize:9,padding:"1px 4px",borderRadius:3,background:c.lastRating==="hard"?"rgba(230,57,70,0.15)":c.lastRating==="easy"?"rgba(42,157,143,0.15)":"rgba(69,123,157,0.15)",color:c.lastRating==="hard"?"#E63946":c.lastRating==="easy"?"#2A9D8F":"#457B9D"}}>{c.lastRating}</span>}
                {SRS.isDue(c)&&<span style={S.catDue}>DUE</span>}
                {(c.streak||0)>=3&&<span style={{fontSize:9,color:"#7FFF00"}}>✓mastered</span>}
                {c.reviewCount===0&&<span style={{fontSize:9,color:"#5A6478"}}>new</span>}
              </div>
              {expandedCard===c.id&&(<div style={{marginTop:10,padding:"10px 12px",background:"rgba(42,157,143,0.04)",borderRadius:8,border:"1px solid rgba(42,157,143,0.08)"}}><div style={{fontSize:12,color:"#B8C6C0",lineHeight:1.6,whiteSpace:"pre-line"}}>{c.back}</div><div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:6}}>{(c.tags||[]).map(t=><span key={t} style={S.tinyTag}>{t}</span>)}</div></div>)}
            </div>))}
          </div>)})()}

        {/* ══ PROGRESS ══ */}
        {view==="progress"&&(<div style={S.page}><h2 style={S.pageTitle}>Progress</h2>

          {/* Overall */}
          <div style={{padding:"20px 16px",background:"rgba(255,255,255,0.02)",borderRadius:14,border:"1px solid rgba(255,255,255,0.04)",marginBottom:20,textAlign:"center"}}>
            <div style={{position:"relative",width:80,height:80,margin:"0 auto 12px"}}>
              <svg width={80} height={80} viewBox="0 0 80 80"><circle cx={40} cy={40} r={34} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6}/><circle cx={40} cy={40} r={34} fill="none" stroke="#2A9D8F" strokeWidth={6} strokeDasharray={`${overallProgress/100*213.6} 213.6`} strokeLinecap="round" transform="rotate(-90 40 40)"/></svg>
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:900,color:"#fff"}}>{overallProgress}%</div>
            </div>
            <div style={{fontSize:14,fontWeight:700,color:"#fff"}}>{reviewed.length} / {cards.length} cards reviewed</div>
            <div style={{fontSize:11,color:"#5A6478",marginTop:2}}>{mastered.length} mastered · {due.length} due · {overdue.length} overdue</div>
          </div>

          <div style={S.statGrid}><div style={S.statBox}><div style={{fontSize:20,fontWeight:900,color:"#fff"}}>{log.length}</div><div style={S.statLbl}>Reviews</div></div><div style={S.statBox}><div style={{fontSize:20,fontWeight:900,color:"#fff"}}>{retention}%</div><div style={S.statLbl}>Retention</div></div><div style={S.statBox}><div style={{fontSize:20,fontWeight:900,color:"#fff"}}>{streak}</div><div style={S.statLbl}>Day Streak</div></div></div>

          {/* Subject table */}
          <h3 style={{...S.secTitle,marginTop:4}}>BY SUBJECT — tap to see weak cards</h3>
          {CATS.filter(c=>(catStats[c.id]?.total||0)>0).sort((a,b)=>(catStats[b.id]?.weakness||0)-(catStats[a.id]?.weakness||0)).map(cat=>{const st=catStats[cat.id];const isOpen=weakViewCat===cat.id;const weakCards=cards.filter(c=>c.category===cat.id&&c.lastRating==="hard");return(
            <div key={cat.id}>
              <div style={{...S.expandCard,borderColor:isOpen?cat.color+"40":"rgba(255,255,255,0.04)"}} onClick={()=>setWeakViewCat(isOpen?null:cat.id)}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:16,width:22,textAlign:"center"}}>{cat.icon}</span>
                  <span style={{fontSize:13,fontWeight:700,color:"#fff",flex:1}}>{cat.short}</span>
                  <div style={{display:"flex",gap:10,alignItems:"center",fontSize:10}}>
                    <span style={{color:"#5A6478"}}>{st.reviewed}/{st.total}</span>
                    <span style={{color:"#7FFF00"}}>{st.mastered}✓</span>
                    {st.due>0&&<span style={{color:"#F4A261"}}>{st.due}due</span>}
                    {st.weakness>0&&<span style={{color:st.weakness>40?"#E63946":"#F4A261"}}>{st.weakness}%weak</span>}
                  </div>
                  <span style={{fontSize:10,color:"#5A6478"}}>{isOpen?"▲":"▼"}</span>
                </div>
                <div style={{height:3,background:"rgba(255,255,255,0.04)",borderRadius:2,marginTop:6}}><div style={{height:3,borderRadius:2,background:cat.color,width:`${st.completion}%`,opacity:.6}}/></div>
              </div>
              {isOpen&&weakCards.length>0&&(<div style={{padding:"0 8px",marginBottom:8}}><div style={{fontSize:10,color:"#E63946",fontWeight:700,margin:"8px 0 4px",letterSpacing:1}}>WEAK CARDS ({weakCards.length})</div>{weakCards.slice(0,8).map(c=>(<div key={c.id} style={{fontSize:12,color:"#D5D3CF",padding:"6px 10px",background:"rgba(230,57,70,0.04)",borderRadius:6,marginBottom:3,lineHeight:1.3}}>{c.front}</div>))}{weakCards.length>8&&<div style={{fontSize:10,color:"#5A6478",marginTop:2}}>+{weakCards.length-8} more</div>}</div>)}
              {isOpen&&weakCards.length===0&&<div style={{padding:"4px 8px 8px",fontSize:11,color:"#2A9D8F"}}>No weak cards — keep it up!</div>}
            </div>
          )})}

          <h3 style={{...S.secTitle,marginTop:24}}>SETTINGS</h3>
          <div style={S.settingRow}><span style={{color:"#ccc"}}>Daily target</span><div style={{display:"flex",alignItems:"center",gap:10}}><button style={S.tBtn} onClick={()=>setDailyTarget(Math.max(5,dailyTarget-5))}>−</button><span style={{fontWeight:800,color:"#fff",minWidth:32,textAlign:"center"}}>{dailyTarget}</span><button style={S.tBtn} onClick={()=>setDailyTarget(dailyTarget+5)}>+</button></div></div>
          <button style={{...S.btnO,color:"#E63946",borderColor:"rgba(230,57,70,0.3)",marginTop:12,width:"100%"}} onClick={()=>{localStorage.removeItem("usmle-v5");window.location.reload()}}>Reset Local Data</button>
        </div>)}

        {/* ══ BROWSE ══ */}
        {view==="browse"&&(<div style={S.page}><h2 style={S.pageTitle}>Browse ({cards.length})</h2>
          <input style={S.searchInput} placeholder="Search questions & answers…" value={search} onChange={e=>setSearch(e.target.value)}/>
          <div style={S.filterRow}><button style={{...S.filterChip,...(!filterCat?S.filterAct:{})}} onClick={()=>setFilterCat("")}>All</button>{CATS.filter(c=>(catStats[c.id]?.total||0)>0).map(c=><button key={c.id} style={{...S.filterChip,...(filterCat===c.id?{...S.filterAct,borderColor:c.color,color:c.color}:{})}} onClick={()=>setFilterCat(filterCat===c.id?"":c.id)}>{c.icon}{catStats[c.id]?.total||0}</button>)}</div>
          {cards.filter(c=>{const ms=!search||c.front.toLowerCase().includes(search.toLowerCase())||c.back.toLowerCase().includes(search.toLowerCase());return ms&&(!filterCat||c.category===filterCat)}).slice(0,60).map(c=>{const cat=getCat(c.category);return(
            <div key={c.id} style={S.expandCard} onClick={()=>setExpandedCard(expandedCard===c.id?null:c.id)}>
              <div style={{display:"flex",gap:6,alignItems:"flex-start"}}><span style={{fontSize:9,fontWeight:600,border:"1px solid "+cat.color,color:cat.color,borderRadius:5,padding:"1px 4px",flexShrink:0,marginTop:2}}>{cat.icon}</span><div style={{fontSize:13,fontWeight:500,color:"#fff",lineHeight:1.4,flex:1}}>{c.front}</div></div>
              {expandedCard===c.id&&(<div style={{marginTop:8}}><div style={{fontSize:12,color:"#B8C6C0",lineHeight:1.6,whiteSpace:"pre-line",padding:"8px 10px",background:"rgba(42,157,143,0.04)",borderRadius:6}}>{c.back}</div><div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:6,alignItems:"center"}}><span style={{fontSize:10,color:"#5A6478"}}>×{c.reviewCount||0} · {fmtDate(c.lastReviewed)}</span>{c.lastRating&&<span style={{fontSize:9,padding:"1px 4px",borderRadius:3,background:c.lastRating==="hard"?"rgba(230,57,70,0.15)":"rgba(69,123,157,0.1)",color:c.lastRating==="hard"?"#E63946":"#457B9D"}}>{c.lastRating}</span>}<button style={{fontSize:10,color:"#E63946",background:"none",border:"none",cursor:"pointer",marginLeft:"auto"}} onClick={e=>{e.stopPropagation();setCards(prev=>prev.filter(x=>x.id!==c.id));notify("Deleted")}}>delete</button></div></div>)}
            </div>)})}
        </div>)}
      </main>

      {/* ══ MODALS ══ */}
      {showCreate&&(<div style={S.overlay} onClick={()=>setShowCreate(false)}><div style={S.modal} onClick={e=>e.stopPropagation()}><div style={S.modalBar}/><h3 style={S.modalTitle}>New Flashcard</h3>
        <label style={S.label}>Subject</label><select style={S.inp} value={newCard.category} onChange={e=>setNewCard(p=>({...p,category:e.target.value}))}><option value="">Select…</option>{CATS.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</select>
        <label style={S.label}>Front</label><textarea style={{...S.inp,minHeight:70}} value={newCard.front} onChange={e=>setNewCard(p=>({...p,front:e.target.value}))}/>
        <label style={S.label}>Back</label><textarea style={{...S.inp,minHeight:100}} value={newCard.back} onChange={e=>setNewCard(p=>({...p,back:e.target.value}))}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div><label style={S.label}>Difficulty</label><select style={S.inp} value={newCard.difficulty} onChange={e=>setNewCard(p=>({...p,difficulty:e.target.value}))}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></div><div><label style={S.label}>Tags</label><input style={S.inp} value={newCard.tags} onChange={e=>setNewCard(p=>({...p,tags:e.target.value}))}/></div></div>
        <div style={{display:"flex",gap:10,marginTop:18}}><button style={{...S.btnS,flex:1}} onClick={()=>setShowCreate(false)}>Cancel</button><button style={{...S.btnP,flex:1}} onClick={createCard}>Create</button></div>
      </div></div>)}

      {showImport&&importPreview&&(<div style={S.overlay} onClick={()=>{setShowImport(false);setImportPreview(null)}}><div style={S.modal} onClick={e=>e.stopPropagation()}><div style={S.modalBar}/><h3 style={S.modalTitle}>Import Preview</h3>
        <div style={S.importMeta}><div style={{display:"flex",gap:16,marginTop:4}}><div><span style={{fontSize:20,fontWeight:800,color:"#2A9D8F"}}>{importPreview.cards.length}</span><span style={{fontSize:11,color:"#5A6478",marginLeft:4}}>new</span></div>{(importPreview.dupes?.length||0)>0&&<div><span style={{fontSize:20,fontWeight:800,color:"#F4A261"}}>{importPreview.dupes.length}</span><span style={{fontSize:11,color:"#5A6478",marginLeft:4}}>dupes</span></div>}<div><span style={{fontSize:20,fontWeight:800,color:"#fff"}}>{importPreview.total}</span><span style={{fontSize:11,color:"#5A6478",marginLeft:4}}>in file</span></div></div></div>
        {importPreview.cards.length>0&&<div style={{maxHeight:200,overflowY:"auto",marginBottom:8}}>{importPreview.cards.slice(0,5).map((c,i)=>{const cat=getCat(c.category);return(<div key={i} style={{background:"rgba(42,157,143,0.04)",borderRadius:6,padding:8,marginBottom:4,border:"1px solid rgba(42,157,143,0.08)"}}><span style={{fontSize:9,border:"1px solid "+cat.color,color:cat.color,borderRadius:4,padding:"0 4px",marginRight:6}}>{cat.icon}</span><span style={{fontSize:12,color:"#D5D3CF"}}>{c.front.length>80?c.front.slice(0,80)+"…":c.front}</span></div>)})}{importPreview.cards.length>5&&<p style={S.muted}>+{importPreview.cards.length-5} more</p>}</div>}
        {importPreview.cards.length===0&&<p style={{fontSize:13,color:"#F4A261",textAlign:"center",padding:"12px 0"}}>All cards already exist</p>}
        <div style={{display:"flex",gap:10,marginTop:8}}><button style={{...S.btnS,flex:1}} onClick={()=>{setShowImport(false);setImportPreview(null)}}>Cancel</button><button style={{...S.btnP,flex:1,opacity:importPreview.cards.length?1:.5}} onClick={confirmImport} disabled={!importPreview.cards.length}>Import {importPreview.cards.length} New</button></div>
      </div></div>)}

      {/* ══ NAV ══ */}
      {!["review","pick-subject"].includes(view)&&(<nav style={S.nav}>
        <button style={{...S.navBtn,...(view==="dashboard"?S.navAct:{})}} onClick={()=>{setView("dashboard");setSelCat(null);setExpandedCard(null)}}><span style={S.navIco}>🏠</span><span style={S.navLbl}>Home</span></button>
        <button style={{...S.navBtn,...(view==="progress"?S.navAct:{})}} onClick={()=>setView("progress")}><span style={S.navIco}>📊</span><span style={S.navLbl}>Progress</span></button>
        <button style={S.navCenter} onClick={()=>setShowModePicker(true)}><span style={{color:"#fff",fontSize:20,marginLeft:2}}>▶</span></button>
        <button style={{...S.navBtn,...(view==="browse"?S.navAct:{})}} onClick={()=>setView("browse")}><span style={S.navIco}>📚</span><span style={S.navLbl}>Cards</span></button>
        <button style={S.navBtn} onClick={()=>fileRef.current?.click()}><span style={S.navIco}>📥</span><span style={S.navLbl}>Import</span></button>
      </nav>)}
    </div>
  );
}

const S={
  app:{fontFamily:"'DM Sans',sans-serif",background:"#080C14",color:"#D5D3CF",minHeight:"100vh",maxWidth:720,margin:"0 auto",position:"relative",paddingBottom:80},
  loading:{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100vh",background:"#080C14"},
  header:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px 8px",borderBottom:"1px solid rgba(255,255,255,0.04)",position:"sticky",top:0,background:"#080C14",zIndex:100},
  hLeft:{display:"flex",alignItems:"center",gap:8},hRight:{display:"flex",alignItems:"center",gap:6},
  backBtn:{background:"none",border:"none",color:"#5A6478",fontSize:24,cursor:"pointer",padding:"2px 4px",lineHeight:1},
  logo:{fontSize:16,fontWeight:900,color:"#fff",letterSpacing:1.5,lineHeight:1,margin:0},
  badge:{background:"rgba(255,152,0,0.12)",color:"#FFB74D",padding:"2px 8px",borderRadius:8,fontSize:11,fontWeight:700},
  page:{padding:"12px 16px"},pageTitle:{fontSize:18,fontWeight:800,color:"#fff",marginBottom:14},
  hero:{width:"100%",background:"linear-gradient(135deg,#0F1524,#0A0F1C)",border:"1px solid rgba(42,157,143,0.2)",borderRadius:14,padding:"20px 16px",cursor:"pointer",display:"block",color:"inherit",marginBottom:14,textAlign:"center"},
  heroGrid:{display:"flex",justifyContent:"space-around",alignItems:"center",marginBottom:12},heroNum:{fontSize:38,fontWeight:900,color:"#2A9D8F",lineHeight:1},heroNum2:{fontSize:22,fontWeight:800,color:"#fff",lineHeight:1},heroLabel:{fontSize:8,color:"#5A6478",letterSpacing:2,marginTop:3,fontWeight:700},heroDiv:{width:1,height:36,background:"rgba(255,255,255,0.06)"},heroCta:{fontSize:11,fontWeight:800,color:"#2A9D8F",letterSpacing:3},
  weekRow:{display:"flex",gap:3,marginBottom:14},weekCol:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2},weekWrap:{height:36,width:"100%",display:"flex",alignItems:"flex-end",justifyContent:"center"},weekBar:{width:"100%",borderRadius:"2px 2px 0 0",minHeight:2,transition:"height .3s"},weekLbl:{fontSize:8,color:"#5A6478",fontWeight:700},
  secHeader:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8},secTitle:{fontSize:10,fontWeight:700,color:"#5A6478",letterSpacing:2,margin:0},
  catGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(95px,1fr))",gap:6,marginBottom:16},
  catCard:{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.04)",borderRadius:8,cursor:"pointer",overflow:"hidden",display:"block",color:"inherit",padding:0,textAlign:"left",width:"100%"},
  catStripe:{height:2.5},catBody:{padding:"8px 7px 7px"},catTop:{display:"flex",alignItems:"center",gap:3,marginBottom:4},catName:{fontSize:10,fontWeight:700,color:"#fff"},catDue:{fontSize:8,color:"#2A9D8F",fontWeight:700,background:"rgba(42,157,143,0.12)",padding:"1px 4px",borderRadius:4},
  revWrap:{padding:"12px 16px",display:"flex",flexDirection:"column",minHeight:"calc(100vh - 60px)"},revProg:{display:"flex",alignItems:"center",gap:8,marginBottom:8},revProgBar:{flex:1,height:3,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden"},revProgFill:{height:"100%",background:"#2A9D8F",borderRadius:3,transition:"width .3s"},
  navArrow:{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,width:32,height:28,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#D5D3CF",fontSize:14,fontWeight:600},
  card:{flex:1,background:"linear-gradient(145deg,#111828,#0B1018)",borderRadius:16,border:"1px solid rgba(69,123,157,0.15)",padding:"24px 20px",display:"flex",flexDirection:"column",justifyContent:"center",cursor:"pointer",minHeight:260,transition:"all .15s",userSelect:"none"},
  cardFlip:{background:"linear-gradient(145deg,#0C1A1E,#081216)",borderColor:"rgba(42,157,143,0.2)"},
  cardFace:{display:"flex",flexDirection:"column",justifyContent:"center",flex:1,gap:14},
  cardTag:{background:"rgba(69,123,157,0.12)",color:"#457B9D",padding:"2px 7px",borderRadius:6,fontSize:9,fontWeight:600},
  cardQ:{fontSize:17,fontWeight:600,lineHeight:1.5,color:"#fff",textAlign:"center"},
  cardA:{fontSize:14,lineHeight:1.7,color:"#B8C6C0",whiteSpace:"pre-line"},
  rateRow:{display:"flex",gap:6,marginTop:14},
  rHard:{flex:1,background:"rgba(230,57,70,0.08)",border:"1px solid rgba(230,57,70,0.2)",borderRadius:12,padding:"10px 4px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,color:"#E63946",fontSize:12},
  rGood:{flex:1,background:"rgba(69,123,157,0.08)",border:"1px solid rgba(69,123,157,0.2)",borderRadius:12,padding:"10px 4px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,color:"#457B9D",fontSize:12},
  rEasy:{flex:1,background:"rgba(42,157,143,0.08)",border:"1px solid rgba(42,157,143,0.2)",borderRadius:12,padding:"10px 4px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,color:"#2A9D8F",fontSize:12},
  doneWrap:{padding:"50px 20px",textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:14},doneNum:{fontSize:24,fontWeight:900,color:"#2A9D8F"},doneLbl:{fontSize:9,color:"#5A6478",letterSpacing:1,textTransform:"uppercase",marginTop:1},
  expandCard:{background:"rgba(255,255,255,0.02)",borderRadius:10,padding:"12px 14px",border:"1px solid rgba(255,255,255,0.04)",marginBottom:6,cursor:"pointer"},
  miniStat:{background:"rgba(255,255,255,0.02)",borderRadius:8,padding:"10px 6px",textAlign:"center",border:"1px solid rgba(255,255,255,0.04)"},
  modeBtn:{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,cursor:"pointer",color:"inherit",textAlign:"left",width:"100%"},
  searchInput:{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,padding:"9px 12px",color:"#D5D3CF",fontSize:13,outline:"none",marginBottom:8,boxSizing:"border-box"},
  filterRow:{display:"flex",gap:4,flexWrap:"wrap",marginBottom:12,maxHeight:100,overflowY:"auto"},filterChip:{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"3px 8px",color:"#5A6478",fontSize:10,cursor:"pointer",fontWeight:500,whiteSpace:"nowrap"},filterAct:{background:"rgba(42,157,143,0.12)",borderColor:"#2A9D8F",color:"#2A9D8F"},
  tinyTag:{background:"rgba(255,255,255,0.05)",color:"#5A6478",padding:"1px 5px",borderRadius:5,fontSize:9},
  statGrid:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:20},statBox:{background:"rgba(255,255,255,0.02)",borderRadius:10,padding:"14px 6px",textAlign:"center",border:"1px solid rgba(255,255,255,0.04)"},statLbl:{fontSize:8,color:"#5A6478",letterSpacing:1.5,textTransform:"uppercase",marginTop:2},
  settingRow:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"},tBtn:{background:"rgba(255,255,255,0.06)",border:"none",borderRadius:6,width:26,height:26,color:"#fff",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"},
  muted:{fontSize:11,color:"#5A6478",fontStyle:"italic"},
  btnP:{background:"#2A9D8F",color:"#fff",border:"none",borderRadius:10,padding:"11px 16px",fontSize:13,fontWeight:700,cursor:"pointer"},
  btnS:{background:"rgba(69,123,157,0.12)",color:"#457B9D",border:"1px solid rgba(69,123,157,0.2)",borderRadius:10,padding:"11px 16px",fontSize:13,fontWeight:700,cursor:"pointer"},
  btnO:{background:"transparent",color:"#5A6478",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"11px 14px",fontSize:13,fontWeight:600,cursor:"pointer"},
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200,animation:"fadeIn .2s"},
  modal:{background:"#111828",borderRadius:"18px 18px 0 0",padding:"10px 20px 28px",width:"100%",maxWidth:720,maxHeight:"88vh",overflowY:"auto",animation:"slideUp .25s ease-out"},
  modalBar:{width:32,height:3,background:"rgba(255,255,255,0.15)",borderRadius:3,margin:"0 auto 14px"},modalTitle:{fontSize:16,fontWeight:800,color:"#fff",marginBottom:12},
  label:{display:"block",fontSize:9,fontWeight:700,color:"#5A6478",letterSpacing:1.5,marginBottom:4,marginTop:10,textTransform:"uppercase"},
  inp:{width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:8,padding:"9px 10px",color:"#D5D3CF",fontSize:13,outline:"none",resize:"vertical",boxSizing:"border-box"},
  importMeta:{background:"rgba(42,157,143,0.06)",borderRadius:8,padding:10,marginBottom:12,border:"1px solid rgba(42,157,143,0.12)"},
  nav:{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:720,background:"#0B1018",borderTop:"1px solid rgba(255,255,255,0.04)",display:"flex",alignItems:"center",justifyContent:"space-around",padding:"5px 0 env(safe-area-inset-bottom,8px)",zIndex:100},
  navBtn:{background:"none",border:"none",display:"flex",flexDirection:"column",alignItems:"center",gap:1,cursor:"pointer",padding:"2px 8px",color:"#5A6478"},navAct:{color:"#2A9D8F"},navIco:{fontSize:17},navLbl:{fontSize:8,fontWeight:700,letterSpacing:.5,textTransform:"uppercase"},
  navCenter:{background:"#2A9D8F",border:"none",borderRadius:"50%",width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",marginTop:-20,boxShadow:"0 4px 16px rgba(42,157,143,0.35)"},
  toast:{position:"fixed",top:14,left:"50%",transform:"translateX(-50%)",background:"#2A9D8F",color:"#fff",padding:"7px 20px",borderRadius:8,fontSize:12,fontWeight:600,zIndex:300,animation:"toastIn .25s ease-out",boxShadow:"0 6px 20px rgba(0,0,0,0.3)",whiteSpace:"nowrap"},
};
