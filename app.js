/* V56 — 13th month on ALL worked hours; night and overtime only add their bonus (and its 13th month) on separate lines */

const KEY="heuresProV35";
const OLD_KEYS=["heuresProV34","heuresProV33","heuresProV32","heuresProV31","heuresProV30","heuresProV29","heuresProV28","heuresProV27","heuresProV26","heuresProV25","heuresProV24"];
const DEF={punches:[],settings:{rate:13.78,net:.78,taxRate:0,thirteen:0,weekly:35,nightStart:"20:00",nightEnd:"06:00",nightPct:50,ot25:43,ot25pct:25,ot50pct:50,teamDates:[],basketDates:[],interimEnabled:true,ifmEnabled:true,ifmRate:10,ifmMode:"pay",iccpEnabled:true,iccpRate:10,iccpMode:"pay",cetEntries:[]}};
// Primes de base (équipe, habillage, panier) : ce sont des lignes de la liste Primes & indemnités.
// Les supprimer les retire du calcul ; on peut les rétablir depuis les réglages.
const BUILTIN_PRIMES=[{builtin:"team",name:"Prime d'équipe",taxable:true,per:"day"},{builtin:"habillage",name:"Habillage",taxable:true,per:"day"},{builtin:"basket",name:"Panier net",taxable:false,per:"day"}];
const K13=1.84/13.78; // 13e mois sur une prime soumise = même proportion que sur les heures normales
function newId(){return (typeof crypto!=="undefined"&&crypto.randomUUID)?crypto.randomUUID():"p"+Date.now().toString(36)+Math.random().toString(36).slice(2)}
function newBuiltin(b){return {id:newId(),enabled:true,...b}}
function migratePrimes(st){
  if(st.primesV>=54&&Array.isArray(st.primes))return;
  const legacy=Array.isArray(st.primes)?st.primes:[];
  const off=st.autoPrimes||{};
  const dup=/panier|équipe|equipe|habill/i;
  // Anciennes primes saisies à la main : seules celles qui étaient réellement comptées sont conservées
  // (celles qui doublonnent équipe/habillage/panier sont retirées).
  const kept=legacy.filter(p=>p&&p.name&&p.counted===true&&p.enabled!==false&&!dup.test(String(p.name))).map(p=>({id:p.id||newId(),name:String(p.name),amount:Number(p.amount)||0,taxable:p.taxable!==false,per:"month",enabled:true}));
  st.primes=[...BUILTIN_PRIMES.filter(b=>off[b.builtin]!==false).map(newBuiltin),...kept];
  st.primesV=54;delete st.autoPrimes;
}
let S=load(),page="home",annualYear=new Date().getFullYear(),annualChartOpen=true,historyMonthKey=iso(new Date()).slice(0,7),historyOpenWeeks=new Set(),historyOpenDays=new Set(),picker={date:new Date(),month:new Date(),startH:8,startM:0,endH:17,endM:0,breakH:1,breakM:0},copyState={source:null,targets:new Set(),month:new Date()};

function load(){
  try{
    let x=JSON.parse(localStorage.getItem(KEY));
    if(x)return merge(x);
    for(const k of OLD_KEYS){
      let old=JSON.parse(localStorage.getItem(k));
      if(old){let migrated=merge(old);localStorage.setItem(KEY,JSON.stringify(migrated));return migrated;}
    }
    return merge(structuredClone(DEF));
  }catch(e){return merge(structuredClone(DEF))}
}
function merge(x){const m={punches:Array.isArray(x.punches)?x.punches:[],settings:{...DEF.settings,...(x.settings||{}),cetEntries:Array.isArray(x.settings?.cetEntries)?x.settings.cetEntries:[],teamDates:Array.isArray(x.settings?.teamDates)?x.settings.teamDates:[],basketDates:Array.isArray(x.settings?.basketDates)?x.settings.basketDates:[]}};migratePrimes(m.settings);return m}
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
function autoOn(k){return (S.settings.primes||[]).some(p=>p.builtin===k)}
function interimFactor(){
  // Coefficient IFM / congés payés versés avec le salaire (identique au calcul mensuel de interimCalc).
  const s=S.settings;
  if(!s.interimEnabled)return 1;
  const ifmR=s.ifmEnabled?Math.max(0,Number(s.ifmRate||0))/100:0;
  const iccpR=s.iccpEnabled?Math.max(0,Number(s.iccpRate||0))/100:0;
  return 1+(s.ifmMode==='pay'?ifmR:0)+(s.iccpMode==='pay'?(1+ifmR)*iccpR:0);
}
function daySalary(d){
  const w=work(d), n=night(d), o=ot(d), r=Math.max(0,Number(S.settings.rate)||13.78);
  const nightHours=n/60, otMin=o.o25+o.o50;
  // Toutes les lignes liées au taux horaire évoluent proportionnellement à r.
  // Le panier reste fixe à 7,50 € net par jour travaillé.
  const scale=r/13.78;
  // Primes équipe / habillage / panier : uniquement les jours réellement travaillés.
  const day=w>0?1:0;
  // Chaque heure travaillée est comptée UNE SEULE FOIS, au taux normal, dans la ligne des heures normales
  // (nuit et heures sup. comprises). La nuit et les heures sup. ajoutent seulement leur majoration, à part.
  const p25=(Number(S.settings.ot25pct)||0)/100, p50=(Number(S.settings.ot50pct)||0)/100;
  const base=(w/60)*r;
  // 13e mois : sur TOUTES les heures travaillées (nuit et heures sup. comprises), comme le salaire de base.
  const normal13=(w/60)*1.84*scale;
  // Équipe / habillage / panier : comptés tant qu'ils sont dans la liste Réglages > Primes & indemnités.
  const tOn=autoOn("team")?1:0, hOn=autoOn("habillage")?1:0, bOn=autoOn("basket")?1:0;
  const team=14.50*scale*day*tOn;
  const team13=1.93*scale*day*tOn;
  const habillage=3.50*scale*day*hOn;
  const habillage13=0.47*scale*day*hOn;
  // Majorations : nuit (uniquement sur les heures de nuit) et heures sup. (+% du taux horaire).
  const nightMajor=nightHours*6.89*scale;
  const nightMajor13=nightHours*0.91*scale;
  const ot25Major=(o.o25/60)*r*p25;
  const ot50Major=(o.o50/60)*r*p50;
  // 13e mois de la majoration des heures sup. uniquement (les heures elles-mêmes sont dans le 13e des heures normales).
  const ot13=1.84*scale*((o.o25/60)*p25+(o.o50/60)*p50);
  const basket=7.50*day*bOn;
  // Primes ajoutées par l'utilisateur, "par jour travaillé" : + leur 13e mois si soumises à l'impôt.
  const cd=(S.settings.primes||[]).filter(p=>!p.builtin&&p.per==="day"&&p.enabled!==false);
  const cust=day*cd.filter(p=>p.taxable).reduce((a,p)=>a+(Number(p.amount)||0),0);
  const cust13=cust*K13;
  const custNon=day*cd.filter(p=>!p.taxable).reduce((a,p)=>a+(Number(p.amount)||0),0);
  const baseGross=base+normal13+team+team13+habillage+habillage13+ot25Major+ot50Major+ot13+nightMajor+nightMajor13+cust+cust13;
  // Estimation jour/semaine : inclut l'IFM et les congés payés versés, comme le calcul mensuel.
  const gross=baseGross*interimFactor();
  const netBeforeTax=gross*S.settings.net;
  const incomeTax=Math.max(0,netBeforeTax*Number(S.settings.taxRate||0)/100);
  const netAfterTax=netBeforeTax-incomeTax;
  const estimatedNet=netAfterTax+basket+custNon;
  return {w,n,o,normal:base,normal13,team,team13,habillage,habillage13,ot25Major,ot50Major,ot13,nightMajor,nightMajor13,basket,cust,cust13,custNon,baseGross,gross,netBeforeTax,incomeTax,netAfterTax,estimatedNet,ifm:0,iccp:0,paidInterim:0,cetInterim:0};
}
function monthSalaryBase(key){
  let out={w:0,gross:0,normal13:0,team:0,team13:0,habillage:0,habillage13:0,ot25Major:0,ot50Major:0,ot13:0,nightMajor:0,nightMajor13:0,basket:0,th:0,taxable:0,nontax:0,days:0,rows:[],cust13:0};
  let ds=[...new Set(S.punches.map(p=>p.date))].filter(d=>d.startsWith(key));
  ds.forEach(d=>{const m=daySalary(d);out.w+=m.w;if(m.w>0)out.days++;out.gross+=m.baseGross;out.normal13+=m.normal13;out.team+=m.team;out.team13+=m.team13;out.habillage+=m.habillage;out.habillage13+=m.habillage13;out.ot25Major+=m.ot25Major;out.ot50Major+=m.ot50Major;out.ot13+=m.ot13;out.nightMajor+=m.nightMajor;out.nightMajor13+=m.nightMajor13;out.basket+=m.basket});
  // Primes ajoutées dans les réglages : comptées dès qu'elles sont dans la liste (avec 13e mois si soumises).
  // Les primes "par jour travaillé" sont déjà dans out.gross via daySalary ; on ajoute ici les primes "par mois".
  const rows=[];
  if(out.w>0){
    for(const p of (S.settings.primes||[]).filter(p=>!p.builtin&&p.enabled!==false)){
      const amount=Number(p.amount)||0,per=p.per==="day"?"day":"month",taxable=p.taxable!==false;
      const total=per==="day"?amount*out.days:amount;
      rows.push({name:p.name,taxable,per,amount,total,total13:taxable?total*K13:0});
    }
  }
  out.rows=rows;
  out.gross+=rows.filter(r=>r.taxable&&r.per==="month").reduce((a,r)=>a+r.total+r.total13,0);
  out.taxable=rows.filter(r=>r.taxable).reduce((a,r)=>a+r.total,0);
  out.nontax=rows.filter(r=>!r.taxable).reduce((a,r)=>a+r.total,0);
  out.cust13=rows.reduce((a,r)=>a+r.total13,0);
  out.th=out.normal13+out.team13+out.habillage13+out.ot13+out.nightMajor13+out.cust13;
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
function home(){let d=openShiftDate(new Date()),m=daySalary(d);return `<header><div><div class="eyebrow">${new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}</div><h1 class="title">Heures Pro</h1></div><div class="logo">⏱</div></header><section class="card hero"><div class="label">TEMPS TRAVAILLÉ AUJOURD'HUI</div><div class="big">${hm(m.w)}</div><div class="grid2"><button id="start" class="btn green">▶ Commencer</button><button id="pause" class="btn orange">Ⅱ Pause</button><button id="resume" class="btn purple">▶ Reprendre</button><button id="end" class="btn red">■ Terminer</button></div></section><section class="card"><div class="head"><h2>Pointages du jour</h2><span class="badge">AUJOURD'HUI</span></div>${ps(d).length?ps(d).map(p=>`<div class="punch"><div>${label(p.type)}<small>${time(p.at)}</small></div></div>`).join(""):`<div class="empty">Aucun pointage aujourd’hui.</div>`}</section><div class="stats"><div class="stat"><small>HEURES NORMALES</small><b>${hm(Math.max(0,m.o.n-m.n))}</b></div><div class="stat"><small>HEURES DE NUIT</small><b>${hm(m.n)}</b></div><div class="stat"><small>SUP. +25%</small><b>${hm(m.o.o25)}</b></div><div class="stat"><small>SUP. +50%</small><b>${hm(m.o.o50)}</b></div></div><section class="card" style="margin-top:13px"><div class="head"><h2>Salaire du jour</h2><span class="badge">ESTIMATION</span></div><div class="row"><span>Brut</span><b>${eur(m.gross)}</b></div><div class="row"><span>Net estimé</span><b>${eur(m.estimatedNet)}</b></div></section>`}
function yearStats(year){
  const months=[];
  for(let m=1;m<=12;m++){
    const key=year+'-'+pad(m), c=interimCalc(key);
    const ds=[...new Set(S.punches.map(p=>p.date))].filter(d=>d.startsWith(key));
    let w=0,n=0,o25=0,o50=0;
    ds.forEach(d=>{const x=daySalary(d);w+=x.w;n+=x.n;o25+=x.o.o25;o50+=x.o.o50});
    const netAfterTax=Math.max(0,c.netBeforeTax-c.tax);
    const received=netAfterTax+c.basket+c.nontax;
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
  const r=Math.max(0,Number(S.settings.rate)||13.78),scale=r/13.78;
  const rNormal13=1.84*scale,rTeam=14.50*scale,rTeam13=1.93*scale,rHab=3.50*scale,rHab13=0.47*scale,rNightMaj=6.89*scale,rNightMaj13=0.91*scale;
  let ds=[...new Set(S.punches.map(p=>p.date))].filter(d=>d.startsWith(mk));
  let tot={w:0,n:0,o25:0,o50:0,base:0,ot25Major:0,ot50Major:0,ot13:0,normal13:0,team:0,team13:0,habillage:0,habillage13:0,nightMajor:0,nightMajor13:0,basket:0};
  ds.forEach(d=>{const m=daySalary(d);tot.w+=m.w;tot.n+=m.n;tot.o25+=m.o.o25;tot.o50+=m.o.o50;tot.base+=m.normal;tot.ot25Major+=m.ot25Major;tot.ot50Major+=m.ot50Major;tot.ot13+=m.ot13;tot.normal13+=m.normal13;tot.team+=m.team;tot.team13+=m.team13;tot.habillage+=m.habillage;tot.habillage13+=m.habillage13;tot.nightMajor+=m.nightMajor;tot.nightMajor13+=m.nightMajor13;tot.basket+=m.basket});
  let gross=c.gross,netBeforeTax=c.netBeforeTax,tax=c.tax,netAfterTax=netBeforeTax-tax,received=netAfterTax+tot.basket+c.nontax;
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
  <section class="card compactSection"><div class="head"><h2>Détail du calcul</h2></div><div class="compactList">
    <div class="infoLine"><span>Heures travaillées <small>${hm(tot.w)} (nuit et heures sup. incluses)</small> × ${r.toFixed(2).replace(".",",")} € / h</span><b>${eur(tot.base)}</b></div>
    <div class="infoLine"><span>13e mois — heures normales × ${rNormal13.toFixed(2).replace(".",",")} € <small>${hm(tot.w)} — nuit et heures sup. comprises</small></span><b>${eur(tot.normal13)}</b></div>
    ${autoOn("team")?`<div class="infoLine"><span>Prime équipe</span><b>${eur(tot.team)}</b></div>
    <div class="infoLine"><span>13e mois — prime équipe × ${rTeam13.toFixed(2).replace(".",",")} €</span><b>${eur(tot.team13)}</b></div>`:""}
    ${autoOn("habillage")?`<div class="infoLine"><span>Habillage</span><b>${eur(tot.habillage)}</b></div>
    <div class="infoLine"><span>13e mois — habillage × ${rHab13.toFixed(2).replace(".",",")} €</span><b>${eur(tot.habillage13)}</b></div>`:""}
    <div class="infoLine"><span>Majoration nuit (heures de nuit uniquement) × ${rNightMaj.toFixed(2).replace(".",",")} €</span><b>${eur(tot.nightMajor)}</b></div>
    <div class="infoLine"><span>13e mois — majoration nuit × ${rNightMaj13.toFixed(2).replace(".",",")} €</span><b>${eur(tot.nightMajor13)}</b></div>
    ${tot.o25?`<div class="infoLine"><span>Majoration heures sup. +${S.settings.ot25pct}% <small>${hm(tot.o25)} × ${r.toFixed(2).replace(".",",")} € × ${S.settings.ot25pct}%</small></span><b>${eur(tot.ot25Major)}</b></div>`:""}
    ${tot.o50?`<div class="infoLine"><span>Majoration heures sup. +${S.settings.ot50pct}% <small>${hm(tot.o50)} × ${r.toFixed(2).replace(".",",")} € × ${S.settings.ot50pct}%</small></span><b>${eur(tot.ot50Major)}</b></div>`:""}
    ${tot.ot13?`<div class="infoLine"><span>13e mois — majoration heures sup.</span><b>${eur(tot.ot13)}</b></div>`:""}
    ${c.rows.filter(r=>r.taxable).map(r=>`<div class="infoLine"><span>${esc(r.name)} <small>${r.per==="day"?c.days+" j × "+eur(r.amount):"par mois"}</small></span><b>${eur(r.total)}</b></div><div class="infoLine"><span>13e mois — ${esc(r.name)}</span><b>${eur(r.total13)}</b></div>`).join("")}
    <div class="infoLine highlightRow"><span>Brut total</span><b>${eur(gross)}</b></div>
    ${autoOn("basket")?`<div class="infoLine"><span>Panier net × 7,50 €</span><b>${eur(tot.basket)}</b></div>`:""}
    ${c.rows.filter(r=>!r.taxable).map(r=>`<div class="infoLine"><span>${esc(r.name)} <small>${r.per==="day"?c.days+" j × "+eur(r.amount):"par mois"}</small></span><b>${eur(r.total)}</b></div>`).join("")}
  </div></section>`;
}

function settings(){return `<header><div><div class="eyebrow">CONFIGURATION</div><h1 class="title">Réglages</h1></div><div class="logo">⚙</div></header>
<section class="card"><div class="head"><div><h2>Salaire</h2><p class="sectionNote">Modifie le taux horaire : tous les montants liés au taux se recalculent automatiquement.</p></div></div><div class="field"><label>Taux horaire normal</label><input id="rate" type="number" inputmode="decimal" step="0.01" min="0" value="${S.settings.rate}"></div><div class="subCard"><div class="head"><div><h3>Barème automatique</h3><p class="sectionNote">Les montants ci-dessous suivent le taux horaire. Le panier reste fixe.</p></div></div><div class="grid2">
<div class="field"><label>13e mois — heures normales</label><input value="${(1.84*(S.settings.rate/13.78)).toFixed(2).replace('.',',')} € / h" disabled></div>
<div class="field"><label>Prime équipe</label><input value="${autoOn('team')?`${(14.50*(S.settings.rate/13.78)).toFixed(2).replace('.',',')} € / jour`:'Retirée'}" disabled></div>
<div class="field"><label>13e mois — prime équipe</label><input value="${autoOn('team')?`${(1.93*(S.settings.rate/13.78)).toFixed(2).replace('.',',')} € / jour`:'Retirée'}" disabled></div>
<div class="field"><label>Habillage</label><input value="${autoOn('habillage')?`${(3.50*(S.settings.rate/13.78)).toFixed(2).replace('.',',')} € / jour`:'Retirée'}" disabled></div>
<div class="field"><label>13e mois — habillage</label><input value="${autoOn('habillage')?`${(0.47*(S.settings.rate/13.78)).toFixed(2).replace('.',',')} € / jour`:'Retirée'}" disabled></div>
<div class="field"><label>Majoration nuit</label><input value="${(6.89*(S.settings.rate/13.78)).toFixed(2).replace('.',',')} € / h" disabled></div>
<div class="field"><label>13e mois — majoration nuit</label><input value="${(0.91*(S.settings.rate/13.78)).toFixed(2).replace('.',',')} € / h" disabled></div>
<div class="field"><label>Panier net</label><input value="${autoOn('basket')?`7,50 € / jour`:'Retirée'}" disabled></div></div></div>
<div class="field"><label>Coefficient net estimé</label><input id="net" type="number" step=".01" value="${S.settings.net}"></div><div class="field"><label>Prélèvement à la source estimé (%)</label><input id="taxRate" type="number" step=".1" min="0" value="${S.settings.taxRate||0}"></div><button id="saveSalary" class="btn purple" style="width:100%">Enregistrer</button></section>
<section class="card"><div class="head"><h2>Heures supplémentaires</h2></div><div class="field"><label>Début des heures sup. (h/semaine)</label><input id="weekly" type="number" step=".1" value="${S.settings.weekly}"></div><div class="field"><label>Fin tranche +25% (h/semaine)</label><input id="ot25" type="number" step=".1" value="${S.settings.ot25}"></div><div class="grid2"><div class="field"><label>Majoration 1 (%)</label><input id="ot25pct" type="number" value="${S.settings.ot25pct}"></div><div class="field"><label>Majoration 2 (%)</label><input id="ot50pct" type="number" value="${S.settings.ot50pct}"></div></div><button id="saveOT" class="btn purple" style="width:100%">Enregistrer</button></section>
<section class="card nightCard"><div class="head"><h2>Nuit</h2></div><div class="nightGrid"><div class="field nightField"><label>Début</label><input id="nightStart" type="time" value="${S.settings.nightStart}"></div><div class="field nightField"><label>Fin</label><input id="nightEnd" type="time" value="${S.settings.nightEnd}"></div></div><div class="field"><label>Majoration nuit (barème)</label><input value="+${Math.round(6.89/13.78*100)} % du taux · ${(6.89*(S.settings.rate/13.78)).toFixed(2).replace('.',',')} € / h" disabled></div><button id="saveNight" class="btn purple" style="width:100%">Enregistrer</button></section>
<section class="card"><div class="head"><div><h2>Intérim — IFM & congés payés</h2><p class="sectionNote">Paramètres modifiables à ta guise. Ils sont repris automatiquement dans le calcul du salaire.</p></div></div>
<div class="switchRow"><div><b>Activer le calcul intérim</b><small>Ajoute IFM et congés payés au calcul quand ils sont activés.</small></div><label class="switch"><input id="interimEnabled" type="checkbox" ${S.settings.interimEnabled!==false?"checked":""}><span></span></label></div>
<div class="subCard"><div class="switchRow"><div><b>Prime de fin de mission (IFM)</b><small>Taux appliqué au brut de la période.</small></div><label class="switch"><input id="ifmEnabled" type="checkbox" ${S.settings.ifmEnabled!==false?"checked":""}><span></span></label></div><div class="field"><label>Taux IFM (%)</label><input id="ifmRate" type="number" min="0" step=".1" value="${S.settings.ifmRate}"></div><div class="field"><label>Mode</label><select id="ifmMode"><option value="pay" ${S.settings.ifmMode!=="cet"?"selected":""}>Versée avec le salaire</option><option value="cet" ${S.settings.ifmMode==="cet"?"selected":""}>Mise au CET</option></select></div></div>
<div class="subCard"><div class="switchRow"><div><b>Indemnité de congés payés (ICCP)</b><small>Calculée selon le taux que tu définis.</small></div><label class="switch"><input id="iccpEnabled" type="checkbox" ${S.settings.iccpEnabled!==false?"checked":""}><span></span></label></div><div class="field"><label>Taux congés payés (%)</label><input id="iccpRate" type="number" min="0" step=".1" value="${S.settings.iccpRate}"></div><div class="field"><label>Mode</label><select id="iccpMode"><option value="pay" ${S.settings.iccpMode!=="cet"?"selected":""}>Versés avec le salaire</option><option value="cet" ${S.settings.iccpMode==="cet"?"selected":""}>Mis au CET</option></select></div></div>
<div class="row"><span>IFM estimée ce mois</span><b>${eur(interimCalc(new Date().getFullYear()+"-"+pad(new Date().getMonth()+1)).ifm)}</b></div><div class="row"><span>Congés payés estimés ce mois</span><b>${eur(interimCalc(new Date().getFullYear()+"-"+pad(new Date().getMonth()+1)).iccp)}</b></div><div class="row"><span>CET cumulé</span><b>${eur(cetTotal())}</b></div><button id="saveInterim" class="btn purple" style="width:100%;margin-top:12px">Enregistrer les paramètres intérim</button></section>
<section class="card"><div class="head"><div><h2>Primes & indemnités</h2><p class="sectionNote">Une prime ajoutée est comptée tout de suite dans le salaire, avec son 13e mois si elle est soumise à l'impôt. Supprime-la de la liste pour l'enlever du calcul.</p></div></div><div class="primeForm"><div class="field"><label>Nom</label><input id="primeName" type="text"></div><div class="field"><label>Montant (€)</label><input id="primeAmount" type="number" inputmode="decimal" min="0" step="0.01"></div><div class="field"><label>Versée</label><div class="taxChoice"><label><input type="radio" name="primePer" value="day" checked><span>Par jour travaillé</span></label><label><input type="radio" name="primePer" value="month"><span>Par mois</span></label></div></div><div class="field"><label>Fiscalité</label><div class="taxChoice"><label><input type="radio" name="primeTax" value="taxable" checked><span>Soumis à l'impôt</span></label><label><input type="radio" name="primeTax" value="nontaxable"><span>Non soumis à l'impôt</span></label></div></div><button id="addPrime" type="button" class="btn purple" style="width:100%">＋ Ajouter la prime / indemnité</button></div>${S.settings.primes.length?S.settings.primes.map((p,i)=>{const sc=S.settings.rate/13.78;const amount=p.builtin==="team"?14.50*sc:p.builtin==="habillage"?3.50*sc:p.builtin==="basket"?7.50:Number(p.amount)||0;return `<div class="primeItem"><span class="primeDot"></span><div class="primeInfo"><div class="primeName">${esc(p.name)}</div><div class="primeMeta">${eur(amount)} · ${p.per==="day"?"par jour travaillé":"par mois"} · ${p.taxable?"Soumis à l'impôt · 13e mois inclus":"Non soumis à l'impôt"}</div></div><button type="button" class="btn small red" data-prime="${i}">Supprimer</button></div>`}).join(""):`<div class="empty">Aucune prime ou indemnité.</div>`}${BUILTIN_PRIMES.some(b=>!autoOn(b.builtin))?`<button id="restorePrimes" type="button" class="btn" style="width:100%;margin-top:12px">Rétablir équipe, habillage et panier</button>`:""}</section>
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
document.querySelectorAll("[data-prime]").forEach(b=>b.onclick=()=>{const y=window.scrollY;S.settings.primes.splice(+b.dataset.prime,1);save();render();window.scrollTo(0,y);toast("Prime supprimée ✓")});
if(q("saveSalary"))q("saveSalary").onclick=()=>{S.settings.rate=Math.max(0,+q("rate").value||13.78);S.settings.net=+q("net").value||0;S.settings.taxRate=Math.max(0,+q("taxRate").value||0);save();render();toast("Salaire enregistré ✓")};

if(q("saveOT"))q("saveOT").onclick=()=>{S.settings.weekly=+q("weekly").value||35;S.settings.ot25=+q("ot25").value||43;S.settings.ot25pct=+q("ot25pct").value||25;S.settings.ot50pct=+q("ot50pct").value||50;save();render();toast("Heures sup. enregistrées ✓")};
if(q("saveNight"))q("saveNight").onclick=()=>{S.settings.nightStart=q("nightStart").value;S.settings.nightEnd=q("nightEnd").value;save();render();toast("Nuit enregistrée ✓")};
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
  const perEl=document.querySelector('input[name="primePer"]:checked');
  const per=perEl&&perEl.value==="month"?"month":"day";
  S.settings.primes.push({id:newId(),name,amount,taxable,per,enabled:true});
  save();render();toast("Prime ajoutée ✓");
};
if(q("restorePrimes"))q("restorePrimes").onclick=()=>{const miss=BUILTIN_PRIMES.filter(b=>!autoOn(b.builtin)).map(newBuiltin);S.settings.primes=[...miss,...S.settings.primes];save();render();toast("Primes rétablies ✓")};
if(q("reset"))q("reset").onclick=()=>{if(confirm("Tout effacer ?")){localStorage.removeItem(KEY);location.reload()}}
}
function openShiftDate(now){
  // Si un poste est en cours (dernier pointage ≠ Fin, moins de 16 h), renvoie sa date de début :
  // un poste de nuit qui passe minuit reste ainsi rattaché à un seul jour.
  const last=[...S.punches].sort((a,b)=>new Date(a.at)-new Date(b.at)).pop();
  if(last&&last.type!=="end"&&now-new Date(last.at)<16*3600000)return last.date;
  return iso(now);
}
function punchDate(type,now){return type==="start"?iso(now):openShiftDate(now)}
function addNow(type){let d=new Date(),date=punchDate(type,d);S.punches.push({id:crypto.randomUUID(),date,at:d.toISOString(),type});save();render();toast(label(type)+" ajouté ✓")}
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
