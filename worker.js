const te = new TextEncoder();

const DEFAULTS = {
  business_name: 'PrintPay',
  price_bw: '2',
  price_color: '8',
  global_discount: '0',
  delivery: '0',
  tier_1: '0',
  tier_5: '0',
  tier_10: '0',
  tier_25: '0'
};

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,customer_name TEXT NOT NULL,mobile TEXT NOT NULL,pages INTEGER NOT NULL DEFAULT 1,copies INTEGER NOT NULL DEFAULT 1,print_mode TEXT NOT NULL DEFAULT 'bw',paper TEXT NOT NULL DEFAULT 'A4',amount_paise INTEGER NOT NULL DEFAULT 0,payment_method TEXT NOT NULL DEFAULT 'cash',payment_status TEXT NOT NULL DEFAULT 'PENDING',order_status TEXT NOT NULL DEFAULT 'PENDING',file_count INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`
];

function now(){ return new Date().toISOString(); }
function json(data,status=200,extra={}){ return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8',...extra}}); }
function esc(s){ return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function b64(buf){ return btoa(String.fromCharCode(...new Uint8Array(buf))); }
async function pbkdf2(password,salt){
  const k=await crypto.subtle.importKey('raw',te.encode(password),'PBKDF2',false,['deriveBits']);
  return b64(await crypto.subtle.deriveBits({name:'PBKDF2',salt:te.encode(salt),iterations:100000,hash:'SHA-256'},k,256));
}
async function hmac(secret,text){
  const k=await crypto.subtle.importKey('raw',te.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return b64(await crypto.subtle.sign('HMAC',k,te.encode(text)));
}
async function ensure(env){
  for(const sql of SCHEMA) await env.DB.prepare(sql).run();
  for(const [k,v] of Object.entries(DEFAULTS)) await env.DB.prepare('INSERT OR IGNORE INTO settings(key,value,updated_at) VALUES(?,?,?)').bind(k,v,now()).run();
}
async function settings(env){
  await ensure(env);
  const r=await env.DB.prepare('SELECT key,value FROM settings').all();
  const s={...DEFAULTS}; for(const x of r.results) s[x.key]=x.value; return s;
}
async function isOwner(req,env){
  const c=req.headers.get('Cookie')||''; const m=c.match(/(?:^|;\s*)pp_session=([^;]+)/); if(!m) return false;
  const secret=env.SESSION_SECRET||env.ADMIN_INITIAL_PASSWORD; if(!secret) return false;
  try{
    const raw=decodeURIComponent(m[1]); const [ts,id,sig]=raw.split('.');
    if(!ts||!id||!sig||Date.now()-Number(ts)>86400000) return false;
    return (await hmac(secret,ts+'.'+id))===sig;
  }catch{return false}
}
async function sessionCookie(env){
  const secret=env.SESSION_SECRET||env.ADMIN_INITIAL_PASSWORD; if(!secret) throw new Error('SESSION_SECRET or ADMIN_INITIAL_PASSWORD is required');
  const payload=Date.now()+'.'+crypto.randomUUID(); const sig=await hmac(secret,payload);
  return `pp_session=${encodeURIComponent(payload+'.'+sig)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`;
}

const CSS = `
:root{--bg:#f5f7ff;--card:#fff;--ink:#172033;--muted:#667085;--p:#6c4cff;--p2:#19b6ff;--ok:#16a34a;--danger:#dc2626;--line:#e7e9f2}*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Noto Sans,sans-serif;background:linear-gradient(135deg,#f6f3ff,#eefaff);color:var(--ink)}button,input,select{font:inherit}button{cursor:pointer;border:0}.wrap{max-width:1050px;margin:auto;padding:18px}.top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.brand{display:flex;align-items:center;gap:10px;font-weight:900;font-size:22px}.logo{width:42px;height:42px;border-radius:13px;background:linear-gradient(135deg,#6c4cff,#19b6ff);display:grid;place-items:center;color:white;font-weight:1000;box-shadow:0 10px 25px #6c4cff33}.card{background:#fffdfebf;border:1px solid var(--line);border-radius:20px;padding:18px;box-shadow:0 10px 35px #1d2a4d0d;margin-bottom:14px}.hero{background:linear-gradient(135deg,#6c4cff,#19b6ff);color:white;border:0}.hero h1{margin:0 0 7px;font-size:clamp(25px,6vw,42px)}.hero p{margin:0;opacity:.92}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.field label{display:block;font-size:13px;font-weight:800;margin:0 0 6px}.field input,.field select{width:100%;padding:12px;border:1px solid var(--line);border-radius:12px;background:#fff}.btn{padding:12px 15px;border-radius:13px;font-weight:900;background:#eef0f7;color:var(--ink)}.btn.primary{background:linear-gradient(135deg,#6c4cff,#19b6ff);color:white}.btn.ok{background:#16a34a;color:#fff}.btn.danger{background:#fee2e2;color:#991b1b}.btn:disabled{opacity:.55;cursor:not-allowed}.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.muted{color:var(--muted);font-size:13px}.amount{font-size:32px;font-weight:1000}.drop{border:2px dashed #bfc5da;border-radius:18px;padding:24px;text-align:center;background:#fafbff}.files{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-top:12px}.file{border:1px solid var(--line);border-radius:14px;padding:10px;background:white}.thumb{height:120px;border-radius:10px;background:#eef1f8;display:grid;place-items:center;overflow:hidden}.thumb img{width:100%;height:100%;object-fit:contain}.file b{display:block;margin-top:7px;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pill{display:inline-flex;padding:6px 9px;border-radius:999px;background:#eef2ff;font-weight:800;font-size:12px}.status{padding:13px;border-radius:14px;background:#f6f7fb;border:1px solid var(--line);font-weight:800}.status.ok{background:#ecfdf3;color:#166534}.status.wait{background:#fff7ed;color:#9a3412}.tablewrap{overflow:auto}.table{width:100%;border-collapse:collapse;min-width:780px}.table th,.table td{padding:10px;border-bottom:1px solid var(--line);text-align:left;font-size:13px}.table th{background:#fafbff}.hide{display:none!important}.print-area{background:white;color:black;padding:10mm}.print-page{break-after:page;page-break-after:always;display:flex;align-items:center;justify-content:center;min-height:260mm;overflow:hidden}.print-page img{max-width:100%;max-height:250mm;object-fit:contain}.print-page canvas{max-width:100%;max-height:250mm}.cleanup{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.cleanup .field input[type=range]{padding:0}.preview{background:#111827;border-radius:18px;padding:12px;overflow:auto}.preview canvas,.preview img{max-width:100%;display:block;margin:auto}.notice{padding:11px 13px;border-radius:12px;background:#eff6ff;color:#1e40af;font-size:13px}.small{font-size:12px}.link{color:#5142d8;font-weight:800;text-decoration:none}@media(max-width:700px){.grid,.cleanup{grid-template-columns:1fr}.wrap{padding:12px}.card{padding:14px}.top{align-items:flex-start}.table{min-width:700px}}@media print{body{background:#fff}.no-print{display:none!important}.print-area{padding:0}.print-page{min-height:auto;margin:0}.print-page img,.print-page canvas{max-height:none;max-width:100%;page-break-inside:avoid}}
`;

const CUSTOMER = `<!doctype html><html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PrintPay</title><style>${CSS}</style></head><body>
<div class="wrap no-print"><div class="top"><div class="brand"><div class="logo">P</div><div>PrintPay<div class="muted">Scan • Upload • Counter Print</div></div></div><a class="link" href="/owner">Owner</a></div>
<div class="card hero"><h1>Upload → Counter Payment → Print</h1><p>কোনো Desktop Software নেই। Mobile বা PC browser থেকেই পুরো কাজ হবে।</p></div>
<div class="card"><h3>1. Customer Details</h3><div class="grid"><div class="field"><label>নাম</label><input id="name" placeholder="Customer name"></div><div class="field"><label>Mobile</label><input id="mobile" inputmode="numeric" placeholder="10 digit mobile"></div></div></div>
<div class="card"><h3>2. Upload Documents</h3><div class="drop"><input id="files" type="file" accept="image/*,.pdf,application/pdf" multiple><div class="muted">Image / PDF • একসাথে অনেক file</div></div><div id="filesList" class="files"></div></div>
<div id="editCard" class="card hide"><h3>3. Preview & Cleanup</h3><div class="cleanup"><div class="field"><label>Brightness</label><input id="brightness" type="range" min="60" max="140" value="100"></div><div class="field"><label>Contrast</label><input id="contrast" type="range" min="60" max="160" value="100"></div><div class="field"><label>Scale</label><input id="scale" type="range" min="70" max="120" value="100"></div><div class="field"><label>Crop edges %</label><input id="crop" type="range" min="0" max="15" value="0"></div><div class="field"><label>Print mode</label><select id="mode"><option value="bw">Black & White</option><option value="color">Colour</option></select></div><div class="field"><label>Copies</label><input id="copies" type="number" min="1" value="1"></div></div><div class="row" style="margin-top:12px"><button class="btn" id="apply">Apply Preview</button><span class="muted">Preview-তে দেখে তারপর order পাঠান।</span></div><div id="preview" class="preview" style="margin-top:12px"></div></div>
<div class="card"><h3>4. Order</h3><div class="grid"><div><div class="muted">Estimated Amount</div><div id="amount" class="amount">₹0</div><div id="calc" class="muted">0 pages × 1 copy</div></div><div><div id="status" class="status">প্রথমে file upload করুন</div></div></div><div class="row" style="margin-top:14px"><button id="orderBtn" class="btn primary" disabled>📨 Send Order to Counter</button><button id="printBtn" class="btn ok hide">🖨️ Print Now</button></div><div class="notice" style="margin-top:12px">Payment online নয়। দোকানে টাকা দিন। Owner “Payment Received” চাপলেই আপনার browser-এ print screen খুলবে।</div></div>
<div id="printArea" class="print-area hide"></div></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs" type="module"></script>
<script>
const $=id=>document.getElementById(id);let files=[],orderId=null,paid=false,pdfjs=null;
const state={brightness:100,contrast:100,scale:100,crop:0,mode:'bw',copies:1}; const pageCache=new Map();
function money(n){return '₹'+Number(n||0).toFixed(0)}
function status(t,c=''){ $('status').textContent=t;$('status').className='status '+c }
async function countPages(){let n=0;for(const f of files){if(f.type==='application/pdf'){if(!pageCache.has(f))try{if(!pdfjs)pdfjs=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';const pdf=await pdfjs.getDocument({data:await f.arrayBuffer()}).promise;pageCache.set(f,pdf.numPages)}catch{pageCache.set(f,1)}n+=pageCache.get(f)}else n++}return n||0}
function showFiles(){ $('filesList').innerHTML=''; files.forEach((f,i)=>{const d=document.createElement('div');d.className='file';d.innerHTML='<div class="thumb">'+(f.type.startsWith('image/')?'<img src="'+URL.createObjectURL(f)+'">':'📄')+'</div><b>'+esc(f.name)+'</b><div class="muted">'+(f.type==='application/pdf'?'PDF':'Image')+'</div><button class="btn danger small" data-i="'+i+'">Remove</button>'; $('filesList').appendChild(d)});$('editCard').classList.toggle('hide',!files.length);$('orderBtn').disabled=!files.length}
function esc(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
$('files').onchange=e=>{files=[...files,...e.target.files];e.target.value='';showFiles();applyPreview();calc()};
$('filesList').onclick=e=>{const b=e.target.closest('[data-i]');if(b){files.splice(Number(b.dataset.i),1);showFiles();applyPreview();calc()}};
['brightness','contrast','scale','crop','mode','copies'].forEach(id=>$(id).oninput=()=>{state.brightness=+$('brightness').value;state.contrast=+$('contrast').value;state.scale=+$('scale').value;state.crop=+$('crop').value;state.mode=$('mode').value;state.copies=Math.max(1,+$('copies').value||1);applyPreview();calc()});
async function applyPreview(){const p=$('preview');p.innerHTML='';for(const f of files){if(f.type.startsWith('image/')){const im=new Image();im.src=URL.createObjectURL(f);await im.decode();const box=document.createElement('div');box.style.cssText='background:white;margin:8px;padding:10px;overflow:hidden;text-align:center';const img=document.createElement('img');img.src=im.src;img.style.filter='brightness('+state.brightness+'%) contrast('+state.contrast+'%)';img.style.transform='scale('+state.scale/100+')';img.style.clipPath='inset('+state.crop+'%)';if(state.mode==='bw')img.style.filter+=' grayscale(1)';box.appendChild(img);p.appendChild(box)}else{const d=document.createElement('div');d.className='notice';d.textContent=f.name+' — PDF page preview will be rendered for printing.';p.appendChild(d)}}}
async function calc(){try{const pg=await countPages();const r=await fetch('/api/public-settings');const s=await r.json();const base=state.mode==='color'?Number(s.price_color):Number(s.price_bw);let rate=base;if(state.copies>=25&&Number(s.tier_25)>0)rate=Number(s.tier_25);else if(state.copies>=10&&Number(s.tier_10)>0)rate=Number(s.tier_10);else if(state.copies>=5&&Number(s.tier_5)>0)rate=Number(s.tier_5);else if(Number(s.tier_1)>0)rate=Number(s.tier_1);let total=rate*pg*state.copies;total=Math.max(0,Math.round(total*(1-Number(s.global_discount||0)/100)+Number(s.delivery||0)));$('amount').textContent=money(total);$('calc').textContent=pg+' pages × '+state.copies+' copy × ₹'+rate+' + delivery/discount';return total}catch{$('amount').textContent='₹0';return 0}}
$('orderBtn').onclick=async()=>{const name=$('name').value.trim(),mobile=$('mobile').value.trim();if(!name||mobile.length<10)return alert('Name ও valid mobile দিন।');if(!files.length)return alert('File upload করুন।');const amount=await calc();const r=await fetch('/api/order/create',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({customer_name:name,mobile,pages:await countPages(),copies:state.copies,print_mode:state.mode,paper:'A4',amount:amount,file_count:files.length})});const j=await r.json();if(!j.ok)return alert(j.error||'Order failed');orderId=j.order_id;localStorage.setItem('printpay_order',orderId);$('orderBtn').disabled=true;status('Order counter-এ গেছে। দোকানে cash payment দিন।','wait');poll()};
async function poll(){if(!orderId)return;try{const r=await fetch('/api/order/status?id='+encodeURIComponent(orderId));const j=await r.json();if(j.ok){const o=j.order;if(o.payment_status==='PAID'&&!paid){paid=true;status('Payment Received ✓ — Print screen খুলছে…','ok');$('printBtn').classList.remove('hide');setTimeout(startPrint,500)}else if(o.payment_status!=='PAID')status('Order '+orderId+' • Counter-এ payment অপেক্ষা করছে।','wait')}}catch{}if(!paid)setTimeout(poll,1000)}
async function startPrint(){buildPrintArea();window.scrollTo({top:0,behavior:'smooth'});setTimeout(()=>window.print(),350)}
async function buildPrintArea(){const area=$('printArea');area.innerHTML='';area.classList.remove('hide');for(const f of files){if(f.type.startsWith('image/')){const pg=document.createElement('div');pg.className='print-page';const im=document.createElement('img');im.src=URL.createObjectURL(f);im.style.filter='brightness('+state.brightness+'%) contrast('+state.contrast+'%)';im.style.transform='scale('+state.scale/100+')';if(state.crop)im.style.clipPath='inset('+state.crop+'%)';if(state.mode==='bw')im.style.filter+=' grayscale(1)';pg.appendChild(im);area.appendChild(pg)}else{try{if(!pdfjs)pdfjs=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';const buf=await f.arrayBuffer();const pdf=await pdfjs.getDocument({data:buf}).promise;for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n);const vp=page.getViewport({scale:1.5});const c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;const pg=document.createElement('div');pg.className='print-page';pg.appendChild(c);area.appendChild(pg)}}catch{const pg=document.createElement('div');pg.className='print-page';pg.innerHTML='<p>PDF preview could not load. Use browser PDF print for '+esc(f.name)+'</p>';area.appendChild(pg)}}}}
$('printBtn').onclick=startPrint;
</script></body></html>`;

const OWNER = `<!doctype html><html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PrintPay Owner</title><style>${CSS}</style></head><body><div class="wrap no-print"><div class="top"><div class="brand"><div class="logo">P</div>PrintPay Owner</div><a class="link" href="/">Customer</a></div><div id="login" class="card"><h2>Owner Login</h2><div class="grid"><div class="field"><label>Username</label><input id="u" value="owner"></div><div class="field"><label>Password</label><input id="p" type="password"></div></div><button id="loginBtn" class="btn primary" style="margin-top:12px">Login</button><div id="loginMsg" class="muted" style="margin-top:8px"></div></div><div id="panel" class="hide"><div class="card"><div class="top"><div><h2 style="margin:0">Counter Orders</h2><div class="muted">Mobile/PC browser only • কোনো desktop software লাগবে না</div></div><div class="row"><button id="voice" class="btn">🔊 Voice ON</button><button id="logout" class="btn">Logout</button></div></div><div class="tablewrap"><table class="table"><thead><tr><th>Time</th><th>Order</th><th>Customer</th><th>Mobile</th><th>Pages</th><th>Copies</th><th>Mode</th><th>Amount</th><th>Payment</th><th>Action</th></tr></thead><tbody id="rows"></tbody></table></div></div><div class="card"><h3>Pricing Settings</h3><div class="grid"><div class="field"><label>B&W ₹ / page</label><input id="bw" type="number" step="0.01"></div><div class="field"><label>Colour ₹ / page</label><input id="color" type="number" step="0.01"></div><div class="field"><label>Discount %</label><input id="disc" type="number" step="0.1"></div><div class="field"><label>Delivery ₹</label><input id="del" type="number" step="0.01"></div><div class="field"><label>1+ rate</label><input id="t1" type="number" step="0.01"></div><div class="field"><label>5+ rate</label><input id="t5" type="number" step="0.01"></div><div class="field"><label>10+ rate</label><input id="t10" type="number" step="0.01"></div><div class="field"><label>25+ rate</label><input id="t25" type="number" step="0.01"></div></div><button id="save" class="btn primary" style="margin-top:12px">Save Settings</button><span id="saved" class="muted"></span></div></div></div>
<script>
const $=id=>document.getElementById(id);let voice=true,lastIds=new Set();function money(n){return '₹'+Number(n||0).toFixed(0)}
async function login(){const r=await fetch('/api/owner/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:$('u').value,password:$('p').value})});const j=await r.json();if(!j.ok){$('loginMsg').textContent=j.error||'Login failed';return}$('login').classList.add('hide');$('panel').classList.remove('hide');loadSettings();loadOrders()}
$('loginBtn').onclick=login;$('p').onkeydown=e=>{if(e.key==='Enter')login()};$('logout').onclick=async()=>{await fetch('/api/owner/logout');location.reload()};$('voice').onclick=()=>{voice=!voice;$('voice').textContent=voice?'🔊 Voice ON':'🔇 Voice OFF'};
async function loadSettings(){const r=await fetch('/api/owner/settings');const s=await r.json();$('bw').value=s.price_bw;$('color').value=s.price_color;$('disc').value=s.global_discount;$('del').value=s.delivery;$('t1').value=s.tier_1;$('t5').value=s.tier_5;$('t10').value=s.tier_10;$('t25').value=s.tier_25}
$('save').onclick=async()=>{await fetch('/api/owner/settings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({price_bw:$('bw').value,price_color:$('color').value,global_discount:$('disc').value,delivery:$('del').value,tier_1:$('t1').value,tier_5:$('t5').value,tier_10:$('t10').value,tier_25:$('t25').value})});$('saved').textContent=' Saved ✓';setTimeout(()=>$('saved').textContent='',1500)};
async function loadOrders(){const r=await fetch('/api/owner/orders');if(r.status===401){location.reload();return}const a=await r.json();$('rows').innerHTML='';for(const o of a){const tr=document.createElement('tr');const paid=o.payment_status==='PAID';tr.innerHTML='<td>'+new Date(o.created_at).toLocaleString()+'</td><td><b>'+o.id+'</b></td><td>'+esc(o.customer_name)+'</td><td>'+esc(o.mobile)+'</td><td>'+o.pages+'</td><td>'+o.copies+'</td><td>'+o.print_mode+'</td><td>'+money(o.amount_paise/100)+'</td><td>'+o.payment_status+'</td><td><div class="row">'+(paid?'<span class="pill">Paid</span>':'<button class="btn ok" data-paid="'+o.id+'">Payment Received</button>')+'<button class="btn danger" data-del="'+o.id+'">Delete</button></div></td>';$('rows').appendChild(tr);if(!lastIds.has(o.id)&&voice){speechSynthesis.cancel();const u=new SpeechSynthesisUtterance('গ্রাহক '+o.customer_name+' এর order এসেছে। '+money(o.amount_paise/100)+' টাকা সংগ্রহ করুন।');u.lang='bn-IN';speechSynthesis.speak(u)}lastIds.add(o.id)} }
function esc(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]) )}
$('rows').onclick=async e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.paid){await fetch('/api/owner/cash-paid',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({order_id:b.dataset.paid})});loadOrders()}if(b.dataset.del){if(confirm('Delete this order?')){await fetch('/api/owner/orders/'+encodeURIComponent(b.dataset.del),{method:'DELETE'});loadOrders()}}};
setInterval(()=>{if(!$('panel').classList.contains('hide'))loadOrders()},1000);
</script></body></html>`;

export default {async fetch(req,env){
  try{
    await ensure(env);
    const u=new URL(req.url),p=u.pathname;
    if(p==='/api/health') return json({ok:true,service:'PrintPay Web Only',storage:'browser-only',time:now()});
    if(p==='/api/public-settings') return json(await settings(env));
    if(p==='/api/owner/login'&&req.method==='POST'){
      if(!env.ADMIN_INITIAL_PASSWORD)return json({ok:false,error:'ADMIN_INITIAL_PASSWORD is not configured in Worker Variables & Secrets.'},503);
      const b=await req.json(); if(String(b.username||'')!=='owner'||String(b.password||'')!==env.ADMIN_INITIAL_PASSWORD)return json({ok:false,error:'Invalid login'},401);
      return json({ok:true},200,{'Set-Cookie':await sessionCookie(env)});
    }
    if(p==='/api/owner/logout')return json({ok:true},200,{'Set-Cookie':'pp_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'});
    if(p==='/api/owner/settings'&&req.method==='GET'){if(!await isOwner(req,env))return json({ok:false,error:'Unauthorized'},401);return json(await settings(env));}
    if(p==='/api/owner/settings'&&req.method==='POST'){if(!await isOwner(req,env))return json({ok:false,error:'Unauthorized'},401);const b=await req.json();for(const [k,v] of Object.entries(b)){if(['price_bw','price_color','global_discount','delivery','tier_1','tier_5','tier_10','tier_25'].includes(k))await env.DB.prepare('INSERT OR REPLACE INTO settings(key,value,updated_at) VALUES(?,?,?)').bind(k,String(v),now()).run()}return json({ok:true});}
    if(p==='/api/owner/orders'&&req.method==='GET'){if(!await isOwner(req,env))return json({ok:false,error:'Unauthorized'},401);const r=await env.DB.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 1000').all();return json(r.results);}
    if(p==='/api/owner/orders/'&&req.method==='DELETE')return json({ok:false,error:'Order ID required'},400);
    if(p.startsWith('/api/owner/orders/')&&req.method==='DELETE'){if(!await isOwner(req,env))return json({ok:false,error:'Unauthorized'},401);const id=decodeURIComponent(p.slice('/api/owner/orders/'.length));await env.DB.prepare('DELETE FROM orders WHERE id=?').bind(id).run();return json({ok:true});}
    if(p==='/api/owner/cash-paid'&&req.method==='POST'){if(!await isOwner(req,env))return json({ok:false,error:'Unauthorized'},401);const b=await req.json(),id=String(b.order_id||'');const r=await env.DB.prepare('SELECT id,payment_status FROM orders WHERE id=?').bind(id).first();if(!r)return json({ok:false,error:'Order not found'},404);await env.DB.prepare("UPDATE orders SET payment_status='PAID',order_status='READY',updated_at=? WHERE id=?").bind(now(),id).run();return json({ok:true,order_id:id});}
    if(p==='/api/order/create'&&req.method==='POST'){
      const b=await req.json(),name=String(b.customer_name||'').trim(),mobile=String(b.mobile||'').trim();if(!name||mobile.length<10)return json({ok:false,error:'Name and valid mobile required'},400);
      const s=await settings(env),pages=Math.max(1,Number(b.pages||1)),copies=Math.max(1,Number(b.copies||1)),mode=b.print_mode==='color'?'color':'bw';
      const base=mode==='color'?Number(s.price_color):Number(s.price_bw);let rate=base;if(copies>=25&&Number(s.tier_25)>0)rate=Number(s.tier_25);else if(copies>=10&&Number(s.tier_10)>0)rate=Number(s.tier_10);else if(copies>=5&&Number(s.tier_5)>0)rate=Number(s.tier_5);else if(copies>=1&&Number(s.tier_1)>0)rate=Number(s.tier_1);
      let total=rate*pages*copies;total=Math.max(0,Math.round(total*(1-Number(s.global_discount||0)/100)+Number(s.delivery||0)));
      const id='PP-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomUUID().slice(0,6).toUpperCase();
      await env.DB.prepare(`INSERT INTO orders(id,customer_name,mobile,pages,copies,print_mode,paper,amount_paise,payment_method,payment_status,order_status,file_count,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,name,mobile,pages,copies,mode,String(b.paper||'A4'),total*100,'cash','PENDING','PENDING',Math.max(0,Number(b.file_count||0)),now(),now()).run();
      return json({ok:true,order_id:id,amount:total});
    }
    if(p==='/api/order/status'){const id=u.searchParams.get('id');const r=await env.DB.prepare('SELECT id,customer_name,mobile,pages,copies,print_mode,paper,amount_paise,payment_status,order_status,created_at,updated_at FROM orders WHERE id=?').bind(id).first();if(!r)return json({ok:false,error:'Not found'},404);return json({ok:true,order:r});}
    if(p==='/owner')return new Response(OWNER,{headers:{'content-type':'text/html; charset=utf-8'}});
    return new Response(CUSTOMER,{headers:{'content-type':'text/html; charset=utf-8'}});
  }catch(e){return json({ok:false,error:e?.message||String(e)},500)}
}};
