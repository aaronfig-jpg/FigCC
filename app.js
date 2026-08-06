/* Figueroa's Carpet Cleaning — Estimate · Job · Invoice (V1)
   Phone-first PWA. Offline. IndexedDB is the source of truth for jobs.
   Pricing model and invoice branding mirror generate_invoice.py and the Quick Price Sheet. */

'use strict';

/* ───────────── Business constants (keep in sync with generate_invoice.py) ───────────── */
const BIZ = {
  name: "Figueroa's Carpet Cleaning",
  phone: "Jose Figueroa — 805.245.4846",
  email: "figueroacarpets@gmail.com",
  location: "Santa Ynez Valley, CA",
  address: "41 Victory Dr, Buellton, CA 93427",
  venmo: "@JoseLuis-Figueroa-9",
  reviewUrl: "https://g.page/r/Cbpmg53Mw3WuEAE/review",
};
const RED = "#CC2020", TEAL = "#3AAFB9", DARK = "#444444", MIDGRAY = "#CCCCCC", LIGHT = "#F5F5F5";

/* Adopted rate card (point values; ranges live in R for the hint text) */
const P = { room:100, hall:40, stairs:40, pet:40, minJob:120,
  sofa:105, loveseat:80, chair:50, dining:30, cushion:140, mattress:70, rug:200 };
const R = { pet:"30-50", sofa:"90-120", loveseat:"70-90", chair:"40-60",
  dining:"20-40", cushion:"120-160", mattress:"60-80", rug:"180-220" };

/* Item catalog for the estimate steppers. label + hint + which section. */
const ITEMS = {
  carpet: [
    ["room","Rooms","Bedroom, living room, den — $100 each"],
    ["hall","Hallways","$40 each"],
    ["stairs","Stairs","Per full flight — $40"],
    ["pet","Pet stain / odor areas","+$"+R.pet+" per area. Always add it"],
  ],
  // add-ons shown in sqft mode (rooms not counted, but stairs/hall/pet still apply)
  carpetAddons: [
    ["hall","Hallways","$40 each"],
    ["stairs","Stairs","Per full flight — $40"],
    ["pet","Pet stain / odor areas","+$"+R.pet+" per area. Always add it"],
  ],
  uph: [
    ["sofa","Sofa","$"+R.sofa+" by size"],
    ["loveseat","Loveseat","$"+R.loveseat],
    ["chair","Chair / recliner","$"+R.chair+" each"],
    ["dining","Dining chair / barstool / sling","$"+R.dining+" each"],
    ["cushion","Cushion set (pool, patio)","$"+R.cushion],
    ["mattress","Mattress","$"+R.mattress],
  ],
  rugs: [["rug","Area rugs","$"+R.rug+" EACH, by size and material"]],
};
const LABELS = {}; // key -> display label
[...ITEMS.carpet, ...ITEMS.uph, ...ITEMS.rugs].forEach(([k,l])=>LABELS[k]=l);

/* Review QR as a data-uri (generated from BIZ.reviewUrl) */
const REVIEW_QR = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAATYAAAE2AQAAAADDx4MEAAACDklEQVR4nO2aQYrkMAxFv9qBWSo3ct1gruwcpQ9Q4FoWOPxZWE6c3nRBM+5UkBemQh4ElZC+JFuIV9b68RIGOPczDkzbL7IAMQOIJAEt7ZWWs9txIU7J6oplBpgQCDxEAAAkSaa3sOMy3CoiM4CYA+WmBYCSNVIWqZ55BzuuwE2Hp3XiMt8nLHP+z9917ntukeadmEd+17luMTX9INmyFNT03PTD9XwU19dXScvXzZb7YxRnEVBXDuxTle5v3B/DuGVepW62ApmU1icuMyC3d7DjGlzNVy0+gLolrV0HyBxcPwZyE4BQttiAAKGge9SnAHp6O67CoUVFLx1kBhBZbHISXT9GcVblQotlrqTFstTuKK+vhnGdYOyjRPMMXD+Gc1181C3W0AibUzw+RnLW9sVsVW5fWtV2Pbh+DOTaxEqfgvgpABSo5dby925vl/l+djuuw8UcCDz+0Bryz8nqKzwmMGEVP/8Yx7XeT622tcliblLe1OXsdlyFO/z3ObB/wWJ67voxjGtjXC0tS9XRron6dpp7djuuwvXz3aRfbjG0ROb5ahh3uF+ytR6tC/T+4xe47X4J9Cly0wK5YRUAJideX43jev1I7WoJE0KnHx4fv8PFNiWRGh/1UGr1+z4DuUN8AFsTYqMSixSPj1Hc4X5JPhzV7ie33n8M4w73S/Zfupe/rh8jOfH77afi/gHYD+Qr150/swAAAABJRU5ErkJggg==";

const $ = id => document.getElementById(id);
const money = v => "$" + Math.round(v).toLocaleString();
const money2 = v => "$" + Number(v).toFixed(2);

/* ───────────── Estimate state ───────────── */
const qty = {};                 // key -> count
const priceOverride = {};       // key -> per-unit price override (undefined = use P[key])
let carpetMode = "rooms";       // "rooms" | "sqft"
let jobType = "res";            // "res" | "com"
let currentJob = null;          // the job being built/last saved
let editingId = null;           // job_id being edited (null = new job)

function unit(k){ return (priceOverride[k] !== undefined && priceOverride[k] !== "") ? +priceOverride[k] : P[k]; }

/* ───────────── Build estimate UI ───────────── */
function stepperRow(host, k, label, hint, withPrice){
  const r = document.createElement("div"); r.className = "row";
  r.innerHTML = `
    <div class="lbl"><b>${label}</b><span>${hint}</span></div>
    <div class="stepper">
      ${withPrice ? `<input class="price-edit" id="pr_${k}" inputmode="decimal" value="${P[k]}" title="price each">` : ``}
      <button data-k="${k}" data-d="-1">−</button>
      <input id="q_${k}" inputmode="numeric" value="0" data-k="${k}">
      <button data-k="${k}" data-d="1">+</button>
    </div>`;
  host.appendChild(r);
}

function buildEstimate(){
  ITEMS.carpet.forEach(([k,l,h]) => stepperRow($("carpet"), k, l, h, true));
  ITEMS.carpetAddons.forEach(([k,l,h]) => stepperRow($("carpet-sqft-addons"), k, l, h, false));
  ITEMS.uph.forEach(([k,l,h]) => stepperRow($("uph"), k, l, h, true));
  ITEMS.rugs.forEach(([k,l,h]) => stepperRow($("rugs"), k, l, h, true));

  // steppers (delegated)
  document.body.addEventListener("click", e=>{
    const b = e.target.closest(".stepper button"); if(!b) return;
    const k = b.dataset.k; qty[k] = Math.max(0, (qty[k]||0) + (+b.dataset.d));
    const inp = $("q_"+k); if(inp) inp.value = qty[k];
    recalc();
  });
  // manual qty typing
  document.body.addEventListener("input", e=>{
    if(e.target.matches("input[id^='q_']")){ const k=e.target.dataset.k; qty[k]=Math.max(0,+e.target.value||0); recalc(); }
    if(e.target.matches("input[id^='pr_']")){ const k=e.target.id.slice(3); priceOverride[k]=e.target.value; recalc(); }
    if(e.target.id==="sqft" || e.target.id==="sqrate") recalc();
  });

  // job type
  $("jobtype").addEventListener("click", e=>{
    const b=e.target.closest("button"); if(!b) return;
    jobType=b.dataset.t;
    $("jobtype").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));
    $("comBox").classList.toggle("show", jobType==="com");
    $("resForm").style.display = jobType==="com" ? "none" : "";
    recalc();
  });
  // carpet mode
  $("carpetMode").addEventListener("click", e=>{
    const b=e.target.closest("button"); if(!b) return;
    carpetMode=b.dataset.m;
    $("carpetMode").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x===b));
    $("mode-rooms").classList.toggle("show", carpetMode==="rooms");
    $("mode-sqft").classList.toggle("show", carpetMode==="sqft");
    if(carpetMode==="sqft"){ qty.room=0; const q=$("q_room"); if(q) q.value=0; }
    recalc();
  });

  $("toJob").addEventListener("click", ()=>{ prepJob(); showScreen("job"); });
}

/* ───────────── Pricing engine ───────────── */
function lineItems(){
  const items = [];
  if(jobType==="com") return items;   // commercial: no auto lines

  if(carpetMode==="rooms"){
    ITEMS.carpet.forEach(([k])=>{ if(qty[k]>0) items.push({key:k,label:LABELS[k],qty:qty[k],unit:unit(k),amount:qty[k]*unit(k)}); });
  } else {
    const sq=+($("sqft").value)||0, rate=+($("sqrate").value)||0;
    if(sq>0 && rate>0) items.push({key:"sqft",label:`Carpet — ${sq} sq ft @ ${money2(rate)}/sq ft`,qty:sq,unit:rate,amount:sq*rate});
    ITEMS.carpetAddons.forEach(([k])=>{ if(qty[k]>0) items.push({key:k,label:LABELS[k],qty:qty[k],unit:unit(k),amount:qty[k]*unit(k)}); });
  }
  ITEMS.uph.forEach(([k])=>{ if(qty[k]>0) items.push({key:k,label:LABELS[k],qty:qty[k],unit:unit(k),amount:qty[k]*unit(k)}); });
  ITEMS.rugs.forEach(([k])=>{ if(qty[k]>0) items.push({key:k,label:LABELS[k],qty:qty[k],unit:unit(k),amount:qty[k]*unit(k)}); });
  return items;
}

function serviceType(items){
  const carpet = items.some(i=>["room","hall","stairs","pet","sqft"].includes(i.key));
  const uph = items.some(i=>["sofa","loveseat","chair","dining","cushion","mattress"].includes(i.key));
  const rug = items.some(i=>i.key==="rug");
  const parts=[]; if(carpet)parts.push("Carpet"); if(uph)parts.push("Upholstery"); if(rug)parts.push("Rug");
  return parts.join(" + ") || "Carpet Cleaning";
}

/* "3 rooms ($300), 1 hallway ($40), sofa ($105)" — the exact format generate_invoice.py parses */
function areasString(items){
  return items.map(i=>{
    if(i.key==="sqft") return `${i.qty} sq ft carpet ($${Math.round(i.amount)})`;
    const noun = i.qty>1 ? i.label.toLowerCase() : i.label.toLowerCase().replace(/s$/,"");
    return `${i.qty} ${noun} ($${Math.round(i.amount)})`;
  }).join(", ");
}

function computeTotals(items){
  const subtotal = items.reduce((s,i)=>s+i.amount,0);
  const floored = subtotal>0 && subtotal<P.minJob;
  const total = floored ? P.minJob : subtotal;
  // implied $/room for the under-baseline nudge (rooms mode only)
  let underBaseline=false;
  if(carpetMode==="rooms" && qty.room>0){ if(unit("room")<P.room) underBaseline=true; }
  return { subtotal, total, floored, underBaseline };
}

function recalc(){
  const items = lineItems();
  const t = computeTotals(items);
  $("total").textContent = money(t.total);
  const parts = items.map(i=> i.key==="sqft" ? `${i.qty}sqft` : `${i.qty}× ${i.key}`);
  $("breakdown").textContent = jobType==="com" ? "Commercial — quote by phone"
    : (parts.length ? parts.join(" · ") : "Nothing added yet");
  $("perhr").textContent = t.floored ? `$120 minimum applied` : (items.length?`${items.length} line${items.length>1?"s":""}`:"");
  $("lowNote").classList.toggle("hide", !t.underBaseline);
  $("toJob").disabled = jobType!=="com" && items.length===0 && t.total===0;
  // keep price override inputs reflecting current unit
  return { items, t };
}

/* ───────────── Job screen ───────────── */
function prepJob(){
  const { items, t } = recalc();
  const disc = +($("j_disc").value)||0;
  currentJob = {
    job_id: editingId || null,
    created: (currentJob && currentJob.created) || Date.now(),
    date: $("j_date").value || new Date().toISOString().slice(0,10),
    jobType,
    carpetMode,
    sq_ft: carpetMode==="sqft" ? (+($("sqft").value)||null) : null,
    service_type: serviceType(items),
    line_items: items,
    areas_rooms_string: areasString(items),
    subtotal: t.subtotal,
    quoted_price: t.total,
    discount: disc,
    final_price: Math.max(0, t.total - disc),
    stain_notes: $("j_stain").value.trim(),
    notes: $("j_notes").value.trim(),
    hours_on_site: $("j_hours").value ? +$("j_hours").value : null,
    technicians: $("j_tech").value.trim() || "Jose Figueroa",
    payment_method: $("j_pay").value,
    paid: $("j_paid").value,
    client: readClient(),
  };
  renderJobSummary();
}

function readClient(){
  return {
    client_id: $("custPick").value || null,
    first: $("c_first").value.trim(), last: $("c_last").value.trim(),
    phone: $("c_phone").value.trim(), email: $("c_email").value.trim(),
    street: $("c_street").value.trim(), city: $("c_city").value.trim(),
    zip: $("c_zip").value.trim(), type: $("c_type").value,
  };
}

function renderJobSummary(){
  if(!currentJob){ return; }
  const j=currentJob; const host=$("jobSummary"); host.innerHTML="";
  const rows=[];
  j.line_items.forEach(i=> rows.push([i.label + (i.key!=="sqft"&&i.qty>1?` ×${i.qty}`:""), money(i.amount)]));
  if(j.discount>0){ rows.push(["Subtotal", money(j.quoted_price)]); rows.push(["Discount", "− "+money(j.discount)]); }
  rows.forEach(([l,v])=>{ const d=document.createElement("div"); d.className="summary-line"; d.innerHTML=`<span>${l}</span><b>${v}</b>`; host.appendChild(d); });
  const tot=document.createElement("div"); tot.className="summary-line total-line";
  tot.innerHTML=`<span>Total due</span><b>${money(j.final_price)}</b>`; host.appendChild(tot);
}

/* recompute job summary when job fields change */
["j_date","j_hours","j_tech","j_pay","j_paid","j_disc","j_stain","j_notes",
 "c_first","c_last","c_phone","c_email","c_street","c_city","c_zip","c_type"].forEach(id=>{
  document.addEventListener("input", e=>{ if(e.target.id===id && currentJob){ prepJob(); } });
});

/* ───────────── IndexedDB ───────────── */
let db;
function openDB(){
  return new Promise((res,rej)=>{
    let rq;
    try{ rq = indexedDB.open("figueroas", 1); }
    catch(e){ return rej(e); }
    rq.onupgradeneeded = ()=>{ const d=rq.result;
      if(!d.objectStoreNames.contains("jobs")) d.createObjectStore("jobs",{keyPath:"job_id"});
      if(!d.objectStoreNames.contains("clients")) d.createObjectStore("clients",{keyPath:"client_id"});
      if(!d.objectStoreNames.contains("meta")) d.createObjectStore("meta",{keyPath:"k"});
    };
    rq.onsuccess=()=>{ db=rq.result; res(db); };
    rq.onerror=()=>rej(rq.error);
    rq.onblocked=()=>rej(new Error("storage blocked"));
  });
}
async function ensureDB(){
  if(db) return true;
  try{ await openDB(); return !!db; }catch(e){ return false; }
}
function tx(store,mode="readonly"){ return db.transaction(store,mode).objectStore(store); }
function idbGet(store,key){ return new Promise((res,rej)=>{ const r=tx(store).get(key); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
function idbAll(store){ return new Promise((res,rej)=>{ const r=tx(store).getAll(); r.onsuccess=()=>res(r.result||[]); r.onerror=()=>rej(r.error); }); }
function idbPut(store,val){ return new Promise((res,rej)=>{ const r=tx(store,"readwrite").put(val); r.onsuccess=()=>res(); r.onerror=()=>rej(r.error); }); }

async function nextJobId(){
  const m = await idbGet("meta","jobseq");
  const n = (m?.v || 0) + 1;
  await idbPut("meta",{k:"jobseq",v:n});
  return "J" + String(n).padStart(4,"0");
}

function clientRecord(c){
  return { client_id:c.client_id, first:c.first||"", last:c.last||"", phone:c.phone||"",
    email:c.email||"", street:c.street||"", city:c.city||"", zip:c.zip||"", type:c.type||"Residential" };
}
async function saveJob(){
  try{
    if(!(await ensureDB())){
      window.alert("This phone is blocking storage, so jobs can't be saved.\n\nIf you opened the app in Private Browsing, open it normally instead. Otherwise check Settings → Safari and make sure website data isn't blocked.");
      return;
    }
    if(!currentJob){ prepJob(); }
    if(!currentJob || currentJob.line_items.length===0){
      window.alert("Add at least one item on the Estimate screen first."); showScreen("estimate"); return;
    }
    const c = currentJob.client;
    if(!c.client_id && !(c.first||c.last)){
      window.alert("Add a customer name first, or pick an existing customer."); $("c_first").focus(); return;
    }
    // save the customer (new, or keep an existing one in sync with edits)
    if(!c.client_id) c.client_id = "APP-" + Date.now().toString(36);
    await idbPut("clients", clientRecord(c));
    await refreshClientPicker(c.client_id);
    if(typeof refreshClients==="function") await refreshClients();
    // save the job
    currentJob.job_id = currentJob.job_id || await nextJobId();
    await idbPut("jobs", currentJob);
    $("jobMsg").textContent = `Saved ${currentJob.job_id}.`;
    loadInvoicePreview(currentJob);
    $("tab-invoice").disabled = false;
    await refreshJobsList();
    showScreen("invoice");   // clear signal it worked + sets up the PDF
  }catch(e){
    window.alert("Couldn't save the job:\n" + (e && e.message ? e.message : e) + "\n\nTell Aaron exactly what this says.");
  }
}

/* ───────────── Edit / delete / new ───────────── */
function resetEstimateInputs(){
  Object.keys(qty).forEach(k=>{ qty[k]=0; const q=$("q_"+k); if(q) q.value=0; });
  Object.keys(priceOverride).forEach(k=>{ delete priceOverride[k]; const p=$("pr_"+k); if(p) p.value=P[k]; });
  const sq=$("sqft"); if(sq) sq.value=""; const sr=$("sqrate"); if(sr) sr.value="0.35";
}
function clearJobFields(){
  ["c_first","c_last","c_phone","c_email","c_street","c_zip"].forEach(id=>$(id).value="");
  $("c_city").value=""; $("c_type").value="Residential"; $("custPick").value=""; $("newCustFields").style.display="";
  ["j_hours","j_tech","j_disc","j_stain","j_notes"].forEach(id=>$(id).value="");
  $("j_pay").value=""; $("j_paid").value="No"; $("j_date").value=new Date().toISOString().slice(0,10);
  $("jobMsg").textContent="";
}
function newJob(){
  editingId=null; currentJob=null;
  jobType="res"; carpetMode="rooms";
  $("jobtype").querySelectorAll("button").forEach(b=>b.classList.toggle("on",b.dataset.t==="res"));
  $("comBox").classList.remove("show"); $("resForm").style.display="";
  $("carpetMode").querySelectorAll("button").forEach(b=>b.classList.toggle("on",b.dataset.m==="rooms"));
  $("mode-rooms").classList.add("show"); $("mode-sqft").classList.remove("show");
  resetEstimateInputs(); clearJobFields(); recalc(); showScreen("estimate");
}
function loadJobIntoForm(j){
  editingId=j.job_id; currentJob=j;
  jobType=j.jobType||"res"; carpetMode=j.carpetMode||"rooms";
  $("jobtype").querySelectorAll("button").forEach(b=>b.classList.toggle("on",b.dataset.t===jobType));
  $("comBox").classList.toggle("show",jobType==="com"); $("resForm").style.display=jobType==="com"?"none":"";
  $("carpetMode").querySelectorAll("button").forEach(b=>b.classList.toggle("on",b.dataset.m===carpetMode));
  $("mode-rooms").classList.toggle("show",carpetMode==="rooms"); $("mode-sqft").classList.toggle("show",carpetMode==="sqft");
  resetEstimateInputs();
  (j.line_items||[]).forEach(it=>{
    if(it.key==="sqft"){ $("sqft").value=j.sq_ft||it.qty||""; $("sqrate").value=it.unit; }
    else { qty[it.key]=it.qty; const q=$("q_"+it.key); if(q) q.value=it.qty;
           if(P[it.key]!==it.unit){ priceOverride[it.key]=it.unit; const p=$("pr_"+it.key); if(p) p.value=it.unit; } }
  });
  const c=j.client||{};
  $("c_first").value=c.first||""; $("c_last").value=c.last||""; $("c_phone").value=c.phone||"";
  $("c_email").value=c.email||""; $("c_street").value=c.street||""; $("c_city").value=c.city||"";
  $("c_zip").value=c.zip||""; $("c_type").value=c.type||"Residential";
  $("j_date").value=j.date||new Date().toISOString().slice(0,10);
  $("j_hours").value=j.hours_on_site||""; $("j_tech").value=j.technicians||"";
  $("j_pay").value=j.payment_method||""; $("j_paid").value=j.paid||"No"; $("j_disc").value=j.discount||"";
  $("j_stain").value=j.stain_notes||""; $("j_notes").value=j.notes||"";
  refreshClientPicker(c.client_id||""); recalc(); prepJob(); showScreen("job");
  $("jobMsg").textContent=`Editing ${j.job_id}. Save to update it.`;
}
async function editJob(id){ const j=await idbGet("jobs",id); if(j) loadJobIntoForm(j); }
async function deleteJob(id){
  if(!window.confirm(`Delete ${id}? This can't be undone.`)) return;
  await new Promise((res,rej)=>{ const r=tx("jobs","readwrite").delete(id); r.onsuccess=()=>res(); r.onerror=()=>rej(r.error); });
  if(editingId===id) newJob();
  await refreshJobsList();
}

/* ───────────── Import customers (privacy-safe, from a local file) ───────────── */
async function importCustomers(file){
  try{
    const data = JSON.parse(await file.text());
    const list = Array.isArray(data) ? data : (data.clients || []);
    if(!list.length){ $("jobMsg").textContent="No customers found in that file."; return; }
    let n=0;
    for(const c of list){
      if(!c.client_id && !(c.first||c.last)) continue;
      const id = c.client_id || ("IMP-"+Date.now().toString(36)+"-"+(n));
      await idbPut("clients", { client_id:id, first:c.first||"", last:c.last||"", phone:c.phone||"",
        email:c.email||"", street:c.street||"", city:c.city||"", zip:c.zip||"", type:c.type||"Residential" });
      n++;
    }
    await refreshClientPicker();
    if(typeof refreshClients==="function") await refreshClients();
    window.alert(`Imported ${n} customers. Find them on the Clients tab and when you pick a customer on the Job screen.`);
  }catch(e){ window.alert("Couldn't read that file. Make sure it's the customers.json from export_customers.py."); }
}

/* ───────────── Invoice: in-app branded PDF ───────────── */
function loadInvoicePreview(j){
  const host=$("invPreview"); host.innerHTML="";
  const badge = j.paid==="Yes"?'<span class="pill paid">PAID</span>' : j.paid==="Partial"?'<span class="pill partial">PARTIAL</span>':'<span class="pill due">BALANCE DUE</span>';
  const name = `${j.client.first||""} ${j.client.last||""}`.trim() || "—";
  host.innerHTML = `
    <div class="summary-line"><span>Invoice</span><b>INV-${j.job_id}</b></div>
    <div class="summary-line"><span>Customer</span><b>${name}</b></div>
    <div class="summary-line"><span>Service</span><b>${j.service_type}</b></div>
    <div class="summary-line"><span>Status</span><b>${badge}</b></div>
    <div class="summary-line total-line"><span>Total due</span><b>${money(j.final_price)}</b></div>`;
  $("genPdf").disabled=false;
  $("genPdf").dataset.job=j.job_id;
}

async function makePdf(j){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({unit:"pt", format:"letter"});
  const PW = doc.internal.pageSize.getWidth();
  const M = 43;                     // ~0.6in margin
  const W = PW - M*2;
  let y = 36;

  // Header red banner
  doc.setFillColor(RED); doc.rect(M, y, W, 92, "F");
  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica","bold"); doc.setFontSize(20);
  doc.text(BIZ.name, M+14, y+28);
  doc.setFont("helvetica","normal"); doc.setFontSize(8.5);
  [BIZ.phone, BIZ.email, BIZ.location, BIZ.address].forEach((t,i)=> doc.text(t, M+14, y+44+i*12));
  doc.setFont("helvetica","bold"); doc.setFontSize(11); doc.text("INVOICE", M+W-14, y+24, {align:"right"});
  doc.setFontSize(17); doc.text("INV-"+j.job_id, M+W-14, y+42, {align:"right"});
  doc.setFont("helvetica","normal"); doc.setFontSize(8.5);
  doc.text("Date: "+fmtDate(new Date()), M+W-14, y+60, {align:"right"});
  doc.text("Job Date: "+fmtDate(j.date), M+W-14, y+72, {align:"right"});
  y += 92 + 22;

  // Bill To + Job details
  const c=j.client;
  doc.setTextColor(TEAL); doc.setFont("helvetica","bold"); doc.setFontSize(8);
  doc.text("BILL TO", M, y);
  doc.text("JOB DETAILS", M+W*0.55, y);
  doc.setTextColor(DARK); doc.setFont("helvetica","normal"); doc.setFontSize(10);
  const nm=`${c.first||""} ${c.last||""}`.trim()||"—";
  const addr=[c.street,c.city,c.zip].filter(Boolean).join(", ")||"—";
  let by=y+15;
  [nm, addr, c.phone||"—", c.email||"—"].forEach(t=>{ doc.text(String(t), M, by); by+=13; });
  let jy=y+15;
  const jd=[["Technician(s):", j.technicians||"—"]];
  if(j.hours_on_site) jd.push(["Hours on site:", String(j.hours_on_site)]);
  jd.push(["Payment:", j.payment_method||"—"]);
  jd.push(["Status:", j.paid==="Yes"?"PAID":j.paid==="Partial"?"PARTIAL":"BALANCE DUE"]);
  doc.setFontSize(9);
  jd.forEach(([a,b])=>{ doc.setFont("helvetica","italic"); doc.text(a, M+W*0.55, jy);
    doc.setFont("helvetica","normal"); doc.text(String(b), M+W*0.80, jy); jy+=14; });
  y = Math.max(by, jy) + 10;

  // Services table
  doc.setFillColor(TEAL); doc.rect(M, y, W, 22, "F");
  doc.setTextColor("#FFFFFF"); doc.setFont("helvetica","bold"); doc.setFontSize(9);
  doc.text("SERVICE", M+8, y+15);
  doc.text("DESCRIPTION", M+W*0.30, y+15);
  doc.text("AMOUNT", M+W-8, y+15, {align:"right"});
  y += 22;
  doc.setTextColor(DARK); doc.setFont("helvetica","normal");
  const svc = j.service_type;
  j.line_items.forEach((it,idx)=>{
    const rowH=22;
    doc.setFillColor(LIGHT); doc.rect(M, y, W, rowH, "F");
    doc.setFontSize(9);
    doc.text(idx===0?svc:"", M+8, y+14, {maxWidth:W*0.26});
    let desc = it.label + (it.key!=="sqft" && it.qty>1 ? `  (×${it.qty} @ ${money(it.unit)})` : "");
    doc.text(desc, M+W*0.30, y+14, {maxWidth:W*0.42});
    doc.text(money(it.amount), M+W-8, y+14, {align:"right"});
    doc.setDrawColor(MIDGRAY); doc.line(M, y+rowH, M+W, y+rowH);
    y += rowH;
  });
  y += 10;

  // Totals
  doc.setFontSize(11); doc.setFont("helvetica","bold");
  if(j.discount>0){
    doc.setTextColor(DARK); doc.text("Subtotal:", M+W-140, y);
    doc.setTextColor(RED); doc.text(money(j.quoted_price), M+W-8, y, {align:"right"}); y+=16;
    doc.setTextColor(DARK); doc.text("Discount:", M+W-140, y);
    doc.setTextColor(RED); doc.text("- "+money(j.discount), M+W-8, y, {align:"right"}); y+=16;
  }
  doc.setDrawColor(RED); doc.setLineWidth(1.5); doc.line(M+W-180, y-2, M+W, y-2); doc.setLineWidth(1);
  y+=12; doc.setTextColor(DARK); doc.text("Total Due:", M+W-140, y);
  doc.setTextColor(RED); doc.setFontSize(13); doc.text(money(j.final_price), M+W-8, y, {align:"right"});
  y += 26;

  // Notes (stain + job notes), italic, under the totals
  const noteBits=[];
  if(j.stain_notes) noteBits.push("Stain notes: "+j.stain_notes);
  if(j.notes) noteBits.push(j.notes);
  if(noteBits.length){
    doc.setTextColor(DARK); doc.setFont("helvetica","italic"); doc.setFontSize(8.5);
    const lines=doc.splitTextToSize(noteBits.join("  ·  "), W);
    doc.text(lines, M, y); y += lines.length*11 + 8;
    doc.setFont("helvetica","normal");
  }

  // How to pay
  doc.setDrawColor(MIDGRAY); doc.line(M, y, M+W, y); y+=16;
  doc.setTextColor(TEAL); doc.setFont("helvetica","bold"); doc.setFontSize(10);
  doc.text("HOW TO PAY", M, y); y+=15;
  doc.setTextColor(DARK); doc.setFont("helvetica","normal"); doc.setFontSize(9);
  const col=W/3;
  doc.setFont("helvetica","bold"); doc.text("Cash", M, y);
  doc.text("Venmo", M+col, y); doc.text("Check", M+col*2, y);
  doc.setFont("helvetica","normal");
  doc.text("Hand it to us directly.", M, y+13, {maxWidth:col-10});
  doc.text(BIZ.venmo, M+col, y+13, {maxWidth:col-10});
  doc.text(`Payable to ${BIZ.name}.\nMail: ${BIZ.address}`, M+col*2, y+13, {maxWidth:col-10});
  y += 44;

  // Review block + QR
  doc.setDrawColor(MIDGRAY); doc.line(M, y, M+W, y); y+=16;
  doc.setTextColor(TEAL); doc.setFont("helvetica","bold"); doc.setFontSize(10);
  doc.text("LEAVE US A REVIEW", M, y);
  doc.setTextColor(DARK); doc.setFont("helvetica","normal"); doc.setFontSize(9);
  doc.text("Happy with our work? A quick Google review means a lot to our\nfamily and helps your neighbors find us.", M, y+15, {maxWidth:W*0.62});
  doc.setTextColor(TEAL); doc.textWithLink(BIZ.reviewUrl, M, y+45, {url:BIZ.reviewUrl});
  try{ doc.addImage(REVIEW_QR, "PNG", M+W-72, y-6, 66, 66); }catch(e){}
  y += 70;

  // Footer
  doc.setDrawColor(MIDGRAY); doc.line(M, y, M+W, y); y+=14;
  doc.setTextColor(MIDGRAY); doc.setFontSize(8);
  doc.text("Thank you for trusting us in your home. — "+BIZ.name, PW/2, y, {align:"center"});
  return doc;
}
function fmtDate(d){ const dt=(d instanceof Date)?d:new Date(d+"T00:00:00");
  return dt.toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}); }

let lastBlobUrl=null;
async function generatePdf(){
  const jid=$("genPdf").dataset.job; const j=await idbGet("jobs",jid);
  const doc=await makePdf(j);
  const blob=doc.output("blob");
  if(lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
  lastBlobUrl=URL.createObjectURL(blob);
  window._lastPdf={blob, name:`INV-${jid}.pdf`, job:j};
  $("sharePdf").disabled=false; $("printPdf").disabled=false;
  $("invMsg").textContent=`INV-${jid}.pdf ready. Share to save it or send to the customer.`;
}
async function sharePdf(){
  const p=window._lastPdf; if(!p) return;
  const file=new File([p.blob], p.name, {type:"application/pdf"});
  if(navigator.canShare && navigator.canShare({files:[file]})){
    try{ await navigator.share({files:[file], title:p.name, text:`Invoice from ${BIZ.name}`}); return; }catch(e){}
  }
  const a=document.createElement("a"); a.href=lastBlobUrl; a.download=p.name; a.click();
}
function openPdf(){ if(lastBlobUrl) window.open(lastBlobUrl, "_blank"); }

/* ───────────── Saved jobs + export ───────────── */
async function refreshJobsList(){
  const jobs=(await idbAll("jobs")).sort((a,b)=>b.created-a.created);
  $("jobCount").textContent = jobs.length ? `${jobs.length} job${jobs.length>1?"s":""}` : "";
  const host=$("jobsList");
  if(!jobs.length){ host.innerHTML='<p class="hint">No saved jobs yet.</p>'; return; }
  host.innerHTML="";
  jobs.forEach(j=>{
    const nm=`${j.client.first||""} ${j.client.last||""}`.trim()||"—";
    const d=document.createElement("div"); d.className="jobrow";
    d.innerHTML=`<div><div class="who">${j.job_id} · ${nm}</div>
      <div class="meta">${j.date} · ${j.service_type} · ${money(j.final_price)}</div></div>
      <div style="display:flex;gap:2px;flex-shrink:0">
        <button class="linkbtn" data-open="${j.job_id}">Invoice</button>
        <button class="linkbtn" data-edit="${j.job_id}">Edit</button>
        <button class="linkbtn" data-del="${j.job_id}" style="color:var(--red)">Delete</button>
      </div>`;
    host.appendChild(d);
  });
  host.querySelectorAll("[data-open]").forEach(b=>b.addEventListener("click", async ()=>{
    const j=await idbGet("jobs", b.dataset.open); loadInvoicePreview(j); $("tab-invoice").disabled=false; showScreen("invoice");
  }));
  host.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click", ()=>editJob(b.dataset.edit)));
  host.querySelectorAll("[data-del]").forEach(b=>b.addEventListener("click", ()=>deleteJob(b.dataset.del)));
}

const CSV_COLS = ["job_id","date","client_id","customer","customer_type","city","zip","source",
  "service_type","areas_raw","sq_ft","labor_hours","price_quoted","discount","price_final",
  "paid","payment_method","technicians","notes"];
function jobToRow(j){
  const c=j.client;
  return {
    job_id:j.job_id, date:j.date, client_id:c.client_id||"", customer:`${c.first||""} ${c.last||""}`.trim(),
    customer_type:c.type||"", city:c.city||"", zip:c.zip||"", source:"",
    service_type:j.service_type, areas_raw:j.areas_rooms_string, sq_ft:j.sq_ft||"",
    labor_hours:j.hours_on_site||"", price_quoted:j.quoted_price, discount:j.discount||"",
    price_final:j.final_price, paid:j.paid||"", payment_method:j.payment_method||"",
    technicians:j.technicians||"", notes:j.notes||"",
  };
}
function csvEsc(v){ v=String(v==null?"":v); return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; }
async function exportCsv(){
  const jobs=(await idbAll("jobs")).sort((a,b)=>a.created-b.created);
  if(!jobs.length){ window.alert("No jobs to export yet."); return; }
  const lines=[CSV_COLS.join(",")];
  jobs.forEach(j=>{ const r=jobToRow(j); lines.push(CSV_COLS.map(k=>csvEsc(r[k])).join(",")); });
  download(new Blob([lines.join("\n")],{type:"text/csv"}), "figueroas-jobs-export.csv");
}
async function exportJson(){
  const jobs=await idbAll("jobs"), clients=await idbAll("clients");
  download(new Blob([JSON.stringify({exported:new Date().toISOString(),jobs,clients},null,2)],{type:"application/json"}), "figueroas-export.json");
}
function download(blob,name){ const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),4000); }

async function refreshClientPicker(selectId){
  const clients=(await idbAll("clients")).sort((a,b)=>(a.last||"").localeCompare(b.last||""));
  const sel=$("custPick"); const cur=selectId||sel.value;
  sel.innerHTML='<option value="">— New customer —</option>';
  clients.forEach(c=>{ const o=document.createElement("option"); o.value=c.client_id;
    o.textContent=`${c.first||""} ${c.last||""}`.trim()+(c.city?` · ${c.city}`:""); sel.appendChild(o); });
  if(cur) sel.value=cur;
}
function bindCustomerPicker(){
  $("custPick").addEventListener("change", async e=>{
    const id=e.target.value;
    if(!id){ $("newCustFields").style.display=""; return; }
    const c=await idbGet("clients",id); if(!c) return;
    $("c_first").value=c.first||""; $("c_last").value=c.last||""; $("c_phone").value=c.phone||"";
    $("c_email").value=c.email||""; $("c_street").value=c.street||""; $("c_city").value=c.city||"";
    $("c_zip").value=c.zip||""; $("c_type").value=c.type||"Residential";
    if(currentJob) prepJob();
  });
}

/* ───────────── Clients page (view / add / edit / delete) ───────────── */
let editingClientId = null;
const CF = ["first","last","phone","email","street","city","zip","type"];
async function refreshClients(){
  if(!(await ensureDB())){ $("clientsList").innerHTML='<p class="hint">Storage is unavailable on this phone.</p>'; return; }
  const clients=(await idbAll("clients")).sort((a,b)=>((a.last||a.first||"")+"").localeCompare((b.last||b.first||"")+""));
  $("clientCount").textContent = clients.length ? `${clients.length}` : "";
  const host=$("clientsList");
  if(!clients.length){ host.innerHTML='<p class="hint">No customers yet. Add one, or Import customers.</p>'; return; }
  host.innerHTML="";
  clients.forEach(c=>{
    const nm=`${c.first||""} ${c.last||""}`.trim()||"—";
    const meta=[c.phone,c.city].filter(Boolean).join(" · ")||"—";
    const d=document.createElement("div"); d.className="jobrow";
    d.innerHTML=`<div><div class="who">${nm}</div><div class="meta">${meta}</div></div>
      <div style="display:flex;gap:2px;flex-shrink:0">
        <button class="linkbtn" data-cedit="${c.client_id}">Edit</button>
        <button class="linkbtn" data-cdel="${c.client_id}" style="color:var(--red)">Delete</button>
      </div>`;
    host.appendChild(d);
  });
  host.querySelectorAll("[data-cedit]").forEach(b=>b.addEventListener("click", ()=>editClient(b.dataset.cedit)));
  host.querySelectorAll("[data-cdel]").forEach(b=>b.addEventListener("click", ()=>deleteClient(b.dataset.cdel)));
}
function showClientForm(show){ $("clientForm").style.display = show?"":"none"; }
function addClient(){
  editingClientId=null; $("clientFormTitle").textContent="New customer";
  CF.forEach(k=>{ const el=$("cf_"+k); if(el) el.value = k==="type"?"Residential":""; });
  $("clientMsg").textContent=""; showClientForm(true);
  if($("clientForm").scrollIntoView) $("clientForm").scrollIntoView({behavior:"smooth"});
}
async function editClient(id){
  const c=await idbGet("clients",id); if(!c) return;
  editingClientId=id; $("clientFormTitle").textContent="Edit customer";
  CF.forEach(k=>{ const el=$("cf_"+k); if(el) el.value=c[k]||(k==="type"?"Residential":""); });
  $("clientMsg").textContent=""; showClientForm(true);
  if($("clientForm").scrollIntoView) $("clientForm").scrollIntoView({behavior:"smooth"});
}
async function saveClient(){
  try{
    if(!(await ensureDB())){ window.alert("Storage is unavailable on this phone."); return; }
    const c={}; CF.forEach(k=>c[k]=($("cf_"+k).value||"").trim());
    if(!c.first && !c.last){ $("clientMsg").textContent="Add at least a first or last name."; return; }
    c.client_id = editingClientId || ("APP-"+Date.now().toString(36));
    await idbPut("clients", clientRecord(c));
    editingClientId=null; showClientForm(false);
    await refreshClients(); await refreshClientPicker();
  }catch(e){ window.alert("Couldn't save customer: "+(e&&e.message?e.message:e)); }
}
async function deleteClient(id){
  if(!window.confirm("Delete this customer? Their saved jobs stay, but the customer entry is removed.")) return;
  await new Promise((res,rej)=>{ const r=tx("clients","readwrite").delete(id); r.onsuccess=()=>res(); r.onerror=()=>rej(r.error); });
  await refreshClients(); await refreshClientPicker();
}

/* ───────────── Screen routing ───────────── */
function showScreen(name){
  document.querySelectorAll(".screen").forEach(s=>s.classList.toggle("on", s.id==="screen-"+name));
  document.querySelectorAll(".tabs button").forEach(b=>b.classList.toggle("on", b.dataset.s===name));
  $("out").style.display = name==="estimate" ? "" : "none";
  if(name==="job"){ if(!$("j_date").value) $("j_date").value=new Date().toISOString().slice(0,10); prepJob(); refreshClientPicker(); }
  if(name==="jobs") refreshJobsList();
  if(name==="clients"){ showClientForm(false); refreshClients(); }
  window.scrollTo(0,0);
}
function bindTabs(){
  document.querySelectorAll(".tabs button").forEach(b=>b.addEventListener("click", ()=>{ if(!b.disabled) showScreen(b.dataset.s); }));
}

/* ───────────── Boot ───────────── */
(async function(){
  buildEstimate();
  bindTabs();
  bindCustomerPicker();
  $("saveJob").addEventListener("click", saveJob);
  $("genPdf").addEventListener("click", generatePdf);
  $("sharePdf").addEventListener("click", sharePdf);
  $("printPdf").addEventListener("click", openPdf);
  $("exportJobs").addEventListener("click", exportCsv);
  $("exportJson").addEventListener("click", exportJson);
  $("newJob").addEventListener("click", newJob);
  $("importCust").addEventListener("click", ()=>$("custFile").click());
  $("importCust2").addEventListener("click", ()=>$("custFile").click());
  $("custFile").addEventListener("change", e=>{ if(e.target.files[0]){ importCustomers(e.target.files[0]); e.target.value=""; } });
  $("addClient").addEventListener("click", addClient);
  $("saveClient").addEventListener("click", saveClient);
  $("cancelClient").addEventListener("click", ()=>{ editingClientId=null; showClientForm(false); });
  const okdb = await ensureDB();
  if(!okdb){ $("jobMsg").textContent="⚠ Storage is blocked on this device — saving won't work until that's fixed."; }
  try{ await refreshJobsList(); await refreshClientPicker(); await refreshClients(); }catch(e){ console.warn("DB error", e); }
  recalc();
  if("serviceWorker" in navigator){ navigator.serviceWorker.register("sw.js").catch(()=>{}); }
})();
