/* V43 — annual history shows only worked months */

const KEY="heuresProV35";
const OLD_KEYS=["heuresProV34","heuresProV33","heuresProV32","heuresProV31","heuresProV30","heuresProV29","heuresProV28","heuresProV27","heuresProV26","heuresProV25","heuresProV24"];
const DEF={punches:[],settings:{rate:13.78,net:.78,taxRate:0,thirteen:0,weekly:35,nightStart:"20:00",nightEnd:"06:00",nightPct:25,ot25:43,ot25pct:25,ot50pct:50,primes:[],interimEnabled:true,ifmEnabled:true,ifmRate:10,ifmMode:"pay",iccpEnabled:true,iccpRate:10,iccpMode:"pay",cetEntries:[]}};
let S=load(),page="home",annualYear=new Date().getFullYear(),annualChartOpen=true,historyMonthKey=iso(new Date()).slice(0,7),historyOpenWeeks=new Set(),historyOpenDays=new Set(),picker={date:new Date(),month:new Date(),startH:8,startM:0,endH:17,endM:0,breakH:1,breakM:0},copyState={source:null,targets:new Set(),month:new Date()};

function load(){
  try{
    let x=JSON.parse(localStorage.getItem(KEY));
    if(x)return merge(x);
    for(const k of OLD_KEYS){
      let old=JSON.parse(localStorage.getItem(k));
      if(old){let migrated=merge(old);localStorage.setItem(KEY,JSON.stringify(migrated));return migrated;}
    }
    return structuredClone(DEF);
  }catch(e){return structuredClone(DEF)}
}
function merge(x){return {punches:Array.isArray(x.punches)?x.punches:[],settings:{...DEF.settings,...(x.settings||{}),primes:Array.isArray(x.settings?.primes)?x.settings.primes:[],cetEntries:Array.isArray(x.settings?.cetEntries)?x.settings.cetEntries:[]}}}
function save(){localStorage.setItem(KEY,JSON.stringify(S))}
function pad(n){return String(n).padStart(2,"0")}
function iso(d){return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())}
function fmtD(s){return new Date(s+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"2-digit",month:"2-digit",year:"numeric"})}
function time(s){let d=new Date(s);return pad(d.getHours())+":"+pad(d.getMinutes())}
function hm(n){n=Math.max(0,Math.round(n));return Math.floor(n/60)+"h"+pad(n%60)}
function eur(n){return Number(n||0).toLocaleString("fr-FR",{style:"currency",currency:"EUR"})}
function toast(t){let e=document.getElementById("toast");e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),1600)}
function ps(d){return S.punches.filter(p=>p.date===d).sort((a,b)=>new Date(a.at)-new Date(b.at))}
function work(d){let total=0,start=null;for(let p of ps(d)){if(p.type==="start"||p.type==="resume")start=new Date(p.at);if((p.type==="pause"||p.type==="end")&&start){total+=(new Date(p.at)-start)/60000;start=null}}return Math.max(0,Math.round(total))}
function hmMinutes(v){
  const m=String(v||"00:00").match(/^(\d{1,2}):(\d{2})$/);
  if(!m)return 0; return Math.max(0,Math.min(23,Number(m[1])))*60+Math.max(0,Math.min(59,Number(m[2])));
}
function nightOverlap(a,b){
  if(!(a instanceof Date)||!(b instanceof Date)||b<=a)return 0;
  const ns=hmMinutes(S.settings.nightStart), ne=hmMinutes(S.settings.nightEnd);
  let total=0;
  // Check the configured night window on each local calendar day crossed by the interval.
  // This correctly handles overnight windows such as 20:00 → 06:00, including shifts
  // that start before 06:00 (e.g. 04:55 → 13:00).
  const firstDay=new Date(a); firstDay.setHours(0,0,0,0); firstDay.setDate(firstDay.getDate()-1);
  for(let day=new Date(firstDay); day<=b; day.setDate(day.getDate()+1)){
    const day0=new Date(day); day0.setHours(0,0,0,0);
    let nightStart=new Date(day0); nightStart.setHours(Math.floor(ns/60),ns%60,0,0);
    let nightEnd=new Date(day0);
    if(ns<ne){
      nightEnd.setHours(Math.floor(ne/60),ne%60,0,0);
    }else{
      nightEnd.setDate(nightEnd.getDate()+1); nightEnd.setHours(Math.floor(ne/60),ne%60,0,0);
    }
    const lo=Math.max(a.getTime(),nightStart.getTime());
    const hi=Math.min(b.getTime(),nightEnd.getTime());
    if(hi>lo) total+=(hi-lo)/60000;
  }
  return total;
}
function night(d){
  let total=0,start=null;
  for(const p of ps(d)){
    if(p.type==="start"||p.type==="resume") start=new Date(p.at);
    if((p.type==="pause"||p.type==="end")&&start){total+=nightOverlap(start,new Date(p.at));start=null;}
  }
  return Math.round(total);
}
function weekStart(d){let x=new Date(d+"T12:00:00");x.setDate(x.getDate()-((x.getDay()+6)%7));return iso(x)}
function week(d){let a=[],x=new Date(weekStart(d)+"T12:00:00");for(let i=0;i<7;i++){a.push(iso(x));x.setDate(x.getDate()+1)}return a}
function ot(d){let before=0;for(let x of week(d))if(x<d)before+=work(x);let cur=work(d),n=0,o25=0,o50=0;let a=S.settings.weekly*60,b=S.settings.ot25*60,totalBefore=before,total=before+cur;let p=Math.max(0,Math.min(total,b)-Math.max(totalBefore,a));o25=p;let q=Math.max(0,total-b)-Math.max(0,totalBefore-b);o50=Math.max(0,q);let used=o25+o50;n=Math.max(0,cur-used);return{n,o25,o50}}
function daySalary(d){
  let w=work(d),n=night(d),o=ot(d),r=S.settings.rate;
  let normal=o.n/60*r,p25=o.o25/60*r*(1+S.settings.ot25pct/100),p50=o.o50/60*r*(1+S.settings.ot50pct/100),np=n/60*r*S.settings.nightPct/100,th=w/60*S.settings.thirteen;
  const active=S.settings.primes.filter(x=>x.enabled!==false);
  const taxablePrimes=active.filter(x=>x.taxable!==false).reduce((a,x)=>a+Number(x.amount||0),0);
  const nonTaxablePrimes=active.filter(x=>x.taxable===false).reduce((a,x)=>a+Number(x.amount||0),0);
  const primes=taxablePrimes+nonTaxablePrimes;
  const baseGross=normal+p25+p50+np+th+taxablePrimes;
  const gross=baseGross;
  const netBeforeTax=gross*S.settings.net;
  const incomeTax=Math.max(0,netBeforeTax*Number(S.settings.taxRate||0)/100);
  const netAfterTax=netBeforeTax-incomeTax;
  const estimatedNet=netAfterTax+nonTaxablePrimes;
  return{w,n,o,normal,p25,p50,np,th,primes,taxablePrimes,nonTaxablePrimes,baseGross,gross,netBeforeTax,incomeTax,netAfterTax,estimatedNet,ifm:0,iccp:0,paidInterim:0,cetInterim:0};
}
function monthSalaryBase(key){
  let out={w:0,gross:0,th:0,pr:0,taxable:0,nontax:0};
  let ds=[...new Set(S.punches.map(p=>p.date))].filter(d=>d.startsWith(key));
  ds.forEach(d=>{let m=daySalary(d);out.w+=m.w;out.gross+=m.baseGross;out.th+=m.th;out.pr+=m.primes;out.taxable+=m.taxablePrimes;out.nontax+=m.nonTaxablePrimes});
  return out;
}
function interimCalc(key){
  let base=monthSalaryBase(key);
  if(!S.settings.interimEnabled)return {...base,ifm:0,iccp:0,paidIfm:0,paidIccp:0,cetIfm:0,cetIccp:0,cetCurrent:0,paidInterim:0,gross:base.gross,netBeforeTax:base.gross*S.settings.net,tax:Math.max(0,base.gross*S.settings.net*Number(S.settings.taxRate||0)/100)};
  let ifm=S.settings.ifmEnabled?base.gross*Math.max(0,Number(S.settings.ifmRate||0))/100:0;
  let iccp=S.settings.iccpEnabled?(base.gross+ifm)*Math.max(0,Number(S.settings.iccpRate||0))/100:0;
  let paidIfm=S.settings.ifmMode==='pay'?ifm:0,paidIccp=S.settings.iccpMode==='pay'?iccp:0;
  let cetIfm=S.settings.ifmMode==='cet'?ifm:0,cetIccp=S.settings.iccpMode==='cet'?iccp:0;
  let paidInterim=paidIfm+paidIccp,gross=base.gross+paidInterim,netBeforeTax=gross*S.settings.net,tax=Math.max(0,netBeforeTax*Number(S.settings.taxRate||0)/100);
  return {...base,ifm,iccp,paidIfm,paidIccp,cetIfm,cetIccp,cetCurrent:cetIfm+cetIccp,paidInterim,gross,netBeforeTax,tax};
}
function cetTotal(){return (S.settings.cetEntries||[]).reduce((a,x)=>a+Number(x.total||0),0)}
function cetHasMonth(key){return (S.settings.cetEntries||[]).some(x=>x.month===key)}
function addCurrentMonthToCET(){
  let now=new Date(),key=now.getFullYear()+"-"+pad(now.getMonth()+1),c=interimCalc(key);
  if(!c.cetCurrent){toast("Aucune indemnité à mettre au CET");return}
  if(cetHasMonth(key)){toast("Ce mois est déjà au CET");return}
  S.settings.cetEntries.push({id:crypto.randomUUID(),month:key,ifm:c.cetIfm,iccp:c.cetIccp,total:c.cetCurrent,addedAt:new Date().toISOString()});save();render();toast("Indemnités mises au CET ✓")
}

function label(t){return{start:"Début",pause:"Pause",resume:"Reprise",end:"Fin"}[t]||t}
function render(){try{document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("active",b.dataset.page===page));document.getElementById("app").innerHTML=page==="home"?home():page==="history"?history():page==="salary"?salary():settings();wire()}catch(err){console.error(err);toast("Erreur d'affichage, réessaie")}}
function home(){let d=iso(new Date()),m=daySalary(d);return `<header><div><div class="eyebrow">${new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}</div><h1 class="title">Heures Pro</h1></div><div class="logo">⏱</div></header><section class="card hero"><div class="label">TEMPS TRAVAILLÉ AUJOURD'HUI</div><div class="big">${hm(m.w)}</div><div class="grid2"><button id="start" class="btn green">▶ Commencer</button><button id="pause" class="btn orange">Ⅱ Pause</button><button id="resume" class="btn purple">▶ Reprendre</button><button id="end" class="btn red">■ Terminer</button></div></section><section class="card"><div class="head"><h2>Pointages du jour</h2><span class="badge">AUJOURD'HUI</span></div>${ps(d).length?ps(d).map(p=>`<div class="punch"><div>${label(p.type)}<small>${time(p.at)}</small></div></div>`).join(""):`<div class="empty">Aucun pointage aujourd’hui.</div>`}</section><div class="stats"><div class="stat"><small>HEURES NORMALES</small><b>${hm(m.o.n)}</b></div><div class="stat"><small>HEURES DE NUIT</small><b>${hm(m.n)}</b></div><div class="stat"><small>SUP. +25%</small><b>${hm(m.o.o25)}</b></div><div class="stat"><small>SUP. +50%</small><b>${hm(m.o.o50)}</b></div></div><section class="card" style="margin-top:13px"><div class="head"><h2>Salaire du jour</h2><span class="badge">ESTIMATION</span></div><div class="row"><span>Brut</span><b>${eur(m.gross)}</b></div><div class="row"><span>Net estimé</span><b>${eur(m.estimatedNet)}</b></div></section>`}
function yearStats(year){
  const months=[];
  for(let m=1;m<=12;m++){
    const key=year+'-'+pad(m), c=interimCalc(key);
    const ds=[...new Set(S.punches.map(p=>p.date))].filter(d=>d.startsWith(key));
    let w=0,n=0,o25=0,o50=0;
    ds.forEach(d=>{const x=daySalary(d);w+=x.w;n+=x.n;o25+=x.o.o25;o50+=x.o.o50});
    const netAfterTax=Math.max(0,c.netBeforeTax-c.tax);
    const received=netAfterTax+c.nontax;
    months.push({m,key,w,n,o25,o50,gross:c.gross,net:received,days:ds.length});
  }
  return months;
}
function annualHistory(){
  const currentYear=new Date().getFullYear();
  const year=annualYear;
  const months=yearStats(year);
  const workedMonths=months.filter(x=>x.days>0);
  const total=months.reduce((a,x)=>{a.w+=x.w;a.n+=x.n;a.gross+=x.gross;a.net+=x.net;a.days+=x.days;return a},{w:0,n:0,gross:0,net:0,days:0});
  const labels=['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
  const max=Math.max(1,...workedMonths.map(x=>x.w));
  const count=workedMonths.length;
  return `<section class="card annualCard">
    <div class="annualHead"><div><h2>Année ${year}</h2><p class="sectionNote">${count?`Mois travaillés : ${count}`:'Aucun mois travaillé pour le moment'}</p></div><div class="annualYearNav"><button type="button" class="btn dark small" id="annualPrev" aria-label="Année précédente">‹</button><span class="badge">${total.days} jour${total.days>1?'s':''}</span><button type="button" class="btn dark small" id="annualNext" aria-label="Année suivante" ${year>=currentYear?'disabled':''}>›</button></div></div>
    <div class="annualTotals"><div><small>HEURES</small><b>${hm(total.w)}</b></div><div><small>BRUT</small><b>${eur(total.gross)}</b></div><div><small>NET ESTIMÉ</small><b>${eur(total.net)}</b></div><div><small>NUIT</small><b>${hm(total.n)}</b></div></div>
    ${count?`<div class="annualChartWrap ${annualChartOpen?'open':'collapsed'}"><div class="annualChartHead"><div><b>Évolution annuelle</b><span class="chartSub">Heures travaillées par mois</span></div><button type="button" class="btn dark small chartToggle" id="annualChartToggle" aria-expanded="${annualChartOpen}" aria-controls="annualChartBody">${annualChartOpen?'Masquer':'Afficher'}</button></div><div id="annualChartBody" class="annualChartBody" ${annualChartOpen?'':'hidden'}><div class="annualChartScale">0 → ${hm(max)}</div><div class="annualBars" style="grid-template-columns:repeat(${count},minmax(0,1fr))" role="img" aria-label="Graphique des heures travaillées pour les mois travaillés de ${year}">${workedMonths.map(x=>`<div class="annualBarCol"><div class="annualBarValue">${hm(x.w)}</div><div class="annualBarTrack"><div class="annualBar" style="height:${Math.max(4,(x.w/max)*100)}%"></div></div><div class="annualBarLabel">${labels[x.m-1]}</div></div>`).join('')}</div><div class="annualMonthCards">${workedMonths.map(x=>`<div class="annualMonthCard"><div class="annualMonthCardName">${labels[x.m-1]}<small>${x.days} jour${x.days>1?'s':''}</small></div><div class="annualMonthMetric"><span><small>HEURES</small><b>${hm(x.w)}</b></span><span><small>NET</small><b>${eur(x.net)}</b></span></div></div>`).join('')}</div></div></div>`:`<div class="empty annualEmpty">Les mois apparaîtront automatiquement dès qu'une journée sera enregistrée.</div>`}
  </section>`;
}
function monthOptions(){
  const keys=[...new Set(S.punches.map(p=>p.date.slice(0,7)))];
  const current=iso(new Date()).slice(0,7);
  if(!keys.includes(current))keys.push(current);
  keys.sort().reverse();
  return keys.map(key=>{const d=new Date(key+'-01T12:00:00');return `<option value="${key}" ${key===historyMonthKey?'selected':''}>${d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}</option>`}).join('');
}
function monthWeeks(key){
  const [yy,mm]=key.split('-').map(Number);
  const first=new Date(yy,mm-1,1), last=new Date(yy,mm,0);
  const dates=[];
  for(let d=1;d<=last.getDate();d++){
    const date=yy+'-'+pad(mm)+'-'+pad(d);
    if(ps(date).length)dates.push(date);
  }
  const groups=new Map();
  dates.forEach(date=>{const ws=weekStart(date);if(!groups.has(ws))groups.set(ws,[]);groups.get(ws).push(date)});
  return [...groups.entries()].sort((a,b)=>b[0].localeCompare(a[0]));
}
function weekLabel(start){
  const d=new Date(start+'T12:00:00'),e=new Date(d);e.setDate(e.getDate()+6);
  return `${d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})} → ${e.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})}`;
}
function history(){
  const weeks=monthWeeks(historyMonthKey);
  const totalDays=weeks.reduce((n,[,ds])=>n+ds.length,0);
  return `<header><div><div class="eyebrow">SUIVI</div><h1 class="title">Historique</h1></div><div class="logo">▣</div></header>
  ${annualHistory()}
  <section class="card historyCard"><div class="head"><div><h2>Jours travaillés</h2><p class="muted historyHint">Mois → semaines → jours. Ouvre un jour pour le modifier.</p></div><button id="addDay" class="btn purple small">＋ Ajouter</button></div>
  <div class="historySelector"><label for="historyMonth">Mois sélectionné</label><select id="historyMonth">${monthOptions()}</select></div>
  <div class="historyMonthSummary"><div><small>MOIS</small><b>${new Date(historyMonthKey+'-01T12:00:00').toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}</b></div><div><small>JOURS</small><b>${totalDays}</b></div></div>
  <div class="historyStair">${weeks.length?weeks.map(([ws,ds],wi)=>{const wkOpen=historyOpenWeeks.has(ws);const wkHours=ds.reduce((a,d)=>a+work(d),0);return `<div class="historyWeek ${wkOpen?'open':''}"><button type="button" class="historyWeekHead" data-week-toggle="${ws}" aria-expanded="${wkOpen}"><span class="historyChevron">›</span><span class="historyWeekTitle"><b>Semaine du ${weekLabel(ws)}</b><small>${ds.length} jour${ds.length>1?'s':''} · ${hm(wkHours)}</small></span><span class="badge">${wkOpen?'Masquer':'Voir'}</span></button>${wkOpen?`<div class="historyDays">${ds.map(d=>{const dayOpen=historyOpenDays.has(d),m=daySalary(d),p=ps(d),first=p.find(x=>x.type==='start'),last=[...p].reverse().find(x=>x.type==='end');return `<div class="historyDay ${dayOpen?'open':''}"><button type="button" class="historyDayHead" data-day-toggle="${d}" aria-expanded="${dayOpen}"><span class="historyChevron">›</span><span class="historyDayTitle"><b>${fmtD(d)}</b><small>${hm(m.w)} · ${first?time(first.at):'—'} → ${last?time(last.at):'—'}</small></span><span class="badge">${dayOpen?'Masquer':'Voir'}</span></button>${dayOpen?`<div class="historyDayBody"><div class="historyDayMeta"><span>${hm(m.n)} nuit</span><span>${hm(m.o.o25)} +25%</span><span>${hm(m.o.o50)} +50%</span></div><div class="historyDayActions"><button type="button" class="btn purple small" data-open-day="${d}">Modifier</button><button type="button" class="btn red small" data-delday="${d}">Supprimer</button></div></div>`:''}</div>`}).join('')}</div>`:''}</div>`}).join(''):`<div class="empty">Aucun jour enregistré pour ce mois.</div>`}</div></section>`;
}
function openEditDay(date){
  const punches=ps(date),first=punches.find(p=>p.type==="start"),last=[...punches].reverse().find(p=>p.type==="end");
  if(!first||!last){toast("Cette journée ne peut pas être modifiée ici");return}
  const start=new Date(first.at),end=new Date(last.at),mins=Math.max(0,Math.round((end-start)/60000)-work(date));
  const br=mins;
  const M=document.getElementById("modal");M.className="modal open";
  M.innerHTML=`<div class="sheet"><div class="sheettop"><div><div class="eyebrow">MODIFICATION</div><h2>${fmtD(date)}</h2></div><button id="closeEdit" class="close" type="button">×</button></div>
  <p class="muted">Modifie rapidement l'entrée, la sortie et la durée totale de pause. Les détails des pointages restent visibles ci-dessous.</p>
  <div class="editGrid"><div class="field"><label>Heure d'entrée</label><input id="editStart" type="text" inputmode="numeric" maxlength="5" value="${time(first.at)}" autocomplete="off"></div><div class="field"><label>Heure de sortie</label><input id="editEnd" type="text" inputmode="numeric" maxlength="5" value="${time(last.at)}" autocomplete="off"></div><div class="field"><label>Temps de pause dans la journée</label><input id="editBreak" type="text" inputmode="numeric" maxlength="5" value="${pad(Math.floor(br/60))}:${pad(br%60)}" autocomplete="off"></div></div>
  <div class="sheetactions"><button id="cancelEdit" class="btn dark" type="button">Annuler</button><button id="saveEdit" class="btn purple" type="button">Enregistrer</button></div>
  <button id="copyDay" type="button" class="btn dark" style="width:100%;margin-top:9px">⧉ Copier ces horaires vers un autre jour</button>
  <div class="detailPunches"><div class="head" style="padding-top:12px"><h3 style="margin:0">Pointages détaillés</h3><span class="badge">${punches.length}</span></div>${punches.map(p=>`<div class="detailPunch"><div>${label(p.type)}<small>${time(p.at)}</small></div><button class="btn small red iconDelete" data-delp="${p.id}" type="button">×</button></div>`).join("")}</div></div>`;
  document.getElementById("closeEdit").onclick=closePicker;document.getElementById("cancelEdit").onclick=closePicker;
  ["editStart","editEnd","editBreak"].forEach(id=>{const el=document.getElementById(id);el.addEventListener("input",()=>{el.value=el.value.replace(/[^0-9:]/g,"").slice(0,5)});el.addEventListener("blur",()=>{el.value=normalizeHM(el.value,id==="editBreak")})});
  document.getElementById("saveEdit").onclick=()=>saveEditedDay(date);
  document.getElementById("copyDay").onclick=()=>openCopyDay(date);
  M.querySelectorAll("[data-delp]").forEach(b=>b.onclick=()=>{S.punches=S.punches.filter(p=>p.id!==b.dataset.delp);save();closePicker();render();toast("Pointage supprimé ✓")});
}
function copyCalendar(month,selected){
  const y=month.getFullYear(),m=month.getMonth(),first=new Date(y,m,1),off=(first.getDay()+6)%7,last=new Date(y,m+1,0).getDate();
  let s="";
  for(let i=0;i<off;i++)s+='<button class="calday" disabled></button>';
  for(let d=1;d<=last;d++){
    const key=y+"-"+pad(m+1)+"-"+pad(d),isSel=selected.has(key),isSource=copyState.source===key,has=ps(key).length;
    s+=`<button type="button" class="calday ${isSel?"sel ":""}${has?"has ":""}${isSource?"copySourceDay":""}" data-copydate="${key}" ${isSource?"disabled":""}>${d}</button>`;
  }
  return s;
}
function openCopyDay(source){
  const punches=ps(source);
  if(!punches.length){toast("Aucun horaire à copier");return}
  copyState={source,targets:new Set(),month:new Date(source+"T12:00:00")};
  drawCopyDay();
}
function drawCopyDay(){
  const M=document.getElementById("modal");M.className="modal open";
  const src=copyState.source;
  const selected=copyState.targets;
  const count=selected.size;
  M.innerHTML=`<div class="sheet"><div class="sheettop"><div><div class="eyebrow">DUPLICATION</div><h2>Copier une journée</h2></div><button id="closeCopy" class="close" type="button">×</button></div>
  <p class="muted">Sélectionne un ou plusieurs jours. Les mêmes horaires et pauses seront copiés sur chaque jour choisi. La journée d’origine reste inchangée.</p>
  <div class="copySource"><span>Journée source</span><b>${fmtD(src)}</b></div>
  <div class="calnav"><button id="copyPrev" type="button">‹</button><b>${copyState.month.toLocaleDateString("fr-FR",{month:"long",year:"numeric"})}</b><button id="copyNext" type="button">›</button></div>
  <div class="calgrid">${["L","M","M","J","V","S","D"].map(x=>`<div class="dow">${x}</div>`).join("")}${copyCalendar(copyState.month,selected)}</div>
  <div class="copyTarget">${count?`<b>${count} jour${count>1?"s":""} sélectionné${count>1?"s":""}</b>`:`Sélectionne un ou plusieurs jours de destination`}</div>
  <button id="confirmCopy" type="button" class="btn purple" style="width:100%" ${count?"":"disabled"}>⧉ Copier sur ${count||"les jours sélectionnés"}</button>
  </div>`;
  document.getElementById("closeCopy").onclick=closePicker;
  document.getElementById("copyPrev").onclick=()=>{copyState.month.setMonth(copyState.month.getMonth()-1);drawCopyDay()};
  document.getElementById("copyNext").onclick=()=>{copyState.month.setMonth(copyState.month.getMonth()+1);drawCopyDay()};
  M.querySelectorAll("[data-copydate]").forEach(b=>b.onclick=()=>{const d=b.dataset.copydate;if(d===src)return;if(copyState.targets.has(d))copyState.targets.delete(d);else copyState.targets.add(d);drawCopyDay()});
  document.getElementById("confirmCopy").onclick=copyDayToTarget;
}
function copyDayToTarget(){
  const src=copyState.source,targets=[...copyState.targets];
  if(!src||!targets.length){toast("Sélectionne au moins un jour");return}
  const sourcePunches=ps(src);
  if(!sourcePunches.length){toast("Aucun horaire à copier");return}
  const first=new Date(sourcePunches[0].at);
  let clones=[];
  for(const target of targets){
    const base=new Date(target+"T12:00:00");
    const targetStart=new Date(base);
    targetStart.setHours(first.getHours(),first.getMinutes(),first.getSeconds(),first.getMilliseconds());
    clones.push(...sourcePunches.map(p=>{
      const delta=new Date(p.at)-first;
      const at=new Date(targetStart.getTime()+delta);
      return {id:crypto.randomUUID(),date:target,at:at.toISOString(),type:p.type};
    }));
  }
  S.punches=S.punches.filter(p=>!targets.includes(p.date)).concat(clones).sort((a,b)=>new Date(a.at)-new Date(b.at));
  save();closePicker();render();toast(`${targets.length} jour${targets.length>1?"s":""} copié${targets.length>1?"s":""} ✓`);
}

function saveEditedDay(date){
  const a=parseHM(document.getElementById("editStart").value,false),b=parseHM(document.getElementById("editEnd").value,false),br=parseHM(document.getElementById("editBreak").value,true);
  if(!a||!b||!br){toast("Vérifie les horaires");return}
  const base=new Date(date+"T12:00:00"),start=new Date(base);start.setHours(a.h,a.m,0,0);const end=new Date(base);end.setHours(b.h,b.m,0,0);if(end<=start)end.setDate(end.getDate()+1);
  const duration=Math.round((end-start)/60000),breakMin=br.h*60+br.m;if(breakMin>=duration){toast("La pause est trop longue");return}
  const pauseStart=new Date(start.getTime()+Math.max(0,Math.round((duration-breakMin)/2))*60000),pauseEnd=new Date(pauseStart.getTime()+breakMin*60000);
  S.punches=S.punches.filter(p=>p.date!==date);
  S.punches.push({id:crypto.randomUUID(),date,at:start.toISOString(),type:"start"},{id:crypto.randomUUID(),date,at:pauseStart.toISOString(),type:"pause"},{id:crypto.randomUUID(),date,at:pauseEnd.toISOString(),type:"resume"},{id:crypto.randomUUID(),date,at:end.toISOString(),type:"end"});
  S.punches.sort((x,y)=>new Date(x.at)-new Date(y.at));save();closePicker();render();toast("Journée modifiée ✓");
}

function salary(){
  let now=new Date(),mk=now.getFullYear()+"-"+pad(now.getMonth()+1),c=interimCalc(mk);
  let ds=[...new Set(S.punches.map(p=>p.date))].filter(d=>d.startsWith(mk));
  let tot={w:0,n:0,o25:0,o50:0,th:0,pr:0,taxable:0,nontax:0};
  ds.forEach(d=>{let m=daySalary(d);tot.w+=m.w;tot.n+=m.n;tot.o25+=m.o.o25;tot.o50+=m.o.o50;tot.th+=m.th;tot.pr+=m.primes;tot.taxable+=m.taxablePrimes;tot.nontax+=m.nonTaxablePrimes});
  let gross=c.gross,netBeforeTax=c.netBeforeTax,tax=c.tax,netAfterTax=netBeforeTax-tax,received=netAfterTax+tot.nontax;
  let wg=0,wnet=0,ww=0,wn=0; week(iso(now)).forEach(d=>{let m=daySalary(d);wg+=m.gross;wnet+=m.estimatedNet;ww+=m.w;wn+=m.n});
  return `<header><div><div class="eyebrow">RÉMUNÉRATION</div><h1 class="title">Salaire</h1></div><div class="logo">€</div></header>
  <section class="card salaryHero"><div class="salaryHeroTop"><div><div class="label">NET À RECEVOIR ESTIMÉ</div><div class="salaryMain">${eur(received)}</div></div><span class="badge">${now.toLocaleDateString("fr-FR",{month:"long",year:"numeric"})}</span></div><div class="salaryHeroMeta"><span>${eur(gross)} brut</span><span>${hm(tot.w)} travaillées</span><span>${hm(tot.n)} de nuit</span></div></section>
  <section class="card compactSection"><div class="head"><div><h2>Cette semaine</h2><p class="sectionNote">Vue rapide</p></div><span class="badge">ESTIMATION</span></div><div class="compactGrid"><div><small>BRUT</small><b>${eur(wg)}</b></div><div><small>NET</small><b>${eur(wnet)}</b></div><div><small>HEURES</small><b>${hm(ww)}</b></div><div><small>NUIT</small><b>${hm(wn)}</b></div></div></section>
  <section class="card compactSection"><div class="head"><h2>Rémunération</h2></div><div class="salaryRows">
    <div class="salaryRow"><span>Brut soumis</span><b>${eur(gross)}</b></div>
    <div class="salaryRow"><span>Net avant impôt</span><b>${eur(netBeforeTax)}</b></div>
    ${c.paidIfm?`<div class="salaryRow"><span>IFM versée <small>${S.settings.ifmRate}%</small></span><b>${eur(c.paidIfm)}</b></div>`:""}
    ${c.paidIccp?`<div class="salaryRow"><span>Congés payés versés <small>${S.settings.iccpRate}%</small></span><b>${eur(c.paidIccp)}</b></div>`:""}
    <div class="salaryRow mutedRow"><span>Prélèvement estimé</span><b>− ${eur(tax)}</b></div>
    <div class="salaryRow"><span>Net après impôt</span><b>${eur(netAfterTax)}</b></div>
    <div class="salaryRow highlightRow"><span>Net à recevoir</span><b>${eur(received)}</b></div>
  </div></section>
  <section class="card compactSection"><div class="head"><div><h2>Intérim</h2><p class="sectionNote">Selon tes paramètres</p></div></div><div class="compactList">
    <div class="infoLine"><span>IFM <small>${S.settings.ifmRate}%</small></span><b>${eur(c.ifm)}</b></div>
    <div class="infoLine"><span>Congés payés <small>${S.settings.iccpRate}%</small></span><b>${eur(c.iccp)}</b></div>
    ${c.paidIfm?`<div class="infoLine sub"><span>IFM versée</span><b>${eur(c.paidIfm)}</b></div>`:""}
    ${c.paidIccp?`<div class="infoLine sub"><span>CP versés</span><b>${eur(c.paidIccp)}</b></div>`:""}
    ${c.cetCurrent?`<div class="infoLine sub"><span>Mis au CET</span><b>${eur(c.cetCurrent)}</b></div>`:""}
    ${cetTotal()?`<div class="infoLine sub"><span>CET cumulé</span><b>${eur(cetTotal())}</b></div>`:""}
  </div>${c.cetCurrent?`<button id="addCet" class="btn purple compactBtn">Mettre ce mois au CET</button>`:""}</section>
  <section class="card compactSection"><div class="head"><h2>Compléments</h2></div><div class="compactList">
    <div class="infoLine"><span>Heures sup. +25%</span><b>${hm(tot.o25)}</b></div>
    <div class="infoLine"><span>Heures sup. +50%</span><b>${hm(tot.o50)}</b></div>
    <div class="infoLine"><span>13e mois</span><b>${eur(tot.th)}</b></div>
    <div class="infoLine"><span>Primes soumises</span><b>${eur(tot.taxable)}</b></div>
    <div class="infoLine"><span>Primes non soumises</span><b>${eur(tot.nontax)}</b></div>
  </div></section>`;
}

function settings(){return `<header><div><div class="eyebrow">CONFIGURATION</div><h1 class="title">Réglages</h1></div><div class="logo">⚙</div></header>
<section class="card"><div class="head"><h2>Salaire</h2></div><div class="field"><label>Taux horaire brut (€)</label><input id="rate" type="number" step=".01" value="${S.settings.rate}"></div><div class="field"><label>Coefficient net estimé</label><input id="net" type="number" step=".01" value="${S.settings.net}"></div><div class="field"><label>Prélèvement à la source estimé (%)</label><input id="taxRate" type="number" step=".1" min="0" value="${S.settings.taxRate||0}"></div><div class="field"><label>13e mois — supplément brut €/heure</label><input id="thirteen" type="number" step=".01" value="${S.settings.thirteen}"></div><button id="saveSalary" class="btn purple" style="width:100%">Enregistrer</button></section>
<section class="card"><div class="head"><h2>Heures supplémentaires</h2></div><div class="field"><label>Début des heures sup. (h/semaine)</label><input id="weekly" type="number" step=".1" value="${S.settings.weekly}"></div><div class="field"><label>Fin tranche +25% (h/semaine)</label><input id="ot25" type="number" step=".1" value="${S.settings.ot25}"></div><div class="grid2"><div class="field"><label>Majoration 1 (%)</label><input id="ot25pct" type="number" value="${S.settings.ot25pct}"></div><div class="field"><label>Majoration 2 (%)</label><input id="ot50pct" type="number" value="${S.settings.ot50pct}"></div></div><button id="saveOT" class="btn purple" style="width:100%">Enregistrer</button></section>
<section class="card nightCard"><div class="head"><h2>Nuit</h2></div><div class="nightGrid"><div class="field nightField"><label>Début</label><input id="nightStart" type="time" value="${S.settings.nightStart}"></div><div class="field nightField"><label>Fin</label><input id="nightEnd" type="time" value="${S.settings.nightEnd}"></div></div><div class="field"><label>Majoration (%)</label><input id="nightPct" type="number" value="${S.settings.nightPct}"></div><button id="saveNight" class="btn purple" style="width:100%">Enregistrer</button></section>
<section class="card"><div class="head"><div><h2>Intérim — IFM & congés payés</h2><p class="sectionNote">Paramètres modifiables à ta guise. Ils sont repris automatiquement dans le calcul du salaire.</p></div></div>
<div class="switchRow"><div><b>Activer le calcul intérim</b><small>Ajoute IFM et congés payés au calcul quand ils sont activés.</small></div><label class="switch"><input id="interimEnabled" type="checkbox" ${S.settings.interimEnabled!==false?"checked":""}><span></span></label></div>
<div class="subCard"><div class="switchRow"><div><b>Prime de fin de mission (IFM)</b><small>Taux appliqué au brut de la période.</small></div><label class="switch"><input id="ifmEnabled" type="checkbox" ${S.settings.ifmEnabled!==false?"checked":""}><span></span></label></div><div class="field"><label>Taux IFM (%)</label><input id="ifmRate" type="number" min="0" step=".1" value="${S.settings.ifmRate}"></div><div class="field"><label>Mode</label><select id="ifmMode"><option value="pay" ${S.settings.ifmMode!=="cet"?"selected":""}>Versée avec le salaire</option><option value="cet" ${S.settings.ifmMode==="cet"?"selected":""}>Mise au CET</option></select></div></div>
<div class="subCard"><div class="switchRow"><div><b>Indemnité de congés payés (ICCP)</b><small>Calculée selon le taux que tu définis.</small></div><label class="switch"><input id="iccpEnabled" type="checkbox" ${S.settings.iccpEnabled!==false?"checked":""}><span></span></label></div><div class="field"><label>Taux congés payés (%)</label><input id="iccpRate" type="number" min="0" step=".1" value="${S.settings.iccpRate}"></div><div class="field"><label>Mode</label><select id="iccpMode"><option value="pay" ${S.settings.iccpMode!=="cet"?"selected":""}>Versés avec le salaire</option><option value="cet" ${S.settings.iccpMode==="cet"?"selected":""}>Mis au CET</option></select></div></div>
<div class="row"><span>IFM estimée ce mois</span><b>${eur(interimCalc(new Date().getFullYear()+"-"+pad(new Date().getMonth()+1)).ifm)}</b></div><div class="row"><span>Congés payés estimés ce mois</span><b>${eur(interimCalc(new Date().getFullYear()+"-"+pad(new Date().getMonth()+1)).iccp)}</b></div><div class="row"><span>CET cumulé</span><b>${eur(cetTotal())}</b></div><button id="saveInterim" class="btn purple" style="width:100%;margin-top:12px">Enregistrer les paramètres intérim</button></section>
<section class="card"><div class="head"><h2>Primes & indemnités</h2></div><div class="primeForm"><div class="field"><label>Nom</label><input id="primeName" type="text"></div><div class="field"><label>Montant (€)</label><input id="primeAmount" type="number" inputmode="decimal" min="0" step="0.01"></div><div class="field"><label>Fiscalité</label><div class="taxChoice"><label><input type="radio" name="primeTax" value="taxable" checked><span>Soumis à l'impôt</span></label><label><input type="radio" name="primeTax" value="nontaxable"><span>Non soumis à l'impôt</span></label></div></div><button id="addPrime" type="button" class="btn purple" style="width:100%">＋ Ajouter la prime / indemnité</button></div>${S.settings.primes.length?S.settings.primes.map((p,i)=>`<div class="primeItem"><span class="primeDot"></span><div class="primeInfo"><div class="primeName">${esc(p.name)}</div><div class="primeMeta">${eur(p.amount)} · ${p.taxable?"Soumis à l'impôt":"Non soumis à l'impôt"}</div></div><button type="button" class="btn small red" data-prime="${i}">Supprimer</button></div>`).join(""):`<div class="empty">Aucune prime ou indemnité.</div>`}</section>
<section class="card"><button id="reset" class="btn red" style="width:100%">Réinitialiser toutes les données</button></section>`}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]))}
function wire(){
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{page=b.dataset.page;render()});
let q=id=>document.getElementById(id);
if(q("start"))q("start").onclick=()=>addNow("start");if(q("pause"))q("pause").onclick=()=>addNow("pause");if(q("resume"))q("resume").onclick=()=>addNow("resume");if(q("end"))q("end").onclick=()=>addNow("end");
if(q("addDay"))q("addDay").onclick=openPicker;
if(q("annualPrev"))q("annualPrev").onclick=()=>{annualYear--;render()};
if(q("annualNext"))q("annualNext").onclick=()=>{if(annualYear<new Date().getFullYear()){annualYear++;render()}};
if(q("annualChartToggle"))q("annualChartToggle").onclick=()=>{annualChartOpen=!annualChartOpen;render()};
if(q("historyMonth"))q("historyMonth").onchange=()=>{historyMonthKey=q("historyMonth").value;historyOpenWeeks.clear();historyOpenDays.clear();render()};
document.querySelectorAll("[data-week-toggle]").forEach(b=>b.onclick=e=>{e.stopPropagation();const k=b.dataset.weekToggle;if(historyOpenWeeks.has(k)){historyOpenWeeks.delete(k);monthWeeks(historyMonthKey).find(x=>x[0]===k)?.[1].forEach(d=>historyOpenDays.delete(d))}else historyOpenWeeks.add(k);render()});
document.querySelectorAll("[data-day-toggle]").forEach(b=>b.onclick=e=>{e.stopPropagation();const k=b.dataset.dayToggle;if(historyOpenDays.has(k))historyOpenDays.delete(k);else historyOpenDays.add(k);render()});
document.querySelectorAll("[data-editday]").forEach(b=>b.onclick=e=>{if(e.target.closest("[data-delday]"))return;openEditDay(b.dataset.editday)});document.querySelectorAll("[data-open-day]").forEach(b=>b.onclick=e=>{e.stopPropagation();openEditDay(b.dataset.openDay)});
document.querySelectorAll("[data-delday]").forEach(b=>b.onclick=e=>{e.stopPropagation();if(confirm("Supprimer toute cette journée ?")){S.punches=S.punches.filter(p=>p.date!==b.dataset.delday);save();render();toast("Journée supprimée ✓")}});
document.querySelectorAll("[data-delp]").forEach(b=>b.onclick=()=>{S.punches=S.punches.filter(p=>p.id!==b.dataset.delp);save();render()});
document.querySelectorAll("[data-prime]").forEach(b=>b.onclick=()=>{S.settings.primes.splice(+b.dataset.prime,1);save();render()});
if(q("saveSalary"))q("saveSalary").onclick=()=>{S.settings.rate=+q("rate").value||0;S.settings.net=+q("net").value||0;S.settings.taxRate=Math.max(0,+q("taxRate").value||0);S.settings.thirteen=+q("thirteen").value||0;save();render();toast("Salaire enregistré ✓")};
if(q("saveOT"))q("saveOT").onclick=()=>{S.settings.weekly=+q("weekly").value||35;S.settings.ot25=+q("ot25").value||43;S.settings.ot25pct=+q("ot25pct").value||25;S.settings.ot50pct=+q("ot50pct").value||50;save();render();toast("Heures sup. enregistrées ✓")};
if(q("saveNight"))q("saveNight").onclick=()=>{S.settings.nightStart=q("nightStart").value;S.settings.nightEnd=q("nightEnd").value;S.settings.nightPct=+q("nightPct").value||0;save();render();toast("Nuit enregistrée ✓")};
if(q("saveInterim"))q("saveInterim").onclick=()=>{S.settings.interimEnabled=q("interimEnabled").checked;S.settings.ifmEnabled=q("ifmEnabled").checked;S.settings.ifmRate=Math.max(0,+q("ifmRate").value||0);S.settings.ifmMode=q("ifmMode").value;S.settings.iccpEnabled=q("iccpEnabled").checked;S.settings.iccpRate=Math.max(0,+q("iccpRate").value||0);S.settings.iccpMode=q("iccpMode").value;save();render();toast("Paramètres intérim enregistrés ✓")};
if(q("addCet"))q("addCet").onclick=addCurrentMonthToCET;
if(q("addPrime"))q("addPrime").onclick=()=>{
  const name=q("primeName").value.trim();
  const raw=q("primeAmount").value.replace(",",".");
  const amount=Number(raw);
  const tax=document.querySelector('input[name="primeTax"]:checked');
  if(!name){toast("Indique le nom de la prime");q("primeName").focus();return}
  if(!Number.isFinite(amount)||amount<0){toast("Indique un montant valide");q("primeAmount").focus();return}
  const taxable=!tax||tax.value==="taxable";
  S.settings.primes.push({id:crypto.randomUUID(),name,amount,taxable,enabled:true});
  save();render();toast("Prime ajoutée ✓");
};
if(q("reset"))q("reset").onclick=()=>{if(confirm("Tout effacer ?")){localStorage.removeItem(KEY);location.reload()}}
}
function addNow(type){let d=new Date(),date=iso(d);S.punches.push({id:crypto.randomUUID(),date,at:d.toISOString(),type});save();render();toast(label(type)+" ajouté ✓")}
function openPicker(){
  const now=new Date();
  picker={
    date:new Date(now.getFullYear(),now.getMonth(),now.getDate()),
    month:new Date(now.getFullYear(),now.getMonth(),1),
    startH:8,startM:0,endH:17,endM:0,breakH:1,breakM:0
  };
  drawDayForm();
}
function closePicker(){document.getElementById("modal").classList.remove("open")}
function dayCalendar(){
  const y=picker.month.getFullYear(),m=picker.month.getMonth();
  const first=new Date(y,m,1),off=(first.getDay()+6)%7,last=new Date(y,m+1,0).getDate();
  let s="";
  for(let i=0;i<off;i++)s+='<button class="calday" disabled></button>';
  for(let d=1;d<=last;d++){
    const key=y+"-"+pad(m+1)+"-"+pad(d);
    const selected=d===picker.date.getDate()&&m===picker.date.getMonth()&&y===picker.date.getFullYear();
    const today=d===new Date().getDate()&&m===new Date().getMonth()&&y===new Date().getFullYear();
    const has=ps(key).length;
    s+=`<button type="button" class="calday ${selected?"sel ":""}${today?"today ":""}${has?"has":""}" data-day="${d}">${d}</button>`;
  }
  return s;
}
function drawDayForm(){
  const M=document.getElementById("modal");M.className="modal open";
  M.innerHTML=`<div class="sheet">
    <div class="sheettop"><h2>Ajouter une journée</h2><button id="closeDay" class="close" type="button">×</button></div>
    <p class="muted">Choisis le jour puis indique librement ton heure d'entrée, ton heure de sortie et la durée totale de ta pause.</p>
    <div class="calnav"><button id="prevMonth" type="button">‹</button><b>${picker.month.toLocaleDateString("fr-FR",{month:"long",year:"numeric"})}</b><button id="nextMonth" type="button">›</button></div>
    <div class="calgrid">${["L","M","M","J","V","S","D"].map(x=>`<div class="dow">${x}</div>`).join("")}${dayCalendar()}</div>
    <div class="simpleTimes">
      <div class="simpleField"><label>Heure d'entrée</label><input id="manualStart" type="text" inputmode="numeric" maxlength="5" autocomplete="off" value="${pad(picker.startH)}:${pad(picker.startM)}"></div>
      <div class="simpleField"><label>Heure de sortie</label><input id="manualEnd" type="text" inputmode="numeric" maxlength="5" autocomplete="off" value="${pad(picker.endH)}:${pad(picker.endM)}"></div>
      <div class="simpleField"><label>Temps de pause dans la journée</label><input id="manualBreak" type="text" inputmode="numeric" maxlength="5" autocomplete="off" value="${pad(picker.breakH)}:${pad(picker.breakM)}"><small>Aucune pause fixe n'est imposée : saisis la durée réellement prise.</small></div>
    </div>
    <div class="dayPreview" id="dayPreview"></div>
    <div class="sheetactions"><button id="cancelDay" class="btn dark" type="button">Annuler</button><button id="saveDay" class="btn purple" type="button">Ajouter la journée</button></div>
  </div>`;

  document.getElementById("closeDay").onclick=closePicker;
  document.getElementById("cancelDay").onclick=closePicker;
  document.getElementById("prevMonth").onclick=()=>{picker.month.setMonth(picker.month.getMonth()-1);drawDayForm()};
  document.getElementById("nextMonth").onclick=()=>{picker.month.setMonth(picker.month.getMonth()+1);drawDayForm()};
  document.querySelectorAll("[data-day]").forEach(btn=>btn.onclick=()=>{
    picker.date=new Date(picker.month.getFullYear(),picker.month.getMonth(),Number(btn.dataset.day));
    drawDayForm();
  });

  ["manualStart","manualEnd","manualBreak"].forEach(id=>{
    const el=document.getElementById(id);
    el.addEventListener("input",()=>{el.value=el.value.replace(/[^0-9:]/g,"").slice(0,5);updateDayPreview()});
    el.addEventListener("blur",()=>{el.value=normalizeHM(el.value,id==="manualBreak");updateSimplePicker();updateDayPreview()});
  });
  document.getElementById("saveDay").onclick=saveWholeDay;
  updateDayPreview();
}
function parseHM(value,allowLongHour){
  let v=String(value||"").trim().replace(",",":").replace(".",":").replace(/[^0-9:]/g,"");
  if(!v)return null;
  let h,m;
  if(v.includes(":")){
    const q=v.split(":");h=parseInt(q[0],10);m=parseInt(q[1]||"0",10);
  }else if(v.length<=2){
    h=parseInt(v,10);m=0;
  }else{
    h=parseInt(v.slice(0,-2),10);m=parseInt(v.slice(-2),10);
  }
  if(!Number.isFinite(h)||!Number.isFinite(m)||h<0||m<0||m>59)return null;
  if(!allowLongHour&&h>23)return null;
  if(allowLongHour&&h>23)return null;
  return {h,m};
}
function normalizeHM(value,allowLongHour=false){
  const x=parseHM(value,allowLongHour);
  return x?pad(x.h)+":"+pad(x.m):"00:00";
}
function updateSimplePicker(){
  const a=document.getElementById("manualStart"),b=document.getElementById("manualEnd"),c=document.getElementById("manualBreak");
  if(!a||!b||!c)return;
  const s=parseHM(a.value,false),e=parseHM(b.value,false),br=parseHM(c.value,true);
  if(s){picker.startH=s.h;picker.startM=s.m}
  if(e){picker.endH=e.h;picker.endM=e.m}
  if(br){picker.breakH=br.h;picker.breakM=br.m}
}
function updateDayPreview(){
  const el=document.getElementById("dayPreview");if(!el)return;
  const start=picker.startH*60+picker.startM,end=picker.endH*60+picker.endM,brk=picker.breakH*60+picker.breakM;
  let total=end-start;if(total<0)total+=1440;total-=brk;
  el.innerHTML=`<b>${pad(picker.startH)}:${pad(picker.startM)} → ${pad(picker.endH)}:${pad(picker.endM)}</b><span>Pause : ${hm(brk)} · Travail : ${hm(total)}</span>`;
}
function saveWholeDay(){
  const a=parseHM(document.getElementById("manualStart").value,false);
  const b=parseHM(document.getElementById("manualEnd").value,false);
  const br=parseHM(document.getElementById("manualBreak").value,true);
  if(!a||!b||!br){toast("Vérifie les horaires : 08:00, 17:00 et 00:30");return}
  const base=new Date(picker.date);
  const start=new Date(base);start.setHours(a.h,a.m,0,0);
  const end=new Date(base);end.setHours(b.h,b.m,0,0);
  if(end<=start)end.setDate(end.getDate()+1);
  const breakMin=br.h*60+br.m,duration=Math.round((end-start)/60000);
  if(breakMin>=duration){toast("La pause est trop longue");return}

  const date=iso(start);
  S.punches=S.punches.filter(p=>p.date!==date);

  // Store one complete manual work interval plus the pause as an interval
  // positioned in the middle of the shift. The total worked time is exact.
  const pauseStart=new Date(start.getTime()+Math.max(0,Math.round((duration-breakMin)/2))*60000);
  const pauseEnd=new Date(pauseStart.getTime()+breakMin*60000);

  S.punches.push(
    {id:crypto.randomUUID(),date,at:start.toISOString(),type:"start"},
    {id:crypto.randomUUID(),date,at:pauseStart.toISOString(),type:"pause"},
    {id:crypto.randomUUID(),date,at:pauseEnd.toISOString(),type:"resume"},
    {id:crypto.randomUUID(),date,at:end.toISOString(),type:"end"}
  );
  S.punches.sort((x,y)=>new Date(x.at)-new Date(y.at));
  save();closePicker();render();toast("Journée ajoutée ✓");
}
render();
if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
