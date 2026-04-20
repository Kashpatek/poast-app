"use client";
import React, { useState, useEffect, useMemo, Fragment } from "react";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { useUser } from "./user-context";

// ═══ DOCX HELPERS ═══
async function downloadDocx(title: string, body: string, filename: string) {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
      children: [new TextRun({ text: title, bold: true, size: 32, color: "F7B041", font: { name: "Outfit" } })],
    }),
  ];
  body.split("\n").forEach(function(line) {
    paragraphs.push(new Paragraph({
      spacing: { after: 100 },
      children: [new TextRun({ text: line || " ", size: 22, color: "1A1A1A", font: { name: "Outfit" } })],
    }));
  });
  const doc = new Document({ sections: [{ properties: {}, children: paragraphs }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/[^a-zA-Z0-9_.-]/g, "_") + ".docx";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Split Claude output like "--- YOUTUBE TITLE ---\n..." into { YT_TITLE: "...", X_HOOK: "..." }
function splitKitSections(raw: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const regex = /---\s+([^-]+?)\s+---\n([\s\S]*?)(?=\n---\s+[^-]+?\s+---|\s*$)/g;
  let m;
  while ((m = regex.exec(raw)) !== null) {
    const key = m[1].trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
    sections[key] = m[2].trim();
  }
  return sections;
}

interface Episode {
  id: string;
  guest: string;
  company: string;
  title: string;
  host: string;
  tier: number;
  tag: string;
  slot: number;
  status: string;
  virtual: boolean;
  received: boolean;
  scheduled: boolean;
  bio: string;
  companyDesc: string;
  logo: string;
  topics: string;
  notes?: string;
}

interface SailEp {
  guest: string;
  company: string;
  host: string;
  note?: string;
}

interface Cadence {
  label: string;
  days: number;
}

interface CalMonth {
  y: number;
  m: number;
  eps: (Episode & { date: Date })[];
}

var AMB = "#F7B041", BLU = "#0B86D1", BG0 = "#060608", BG1 = "#09090D", BDR = "rgba(255,255,255,0.06)", GRN = "#2EAD8E", RED = "#E06347", CYN = "#26C9D8";
var FONT = "'Outfit',sans-serif";
var MONO = "'JetBrains Mono',monospace";
var TC: Record<string, string> = {"Cloud/Infra":"#3b82f6","AI/ML":"#8b5cf6","Hardware":"#ef4444","GPU Optimization":"#f97316","Internal":"#6b7280","AI Safety":"#f59e0b","Neocloud":"#0ea5e9","AMD Ecosystem":"#dc2626","Energy/Infra":"#22c55e"};
var TL: Record<number, string> = {1:"Flagship",2:"Strong",3:"Standard"};
var DYLAN_SYS = "You write social captions for SemiAnalysis. Match this voice exactly.\n\nRULES:\n- Lead with a number or specific claim. A fact, not a vibe.\n- Casual, informed. Short sentences.\n- NEVER hashtags on X.\n- No marketing language. No breaks down or deep-dive or explores.\n- No em dashes. No emojis.\n- X hook: 1 sentence, no link, no hashtags.\n- X reply: just the link.\n- LinkedIn: 3-5 sentences with guest context.\n- Facebook: 3-5 sentences, conversational.\n- Story: one short line.";
var CADENCES = [{label:"Weekly",days:7},{label:"Bi-Weekly",days:14},{label:"Every 3 Weeks",days:21}];
var BASE_DATE = new Date(2026, 3, 22);
function slotDate(s: number, cd: number){var d=new Date(BASE_DATE);d.setDate(d.getDate()+s*cd);return d;}
function fm(d: Date){return d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});}
function fs(d: Date){return d.toLocaleDateString("en-US",{month:"short",day:"numeric"});}
var HOSTS=["All","Dylan Patel","Kimbo Chen","Wega Chu","Cameron Quilici","Jordan Nanos","Gerald Wong (Howie)","Rachel Zheng","Wega Chu / Rachel Zheng"];

var INIT: Episode[]=[
{id:"sa-0",guest:"Waleed Atallah",company:"Makora",title:"Co-Founder & CEO",host:"Dylan Patel",tier:1,tag:"GPU Optimization",slot:-1,status:"published",virtual:false,received:true,scheduled:true,bio:"Waleed Atallah is the co-founder and CEO of Makora, building AI agents that write and optimize GPU kernels. $8.5M seed led by M13, backed by Jeff Dean.",companyDesc:"Makora writes, optimizes, and deploys GPU code. MakoraGenerate writes kernels, MakoraOptimize tunes vLLM/SGLang.",logo:"https://logo.clearbit.com/makora.com",topics:"GPU kernel optimization, AI-native compilers"},
{id:"sa-1",guest:"Bryan Shan",company:"SemiAnalysis",title:"Member of Technical Staff",host:"Cameron Quilici",tier:3,tag:"Internal",slot:-1,status:"published",virtual:false,received:true,scheduled:true,bio:"Bryan Shan is MTS at SemiAnalysis, co-author on InferenceX v2. Nightly sweeps across SGLang, vLLM, TensorRT-LLM on ~1,000 GPUs.",companyDesc:"SemiAnalysis. InferenceX open-source inference benchmarking.",logo:"https://logo.clearbit.com/semianalysis.com",topics:"InferenceX, inference benchmarking, NVIDIA vs AMD"},
{id:"sa-2",guest:"David Randle",company:"Amazon AWS",title:"Principal Engineer",host:"Wega Chu",tier:1,tag:"Cloud/Infra",slot:0,status:"scheduled",virtual:false,received:false,scheduled:false,bio:"David Randle is a Principal Engineer at AWS focused on AI infrastructure, GPU cluster orchestration, and custom silicon strategy.",companyDesc:"AWS. Trainium, Inferentia, largest cloud platform.",logo:"https://logo.clearbit.com/aws.amazon.com",topics:"AWS AI infra, Trainium, custom silicon"},
{id:"sa-3",guest:"Thomas Sohmers",company:"Positron AI",title:"Co-Founder & CTO",host:"Jordan Nanos",tier:1,tag:"Hardware",slot:-1,status:"published",virtual:false,received:true,scheduled:true,bio:"Thomas Sohmers, Thiel Fellow at 17. Founded REX Computing, was at Lambda and Groq. Positron raised $305M, $1B+ valuation. Inference-first accelerators.",companyDesc:"Positron builds inference-optimized accelerators, 3-4x better perf/$ vs GPUs. Atlas is first LLM-inference-first chip. Made in U.S.",logo:"https://logo.clearbit.com/positron.ai",topics:"AI inference hardware, FPGA, competing with NVIDIA"},
{id:"sa-4",guest:"Lucas Atkins",company:"Arcee AI",title:"CTO",host:"Kimbo Chen",tier:2,tag:"AI/ML",slot:2,status:"scheduled",virtual:false,received:false,scheduled:false,bio:"Lucas Atkins, CTO of Arcee AI. Trained Trinity Large, 400B params on 2,048 Blackwell GPUs in 6 months for $20M.",companyDesc:"Arcee AI. Open-weight enterprise LLMs. Apache 2.0. ~$50M raised.",logo:"https://logo.clearbit.com/arcee.ai",topics:"open-source LLMs, Trinity, enterprise AI, pretraining"},
{id:"sa-5",guest:"Manish Shah",company:"Project VAIL",title:"Co-Founder & CEO",host:"Kimbo Chen",tier:2,tag:"AI Safety",slot:3,status:"scheduled",virtual:false,received:false,scheduled:false,bio:"Manish Shah co-founded VAIL (Verifiable AI Layer). Previously PeerWell (acquired), Rapleaf/LiveRamp. UC Berkeley.",companyDesc:"VAIL creates AI model verification standards. Cryptographic trust via TEEs.",logo:"",topics:"AI verification, cryptographic trust, TEEs"},
{id:"sa-6",guest:"Patrick Wohlschlegel",company:"Radiant",title:"Founder",host:"Jordan Nanos",tier:2,tag:"Energy/Infra",slot:4,status:"scheduled",virtual:false,received:false,scheduled:false,bio:"Patrick Wohlschlegel leads Radiant, energy infrastructure meets AI compute.",companyDesc:"Radiant. Power demands of GPU-dense data centers.",logo:"",topics:"AI energy, data center power"},
{id:"sa-7",guest:"Mohamed Abdelfattah",company:"Makora",title:"Co-Founder & CSO",host:"Kimbo Chen",tier:1,tag:"GPU Optimization",slot:5,status:"scheduled",virtual:true,received:false,scheduled:false,bio:"Mohamed Abdelfattah, Ph.D (U of Toronto). Leads science behind Makora's compiler and kernel engine. Advisors: Jeff Dean, Shyamal Anadket (OpenAI).",companyDesc:"Makora. MakoraGenerate writes GPU kernels. MakoraOptimize tunes inference. $8.5M seed.",logo:"https://logo.clearbit.com/makora.com",topics:"kernel generation, search optimization, CUDA vs Triton"},
{id:"sa-8",guest:"Narek Tatevosyan",company:"Nebius",title:"VP of Product",host:"Jordan Nanos",tier:1,tag:"Neocloud",slot:6,status:"scheduled",virtual:true,received:false,scheduled:false,bio:"Narek Tatevosyan, 15+ yrs IT. Built Yandex Cloud from scratch. Nebius: $27B Meta deal, $19.4B Microsoft, $2B NVIDIA. 170MW to 1GW in 2026.",companyDesc:"Nebius. Neocloud, NASDAQ (NBIS). $3.4B projected 2026 rev. 1.2GW Missouri campus.",logo:"https://logo.clearbit.com/nebius.com",topics:"neocloud, scaling capacity, Meta/Microsoft deals, MLPerf"},
{id:"sa-9",guest:"Jeff Tatarchuk",company:"TensorWave",title:"Co-Founder & CGO",host:"Cameron Quilici",tier:1,tag:"AMD Ecosystem",slot:7,status:"scheduled",virtual:true,received:false,scheduled:false,bio:"Jeff Tatarchuk co-founded TensorWave, only all-AMD GPU cloud. 8,192 MI325X cluster. $100M Series A. First to ship MI355X. $100M+ ARR.",companyDesc:"TensorWave. All-AMD, no NVIDIA. $145M raised. $800M debt facility. Beyond CUDA summit.",logo:"https://logo.clearbit.com/tensorwave.com",topics:"AMD MI355X, Beyond CUDA, ROCm, all-AMD inference"},
{id:"sa-10",guest:"Keval Shah",company:"Pebble",title:"AI Research Lead",host:"Jordan Nanos",tier:3,tag:"AI/ML",slot:8,status:"scheduled",virtual:false,received:false,scheduled:false,bio:"Keval Shah, AI Research Lead at Pebble.",companyDesc:"Pebble. AI-native tools.",logo:"",topics:""},
{id:"sa-11",guest:"Kimbo Chen",company:"SemiAnalysis",title:"Analyst",host:"Cameron Quilici",tier:3,tag:"Internal",slot:9,status:"scheduled",virtual:false,received:false,scheduled:false,bio:"Kimbo Chen, analyst at SemiAnalysis. AI systems architecture and interconnects.",companyDesc:"SemiAnalysis.",logo:"https://logo.clearbit.com/semianalysis.com",topics:""},
{id:"sa-12",guest:"Mishek Musa",company:"Analog",title:"Mechatronics Engineer",host:"Jordan Nanos",tier:3,tag:"Hardware",slot:10,status:"pending",virtual:false,received:false,scheduled:false,notes:"Needs approval",bio:"Mishek Musa, Mechatronics Engineer at Analog.",companyDesc:"Analog. Hardware and sensors.",logo:"",topics:""},
{id:"sa-prabha-aws",guest:"Prabha Ganapathy",company:"Amazon AWS",title:"Global Head, GenAI Strategic Initiatives",host:"Gerald Wong (Howie)",tier:2,tag:"Cloud/Infra",slot:1,status:"scheduled",virtual:false,received:true,scheduled:false,notes:"Recorded at GTC 2026. Based in Santa Clara County, CA. AWS since Sep 2023. TODO(akash): add bio and topics.",bio:"Prabha Ganapathy is Global Head of GenAI Strategic Initiatives at AWS, leading enterprise AI strategy and customer adoption across AWS's GenAI portfolio.",companyDesc:"AWS. Trainium, Inferentia, largest cloud platform.",logo:"https://logo.clearbit.com/aws.amazon.com",topics:""},
{id:"sa-karthik-aws",guest:"Karthik Venna",company:"Amazon AWS",title:"",host:"Wega Chu / Rachel Zheng",tier:2,tag:"Cloud/Infra",slot:11,status:"scheduled",virtual:false,received:true,scheduled:false,notes:"Recorded at GTC 2026. Co-hosted by Wega Chu and Rachel Zheng. TODO(akash): add title, bio, topics.",bio:"",companyDesc:"AWS. Trainium, Inferentia, largest cloud platform.",logo:"https://logo.clearbit.com/aws.amazon.com",topics:""},
];

var SAIL_EPS: SailEp[]=[
{guest:"Dan Fu",company:"Together AI",host:"Caithrin Rintoul",note:"SAIL-hosted"},
{guest:"Valentin Bercovici",company:"WEKA",host:"Kai Williams",note:"SAIL-hosted"},
{guest:"David Randle (Pt. 2)",company:"Amazon AWS",host:"Kai Williams",note:"SAIL-hosted"},
{guest:"Charles Frye",company:"Modal",host:"Lily Ottinger"},
{guest:"Varun Sivaram",company:"Emerald AI",host:"Kai Williams"},
{guest:"Alan Butler",company:"SF Compute",host:"Kai Williams"},
{guest:"Zach Mueller",company:"Lambda AI",host:"Caithrin Rintoul"},
{guest:"Caia Costello",company:"Lambda AI",host:"Caithrin Rintoul"},
];

// ═══ SUPABASE SYNC ═══
function dbSyncGtc(config: { eps: Episode[]; cadIdx: number; createdBy?: string; createdByRole?: string }) {
  fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table: "projects", data: { id: "gtc-master", name: "GTC Flow", data: config, type: "gtc", updated_at: new Date().toISOString() } }),
  }).catch(function() {});
}

function Badge(p: { bg: string; c?: string; children: React.ReactNode }){return <span style={{display:"inline-block",fontSize:10,fontWeight:600,padding:"3px 8px",borderRadius:6,background:p.bg,color:p.c||"#fff",letterSpacing:.5,fontFamily:FONT}}>{p.children}</span>}
function Btn(p: { onClick: () => void; on: boolean; sx?: React.CSSProperties; children: React.ReactNode }){return <button onClick={p.onClick} style={{padding:"8px 16px",border:p.on?"1px solid "+AMB+"50":"1px solid "+BDR,borderRadius:8,background:p.on?AMB+"12":"rgba(255,255,255,0.02)",color:p.on?AMB:"rgba(255,255,255,0.4)",cursor:"pointer",fontFamily:FONT,fontSize:13,fontWeight:p.on?700:500,transition:"all 0.15s",...(p.sx||{})}}>{p.children}</button>}
function Chk(p: { onClick: () => void; on: boolean }){return <span onClick={p.onClick} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:24,height:24,borderRadius:6,border:"2px solid "+(p.on?GRN:BDR),background:p.on?GRN+"20":"transparent",cursor:"pointer",fontSize:12,color:p.on?GRN:"rgba(255,255,255,0.25)",userSelect:"none",fontWeight:700,transition:"all 0.15s"}}>{p.on?"\u2713":""}</span>}

export default function GTCFlow(){
  var userCtx = useUser();
  var [view,setView]=useState("dash");
  var [eps,setEps]=useState(INIT);
  var [sel,setSel]=useState<Episode|null>(null);
  var [edit,setEdit]=useState(false);
  var [hostF,setHostF]=useState("All");
  var [tagF,setTagF]=useState("All");
  var [showSail,setShowSail]=useState(false);
  var [cadIdx,setCadIdx]=useState(1);
  var [cadLocked,setCadLocked]=useState(true);
  var [dragId,setDragId]=useState<string|null>(null);
  var [subV,setSubV]=useState("timeline");
  var [loaded,setLoaded]=useState(false);
  var [showAdd,setShowAdd]=useState(false);

  // Merge any code-defined INIT episodes that aren't already in the stored list.
  // Preserves user edits to existing ids; backfills new ones we add in code.
  // Also strips legacy stale ids (like "sa-13" orphaned from renamed entries)
  // and dedupes by guest name.
  function mergeWithInit(stored: Episode[]): Episode[] {
    var STALE_IDS: Record<string, boolean> = { "sa-13": true };
    var initGuests: Record<string, boolean> = {};
    INIT.forEach(function(e){ initGuests[e.guest]=true; });
    // Drop stale ids + any stored entry whose guest is an INIT guest but id differs
    // (this would mean a rename/re-id happened in code and stored still has the old stub)
    var cleaned = stored.filter(function(e){
      if (STALE_IDS[e.id]) return false;
      if (initGuests[e.guest]) {
        var initMatch = INIT.find(function(i){return i.guest===e.guest});
        if (initMatch && initMatch.id !== e.id) return false; // drop stale dup
      }
      return true;
    });
    var have: Record<string, boolean> = {};
    cleaned.forEach(function(e){have[e.id]=true});
    var missing=INIT.filter(function(e){return !have[e.id]});
    return cleaned.concat(missing);
  }

  // Load from localStorage helper
  function loadFromLS(){
    try{var s=localStorage.getItem("pv4");if(s){var parsed:Episode[]=JSON.parse(s);setEps(mergeWithInit(parsed))}}catch(e){}
    try{var c=localStorage.getItem("pv4c");if(c)setCadIdx(JSON.parse(c));}catch(e){}
  }

  // On mount: fetch from Supabase, fall back to localStorage
  useEffect(function(){
    var settled=false;
    var timer=setTimeout(function(){
      if(settled)return;
      settled=true;
      loadFromLS();
      setLoaded(true);
    },800);

    fetch("/api/db?table=projects").then(function(r){return r.json()}).then(function(res){
      if(settled)return;
      clearTimeout(timer);
      settled=true;
      if(res.data&&res.data.length>0){
        var row=res.data.find(function(r: Record<string, unknown>){return r.type==="gtc"&&r.id==="gtc-master"});
        if(row&&row.data){
          var cfg=row.data;
          if(cfg.eps&&cfg.eps.length>0)setEps(mergeWithInit(cfg.eps));
          if(cfg.cadIdx!==undefined)setCadIdx(cfg.cadIdx);
          setLoaded(true);
          return;
        }
      }
      loadFromLS();
      setLoaded(true);
    }).catch(function(){
      if(settled)return;
      clearTimeout(timer);
      settled=true;
      loadFromLS();
      setLoaded(true);
    });

    return function(){clearTimeout(timer)};
  },[]);

  // Persist on change: localStorage + Supabase fire-and-forget
  useEffect(function(){
    if(!loaded)return;
    try{localStorage.setItem("pv4",JSON.stringify(eps));localStorage.setItem("pv4c",JSON.stringify(cadIdx));}catch(e){}
    // TODO(akash): GTC Flow config is shared (id: "gtc-master") so createdBy reflects only the most recent editor across all users.
    dbSyncGtc({eps:eps,cadIdx:cadIdx,createdBy: userCtx.user ? userCtx.user.name : "Unknown", createdByRole: userCtx.user ? userCtx.user.role : ""});
  },[eps,cadIdx,loaded]);

  var cad=CADENCES[cadIdx];
  var pub=eps.filter(function(e){return e.status==="published"});
  var sched=eps.filter(function(e){return e.status!=="published"}).sort(function(a,b){return a.slot-b.slot});
  var filtered=sched.filter(function(e){return(hostF==="All"||e.host===hostF)&&(tagF==="All"||e.tag===tagF)});
  var allTags=[...new Set(eps.map(function(e){return e.tag}))].sort();

  function tog(id: string, f: "received" | "scheduled"){setEps(function(p){return p.map(function(e){if(e.id!==id)return e;var n=Object.assign({},e);n[f]=!n[f];return n})})}
  function markPub(id: string){setEps(function(p){var a=p.map(function(e){return Object.assign({},e)});var ep=a.find(function(e){return e.id===id});if(ep){ep.status="published";ep.slot=-1}var r=a.filter(function(e){return e.status!=="published"}).sort(function(x,y){return x.slot-y.slot});r.forEach(function(e,i){e.slot=i});return a})}
  function unPub(id: string){setEps(function(p){var a=p.map(function(e){return Object.assign({},e)});var ep=a.find(function(e){return e.id===id});if(ep){ep.status="scheduled";var maxSlot=a.filter(function(e){return e.status!=="published"}).reduce(function(m,e){return Math.max(m,e.slot)},-1);ep.slot=maxSlot+1}return a})}
  function doDrop(tid: string){if(!dragId||dragId===tid)return;setEps(function(p){var a=p.map(function(e){return Object.assign({},e)});var f=a.find(function(e){return e.id===dragId});var t=a.find(function(e){return e.id===tid});if(f&&t){var tmp=f.slot;f.slot=t.slot;t.slot=tmp}return a});setDragId(null)}
  function addEp(ep: Episode){setEps(function(p){return p.concat([ep])});setShowAdd(false)}
  function updateEp(updated: Episode){setEps(function(p){return p.map(function(e){return e.id===updated.id?updated:e})})}
  function deleteEp(id: string){setEps(function(p){var a=p.filter(function(e){return e.id!==id});var s=a.filter(function(e){return e.status!=="published"}).sort(function(x,y){return x.slot-y.slot});s.forEach(function(e,i){e.slot=i});return a})}

  if(view==="ep"&&sel)return <EpDet ep={sel} cad={cad} onBack={function(){setView("dash");setSel(null)}} onUpdate={function(u: Episode){updateEp(u);setSel(u)}}/>;

  return(<div style={{fontFamily:FONT,color:"#E8E4DD"}}><div style={{maxWidth:1140,margin:"0 auto",padding:"28px 32px 60px"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:10}}>
      <div>
        <div style={{fontSize:28,fontWeight:900,color:"#E8E4DD",letterSpacing:-1}}>GTC Flow</div>
        <div style={{fontFamily:MONO,fontSize:10,fontWeight:600,color:"rgba(255,255,255,0.25)",letterSpacing:2,marginTop:2}}>WED 8AM PST // CLIPS THU+TUE 10AM PST</div>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        <Btn on={subV==="timeline"} onClick={function(){setSubV("timeline")}}>Timeline</Btn>
        <Btn on={subV==="calendar"} onClick={function(){setSubV("calendar")}}>Calendar</Btn>
        <Btn on={showSail} onClick={function(){setShowSail(!showSail)}} sx={{borderColor:BLU}}>SAIL</Btn>
        <Btn on={edit} onClick={function(){setEdit(!edit)}} sx={{marginLeft:4}}>{edit?"Done":"Edit"}</Btn>
        {edit&&<Btn on={true} onClick={function(){setShowAdd(true)}} sx={{background:AMB+"18",borderColor:AMB,color:AMB}}>+ Add Episode</Btn>}
      </div>
    </div>

    <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginBottom:14}}>
      <span style={{fontFamily:MONO,fontSize:10,fontWeight:600,color:"rgba(255,255,255,0.25)",letterSpacing:2}}>CADENCE</span>
      {CADENCES.map(function(c,i){return <button key={i} disabled={cadLocked&&i!==cadIdx} onClick={function(){if(!cadLocked)setCadIdx(i)}} style={{padding:"6px 14px",border:i===cadIdx?"1px solid "+AMB+"50":"1px solid "+BDR,borderRadius:8,background:i===cadIdx?AMB+"12":"rgba(255,255,255,0.02)",color:i===cadIdx?AMB:"rgba(255,255,255,0.3)",cursor:cadLocked&&i!==cadIdx?"not-allowed":"pointer",fontFamily:FONT,fontSize:12,fontWeight:i===cadIdx?700:500,opacity:cadLocked&&i!==cadIdx?.3:1,transition:"all 0.15s"}}>{c.label}</button>})}
      <button onClick={function(){setCadLocked(!cadLocked)}} style={{padding:"5px 12px",border:"1px solid "+(cadLocked?GRN+"40":RED+"40"),borderRadius:8,background:"transparent",color:cadLocked?GRN:RED,cursor:"pointer",fontFamily:FONT,fontSize:11,fontWeight:600,transition:"all 0.15s"}}>{cadLocked?"Locked":"Unlock"}</button>
      <span style={{width:1,height:16,background:BDR,margin:"0 8px"}}/>
      <span style={{fontFamily:MONO,fontSize:10,fontWeight:600,color:"rgba(255,255,255,0.25)",letterSpacing:2}}>HOST</span>
      <select value={hostF} onChange={function(e){setHostF(e.target.value)}} style={{padding:"6px 10px",background:"#09090D",border:"1px solid "+BDR,borderRadius:8,color:AMB,fontFamily:FONT,fontSize:12}}>{HOSTS.map(function(h){return <option key={h} value={h}>{h}</option>})}</select>
      <span style={{fontFamily:MONO,fontSize:10,fontWeight:600,color:"rgba(255,255,255,0.25)",letterSpacing:2}}>TOPIC</span>
      <select value={tagF} onChange={function(e){setTagF(e.target.value)}} style={{padding:"6px 10px",background:"#09090D",border:"1px solid "+BDR,borderRadius:8,color:BLU,fontFamily:FONT,fontSize:12}}><option value="All">All</option>{allTags.map(function(t){return <option key={t} value={t}>{t}</option>})}</select>
    </div>

    {/* Stats */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:20,padding:18,background:"#09090D",borderRadius:10,border:"1px solid "+BDR}}>
      {[{l:"Published",v:pub.length,c:GRN},{l:"Remaining",v:sched.length,c:AMB},{l:"Cadence",v:cad.label,c:"rgba(255,255,255,0.55)"},{l:"Full Ep",v:"8AM PST",c:AMB},{l:"Clips",v:"10AM PST",c:BLU}].map(function(s,i){return <div key={i} style={{textAlign:"center"}}><div style={{fontFamily:MONO,fontSize:22,fontWeight:900,color:s.c}}>{s.v}</div><div style={{fontFamily:MONO,fontSize:9,fontWeight:600,color:"rgba(255,255,255,0.2)",textTransform:"uppercase",letterSpacing:1.5,marginTop:4}}>{s.l}</div></div>})}
    </div>

    {pub.length>0&&<div style={{marginBottom:16,padding:12,background:GRN+"08",borderRadius:8,border:"1px solid "+GRN+"30"}}>
      <div style={{fontSize:10,color:GRN,textTransform:"uppercase",letterSpacing:2,fontWeight:700,marginBottom:8}}>Published{edit?" (click Restore to move back to schedule)":""}</div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{pub.map(function(ep){return <div key={ep.id} style={{padding:"8px 14px",borderRadius:6,background:GRN+"0a",border:"1px solid "+GRN+"25",cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
        <div onClick={function(){setSel(ep);setView("ep")}}><div style={{fontSize:13,fontWeight:700,color:"#d1d5db"}}>{ep.guest}</div><div style={{fontSize:10,color:"#6b7280"}}>{ep.company} // {ep.host}</div></div>
        {edit&&<button onClick={function(ev){ev.stopPropagation();unPub(ep.id)}} style={{background:AMB+"20",border:"1px solid "+AMB,borderRadius:4,color:AMB,cursor:"pointer",fontFamily:FONT,fontSize:10,padding:"4px 10px",fontWeight:700,whiteSpace:"nowrap"}}>Restore</button>}
      </div>})}</div>
    </div>}

    {edit&&<div style={{padding:16,background:BG1,borderRadius:8,border:"2px solid "+AMB+"40",marginBottom:18}}>
      <div style={{fontSize:10,color:AMB,textTransform:"uppercase",letterSpacing:2,fontWeight:700,marginBottom:10}}>Drag to reorder. Checkmarks: RCV=Received, SCH=Scheduled. Pub=mark published.</div>
      {sched.map(function(ep,idx){var d=slotDate(ep.slot,cad.days);return <div key={ep.id} draggable onDragStart={function(){setDragId(ep.id)}} onDragOver={function(ev){ev.preventDefault()}} onDrop={function(){doDrop(ep.id)}} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 12px",marginBottom:2,borderRadius:6,background:dragId===ep.id?AMB+"18":"rgba(255,255,255,0.015)",border:dragId===ep.id?"1px solid "+AMB:"1px solid transparent",cursor:"grab"}}>
        <span style={{fontSize:11,color:"#4b5563",fontWeight:700,width:20}}>{idx+1}</span>
        <Chk on={ep.received} onClick={function(){tog(ep.id,"received")}}/>
        <Chk on={ep.scheduled} onClick={function(){tog(ep.id,"scheduled")}}/>
        <Badge bg={ep.tier===1?AMB:ep.tier===2?BLU:"#2a2d35"} c={ep.tier===3?"#9ca3af":"#0D0F14"}>T{ep.tier}</Badge>
        {ep.virtual?<span style={{fontSize:8,color:CYN}}>VRT</span>:<span style={{fontSize:8,color:"#374151"}}>IRL</span>}
        <span style={{fontSize:12,fontWeight:600,color:"#d1d5db",flex:1}}>{ep.guest}</span>
        <span style={{fontSize:11,color:"#6b7280"}}>{ep.company}</span>
        <span style={{fontSize:10,color:"#4b5563"}}>{ep.host}</span>
        <span style={{fontSize:9,color:"#374151"}}>{fs(d)}</span>
        <button onClick={function(){markPub(ep.id)}} style={{background:GRN+"20",border:"2px solid "+GRN,borderRadius:6,color:GRN,cursor:"pointer",fontFamily:FONT,fontSize:11,padding:"5px 12px",fontWeight:700}}>Publish</button>
        <button onClick={function(){if(confirm("Delete "+ep.guest+"?"))deleteEp(ep.id)}} style={{background:RED+"20",border:"1px solid "+RED,borderRadius:6,color:RED,cursor:"pointer",fontFamily:FONT,fontSize:11,padding:"5px 8px",fontWeight:700,lineHeight:1}}>X</button>
      </div>})}
    </div>}

    {subV==="timeline"&&<div style={{position:"relative"}}>
      <div style={{position:"absolute",left:50,top:0,bottom:0,width:2,background:"linear-gradient(to bottom,"+AMB+","+BDR+" 12%,"+BDR+" 88%,"+AMB+")"}}/>
      {filtered.map(function(ep,idx){var d=slotDate(ep.slot,cad.days);var isF=ep.tier===1;var isN=idx===0&&hostF==="All"&&tagF==="All";var tc=TC[ep.tag]||"#6b7280";var thu=new Date(d.getTime()+864e5);var tue=new Date(d.getTime()+6*864e5);
      return <div key={ep.id} style={{display:"flex",gap:14,marginBottom:5,position:"relative",minHeight:54}}>
        <div style={{width:100,flexShrink:0,textAlign:"right",paddingRight:18,paddingTop:8}}>
          <div style={{fontSize:11,fontWeight:isF?800:500,color:isN?GRN:isF?AMB:"#374151"}}>{isN?"NEXT UP":"Wk "+(idx+1)}</div>
          <div style={{fontSize:10,color:"#4b5563"}}>{fs(d)}</div>
          <div style={{fontSize:8,color:"#2a2d35"}}>8AM PST</div>
        </div>
        <div style={{position:"absolute",left:isF?46:48,top:12,width:isF?12:8,height:isF?12:8,borderRadius:"50%",background:isN?GRN:isF?AMB:BDR,border:"2px solid "+(isN?GRN:isF?AMB:"#2a2d35"),zIndex:2}}/>
        <div style={{flex:1,paddingTop:4}}>
          <div onClick={function(){setSel(ep);setView("ep")}} style={{padding:"10px 14px",borderRadius:8,background:AMB+"08",border:"1px solid "+AMB+"20",cursor:"pointer",maxWidth:520}}>
            <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}>
              <Badge bg={AMB} c="#0D0F14">SA</Badge>
              <span style={{fontSize:9,padding:"2px 5px",borderRadius:3,border:"1px solid "+tc+"50",color:tc,background:tc+"12"}}>{ep.tag}</span>
              <span style={{fontSize:8,color:"#374151"}}>T{ep.tier}</span>
              {ep.virtual&&<span style={{fontSize:8,color:CYN,border:"1px solid "+CYN+"30",padding:"1px 4px",borderRadius:3}}>VRT</span>}
              {ep.received&&<span style={{fontSize:8,color:GRN}}>RCV</span>}
              {ep.scheduled&&<span style={{fontSize:8,color:BLU}}>SCH</span>}
            </div>
            <div style={{fontSize:15,fontWeight:700,color:"#f3f4f6"}}>{ep.guest}</div>
            <div style={{fontSize:11,color:"#6b7280"}}>{ep.title} at {ep.company} // {ep.host}</div>
            <div style={{display:"flex",gap:10,marginTop:5,fontSize:9,color:"#4b5563"}}>
              <span style={{color:AMB}}>Full: {fs(d)} 8AM</span>
              <span style={{color:BLU}}>Clip1: Thu {fs(thu)} 10AM</span>
              <span style={{color:BLU}}>Clip2: Tue {fs(tue)} 10AM</span>
              <span>+Story</span>
            </div>
          </div>
        </div>
      </div>})}
      {showSail&&<div style={{marginTop:20,paddingTop:16,borderTop:"1px solid "+BDR}}>
        <div style={{fontSize:10,color:BLU,textTransform:"uppercase",letterSpacing:2,fontWeight:700,marginBottom:10}}>SAIL / Caithrin / Kai (not SA-posted)</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{SAIL_EPS.map(function(s,i){return <div key={i} style={{padding:"6px 10px",borderRadius:6,background:BLU+"08",border:"1px solid "+BLU+"18"}}><div style={{fontSize:12,fontWeight:600,color:"#9ca3af"}}>{s.guest}</div><div style={{fontSize:10,color:"#4b5563"}}>{s.company} // {s.host}{s.note?" // "+s.note:""}</div></div>})}</div>
      </div>}
    </div>}

    {subV==="calendar"&&<CalV eps={sched} cad={cad} onSel={function(ep){setSel(ep);setView("ep")}}/>}

    <div style={{padding:16,background:BG1,borderRadius:8,border:"1px solid "+BDR,marginTop:24}}>
      <div style={{fontSize:10,color:AMB,textTransform:"uppercase",letterSpacing:2,fontWeight:700,marginBottom:8}}>Rollout</div>
      <p style={{fontSize:12,color:"#9ca3af",lineHeight:1.8,margin:0}}>{cad.label} Wednesdays at 8AM PST. Clip #1 Thursday 10AM. Clip #2 following Tuesday 10AM. All clips go to X, YT Shorts, IG Reels, TikTok (stagger 4-6hr), Story. LinkedIn and Facebook get longer captions. Caithrin/Kai episodes are SAIL's.</p>
    </div>
    {showAdd&&<AddEpisodeModal onAdd={addEp} onClose={function(){setShowAdd(false)}} maxSlot={sched.length>0?sched.reduce(function(m,e){return Math.max(m,e.slot)},-1):-1}/>}
  </div></div>);
}

function CalV(p: { eps: Episode[]; cad: Cadence; onSel: (ep: Episode) => void }){var eps=p.eps,cad=p.cad,onSel=p.onSel;var mo: Record<string, CalMonth>={};eps.forEach(function(ep){var d=slotDate(ep.slot,cad.days);var k=d.getFullYear()+"-"+d.getMonth();if(!mo[k])mo[k]={y:d.getFullYear(),m:d.getMonth(),eps:[]};mo[k].eps.push(Object.assign({},ep,{date:d}))});
return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>{Object.values(mo).map(function(m: CalMonth,mi: number){var fd=new Date(m.y,m.m,1).getDay();var dim=new Date(m.y,m.m+1,0).getDate();var cells: (number|null)[] =[];for(var i=0;i<fd;i++)cells.push(null);for(var d=1;d<=dim;d++)cells.push(d);
return <div key={mi} style={{padding:14,background:BG1,borderRadius:8,border:"1px solid "+BDR}}>
  <div style={{fontSize:13,fontWeight:700,color:AMB,marginBottom:8}}>{new Date(m.y,m.m).toLocaleDateString("en-US",{month:"long",year:"numeric"})}</div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,fontSize:9}}>
    {["Su","Mo","Tu","We","Th","Fr","Sa"].map(function(dn){return <div key={dn} style={{textAlign:"center",color:"#4b5563",padding:3,fontWeight:700}}>{dn}</div>})}
    {cells.map(function(day,ci){if(!day)return <div key={"e"+ci}/>;var epH=m.eps.find(function(e){return e.date.getDate()===day});var has=!!epH;return <div key={ci} onClick={function(){if(has && epH)onSel(epH)}} style={{textAlign:"center",padding:"6px 3px",borderRadius:4,background:epH?BG0:"transparent",border:epH?"2px solid "+GRN:"1px solid transparent",color:epH?"#ffffff":"#9ca3af",cursor:has?"pointer":"default",fontWeight:epH?700:400,fontSize:11}}>{day}{epH&&<div style={{fontSize:8,color:GRN,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:700}}>{epH.guest.split(" ")[0]}</div>}</div>})}
  </div></div>})}</div>}

var ADD_TAGS=["Cloud/Infra","AI/ML","Hardware","GPU Optimization","Internal","AI Safety","Neocloud","AMD Ecosystem","Energy/Infra"];

function AddEpisodeModal(p: { onAdd: (ep: Episode) => void; onClose: () => void; maxSlot: number }){
  var onAdd=p.onAdd,onClose=p.onClose,maxSlot=p.maxSlot;
  var [guest,setGuest]=useState("");
  var [company,setCompany]=useState("");
  var [title,setTitle]=useState("");
  var [host,setHost]=useState(HOSTS[1]);
  var [tier,setTier]=useState(2);
  var [tag,setTag]=useState("AI/ML");
  var [virtual_,setVirtual]=useState(false);
  var [bio,setBio]=useState("");
  var [companyDesc,setCompanyDesc]=useState("");
  var [logo,setLogo]=useState("");
  var [topics,setTopics]=useState("");

  function submit(ev: React.FormEvent){
    ev.preventDefault();
    if(!guest.trim()||!company.trim())return;
    onAdd({id:"sa-"+Date.now(),guest:guest.trim(),company:company.trim(),title:title.trim(),host:host,tier:Number(tier),tag:tag,slot:maxSlot+1,status:"scheduled",virtual:virtual_,received:false,scheduled:false,bio:bio.trim(),companyDesc:companyDesc.trim(),logo:logo.trim(),topics:topics.trim()});
  }

  var lbl: React.CSSProperties={fontSize:10,color:AMB,textTransform:"uppercase",letterSpacing:1.5,fontWeight:700,marginBottom:4,fontFamily:MONO};
  var inp: React.CSSProperties={width:"100%",padding:"8px 10px",background:BG0,border:"1px solid "+BDR,borderRadius:8,color:"#d1d5db",fontFamily:FONT,fontSize:12,outline:"none",boxSizing:"border-box"};
  var sel_: React.CSSProperties={width:"100%",padding:"8px 10px",background:BG0,border:"1px solid "+BDR,borderRadius:8,color:AMB,fontFamily:FONT,fontSize:12,outline:"none",boxSizing:"border-box"};
  var ta: React.CSSProperties={width:"100%",minHeight:70,padding:"8px 10px",background:BG0,border:"1px solid "+BDR,borderRadius:8,color:"#d1d5db",fontFamily:FONT,fontSize:12,resize:"vertical",outline:"none",boxSizing:"border-box"};

  return <div style={{position:"fixed",inset:0,zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)"}}>
    <div style={{width:540,maxHeight:"85vh",overflow:"auto",background:"#0F0F18",borderRadius:12,border:"1px solid "+BDR,padding:28,fontFamily:FONT}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div style={{fontSize:20,fontWeight:900,color:"#E8E4DD",letterSpacing:-0.5}}>Add Episode</div>
        <button onClick={onClose} style={{background:"transparent",border:"1px solid "+BDR,borderRadius:6,color:"rgba(255,255,255,0.4)",cursor:"pointer",fontFamily:FONT,fontSize:16,padding:"4px 10px",lineHeight:1}}>X</button>
      </div>
      <form onSubmit={submit}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div><div style={lbl}>Guest *</div><input value={guest} onChange={function(e){setGuest(e.target.value)}} required placeholder="Full name" style={inp}/></div>
          <div><div style={lbl}>Company *</div><input value={company} onChange={function(e){setCompany(e.target.value)}} required placeholder="Company name" style={inp}/></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
          <div><div style={lbl}>Title</div><input value={title} onChange={function(e){setTitle(e.target.value)}} placeholder="CEO, CTO, etc." style={inp}/></div>
          <div><div style={lbl}>Host</div><select value={host} onChange={function(e){setHost(e.target.value)}} style={sel_}>{HOSTS.filter(function(h){return h!=="All"}).map(function(h){return <option key={h} value={h}>{h}</option>})}</select></div>
          <div><div style={lbl}>Tier</div><select value={tier} onChange={function(e){setTier(Number(e.target.value))}} style={sel_}><option value={1}>1 - Flagship</option><option value={2}>2 - Strong</option><option value={3}>3 - Standard</option></select></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div><div style={lbl}>Tag</div><select value={tag} onChange={function(e){setTag(e.target.value)}} style={sel_}>{ADD_TAGS.map(function(t){return <option key={t} value={t}>{t}</option>})}</select></div>
          <div style={{display:"flex",alignItems:"flex-end",paddingBottom:2}}><label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}><input type="checkbox" checked={virtual_} onChange={function(e){setVirtual(e.target.checked)}}/><span style={{fontSize:12,color:virtual_?CYN:"rgba(255,255,255,0.4)",fontFamily:FONT,fontWeight:600}}>Virtual (Riverside)</span></label></div>
        </div>
        <div style={{marginBottom:12}}><div style={lbl}>Bio</div><textarea value={bio} onChange={function(e){setBio(e.target.value)}} placeholder="Guest bio..." style={ta}/></div>
        <div style={{marginBottom:12}}><div style={lbl}>Company Description</div><textarea value={companyDesc} onChange={function(e){setCompanyDesc(e.target.value)}} placeholder="What the company does..." style={ta}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
          <div><div style={lbl}>Logo URL</div><input value={logo} onChange={function(e){setLogo(e.target.value)}} placeholder="https://logo.clearbit.com/..." style={inp}/></div>
          <div><div style={lbl}>Topics (comma-separated)</div><input value={topics} onChange={function(e){setTopics(e.target.value)}} placeholder="AI inference, custom silicon" style={inp}/></div>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button type="button" onClick={onClose} style={{padding:"10px 20px",border:"1px solid "+BDR,borderRadius:8,background:"transparent",color:"rgba(255,255,255,0.4)",cursor:"pointer",fontFamily:FONT,fontSize:13,fontWeight:600}}>Cancel</button>
          <button type="submit" style={{padding:"10px 24px",border:"1px solid "+AMB,borderRadius:8,background:AMB+"18",color:AMB,cursor:"pointer",fontFamily:FONT,fontSize:13,fontWeight:700}}>Add Episode</button>
        </div>
      </form>
    </div>
  </div>;
}

function EpDet(p: { ep: Episode; cad: Cadence; onBack: () => void; onUpdate: (ep: Episode) => void }){var ep=p.ep,cad=p.cad,onBack=p.onBack,onUpdate=p.onUpdate;
  var [tab,setTab]=useState("kit");var [genK,setGenK]=useState(false);var [kitOut,setKitOut]=useState("");var [c1,setC1]=useState("");var [c2,setC2]=useState("");var [clipOut,setClipOut]=useState("");var [genC,setGenC]=useState(false);var [cp,setCp]=useState("");
  var [ytTranscript,setYtTranscript]=useState("");var [ytOut,setYtOut]=useState("");var [genYt,setGenYt]=useState(false);
  var [editing,setEditing]=useState(false);
  var [eBio,setEBio]=useState(ep.bio||"");
  var [eTitle,setETitle]=useState(ep.title||"");
  var [eHost,setEHost]=useState(ep.host||"");
  var [eCompanyDesc,setECompanyDesc]=useState(ep.companyDesc||"");
  var [eTopics,setETopics]=useState(ep.topics||"");
  function saveEdit(){onUpdate(Object.assign({},ep,{bio:eBio,title:eTitle,host:eHost,companyDesc:eCompanyDesc,topics:eTopics}));setEditing(false);}
  function cancelEdit(){setEBio(ep.bio||"");setETitle(ep.title||"");setEHost(ep.host||"");setECompanyDesc(ep.companyDesc||"");setETopics(ep.topics||"");setEditing(false);}
  var d=ep.slot>=0?slotDate(ep.slot,cad.days):new Date(2026,3,2);var tc=TC[ep.tag]||"#6b7280";var thu=new Date(d.getTime()+864e5);var tue=new Date(d.getTime()+6*864e5);
  var seriesPara=ep.virtual
    ?"Researcher Conversations is a live interview series recorded virtually via Riverside, produced by SemiAnalysis in partnership with SAIL and Makora. Technical deep-dives with the researchers, founders, and engineers building the future of AI compute."
    :"Researcher Conversations is a live interview series recorded on-site at NVIDIA GTC 2026 in San Jose, produced by SemiAnalysis in partnership with SAIL and Makora. Technical deep-dives with the researchers, founders, and engineers building the future of AI compute.";
  var ytD=ep.host+" sits down with "+ep.guest+", "+ep.title+" at "+ep.company+", to discuss "+(ep.topics||"[TOPICS]")+". "+(ep.guest.split(" ")[0])+" dives into [2-3 specific technical details from the conversation — what they built, specific numbers, concrete wins].\n\n"+(ep.bio||"[GUEST BIO WITH SPECIFIC ACCOMPLISHMENTS AND METRICS]")+"\n\n"+seriesPara;
  var bio2=ep.bio?ep.bio.split(".").slice(0,2).join(".")+".":"";
  var kit="GTC INTERVIEW LAUNCH KIT\n==============================\n"+ep.guest+" ("+ep.company+")\nHost: "+ep.host+" // "+fm(d)+" 8:00 AM PST"+(ep.virtual?" // Virtual":"")+"\nLink: [INSERT YOUTUBE LINK]\nThumbnail: [ATTACH]\n\n--- YOUTUBE DESCRIPTION ---\n"+ytD+"\n\n--- X (HOOK) ---\n"+(ep.topics?ep.topics.split(",")[0].trim():"[TOPIC]")+" with "+ep.guest+" from "+ep.company+".\n\n--- X (REPLY) ---\n[INSERT YOUTUBE LINK]\n\n--- LINKEDIN ---\n"+ep.guest+", "+ep.title+" at "+ep.company+", on "+(ep.topics||"[topics]")+". "+bio2+" New episode of Researcher Conversations"+(ep.virtual?", recorded via Riverside":"")+". Worth the listen if you care about "+(ep.tag||"this space")+".\n\n[INSERT YOUTUBE LINK]\n\n--- FACEBOOK ---\n"+ep.guest+" from "+ep.company+" on "+(ep.topics||"[topics]")+". "+bio2+" Full Researcher Conversations episode"+(ep.virtual?" recorded virtually":"")+". Good one.\n\n[INSERT YOUTUBE LINK]\n\n--- STORY ---\nNew ep: "+ep.guest+" // "+ep.company+"\n\n--- REGIMENT ---\n"+fm(d)+" 8:00 AM PST    YouTube + X + LinkedIn + Facebook + Story\nThu "+fs(thu)+" 10:00 AM PST    Clip #1 (Shorts + Reels + X + TikTok + Story)\nTue "+fs(tue)+" 10:00 AM PST    Clip #2 (Shorts + Reels + X + TikTok + Story)";

  var firstName = ep.guest.split(" ")[0];
  function doCopy(t: string, l: string){navigator.clipboard.writeText(t);setCp(l);setTimeout(function(){setCp("")},2000)}

  var KIT_SYS = [
    "You write launch kits for SemiAnalysis GTC interview series (Researcher Conversations by SAIL).",
    "Every piece of content must be attention-grabbing, specific, and make the reader want to click/watch.",
    "The user launches with either the video thumbnail OR just the link — so captions must sell the watch on their own.",
    "",
    "STYLE RULES:",
    "- Lead with a specific number, claim, or concrete technical detail. Never vibes. Never marketing fluff.",
    "- Short sentences. Casual but informed. Direct.",
    "- No em dashes. No emojis. No generic hype words (revolutionary, game-changing, explores, dives deep, breaks down).",
    "- Hooks should make readers stop scrolling. Use curiosity gaps, surprising numbers, or contrarian takes.",
    "- X: NEVER hashtags. 1 sentence hook.",
    "- LinkedIn: 3-5 sentences, guest context + why it matters to industry.",
    "- Facebook: 3-5 sentences, conversational, a little more color.",
    "- Story: 1 punchy line.",
    "",
    "REFERENCE YOUTUBE DESCRIPTION (match this quality):",
    "Jordan Nanos sits down with Thomas Sohmers, Co-Founder & CTO at Positron AI, to discuss AI inference hardware, FPGA, competing with NVIDIA. Thomas dives into how Positron is achieving a 1:1 ratio for matrix-matrix and matrix-vector performance, their strategic shift to LPDDR memory to bypass HBM supply constraints, and how their Titan server is designed to run 16-trillion parameter models with million-token context lengths on a single box.",
    "",
    "Thomas Sohmers is a hardware pioneer and the founder of Positron AI, a startup reimagining the infrastructure for large-scale AI inference. By focusing on maximizing memory bandwidth utilization (hitting 93% of theoretical peak) and leveraging commodity supply chains like organic substrates and LPDDR, Thomas and his team are building a more accessible, high-performance path for the world's most demanding LLM workloads."
  ].join("\n");

  async function gKit(){
    setGenK(true);
    var prompt = [
      "Generate the FULL launch kit for this episode. Every section must pull specific hooks from the bio/topics.",
      "",
      "Guest: " + ep.guest + ", " + ep.title + " at " + ep.company,
      "Host: " + ep.host,
      "Bio: " + ep.bio,
      "Topics: " + (ep.topics || "general"),
      "Company: " + (ep.companyDesc || ""),
      "Format: " + (ep.virtual ? "virtual via Riverside" : "on-site at NVIDIA GTC 2026 in San Jose"),
      "",
      "REQUIREMENTS:",
      "- Each caption must contain at least ONE concrete detail/metric/claim pulled from bio or topics.",
      "- YouTube description: 3 paragraphs. Para 1 includes 3 specific technical hooks. Para 2 includes 1+ metric. Para 3 VERBATIM as given below.",
      "- X hook: one sentence that makes people want to click. Lead with a number/claim from the bio.",
      "- LinkedIn: set up stakes for industry insiders. Why should someone building AI infra care?",
      "- Facebook: same substance, more conversational tone.",
      "- Story: punchy one-liner.",
      "- Thumbnail headline: 6-8 words, bold claim or number, optimized for video thumbnail text.",
      "- YouTube title: under 70 chars, front-loads the most clickable hook (not just the guest name).",
      "",
      "VERBATIM PARA 3 (do not change):",
      seriesPara,
      "",
      "OUTPUT EXACTLY THIS FORMAT:",
      "--- YOUTUBE TITLE ---",
      "[under 70 chars, hooks first]",
      "",
      "--- THUMBNAIL HEADLINE ---",
      "[6-8 words for thumbnail overlay text]",
      "",
      "--- YOUTUBE DESCRIPTION ---",
      "[Para 1: " + ep.host + " sits down with " + ep.guest + ", " + ep.title + " at " + ep.company + ", to discuss [topics]. " + firstName + " dives into [3 specific technical hooks with numbers].]",
      "",
      "[Para 2: positioning + specific metric + outcome]",
      "",
      seriesPara,
      "",
      "--- X (HOOK) ---",
      "[1 sentence, specific claim, no link, no hashtags]",
      "",
      "--- X (REPLY) ---",
      "[INSERT YOUTUBE LINK]",
      "",
      "--- LINKEDIN ---",
      "[3-5 sentences with specific technical stakes + why industry should care]",
      "[INSERT YOUTUBE LINK]",
      "",
      "--- FACEBOOK ---",
      "[3-5 sentences conversational, same substance]",
      "[INSERT YOUTUBE LINK]",
      "",
      "--- STORY ---",
      "[1 punchy line]"
    ].join("\n");
    var r = await callAPI(KIT_SYS, prompt);
    setKitOut(r);
    setGenK(false);
  }

  async function gYtDesc(){
    setGenYt(true);
    var hasTx = ytTranscript.trim().length > 200;
    var prompt = [
      "Generate a full YouTube description for this episode. Exactly 3 paragraphs. NO chapter markers or timestamps (user adds those themselves).",
      "",
      "Guest: " + ep.guest + ", " + ep.title + " at " + ep.company,
      "Host: " + ep.host,
      "Bio: " + ep.bio,
      "Topics: " + (ep.topics || "general"),
      "Company: " + (ep.companyDesc || ""),
      "Format: " + (ep.virtual ? "virtual via Riverside" : "on-site at NVIDIA GTC 2026 in San Jose"),
      "",
      hasTx ? "TRANSCRIPT (use for pulling specific technical details, numbers, and quotes):\n" + ytTranscript.slice(0, 8000) + "\n" : "",
      "Output exactly 3 paragraphs, separated by blank lines:",
      "",
      "[Paragraph 1: " + ep.host + " sits down with " + ep.guest + ", " + ep.title + " at " + ep.company + ", to discuss [topics]. " + firstName + " dives into [3 specific technical details with numbers from bio/topics/transcript].]",
      "",
      "[Paragraph 2: positioning line + specific metric/approach + outcome. Match the Positron reference style.]",
      "",
      seriesPara
    ].join("\n");
    var r = await callAPI(KIT_SYS, prompt);
    setYtOut(r);
    setGenYt(false);
  }
  async function gClip(){setGenC(true);var r=await callAPI(DYLAN_SYS,"2 clips. All casual.\nGuest: "+ep.guest+" ("+ep.company+")\n\nCLIP 1:\n"+(c1||"[no transcript]")+"\n\nCLIP 2:\n"+(c2||"[no transcript]")+"\n\nEach clip: X (no hashtags), YT Shorts (title<40 + #shorts), IG Reels (save CTA + 5-8 hashtags + San Jose), TikTok (lowercase + 4-6 hashtags + on-screen 0s/3s/6s), Story (1 line).\nClip1 Thu 10AM, Clip2 Tue 10AM. TikTok stagger 4-6hr.");setClipOut(r);setGenC(false)}

  return <div style={{fontFamily:FONT,color:"#E8E4DD"}}><div style={{maxWidth:960,margin:"0 auto",padding:"28px 32px 60px"}}>
    <div style={{display:"flex",gap:8,marginBottom:24}}>
      <button onClick={onBack} style={{background:"rgba(255,255,255,0.02)",border:"1px solid "+BDR,color:"rgba(255,255,255,0.4)",padding:"10px 20px",borderRadius:8,cursor:"pointer",fontFamily:FONT,fontSize:13,fontWeight:600,transition:"all 0.15s"}}>Back</button>
      {!editing&&<button onClick={function(){setEditing(true)}} style={{background:AMB+"12",border:"1px solid "+AMB+"50",color:AMB,padding:"10px 20px",borderRadius:8,cursor:"pointer",fontFamily:FONT,fontSize:13,fontWeight:700,transition:"all 0.15s"}}>Edit</button>}
      {editing&&<button onClick={saveEdit} style={{background:GRN+"18",border:"1px solid "+GRN,color:GRN,padding:"10px 20px",borderRadius:8,cursor:"pointer",fontFamily:FONT,fontSize:13,fontWeight:700,transition:"all 0.15s"}}>Save</button>}
      {editing&&<button onClick={cancelEdit} style={{background:"rgba(255,255,255,0.02)",border:"1px solid "+BDR,color:"rgba(255,255,255,0.4)",padding:"10px 20px",borderRadius:8,cursor:"pointer",fontFamily:FONT,fontSize:13,fontWeight:600,transition:"all 0.15s"}}>Cancel</button>}
    </div>
    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:6,flexWrap:"wrap"}}>
      <Badge bg={AMB} c="#0D0F14">SA</Badge>
      <span style={{fontSize:10,padding:"3px 8px",borderRadius:4,border:"1px solid "+tc+"50",color:tc}}>{ep.tag}</span>
      <span style={{fontSize:10,padding:"3px 8px",borderRadius:4,border:"1px solid "+AMB+"50",color:AMB}}>T{ep.tier} {TL[ep.tier]}</span>
      {ep.virtual&&<Badge bg={CYN+"20"} c={CYN}>VIRTUAL</Badge>}
      {ep.status==="published"&&<Badge bg={GRN+"20"} c={GRN}>PUBLISHED</Badge>}
    </div>
    <h1 style={{fontSize:28,fontWeight:900,color:"#f3f4f6",letterSpacing:-1,margin:"6px 0 2px"}}>{ep.guest}</h1>
    {editing?<div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4}}>
      <input value={eTitle} onChange={function(e){setETitle(e.target.value)}} placeholder="Title" style={{padding:"6px 10px",background:BG0,border:"1px solid "+BDR,borderRadius:6,color:"#d1d5db",fontFamily:FONT,fontSize:13,width:160,outline:"none"}}/>
      <span style={{fontSize:14,color:"#6b7280"}}>at {ep.company}</span>
    </div>:<p style={{fontSize:14,color:"#6b7280",margin:"0 0 4px"}}>{ep.title} at {ep.company}</p>}
    {editing?<div style={{marginBottom:20}}><div style={{fontSize:10,color:AMB,textTransform:"uppercase",letterSpacing:1.5,fontWeight:700,marginBottom:4,fontFamily:MONO}}>Host</div><select value={eHost} onChange={function(e){setEHost(e.target.value)}} style={{padding:"6px 10px",background:BG0,border:"1px solid "+BDR,borderRadius:8,color:AMB,fontFamily:FONT,fontSize:12}}>{HOSTS.filter(function(h){return h!=="All"}).map(function(h){return <option key={h} value={h}>{h}</option>})}</select></div>:<p style={{fontSize:12,color:AMB,margin:"0 0 20px",fontWeight:600}}>{fm(d)} 8:00 AM PST{ep.virtual?" // Riverside":""}</p>}

    {ep.logo&&<div style={{display:"flex",gap:14,marginBottom:16}}><div style={{width:52,height:52,borderRadius:8,border:"1px solid "+BDR,background:BG1,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><img src={ep.logo} alt="" style={{width:36,height:36,objectFit:"contain"}} onError={function(e){(e.target as HTMLImageElement).style.display="none"}}/></div><div style={{flex:1}}><div style={{fontSize:10,color:AMB,textTransform:"uppercase",letterSpacing:2,fontWeight:700,marginBottom:4}}>Company</div>{editing?<textarea value={eCompanyDesc} onChange={function(e){setECompanyDesc(e.target.value)}} style={{width:"100%",minHeight:50,padding:"8px 10px",background:BG0,border:"1px solid "+BDR,borderRadius:6,color:"#d1d5db",fontFamily:FONT,fontSize:12,resize:"vertical",outline:"none",boxSizing:"border-box"}}/>:<p style={{fontSize:12,color:"#9ca3af",margin:0,lineHeight:1.6}}>{ep.companyDesc}</p>}</div></div>}
    <div style={{marginBottom:16}}><div style={{fontSize:10,color:AMB,textTransform:"uppercase",letterSpacing:2,fontWeight:700,marginBottom:6}}>Bio</div>{editing?<textarea value={eBio} onChange={function(e){setEBio(e.target.value)}} style={{width:"100%",minHeight:80,padding:14,background:BG1,border:"1px solid "+BDR,borderRadius:8,color:"#d1d5db",fontFamily:FONT,fontSize:12,resize:"vertical",outline:"none",boxSizing:"border-box",lineHeight:1.7}}/>:<p style={{fontSize:12,color:"#d1d5db",margin:0,lineHeight:1.7,padding:14,background:BG1,borderRadius:8,border:"1px solid "+BDR}}>{ep.bio}</p>}</div>
    {editing&&<div style={{marginBottom:16}}><div style={{fontSize:10,color:AMB,textTransform:"uppercase",letterSpacing:2,fontWeight:700,marginBottom:6}}>Topics</div><input value={eTopics} onChange={function(e){setETopics(e.target.value)}} placeholder="Comma-separated topics" style={{width:"100%",padding:"8px 14px",background:BG1,border:"1px solid "+BDR,borderRadius:8,color:"#d1d5db",fontFamily:FONT,fontSize:12,outline:"none",boxSizing:"border-box"}}/></div>}

    {ep.slot>=0&&<div style={{padding:18,background:"linear-gradient(135deg, "+BG1+" 0%, "+BG0+" 100%)",borderRadius:12,border:"1px solid "+BDR,marginBottom:16}}>
      <div style={{fontSize:10,color:AMB,textTransform:"uppercase",letterSpacing:2,fontWeight:700,marginBottom:14}}>Content Rollout</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:12}}>
        {[
          {date:d,time:"8:00 AM PST",label:"EPISODE LAUNCH",ch:["YouTube","X","LinkedIn","Facebook","Story"],color:AMB,icon:"\u25B6"},
          {date:thu,time:"10:00 AM PST",label:"CLIP #1",ch:["Shorts","Reels","X","TikTok","Story"],color:BLU,icon:"\u2702"},
          {date:tue,time:"10:00 AM PST",label:"CLIP #2",ch:["Shorts","Reels","X","TikTok","Story"],color:CYN,icon:"\u2702"}
        ].map(function(item,i){
          var dateObj=item.date;
          var month=dateObj.toLocaleDateString("en-US",{month:"short"}).toUpperCase();
          var day=dateObj.getDate();
          var weekday=dateObj.toLocaleDateString("en-US",{weekday:"short"}).toUpperCase();
          return <div key={i} style={{background:BG0,border:"1px solid "+item.color+"30",borderRadius:10,padding:14,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:item.color,opacity:0.6}}/>
            <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:10}}>
              <div style={{flexShrink:0,width:58,borderRadius:8,overflow:"hidden",border:"1px solid "+item.color+"40",background:BG1}}>
                <div style={{background:item.color+"18",padding:"3px 0",textAlign:"center",fontSize:8,fontWeight:800,color:item.color,letterSpacing:1.5,fontFamily:MONO}}>{month}</div>
                <div style={{padding:"6px 0",textAlign:"center"}}>
                  <div style={{fontSize:22,fontWeight:900,color:"#f3f4f6",lineHeight:1,fontFamily:FONT}}>{day}</div>
                  <div style={{fontSize:7,fontWeight:700,color:"#6b7280",letterSpacing:1.2,marginTop:2,fontFamily:MONO}}>{weekday}</div>
                </div>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:4}}>
                  <span style={{color:item.color,fontSize:10}}>{item.icon}</span>
                  <span style={{fontSize:9,color:item.color,fontWeight:800,letterSpacing:1,fontFamily:MONO}}>{item.label}</span>
                </div>
                <div style={{fontSize:10,color:"#9ca3af",fontFamily:MONO,marginBottom:2}}>{item.time}</div>
              </div>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
              {item.ch.map(function(c){return <span key={c} style={{fontSize:8,fontWeight:600,padding:"2px 6px",borderRadius:4,background:item.color+"10",color:item.color+"cc",border:"1px solid "+item.color+"20"}}>{c}</span>})}
            </div>
          </div>;
        })}
      </div>
    </div>}

    <div style={{display:"flex",gap:8,marginBottom:6}}>
      <Btn on={tab==="kit"} onClick={function(){setTab("kit")}}>Launch Kit</Btn>
      <Btn on={tab==="yt"} onClick={function(){setTab("yt")}}>YT Description</Btn>
      <Btn on={tab==="clips"} onClick={function(){setTab("clips")}}>Clips Kit</Btn>
    </div>
    <div style={{fontSize:9,color:"#4b5563",marginBottom:14}}>{tab==="kit"?"Title + thumbnail headline + YT desc + X, LinkedIn, Facebook, Story — all attention-grabbing":tab==="yt"?"3-paragraph YouTube description. Paste transcript for sharper specifics. Timestamps added manually on YouTube.":"Paste 2 clip transcripts. Generates X, Shorts, Reels, TikTok, Story"}</div>

    {tab==="kit"&&(function(){
      var sections = kitOut ? splitKitSections(kitOut) : {};
      var epSlug = ep.guest.replace(/[^a-zA-Z0-9]/g, "_");
      var cards: Array<{key:string;label:string;color:string;lines?:number}> = [
        { key: "YOUTUBE_TITLE", label: "YouTube Title", color: RED, lines: 1 },
        { key: "THUMBNAIL_HEADLINE", label: "Thumbnail Headline", color: AMB, lines: 1 },
        { key: "X_HOOK", label: "X (Hook)", color: "#ffffff", lines: 2 },
        { key: "LINKEDIN", label: "LinkedIn", color: "#0A66C2", lines: 5 },
        { key: "FACEBOOK", label: "Facebook", color: "#1877F2", lines: 5 },
        { key: "STORY", label: "Story", color: CYN, lines: 1 },
      ];
      return <div>
        <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
          <Btn on={true} onClick={gKit} sx={{opacity:genK?.5:1}}>{genK?"Generating...":kitOut?"Regenerate":"Generate Launch Kit"}</Btn>
          {kitOut&&<Btn on={false} onClick={function(){doCopy(kitOut,"kit")}} sx={{borderColor:AMB+"60",color:AMB}}>{cp==="kit"?"Copied!":"Copy All"}</Btn>}
          {kitOut&&<Btn on={false} onClick={function(){downloadDocx("Launch Kit - "+ep.guest,kitOut,"LaunchKit_"+epSlug)}} sx={{borderColor:GRN+"60",color:GRN}}>Download .docx</Btn>}
        </div>
        {!kitOut&&<div style={{padding:40,background:BG1,borderRadius:8,border:"1px solid "+BDR,color:"#4b5563",fontSize:12,textAlign:"center"}}>Click Generate to create the full launch kit — title, thumbnail headline, and all social captions.</div>}
        {kitOut&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
          {cards.map(function(card){
            var content = sections[card.key] || "";
            if (!content) return null;
            return <div key={card.key} style={{background:BG1,border:"1px solid "+card.color+"25",borderRadius:10,padding:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{fontSize:10,color:card.color,textTransform:"uppercase",letterSpacing:1.5,fontWeight:700,fontFamily:MONO}}>{card.label}</div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={function(){doCopy(content,"sec_"+card.key)}} style={{fontSize:10,padding:"4px 10px",background:"transparent",border:"1px solid "+card.color+"40",borderRadius:5,color:card.color,cursor:"pointer",fontFamily:MONO,fontWeight:600}}>{cp==="sec_"+card.key?"Copied":"Copy"}</button>
                  <button onClick={function(){downloadDocx(card.label+" - "+ep.guest,content,card.label.replace(/\s+/g,"_")+"_"+epSlug)}} style={{fontSize:10,padding:"4px 10px",background:"transparent",border:"1px solid "+GRN+"40",borderRadius:5,color:GRN,cursor:"pointer",fontFamily:MONO,fontWeight:600}}>.docx</button>
                </div>
              </div>
              <pre style={{fontSize:12,color:"#d1d5db",lineHeight:1.6,whiteSpace:"pre-wrap",fontFamily:FONT,margin:0}}>{content}</pre>
            </div>;
          })}
          {/* Rollout / regimen summary */}
          {!!sections["YOUTUBE_DESCRIPTION"]&&<div style={{fontSize:10,color:"#6b7280",marginTop:4,padding:"8px 12px",background:"rgba(255,255,255,0.02)",borderRadius:6,fontFamily:MONO}}>YT description is auto-included. For timestamped chapters, use the YT Description tab with transcript.</div>}
        </div>}
      </div>;
    })()}

    {tab==="yt"&&<div>
      <div style={{marginBottom:12,padding:14,background:BG1,border:"1px solid "+BDR,borderRadius:8}}>
        <div style={{fontSize:10,color:AMB,textTransform:"uppercase",letterSpacing:1.5,fontWeight:700,fontFamily:MONO,marginBottom:8}}>Transcript (optional)</div>
        <textarea value={ytTranscript} onChange={function(e){setYtTranscript(e.target.value)}} placeholder="Paste full interview transcript. AI will pull specific technical details, numbers, and claims from it to make the description richer..." style={{width:"100%",minHeight:140,padding:10,background:BG0,border:"1px solid "+BDR,borderRadius:6,color:"#d1d5db",fontFamily:FONT,fontSize:11,resize:"vertical",outline:"none",boxSizing:"border-box"}}/>
        <div style={{fontSize:10,color:"#6b7280",fontFamily:MONO,marginTop:6}}>Transcript makes para 1 sharper — real quotes, real numbers, real claims. Timestamped chapters are added manually on YouTube.</div>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        <Btn on={true} onClick={gYtDesc} sx={{opacity:genYt?.5:1}}>{genYt?"Generating...":ytOut?"Regenerate":"Generate YT Description"}</Btn>
        {ytOut&&<Btn on={false} onClick={function(){doCopy(ytOut,"yt")}} sx={{borderColor:AMB+"60",color:AMB}}>{cp==="yt"?"Copied!":"Copy"}</Btn>}
        {ytOut&&<Btn on={false} onClick={function(){downloadDocx("YouTube Description - "+ep.guest,ytOut,"YTDescription_"+ep.guest.replace(/[^a-zA-Z0-9]/g,"_"))}} sx={{borderColor:GRN+"60",color:GRN}}>Download .docx</Btn>}
      </div>
      {ytOut&&<pre style={{fontSize:12,color:"#d1d5db",lineHeight:1.7,padding:16,background:BG1,borderRadius:8,border:"1px solid "+BDR,whiteSpace:"pre-wrap",fontFamily:FONT,maxHeight:560,overflow:"auto"}}>{ytOut}</pre>}
      {!ytOut&&<div style={{padding:40,background:BG1,borderRadius:8,border:"1px solid "+BDR,color:"#4b5563",fontSize:12,textAlign:"center"}}>Generate the 3-paragraph YT description. Paste transcript above for richer, more specific writing.</div>}
    </div>}

    {tab==="clips"&&<div>
      <div style={{marginBottom:12,padding:14,background:CYN+"08",border:"1px solid "+CYN+"30",borderRadius:8}}>
        <div style={{fontSize:10,color:CYN,textTransform:"uppercase",letterSpacing:1.5,fontWeight:700,fontFamily:MONO,marginBottom:6}}>How to get clip transcripts fast</div>
        <ol style={{margin:"0 0 0 18px",padding:0,fontSize:11,color:"#9ca3af",lineHeight:1.7}}>
          <li><b style={{color:"#d1d5db"}}>YouTube auto-captions (fastest, free):</b> Upload each clip as an unlisted YouTube video. Wait 5-10 min for auto-captions. Click "..." under video → "Show transcript" → copy.</li>
          <li><b style={{color:"#d1d5db"}}>Mac built-in:</b> Open clip in QuickTime → Edit → Captions → Auto-Generate. Or use Voice Memos app if it's audio-first.</li>
          <li><b style={{color:"#d1d5db"}}>CLI (if you have it):</b> <code style={{background:BG0,padding:"1px 5px",borderRadius:3,fontFamily:MONO,fontSize:10}}>whisper clip.mp4 --model base</code> — outputs a .txt next to the file.</li>
          <li><b style={{color:"#d1d5db"}}>Web tools:</b> rev.com, happyscribe.com, or otter.ai (free tier — upload + export).</li>
        </ol>
        <div style={{fontSize:10,color:"#6b7280",marginTop:8,fontFamily:MONO}}>For best results paste full transcripts with speaker labels if available. 30 seconds of transcript = ~500 words.</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <div><div style={{fontSize:11,color:AMB,fontWeight:600,marginBottom:4}}>Clip 1 Transcript</div><textarea value={c1} onChange={function(e){setC1(e.target.value)}} placeholder="Paste clip 1..." style={{width:"100%",minHeight:130,padding:10,background:BG1,border:"1px solid "+BDR,borderRadius:6,color:"#d1d5db",fontFamily:FONT,fontSize:11,resize:"vertical",outline:"none"}}/></div>
        <div><div style={{fontSize:11,color:BLU,fontWeight:600,marginBottom:4}}>Clip 2 Transcript</div><textarea value={c2} onChange={function(e){setC2(e.target.value)}} placeholder="Paste clip 2..." style={{width:"100%",minHeight:130,padding:10,background:BG1,border:"1px solid "+BDR,borderRadius:6,color:"#d1d5db",fontFamily:FONT,fontSize:11,resize:"vertical",outline:"none"}}/></div>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
        <Btn on={true} onClick={gClip} sx={{opacity:genC?.5:1}}>{genC?"Generating...":"Generate"}</Btn>
        {clipOut&&<Btn on={false} onClick={function(){doCopy(clipOut,"clips")}} sx={{borderColor:AMB+"60",color:AMB}}>{cp==="clips"?"Copied!":"Copy"}</Btn>}
        {clipOut&&<Btn on={false} onClick={function(){downloadDocx("Clips Kit - "+ep.guest,clipOut,"ClipsKit_"+ep.guest.replace(/[^a-zA-Z0-9]/g,"_"))}} sx={{borderColor:GRN+"60",color:GRN}}>Download .docx</Btn>}
      </div>
      {clipOut&&<pre style={{fontSize:11,color:"#9ca3af",lineHeight:1.7,padding:14,background:BG1,borderRadius:8,border:"1px solid "+BDR,whiteSpace:"pre-wrap",fontFamily:FONT,maxHeight:520,overflow:"auto"}}>{clipOut}</pre>}
      {!clipOut&&<div style={{padding:40,background:BG1,borderRadius:8,border:"1px solid "+BDR,color:"#4b5563",fontSize:12,textAlign:"center"}}>Paste transcripts and generate.</div>}
    </div>}
  </div></div>
}

async function callAPI(sys: string, usr: string): Promise<string>{try{var r=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({system:sys,prompt:usr})});var d=await r.json();return(d.content||[]).map(function(b: { text?: string }){return b.text||""}).join("\n")||"Failed.";}catch(e){return"Error: "+(e instanceof Error ? e.message : String(e))}}
