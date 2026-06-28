import { useState, useEffect, useCallback } from "react";

const REPO = "Trevor-Davis/real-estate-crm";
const FILE = "contacts.json";
const API = `https://api.github.com/repos/${REPO}/contents/${FILE}`;

const TYPE_COLORS = {
  Buyer:    { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
  Seller:   { bg: "#F0FDF4", text: "#15803D", border: "#BBF7D0" },
  Investor: { bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA" },
  Tenant:   { bg: "#FAF5FF", text: "#7E22CE", border: "#E9D5FF" },
};
const STATUS_OPTIONS = ["Active", "Prospect", "Closed", "On Hold"];
const TYPE_OPTIONS   = ["Buyer", "Seller", "Investor", "Tenant"];
const EMPTY_FORM = { name:"", type:"Buyer", status:"Prospect", phone:"", email:"", address:"", budget:"", source:"", notes:"", commentary:"" };

function Badge({ type }) {
  const c = TYPE_COLORS[type] || { bg:"#F3F4F6", text:"#374151", border:"#E5E7EB" };
  return <span style={{ background:c.bg, color:c.text, border:`1px solid ${c.border}`, borderRadius:4, padding:"2px 8px", fontSize:11, fontWeight:600, letterSpacing:"0.04em", textTransform:"uppercase" }}>{type}</span>;
}
function StatusDot({ status }) {
  const colors = { Active:"#16A34A", Prospect:"#2563EB", Closed:"#6B7280", "On Hold":"#D97706" };
  return <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:12, color:"#6B7280" }}><span style={{ width:7, height:7, borderRadius:"50%", background:colors[status]||"#9CA3AF", display:"inline-block" }} />{status}</span>;
}
function Toast({ msg, type }) {
  if (!msg) return null;
  return <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", background:type==="error"?"#FEE2E2":"#DCFCE7", color:type==="error"?"#991B1B":"#166534", border:`1px solid ${type==="error"?"#FECACA":"#BBF7D0"}`, borderRadius:8, padding:"10px 20px", fontSize:13, fontWeight:500, boxShadow:"0 4px 12px rgba(0,0,0,0.1)", zIndex:9999 }}>{msg}</div>;
}

function TokenGate({ onToken }) {
  const [val, setVal] = useState("");
  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#F8FAFC", fontFamily:"'Inter',system-ui,sans-serif" }}>
      <div style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:14, padding:32, maxWidth:380, width:"90%", textAlign:"center" }}>
        <div style={{ fontSize:28, marginBottom:8 }}>🏠</div>
        <h2 style={{ margin:"0 0 8px", fontSize:20, fontWeight:700 }}>RE·CRM</h2>
        <p style={{ color:"#64748B", fontSize:13, marginBottom:20 }}>Enter your GitHub Personal Access Token to get started. It's stored only in your browser.</p>
        <input
          type="password"
          value={val}
          onChange={e => setVal(e.target.value)}
          placeholder="ghp_..."
          style={{ border:"1px solid #E2E8F0", borderRadius:8, padding:"9px 12px", fontSize:13, width:"100%", boxSizing:"border-box", marginBottom:12, outline:"none" }}
        />
        <button
          onClick={() => { if(val.trim()){ localStorage.setItem("gh_crm_token", val.trim()); onToken(val.trim()); } }}
          style={{ background:"#2563EB", color:"#fff", border:"none", borderRadius:8, padding:"10px 20px", fontSize:13, fontWeight:600, cursor:"pointer", width:"100%" }}
        >Connect</button>
        <p style={{ color:"#94A3B8", fontSize:11, marginTop:12 }}>Need a token? Go to GitHub → Settings → Developer Settings → Personal Access Tokens → generate one with <strong>repo</strong> scope.</p>
      </div>
    </div>
  );
}

export default function App() {
  const [token, setToken]         = useState(() => localStorage.getItem("gh_crm_token") || "");
  const [contacts, setContacts]   = useState([]);
  const [sha, setSha]             = useState(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState({ msg:"", type:"ok" });
  const [view, setView]           = useState("list");
  const [selected, setSelected]   = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [editId, setEditId]       = useState(null);
  const [search, setSearch]       = useState("");
  const [filterType, setFilterType]     = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [confirmDelete, setConfirmDelete] = useState(null);

  const showToast = (msg, type="ok") => { setToast({msg,type}); setTimeout(()=>setToast({msg:"",type:"ok"}),3000); };

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch(API, { headers:{ Authorization:`token ${token}` } })
      .then(r => r.json())
      .then(d => {
        setSha(d.sha);
        const parsed = JSON.parse(atob(d.content.replace(/\n/g,"")));
        setContacts(parsed.contacts||[]);
        setLoading(false);
      })
      .catch(() => { showToast("Failed to load","error"); setLoading(false); });
  }, [token]);

  const save = useCallback(async (newContacts) => {
    setSaving(true);
    try {
      const content = btoa(unescape(encodeURIComponent(JSON.stringify({contacts:newContacts},null,2))));
      const res = await fetch(API, {
        method:"PUT",
        headers:{ Authorization:`token ${token}`, "Content-Type":"application/json" },
        body: JSON.stringify({ message:"Update contacts", content, sha })
      });
      const d = await res.json();
      setSha(d.content.sha);
      setContacts(newContacts);
      showToast("Saved \u2713");
    } catch { showToast("Save failed","error"); }
    setSaving(false);
  }, [sha, token]);

  const openNew    = () => { setForm(EMPTY_FORM); setEditId(null); setView("form"); };
  const openEdit   = (c) => { setForm({...EMPTY_FORM,...c}); setEditId(c.id); setView("form"); };
  const openDetail = (c) => { setSelected(c); setView("detail"); };

  const handleSubmit = async () => {
    if (!form.name.trim()) { showToast("Name is required","error"); return; }
    let updated;
    if (editId) {
      updated = contacts.map(c => c.id===editId ? {...c,...form,updatedAt:new Date().toISOString()} : c);
    } else {
      updated = [{...form, id:crypto.randomUUID(), createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()}, ...contacts];
    }
    await save(updated);
    setView("list");
  };

  const handleDelete = async (id) => {
    await save(contacts.filter(c=>c.id!==id));
    setView("list"); setConfirmDelete(null);
  };

  if (!token) return <TokenGate onToken={t => { setToken(t); setLoading(true); }} />;
  if (loading) return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Inter',system-ui,sans-serif",color:"#64748B"}}>Loading contacts\u2026</div>;

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase();
    return (!q || c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.includes(q))
      && (filterType==="All" || c.type===filterType)
      && (filterStatus==="All" || c.status===filterStatus);
  });

  const stats = { total:contacts.length, buyers:contacts.filter(c=>c.type==="Buyer").length, sellers:contacts.filter(c=>c.type==="Seller").length, investors:contacts.filter(c=>c.type==="Investor").length, tenants:contacts.filter(c=>c.type==="Tenant").length };
  const f = k => e => setForm(p=>({...p,[k]:e.target.value}));

  const S = {
    app:{ fontFamily:"'Inter',system-ui,sans-serif", minHeight:"100vh", background:"#F8FAFC", color:"#1E293B" },
    header:{ background:"#fff", borderBottom:"1px solid #E2E8F0", padding:"0 20px", display:"flex", alignItems:"center", justifyContent:"space-between", height:56, position:"sticky", top:0, zIndex:100 },
    logo:{ fontWeight:700, fontSize:17, color:"#0F172A", letterSpacing:"-0.02em" },
    main:{ maxWidth:860, margin:"0 auto", padding:"20px 16px 80px" },
    statRow:{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))", gap:10, marginBottom:20 },
    statCard:{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:10, padding:"12px 14px" },
    statNum:{ fontSize:22, fontWeight:700 },
    statLabel:{ fontSize:11, color:"#94A3B8", fontWeight:500, marginTop:2 },
    toolbar:{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" },
    input:{ border:"1px solid #E2E8F0", borderRadius:8, padding:"8px 12px", fontSize:13, outline:"none", background:"#fff", color:"#1E293B", width:"100%", boxSizing:"border-box" },
    select:{ border:"1px solid #E2E8F0", borderRadius:8, padding:"8px 10px", fontSize:13, background:"#fff", color:"#1E293B", outline:"none" },
    btn:(v="primary")=>({ border:"none", borderRadius:8, padding:"9px 16px", fontSize:13, fontWeight:600, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:5, background:v==="primary"?"#2563EB":v==="danger"?"#EF4444":v==="ghost"?"transparent":"#F1F5F9", color:v==="primary"||v==="danger"?"#fff":v==="ghost"?"#64748B":"#374151", outline:v==="ghost"?"1px solid #E2E8F0":"none" }),
    card:{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:12, padding:"14px 16px", marginBottom:10, cursor:"pointer" },
    label:{ fontSize:12, fontWeight:600, color:"#64748B", marginBottom:4, display:"block" },
    formGroup:{ marginBottom:16 },
    textarea:{ border:"1px solid #E2E8F0", borderRadius:8, padding:"8px 12px", fontSize:13, outline:"none", background:"#fff", color:"#1E293B", width:"100%", boxSizing:"border-box", minHeight:80, resize:"vertical", fontFamily:"inherit" },
    divider:{ border:"none", borderTop:"1px solid #E2E8F0", margin:"20px 0" },
    detailLabel:{ fontSize:11, fontWeight:600, color:"#94A3B8", textTransform:"uppercase", letterSpacing:"0.06em" },
    detailValue:{ fontSize:14, color:"#1E293B", marginTop:2, marginBottom:14 },
    commentBox:{ background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:10, padding:"12px 14px", fontSize:13, lineHeight:1.6, color:"#92400E" },
    emptyState:{ textAlign:"center", padding:"60px 20px", color:"#94A3B8" },
    backBtn:{ background:"none", border:"none", cursor:"pointer", color:"#2563EB", fontSize:13, fontWeight:600, padding:"0 0 16px", display:"flex", alignItems:"center", gap:4 }
  };

  return (
    <div style={S.app}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');*{box-sizing:border-box;}input:focus,select:focus,textarea:focus{border-color:#2563EB!important;box-shadow:0 0 0 3px rgba(37,99,235,0.1);}`}</style>
      <header style={S.header}>
        <div style={S.logo}>RE<span style={{color:"#2563EB"}}>\u00b7</span>CRM</div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {saving && <span style={{fontSize:12,color:"#94A3B8"}}>Saving\u2026</span>}
          <button style={{...S.btn("ghost"),fontSize:11}} onClick={()=>{localStorage.removeItem("gh_crm_token");setToken("");}}>Sign out</button>
          {view!=="form" && <button style={S.btn("primary")} onClick={openNew}>+ Add Contact</button>}
        </div>
      </header>
      <main style={S.main}>

        {view==="list" && <>
          <div style={S.statRow}>
            {[["Total",stats.total,"#2563EB"],["Buyers",stats.buyers,"#1D4ED8"],["Sellers",stats.sellers,"#15803D"],["Investors",stats.investors,"#C2410C"],["Tenants",stats.tenants,"#7E22CE"]].map(([label,num,color])=>(
              <div key={label} style={S.statCard}><div style={{...S.statNum,color}}>{num}</div><div style={S.statLabel}>{label}</div></div>
            ))}
          </div>
          <div style={S.toolbar}>
            <div style={{flex:1,minWidth:160}}><input style={S.input} placeholder="Search\u2026" value={search} onChange={e=>setSearch(e.target.value)} /></div>
            <select style={S.select} value={filterType} onChange={e=>setFilterType(e.target.value)}><option value="All">All Types</option>{TYPE_OPTIONS.map(t=><option key={t}>{t}</option>)}</select>
            <select style={S.select} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}><option value="All">All Statuses</option>{STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}</select>
          </div>
          {filtered.length===0 ? (
            <div style={S.emptyState}><div style={{fontSize:36,marginBottom:12}}>\ud83c\udfe0</div><div style={{fontWeight:600,color:"#374151",marginBottom:6}}>{contacts.length===0?"No contacts yet":"No results"}</div><div style={{fontSize:13}}>{contacts.length===0?"Add your first contact.":"Try adjusting filters."}</div></div>
          ) : filtered.map(c=>(
            <div key={c.id} style={S.card} onClick={()=>openDetail(c)}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontWeight:600,fontSize:15,color:"#0F172A",marginBottom:4}}>{c.name}</div>
                  <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}><Badge type={c.type}/><StatusDot status={c.status}/>{c.phone&&<span style={{fontSize:12,color:"#64748B"}}>{c.phone}</span>}</div>
                  {c.commentary&&<div style={{marginTop:8,fontSize:12,color:"#92400E",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:6,padding:"4px 8px",maxWidth:400}}>\ud83d\udcac {c.commentary.length>80?c.commentary.slice(0,80)+"\u2026":c.commentary}</div>}
                </div>
                {c.budget&&<span style={{fontSize:13,fontWeight:600,color:"#374151"}}>{c.budget}</span>}
              </div>
            </div>
          ))}
        </>}

        {view==="detail" && selected && (()=>{
          const c = contacts.find(x=>x.id===selected.id)||selected;
          return <>
            <button style={S.backBtn} onClick={()=>setView("list")}>\u2190 Back</button>
            <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:14,padding:20}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                <div><h2 style={{margin:0,fontSize:22,fontWeight:700}}>{c.name}</h2><div style={{display:"flex",gap:8,marginTop:8}}><Badge type={c.type}/><StatusDot status={c.status}/></div></div>
                <div style={{display:"flex",gap:6}}><button style={S.btn("ghost")} onClick={()=>openEdit(c)}>Edit</button><button style={S.btn("danger")} onClick={()=>setConfirmDelete(c.id)}>Delete</button></div>
              </div>
              <hr style={S.divider}/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 24px"}}>
                {[["Phone",c.phone],["Email",c.email],["Address",c.address],["Budget",c.budget],["Source",c.source]].map(([l,v])=>v?<div key={l}><div style={S.detailLabel}>{l}</div><div style={S.detailValue}>{v}</div></div>:null)}
              </div>
              {c.notes&&<><hr style={S.divider}/><div style={S.detailLabel}>Notes</div><div style={{...S.detailValue,lineHeight:1.6}}>{c.notes}</div></>}
              {c.commentary&&<><hr style={S.divider}/><div style={S.detailLabel}>Commentary</div><div style={S.commentBox}>\ud83d\udcac {c.commentary}</div></>}
              {c.createdAt&&<div style={{marginTop:20,fontSize:11,color:"#CBD5E1"}}>Added {new Date(c.createdAt).toLocaleDateString()} \u00b7 Updated {new Date(c.updatedAt).toLocaleDateString()}</div>}
            </div>
            {confirmDelete===c.id&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}><div style={{background:"#fff",borderRadius:14,padding:24,maxWidth:320,width:"90%",textAlign:"center"}}><div style={{fontSize:18,fontWeight:700,marginBottom:8}}>Delete contact?</div><div style={{fontSize:13,color:"#64748B",marginBottom:20}}>This will permanently remove <strong>{c.name}</strong>.</div><div style={{display:"flex",gap:8,justifyContent:"center"}}><button style={S.btn("ghost")} onClick={()=>setConfirmDelete(null)}>Cancel</button><button style={S.btn("danger")} onClick={()=>handleDelete(c.id)}>Delete</button></div></div></div>}
          </>;
        })()}

        {view==="form" && <>
          <button style={S.backBtn} onClick={()=>setView(editId?"detail":"list")}>\u2190 Back</button>
          <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:14,padding:20}}>
            <h2 style={{margin:"0 0 20px",fontSize:18,fontWeight:700}}>{editId?"Edit Contact":"New Contact"}</h2>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
              <div style={{...S.formGroup,gridColumn:"1/-1"}}><label style={S.label}>Full Name *</label><input style={S.input} value={form.name} onChange={f("name")} placeholder="Jane Smith"/></div>
              <div style={S.formGroup}><label style={S.label}>Type</label><select style={S.input} value={form.type} onChange={f("type")}>{TYPE_OPTIONS.map(t=><option key={t}>{t}</option>)}</select></div>
              <div style={S.formGroup}><label style={S.label}>Status</label><select style={S.input} value={form.status} onChange={f("status")}>{STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}</select></div>
              <div style={S.formGroup}><label style={S.label}>Phone</label><input style={S.input} value={form.phone} onChange={f("phone")} placeholder="(716) 555-0100"/></div>
              <div style={S.formGroup}><label style={S.label}>Email</label><input style={S.input} value={form.email} onChange={f("email")} placeholder="jane@email.com"/></div>
              <div style={{...S.formGroup,gridColumn:"1/-1"}}><label style={S.label}>Address / Area</label><input style={S.input} value={form.address} onChange={f("address")} placeholder="South Buffalo, NY"/></div>
              <div style={S.formGroup}><label style={S.label}>Budget / Rent</label><input style={S.input} value={form.budget} onChange={f("budget")} placeholder="$350,000"/></div>
              <div style={S.formGroup}><label style={S.label}>Lead Source</label><input style={S.input} value={form.source} onChange={f("source")} placeholder="Zillow, Referral\u2026"/></div>
              <div style={{...S.formGroup,gridColumn:"1/-1"}}><label style={S.label}>Notes</label><textarea style={S.textarea} value={form.notes} onChange={f("notes")} placeholder="3BR needed, pre-approved\u2026"/></div>
              <div style={{...S.formGroup,gridColumn:"1/-1"}}><label style={{...S.label,color:"#92400E"}}>\ud83d\udcac Commentary</label><textarea style={{...S.textarea,background:"#FFFBEB",border:"1px solid #FDE68A"}} value={form.commentary} onChange={f("commentary")} placeholder="Private notes about this client\u2026"/></div>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button style={S.btn("ghost")} onClick={()=>setView("list")}>Cancel</button>
              <button style={S.btn("primary")} onClick={handleSubmit} disabled={saving}>{saving?"Saving\u2026":editId?"Save Changes":"Add Contact"}</button>
            </div>
          </div>
        </>}
      </main>
      <Toast msg={toast.msg} type={toast.type}/>
    </div>
  );
}
