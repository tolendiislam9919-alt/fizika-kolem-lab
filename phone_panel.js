/* Панель жағы: QR, оқушылар тізімі, тапсырманы телефонға жіберу, көлік жарысы.
   index.html-дегі негізгі скрипттен кейін жүктеледі және оның атауларын қолданады. */
"use strict";
const PH=(()=>{
  const today=new Date().toISOString().slice(0,10);
  const newRoom=()=>{ const A='ABCDEFGHJKMNPQRSTUVWXYZ'; let s=''; for(let i=0;i<4;i++) s+=A[Math.floor(Math.random()*A.length)]; return s; };
  let D=store.get('kl_ph',null); if(!D||D.date!==today) D={date:today,room:newRoom(),st:{},kick:[]};
  const save=()=>store.set('kl_ph',D);
  const seen={};                    // pid → соңғы белгі (мс)
  let net=null, act=null, linkInfo=null, status=[];
  const online=pid=>Date.now()-(seen[pid]||0)<9000;
  const ids=()=>Object.keys(D.st);
  const isLocal=()=>linkInfo&&linkInfo.local;

  /* ---------- сілтеме және QR ---------- */
  function joinUrl(){ if(isLocal()) return /^127\./.test(linkInfo.host)?'':`http://${linkInfo.host}:${linkInfo.port}/oqushy.html?r=${D.room}`;
    if(location.protocol==='http:'||location.protocol==='https:'){ const p=location.pathname.replace(/[^/]*$/,''); return location.origin+p+'oqushy.html?r='+D.room; }
    const b=store.get('kl_puburl','').trim(); if(b) return b.replace(/\/?(index\.html)?$/,'/')+'oqushy.html?r='+D.room; return ''; }
  function qrSvg(u){ const q=qrcode(0,'M'); q.addData(u); q.make(); return q.createSvgTag({cellSize:6,margin:2,scalable:true}); }
  function paintQR(){ const u=joinUrl(), loc=isLocal(); document.querySelectorAll('[data-qr]').forEach(b=>{ b.innerHTML=u?qrSvg(u):(loc?'<div class="qrno">QR жоқ:<br>компьютерді Wi-Fi-ға қосыңыз</div>':'<div class="qrno">QR жоқ:<br>сілтеме керек</div>'); });
    document.querySelectorAll('[data-url]').forEach(b=>{ b.textContent=u?u.replace(/^https?:\/\//,''):'—'; });
    const w=$('phFile'); if(w) w.style.display=(u||loc)?'none':'block'; const i=$('phPub'); if(i&&!i.value) i.value=store.get('kl_puburl','');
    const f=$('phWifi'); if(f){ f.style.display=(loc&&u)?'block':'none'; f.innerHTML=linkInfo&&linkInfo.ssid?`Алдымен телефонды <b>«${esc(linkInfo.ssid)}»</b> Wi-Fi-ына қос (мобильді интернетті өшір).`:'Алдымен телефонды осы компьютер қосылған Wi-Fi-ға қос.'; } }

  /* ---------- оқушылар ---------- */
  function groupFor(name){ const f=GD.list.find(x=>x.name===name); if(f) return f.c; let c; if(GD.bag.length) c=GD.bag.pop(); else { const n=[0,0,0]; GD.list.forEach(x=>n[x.c]++); c=n.indexOf(Math.min(...n)); } GD.list.push({name,c}); store.set('kl_gd',GD); gdShow(); return c; }
  function ensureRoster(name){ if(ROSTER.includes(name)) return; const i=ROSTER.findIndex(n=>/^\d+-оқушы$/.test(n)&&!RES[n]); if(i>=0) ROSTER[i]=name; else ROSTER.push(name); store.set('kl_roster',ROSTER); $('roster').value=ROSTER.join('\n'); tkFill(); grBuild(); }
  function reg(pid,name){ name=String(name||'').slice(0,24).trim()||'Оқушы'; let s=D.st[pid]; if(!s){ s=D.st[pid]={n:name,g:groupFor(name),prog:{}}; ensureRoster(name); save(); SND.clink(); paintList(); } else if(s.n!==name){ s.n=name; save(); paintList(); } return s; }
  function applyGrade(s,v){ if(!v||!v.it) return; const r=RES[s.n]=RES[s.n]||{}; let ch=false; Object.keys(v.it).forEach(q=>{ const a=v.it[q]; if(!r[q]||r[q].t!==a.t||r[q].done!==a.done){ r[q]={t:a.t,p:a.p,v:a.v,done:a.done}; ch=true; } }); if(ch){ store.set('kl_res',RES); tkLoad(); grBuild(); } }
  function setProg(pid,key,v){ const s=D.st[pid]; if(!s||!v) return; const o=s.prog[key]; if(!o||o.dn!==v.dn||o.sc!==v.sc){ s.prog[key]={sc:v.sc,dn:v.dn,tot:v.tot,max:v.max}; save(); paintChip(); paintMon(); } applyGrade(s,v); }
  /* «Бастау» басылғанша телефонға тапсырма бармайды. Жарыс беті – бөлек: оның лоббиі өзі күту экраны, ойынды «Жарысты бастау» қосады. */
  function shownAct(){ return D.started||act==='race'?act:null; }
  function stFor(pid){ const s=D.st[pid]; return {t:'st',pid,act:shownAct(),started:!!D.started,g:s?s.g:0,rc:act==='race'?RC.forPid(pid):null}; }
  function paintStart(){ const n=ids().length; document.querySelectorAll('[data-phstart]').forEach(b=>{ b.disabled=!!D.started||!n; b.textContent=D.started?'✓ Сабақ басталды':(n?`▶ Бастау (${n} оқушы)`:'▶ Бастау: оқушыларды күтудеміз'); }); }
  function markStarted(){ if(D.started) return; D.started=true; save(); paintStart(); paintChip(); all(); }
  function begin(){ if(D.started||!ids().length) return; if(slides[cur].id==='slJoin') act=null; SND.bell(); markStarted(); toast('▶ Сабақ басталды!'); monitor(false); if(slides[cur].id==='slJoin') go(cur+1); }
  function tell(pid){ if(net) net.send(pid,stFor(pid)); }
  function all(){ ids().forEach(pid=>{ if(online(pid)) tell(pid); }); }
  function onMsg(m){ const pid=m.pid; if(!pid) return; seen[pid]=Date.now();
    if(D.kick.includes(pid)&&!m.force){ net.send(pid,{t:'kicked',pid}); return; }
    if(m.force) D.kick=D.kick.filter(x=>x!==pid);
    if(m.t==='hello'){ reg(pid,m.name); tell(pid); paintChip(); return; }
    if(!D.st[pid]){ if(m.n) reg(pid,m.n); else return; }
    if(m.t==='ping'){ if(m.n) reg(pid,m.n); if(m.p) Object.keys(m.p).forEach(k=>setProg(pid,k,m.p[k])); if(m.a) RC.answer(pid,m.a.i,m.a.k); tell(pid); return; }
    if(m.t==='res'){ setProg(pid,m.pack,m.v); return; }
    if(m.t==='rjoin'){ RC.join(pid); return; }
    if(m.t==='ans'){ RC.answer(pid,m.i,m.k); return; } }
  function kick(pid){ const s=D.st[pid]; if(!s) return; if(!confirm(s.n+' тізімнен алынсын ба?')) return; delete D.st[pid]; D.kick.push(pid); RC.leave(pid); save(); if(net) net.send(pid,{t:'kicked',pid}); paintList(); }
  function resetAll(){ if(!confirm('Жаңа сабақ: жаңа QR жасалады, телефондар қайта сканерлейді. Жалғастырамыз ба?')) return; store.set('kl_ph',{date:today,room:newRoom(),st:{},kick:[]}); store.set('kl_gd',null); location.reload(); }

  /* ---------- экрандағы тізім ---------- */
  function paintChip(){ const c=$('phChip'); if(!c) return; const n=ids().length; let t='📱 QR · '+n; const P=act&&act!=='race'&&KL.PACKS[act]; if(!D.started&&act!=='race'&&n) t+=' · «Бастау» күтілуде'; else if(P){ const dn=ids().filter(p=>{ const v=D.st[p].prog[act]; return v&&v.dn>=v.tot; }).length; t+=` · ${P.t}: ${dn}/${n}`; } else if(act==='race') t+=' · жарыс'; c.textContent=t; }
  function paintList(){ paintChip(); const g=$('phNames'); if(g){ $('phCount').textContent=ids().length; g.innerHTML=ids().map(p=>{ const s=D.st[p]; return `<span class="nmc" style="background:${GR[s.g].c}" data-k="${p}" title="Алып тастау">${esc(s.n)}</span>`; }).join('')||'<span style="color:var(--muted);font-size:20px">Әзірге ешкім қосылған жоқ…</span>'; } paintStart(); paintMon(); if(act==='race'&&RC.R.ph==='lobby') RC.paint(); }
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function paintMon(){ const b=$('phMonT'); if(!b||$('phOv').style.display==='none') return; const keys=Object.keys(KL.PACKS).filter(k=>ids().some(p=>D.st[p].prog[k]));
    let h='<tr><th>Оқушы</th><th>Топ</th>'+keys.map(k=>`<th>${KL.PACKS[k].t}</th>`).join('')+'<th>Байланыс</th><th></th></tr>';
    ids().forEach(p=>{ const s=D.st[p]; h+=`<tr><td class="l"><b>${esc(s.n)}</b></td><td style="color:${GR[s.g].c};font-weight:700">${GR[s.g].n}</td>`+keys.map(k=>{ const v=s.prog[k]; return v?`<td class="${v.dn>=v.tot?'ok':''}">${nf(v.sc,1)} / ${v.max}</td>`:'<td>–</td>'; }).join('')+`<td>${online(p)?'🟢':'⚪'}</td><td><button class="btn" data-x="${p}" style="padding:1px 8px">×</button></td></tr>`; });
    b.innerHTML=h; }
  function monitor(on){ $('phOv').style.display=on?'flex':'none'; if(on){ paintQR(); paintMon(); } }
  function paintNet(){ const e=$('phNet'); if(!e) return; const ok=status.filter(x=>x.on); e.textContent=ok.length?'Байланыс бар: '+ok.map(x=>x.name).join(', '):'Байланыс орнатылып жатыр…'; e.style.color=ok.length?'var(--green)':'var(--red)'; }

  /* ---------- бет ауысқанда ---------- */
  function sync(){ const s=slides[cur], a=s.dataset.phone||null; if(a&&a!==act){ act=a; if(ids().length&&a!=='race'&&KL.PACKS[a]) toast(D.started?'📱 Телефонға жіберілді: '+KL.PACKS[a].t:'📱 Телефондар күтіп тұр: жоғарғы сары түйме → «Бастау»'); all(); } paintChip(); if(s.id==='slJoin'||a==='race') paintQR(); if(a==='race') RC.paint(); }

  function init(){ net=NET.openPanel({room:D.room,onMsg,onStatus:l=>{ status=l; paintNet(); },onReady:i=>{ linkInfo=i; paintQR(); paintNet(); }});
    $('phChip').onclick=()=>monitor($('phOv').style.display==='none');
    $('phClose').onclick=()=>monitor(false);
    $('phOv').addEventListener('click',e=>{ const x=e.target.closest('[data-x]'); if(x) kick(x.dataset.x); });
    $('phNames').addEventListener('click',e=>{ const x=e.target.closest('[data-k]'); if(x) kick(x.dataset.k); });
    $('phReset').onclick=resetAll;
    document.querySelectorAll('[data-phstart]').forEach(b=>b.onclick=begin);
    $('phPubOk').onclick=()=>{ store.set('kl_puburl',$('phPub').value.trim()); paintQR(); };
    setInterval(()=>{ if($('phOv').style.display!=='none') paintMon(); },2000);
    const og=go; go=function(i){ og(i); sync(); };
    paintList(); paintQR(); sync(); }
  return {init,sync,all,tell,online,ids,get D(){return D;},esc,qrSvg,joinUrl,onMsg,get act(){return act;},paintQR,begin,markStarted};
})();

/* ===================== КӨЛІК ЖАРЫСЫ ===================== */
const RC=(()=>{
  const N=10,T=20,COL=[{b:'#d63a35',d:'#9c2320',n:'Қызыл'},{b:'#1f6fc4',d:'#134d8c',n:'Көк'},{b:'#e0a92e',d:'#a47a14',n:'Сары'}];
  const SY=['▲','◆','●','■'];
  const R={ph:'lobby',qs:[],i:-1,t0:0,all:{},cars:[],revT:0,hold:false,cdT:0,conf:[]};
  const P=pid=>{ if(!R.all[pid]){ const s=PH.D.st[pid]; R.all[pid]={pid,name:s?s.n:'Бот',pts:0,right:0,ans:null,at:0,gain:0,ok:false}; } return R.all[pid]; };
  const places=()=>Object.values(R.all).sort((a,b)=>b.pts-a.pts||b.right-a.right);
  const placeOf=pid=>{ const i=places().findIndex(p=>p.pid===pid); return i<0?null:i+1; };
  function forPid(pid){ const s=PH.D.st[pid], p=R.all[pid], car=R.cars.some(c=>c.pid===pid); const q=R.qs[R.i];
    const o={ph:R.ph,i:R.i,n:N,T,slots:R.cars.map(c=>c.name),me:{role:car?'car':'fan',ans:p?p.ans:null,ok:p?p.ok:false,gain:p?p.gain:0,pts:p?p.pts:0,right:p?p.right:0,place:placeOf(pid)}};
    if(R.ph==='q'){ o.q=q.q; o.o=q.o; o.left=Math.max(0,T*1000-(Date.now()-R.t0)); } if(R.ph==='rev') o.ca=q.o[q.ci]; return o; }
  function join(pid){ if(R.ph!=='lobby'||R.cars.length>=3||R.cars.some(c=>c.pid===pid)){ PH.tell(pid); return; } const p=P(pid); R.cars.push({pid,name:p.name,pos:0,vis:0,col:COL[R.cars.length],spin:0,puff:[]}); SND.beep(); paint(); PH.all(); }
  function leave(pid){ if(R.ph==='lobby'){ R.cars=R.cars.filter(c=>c.pid!==pid); R.cars.forEach((c,i)=>c.col=COL[i]); delete R.all[pid]; paint(); PH.all(); } }
  function addBot(){ if(R.ph!=='lobby'||R.cars.length>=3){ return; } const id='bot'+Date.now()%100000; const nm=['Бот Алма','Бот Арман','Бот Дана'][R.cars.length]; R.all[id]={pid:id,name:nm,pts:0,right:0,ans:null,at:0,gain:0,ok:false,bot:true}; R.cars.push({pid:id,name:nm,pos:0,vis:0,col:COL[R.cars.length],spin:0,puff:[],bot:true}); paint(); }
  function autoCars(){ PH.ids().forEach(pid=>{ if(R.cars.length<3&&PH.online(pid)&&!R.cars.some(c=>c.pid===pid)){ const p=P(pid); R.cars.push({pid,name:p.name,pos:0,vis:0,col:COL[R.cars.length],spin:0,puff:[]}); } }); }
  function start(){ if(!R.cars.length) autoCars();   // ешкім тіркелмесе, алғашқы 3 оқушы жарысады
    if(!R.cars.length){ toast('Алдымен кемінде бір оқушы қосылсын'); return; } PH.markStarted(); const pool=shuffle(KL.RACEQ).slice(0,N); R.qs=pool.map(([q,o])=>{ const idx=shuffle([0,1,2,3]); return {q,o:idx.map(i=>o[i]),ci:idx.indexOf(0)}; }); R.i=-1; R.ph='cd'; R.cdT=Date.now(); R.conf=[]; Object.values(R.all).forEach(p=>{ p.pts=0; p.right=0; p.ans=null; p.gain=0; p.ok=false; }); R.cars.forEach(c=>{ c.pos=0; c.vis=0; }); SND.beep(); paint(); PH.all(); }
  function nextQ(){ R.i++; if(R.i>=N){ finish(); return; } Object.values(R.all).forEach(p=>{ p.ans=null; p.gain=0; p.ok=false; }); R.ph='q'; R.t0=Date.now(); R.hold=false; SND.page(); paint(); PH.all();
    Object.values(R.all).filter(p=>p.bot).forEach(p=>{ const t=2000+Math.random()*9000, ci=R.qs[R.i].ci, k=Math.random()<.72?ci:(ci+1+Math.floor(Math.random()*3))%4, i=R.i; setTimeout(()=>answer(p.pid,i,k),t); }); }
  function needed(){ const want=R.cars.map(c=>c.pid); PH.ids().forEach(p=>{ if(PH.online(p)&&!want.includes(p)) want.push(p); }); return want; }
  function answer(pid,i,k){ if(R.ph!=='q'||i!==R.i) return; if(!R.all[pid]&&!PH.D.st[pid]) return; const p=P(pid); if(p.ans!=null) return; p.ans=k; p.at=Date.now()-R.t0; if(!p.bot) PH.tell(pid); SND.clink(); paintCounts(); if(needed().every(x=>R.all[x]&&R.all[x].ans!=null)) reveal(); }
  function reveal(){ if(R.ph!=='q') return; const q=R.qs[R.i]; Object.values(R.all).forEach(p=>{ p.ok=p.ans===q.ci; p.gain=p.ok?500+Math.round(500*Math.max(0,1-p.at/(T*1000))):0; p.pts+=p.gain; if(p.ok) p.right++; });
    R.cars.forEach(c=>{ const p=R.all[c.pid]; if(p&&p.ok) c.pos=Math.min(100,c.pos+7.5+2.5*Math.max(0,1-p.at/(T*1000))); }); R.ph='rev'; R.revT=Date.now(); SND.ok(); paint(); PH.all(); }
  function finish(){ R.ph='end'; SND.bell(); const lead=R.cars.slice().sort((x,y)=>R.all[y.pid].pts-R.all[x.pid].pts)[0]; if(lead) lead.pos=100; R.conf=Array.from({length:130},()=>({x:Math.random()*1540,y:-Math.random()*300,v:60+Math.random()*120,c:['#d63a35','#1f6fc4','#e0a92e','#2a8f4d','#fff'][Math.floor(Math.random()*5)],r:Math.random()*6})); paint(); PH.all(); }
  function again(keep){ R.ph='lobby'; R.i=-1; R.conf=[]; R.qs=[]; if(keep){ const ks={}; R.cars.forEach(c=>{ ks[c.pid]=R.all[c.pid]; c.pos=0; c.vis=0; }); R.all=ks; Object.values(ks).forEach(p=>{ p.pts=0; p.right=0; p.ans=null; p.gain=0; }); } else { R.cars=[]; R.all={}; } paint(); PH.all(); }
  setInterval(()=>{ if(R.ph==='cd'){ const left=3-Math.floor((Date.now()-R.cdT)/1000); const e=$('rcCd'); if(e&&e.textContent!==String(left)&&left>0){ e.textContent=left; SND.beep(); } if(left<=0) nextQ(); }
    else if(R.ph==='q'){ const l=T*1000-(Date.now()-R.t0); const e=$('rcSec'); if(e) e.textContent=Math.max(0,Math.ceil(l/1000)); const b=$('rcBar'); if(b) b.style.width=Math.max(0,l/(T*10))+'%'; if(l<=0) reveal(); }
    else if(R.ph==='rev'&&!R.hold){ const l=6000-(Date.now()-R.revT); const b=$('rcNx'); if(b) b.textContent='Келесі ▶ ('+Math.max(0,Math.ceil(l/1000))+')'; if(l<=0) nextQ(); } },200);

  /* ---------- экран ---------- */
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function board(){ return '<div class="rcboard">'+R.cars.slice().sort((a,b)=>R.all[b.pid].pts-R.all[a.pid].pts).map((c,i)=>`<div class="rcb" style="border-left-color:${c.col.b}"><span>${i+1}. ${esc(c.name)}</span><b>${R.all[c.pid].pts}</b></div>`).join('')+'</div>'; }
  function paintCounts(){ const e=$('rcAns'); if(!e) return; const w=needed(); e.textContent=w.filter(x=>R.all[x]&&R.all[x].ans!=null).length+' / '+w.length; }
  function paint(){ const top=$('rcTop'),bot=$('rcBot'); if(!top) return;
    if(R.ph==='lobby'){ top.innerHTML=`<div class="rctt"><div><small>Сабақты бекіту · телефонмен ойын</small><h2>Көлік жарысы</h2><p>QR-кодты сканерле, атыңды жаз, <b>«Жарысқа тіркелу»</b> түймесін бас (ешкім баспаса, алғашқы үшеуі өзі жарысады). Алғашқы <b>3 оқушы</b> – жарысушы, қалғандары – жанкүйер: олар да жауап береді, өз ұпайын жинайды. Сұрақ саны – <b>10</b>: дұрыс әрі жылдам жауап көлікті алға жылжытады.</p></div><div class="rcqr" data-qr></div></div>`;
      bot.innerHTML=`<div class="rcslots">${[0,1,2].map(i=>{ const c=R.cars[i]; return c?`<div class="rcsl" style="background:${c.col.b}"><span>${esc(c.name)}</span><button data-rm="${c.pid}">×</button></div>`:`<div class="rcsl em" style="border-color:${COL[i].b};color:${COL[i].b}">${i+1}-орын бос</div>`; }).join('')}</div>
        <div class="rcctl"><button class="btn main big2" id="rcStart" ${R.cars.length||PH.ids().length?'':'disabled'}>🏁 Жарысты бастау</button><button class="btn" id="rcBot1">🤖 Бот қосу (сынап көру үшін)</button><span class="rcfan">Қосылғандар: <b>${PH.ids().length}</b>${PH.ids().length?' – '+PH.ids().map(p=>esc(PH.D.st[p].n)).join(', '):''}</span><span class="rcurl" data-url></span></div>`; PH.paintQR(); }
    else if(R.ph==='cd'){ top.innerHTML=`<div class="rcq" style="justify-content:center"><div class="rccd" id="rcCd">3</div></div>`; bot.innerHTML='<div class="rcfan" style="text-align:center;font-size:24px">Дайындалыңдар!</div>'; }
    else if(R.ph==='q'||R.ph==='rev'){ const q=R.qs[R.i], rev=R.ph==='rev', cnt=[0,0,0,0]; Object.values(R.all).forEach(p=>{ if(p.ans!=null) cnt[p.ans]++; });
      top.innerHTML=`<div class="rcq"><div class="rcn">${R.i+1}/${N}</div><div class="rcqt">${esc(q.q)}</div>${rev?'':`<div class="rcsec" id="rcSec">${T}</div>`}</div>${rev?'':'<div class="rctm"><i id="rcBar"></i></div>'}`;
      bot.innerHTML=`<div class="rcopts">${q.o.map((x,j)=>`<div class="rco o${j} ${rev?(j===q.ci?'right':'dim'):''}"><b>${SY[j]}</b><span>${esc(x)}</span>${rev?`<em>${cnt[j]}</em>`:''}</div>`).join('')}</div>
        <div class="rcctl">${rev?`<button class="btn main big2" id="rcNx">Келесі ▶</button><button class="btn" id="rcHold">⏸ Тоқтата тұру (түсіндіру)</button>`:`<span class="rcfan">Жауап берді: <b id="rcAns"></b></span><button class="btn" id="rcSkip">Жауапты көрсету</button>`}${board()}</div>`; paintCounts(); }
    else { const pl=places(), cars=R.cars.slice().sort((a,b)=>R.all[b.pid].pts-R.all[a.pid].pts), fans=pl.filter(p=>!R.cars.some(c=>c.pid===p.pid)).slice(0,5);
      top.innerHTML=`<div class="rcq" style="justify-content:center"><div class="rcwin">🏆 Жеңімпаз: ${esc(cars[0]?cars[0].name:'')}</div></div>`;
      bot.innerHTML=`<div class="rcend"><div class="rcpod">${cars.map((c,i)=>`<div class="pd p${i}" style="background:${c.col.b}"><div class="pn">${i+1}-орын</div><div>${esc(c.name)}</div><b>${R.all[c.pid].pts}</b><small>${R.all[c.pid].right} / ${N} дұрыс</small></div>`).join('')}</div>
        <div class="rcfl"><h4>Үздік жанкүйерлер</h4>${fans.map((p,i)=>`<div>${i+1}. ${esc(p.name)} – <b>${p.pts}</b></div>`).join('')||'<div style="color:var(--muted)">Жанкүйер болған жоқ</div>'}<div class="rcctl" style="margin-top:10px"><button class="btn main" id="rcAg1">↺ Сол ойыншылармен қайта</button><button class="btn" id="rcAg2">Жаңа ойыншылар</button></div></div></div>`; }
    const w=(id,f)=>{ const e=$(id); if(e) e.onclick=f; };
    w('rcStart',start); w('rcBot1',addBot); w('rcNx',nextQ); w('rcHold',()=>{ R.hold=!R.hold; $('rcHold').textContent=R.hold?'▶ Жалғастыру':'⏸ Тоқтата тұру (түсіндіру)'; if(!R.hold) R.revT=Date.now(); else $('rcNx').textContent='Келесі ▶'; }); w('rcSkip',reveal); w('rcAg1',()=>again(true)); w('rcAg2',()=>again(false));
    bot.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>leave(b.dataset.rm)); }

  /* ---------- жол және көліктер ---------- */
  function car(ctx,x,y,c,spin,moving){ const s=1; ctx.save(); ctx.translate(x,y);
    ctx.fillStyle='rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(0,20,64,7,0,0,7); ctx.fill();
    ctx.fillStyle=c.b; rr(ctx,-62,-12,124,28,10); ctx.fill(); ctx.beginPath(); ctx.moveTo(-34,-12); ctx.quadraticCurveTo(-24,-36,4,-36); ctx.quadraticCurveTo(26,-36,38,-12); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#cfe6f4'; ctx.beginPath(); ctx.moveTo(-24,-13); ctx.quadraticCurveTo(-17,-30,1,-30); ctx.lineTo(1,-13); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(6,-13); ctx.lineTo(6,-30); ctx.quadraticCurveTo(20,-29,29,-13); ctx.closePath(); ctx.fill();
    ctx.fillStyle=c.d; ctx.fillRect(-60,4,120,5); ctx.fillStyle='#ffe28a'; rr(ctx,52,-8,10,8,3); ctx.fill(); ctx.fillStyle='#e8604c'; rr(ctx,-62,-8,7,8,2); ctx.fill();
    for(const wx of [-34,36]){ ctx.save(); ctx.translate(wx,14); ctx.fillStyle='#22262b'; ctx.beginPath(); ctx.arc(0,0,13,0,7); ctx.fill(); ctx.fillStyle='#c3c8ce'; ctx.beginPath(); ctx.arc(0,0,6,0,7); ctx.fill(); ctx.rotate(spin); ctx.strokeStyle='#555'; ctx.lineWidth=2; for(let k=0;k<3;k++){ ctx.rotate(Math.PI/3*2); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(6,0); ctx.stroke(); } ctx.restore(); }
    ctx.restore(); }
  LABS.cRace={t:0,frame(ctx,w,h,dt){ this.t+=dt; const X0=150,X1=w-150, nl=3, top=26, lh=(h-top-8)/nl;
    ctx.fillStyle='#7fb069'; ctx.fillRect(0,0,w,h);
    for(let i=0;i<nl;i++){ const y=top+i*lh; ctx.fillStyle='#4a4e54'; ctx.fillRect(0,y,w,lh-6); ctx.fillStyle='#f3efe4'; ctx.fillRect(0,y,w,2.5); ctx.fillRect(0,y+lh-8.5,w,2.5);
      ctx.strokeStyle='rgba(255,255,255,.35)'; ctx.setLineDash([26,22]); ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(0,y+lh/2-3); ctx.lineTo(w,y+lh/2-3); ctx.stroke(); ctx.setLineDash([]); }
    for(let k=0;k<=N;k++){ const x=X0+(X1-X0)*k/N; ctx.fillStyle='rgba(255,255,255,.28)'; ctx.fillRect(x-1,top,2,h-top-8); label(ctx,k===0?'СТАРТ':String(k),x,top-8,'#22351b',k===0?14:15,'center',true); }
    const cs=12; for(let r=0;r<Math.ceil((h-top-8)/cs);r++) for(let q=0;q<3;q++){ ctx.fillStyle=(r+q)%2?'#111':'#f6f6f6'; ctx.fillRect(X1+q*cs-6,top+r*cs,cs,Math.min(cs,h-8-top-r*cs)); }
    label(ctx,'МӘРЕ',X1+12,top-8,'#22351b',15,'center',true);
    R.cars.forEach((c,i)=>{ const before=c.vis; c.vis+=(c.pos-c.vis)*Math.min(1,dt*1.8); const dx=c.vis-before; c.spin+=dx*2.4; const y=top+i*lh+lh/2-2, x=X0+(X1-X0)*c.vis/100;
      if(dx>.02) c.puff.push({x:x-70,y:y+8,a:1,r:4}); c.puff=c.puff.filter(p=>(p.a-=dt*1.4)>0); c.puff.forEach(p=>{ p.x-=26*dt; p.r+=16*dt; ctx.fillStyle=`rgba(235,235,235,${p.a*.55})`; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,7); ctx.fill(); });
      car(ctx,x,y,c.col,c.spin);
      const nm=c.name, tw=(ctx.font='700 17px Segoe UI, sans-serif',ctx.measureText(nm).width)+18; ctx.fillStyle='rgba(255,255,255,.95)'; rr(ctx,x-tw/2,y-lh/2+4,tw,23,6); ctx.fill(); label(ctx,nm,x,y-lh/2+21,'#1d2430',17,'center',true); });
    if(!R.cars.length) label(ctx,'Ойыншылар тіркелгенде көліктер осында шығады',w/2,h/2+8,'#f3efe4',26,'center',true);
    if(R.conf.length) R.conf.forEach(p=>{ p.y+=p.v*dt; p.r+=dt*4; if(p.y>h) p.y=-10; ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.r); ctx.fillStyle=p.c; ctx.fillRect(-5,-3,10,6); ctx.restore(); }); }};
  return {forPid,join,leave,answer,paint,start,addBot,reveal,nextQ,R};
})();

PH.init(); RC.paint();
window.__ph={PH,RC};
