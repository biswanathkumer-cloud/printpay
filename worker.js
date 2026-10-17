const te = new TextEncoder();
function json(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8',...extra}})}
function now(){return new Date().toISOString()}
function b64(buf){return btoa(String.fromCharCode(...new Uint8Array(buf)))}
async function hmac(secret,text){const k=await crypto.subtle.importKey('raw',te.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);return b64(await crypto.subtle.sign('HMAC',k,te.encode(text)))}
async function sha256hex(text){const d=await crypto.subtle.digest('SHA-256',te.encode(text));return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function pbkdf2(password,salt){const k=await crypto.subtle.importKey('raw',te.encode(password),'PBKDF2',false,['deriveBits']);return b64(await crypto.subtle.deriveBits({name:'PBKDF2',salt:te.encode(salt),iterations:100000,hash:'SHA-256'},k,256))}
async function ensureSchema(env){
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS owners(id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,password_salt TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL)').run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,customer_name TEXT NOT NULL,mobile TEXT NOT NULL,pages INTEGER NOT NULL DEFAULT 1,copies INTEGER NOT NULL DEFAULT 1,print_mode TEXT NOT NULL DEFAULT 'bw',paper TEXT NOT NULL DEFAULT 'A4',amount_paise INTEGER NOT NULL DEFAULT 0,payment_method TEXT NOT NULL DEFAULT 'cash',payment_status TEXT NOT NULL DEFAULT 'PENDING',order_status TEXT NOT NULL DEFAULT 'PENDING',file_key TEXT,upload_token_hash TEXT,utr TEXT,notes TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)").run();
}
async function ensureSettings(env){const d={business_name:'PrintPay',price_bw:'2',price_color:'8',delivery:'0',logo_url:'/printpay-logo.svg',global_discount:'0',tier_1:'0',tier_5:'0',tier_10:'0',tier_25:'0',voice_enabled:'1',voice_message:'গ্রাহক আপনাকে প্রিন্ট করার জন্য ফাইল পাঠিয়েছে। ₹{amount} টাকা সংগ্রহ করে প্রিন্ট করে দিন।',bw_a4_1:'2',bw_a4_2:'4',bw_a4_4:'6',bw_a4_5:'7',bw_a4_6:'8',bw_a4_9:'10',bw_a4_10:'12',bw_a4_12:'14',color_a4_1:'8',color_a4_2:'16',color_a4_4:'24',color_a4_5:'28',color_a4_6:'32',color_a4_9:'40',color_a4_10:'44',color_a4_12:'50'};for(const [k,v] of Object.entries(d))await env.DB.prepare('INSERT OR IGNORE INTO settings(key,value,updated_at) VALUES(?,?,?)').bind(k,v,now()).run()}
async function initOwner(env){
  await ensureSchema(env); await ensureSettings(env);
  const r=await env.DB.prepare("SELECT id FROM owners WHERE username='owner'").first();
  if(!r && !env.ADMIN_INITIAL_PASSWORD) return;
  if(!r && env.ADMIN_INITIAL_PASSWORD){
    const initial=String(env.ADMIN_INITIAL_PASSWORD),salt=crypto.randomUUID(),hash=await pbkdf2(initial,salt);
    await env.DB.prepare("INSERT INTO owners(username,password_hash,password_salt,created_at,updated_at) VALUES('owner',?,?,?,?)").bind(hash,salt,now(),now()).run();
  }
}
async function makeSession(env){const secret=env.SESSION_SECRET||env.ADMIN_INITIAL_PASSWORD;const payload=`${Date.now()}.${crypto.randomUUID()}`;const sig=await hmac(secret,payload);return `pp_session=${encodeURIComponent(payload+'.'+sig)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`}
async function isOwner(req,env){const c=req.headers.get('Cookie')||'';const m=c.match(/(?:^|;\s*)pp_session=([^;]+)/);if(!m)return false;const secret=env.SESSION_SECRET||env.ADMIN_INITIAL_PASSWORD;const raw=decodeURIComponent(m[1]);const p=raw.split('.');if(p.length<3)return false;const payload=p.slice(0,2).join('.'),sig=p.slice(2).join('.');const ts=Number(p[0]);if(!ts||Date.now()-ts>86400000)return false;return (await hmac(secret,payload))===sig}
async function settings(env){await ensureSettings(env);const rs=await env.DB.prepare('SELECT key,value FROM settings').all();const o={};for(const r of rs.results)o[r.key]=r.value;const defaults={business_name:'PrintPay',price_bw:'2',price_color:'8',delivery:'0',logo_url:'/printpay-logo.svg',global_discount:'0',tier_1:'0',tier_5:'0',tier_10:'0',tier_25:'0',voice_enabled:'1',voice_message:'গ্রাহক আপনাকে প্রিন্ট করার জন্য ফাইল পাঠিয়েছে। ₹{amount} টাকা সংগ্রহ করে প্রিন্ট করে দিন।',bw_a4_1:'2',bw_a4_2:'4',bw_a4_4:'6',bw_a4_5:'7',bw_a4_6:'8',bw_a4_9:'10',bw_a4_10:'12',bw_a4_12:'14',color_a4_1:'8',color_a4_2:'16',color_a4_4:'24',color_a4_5:'28',color_a4_6:'32',color_a4_9:'40',color_a4_10:'44',color_a4_12:'50'};for(const[k,v]of Object.entries(defaults))if(o[k]===undefined||String(o[k]).trim()==='')o[k]=v;return o}
async function publicSettings(env){return await settings(env)}
async function markPaid(env,id){await env.DB.prepare("UPDATE orders SET payment_status='PAID',order_status='READY',updated_at=? WHERE id=?").bind(now(),id).run()}

export default {async fetch(req,env){try{await initOwner(env);const u=new URL(req.url),p=u.pathname;
if(p==='/api/health')return json({ok:true,service:'PrintPay',storage:'temporary-files-only',time:now()});
if(p==='/api/public-settings')return json(await publicSettings(env));
if(p==='/api/owner/login'&&req.method==='POST'){
 const b=await req.json(),username=String(b.username||'').trim(),password=String(b.password||'');
 if(username!=='owner'||!password)return json({ok:false,error:'Owner username/password দিন।'},401);
 if(!env.ADMIN_INITIAL_PASSWORD)return json({ok:false,error:'ADMIN_INITIAL_PASSWORD Cloudflare Secret-এ set করা হয়নি। Default password নেই।'},503);
 let row=await env.DB.prepare('SELECT * FROM owners WHERE username=?').bind(username).first(),valid=false;
 if(row)valid=(await pbkdf2(password,row.password_salt))===row.password_hash;
 if(password===String(env.ADMIN_INITIAL_PASSWORD)){
   const salt=crypto.randomUUID(),hash=await pbkdf2(password,salt);
   if(row)await env.DB.prepare('UPDATE owners SET password_hash=?,password_salt=?,updated_at=? WHERE username=?').bind(hash,salt,now(),username).run();
   else await env.DB.prepare("INSERT INTO owners(username,password_hash,password_salt,created_at,updated_at) VALUES('owner',?,?,?,?)").bind(hash,salt,now(),now()).run();
   valid=true;
 }
 if(!valid)return json({ok:false,error:'Owner password ভুল।'},401);
 return json({ok:true},200,{'Set-Cookie':await makeSession(env)});
}
if(p==='/api/owner/logout' )return json({ok:true},200,{'Set-Cookie':'pp_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'});
if(p==='/api/owner/settings'&&req.method==='GET'){if(!await isOwner(req,env))return json({ok:false,error:'Unauthorized'},401);return json(await settings(env))}
if(p==='/api/owner/settings'&&req.method==='POST'){if(!await isOwner(req,env))return json({ok:false,error:'Unauthorized'},401);const b=await req.json();for(const[k,v]of Object.entries(b)){if(k==='session')continue;await env.DB.prepare('INSERT OR REPLACE INTO settings(key,value,updated_at) VALUES(?,?,?)').bind(k,String(v??''),now()).run()}return json({ok:true,settings:await settings(env)})}
if(p==='/api/owner/orders'&&req.method==='GET'){if(!await isOwner(req,env))return json({ok:false,error:'Unauthorized'},401);const rs=await env.DB.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 1000').all();return json(rs.results)}
if(p.startsWith('/api/owner/orders/')&&req.method==='DELETE'){if(!await isOwner(req,env))return json({ok:false,error:'Unauthorized'},401);const id=decodeURIComponent(p.slice('/api/owner/orders/'.length));if(!id)return json({ok:false,error:'Order ID required'},400);const stub=env.PRINT_ROOM.get(env.PRINT_ROOM.idFromName('print-files'));await stub.fetch('https://print-files/delete-order',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({order_id:id})});await env.DB.prepare('DELETE FROM orders WHERE id=?').bind(id).run();return json({ok:true,deleted:id})}
if(p==='/api/owner/cash-paid'&&req.method==='POST'){if(!await isOwner(req,env))return json({ok:false,error:'Unauthorized'},401);const b=await req.json();const id=String(b.order_id||'');if(!id)return json({ok:false,error:'Order ID required'},400);const row=await env.DB.prepare("SELECT id,amount_paise,payment_status FROM orders WHERE id=? AND payment_method='cash'").bind(id).first();if(!row)return json({ok:false,error:'Cash order not found'},404);if(row.payment_status!=='PAID')await markPaid(env,id);return json({ok:true,order_id:id,amount:Number(row.amount_paise||0)/100,payment_status:'PAID',order_status:'READY'})}
if(p==='/api/order/status'&&req.method==='GET'){const id=String(u.searchParams.get('id')||'');if(!id)return json({ok:false,error:'Order ID required'},400);const row=await env.DB.prepare('SELECT id,payment_status,order_status,amount_paise,pages,copies,print_mode,paper FROM orders WHERE id=?').bind(id).first();if(!row)return json({ok:false,error:'Order not found'},404);return json({ok:true,order:row})}
if(p==='/api/order/create'&&req.method==='POST'){
 const b=await req.json(),name=String(b.customer_name||'').trim(),mobile=String(b.mobile||'').trim();
 if(!name||mobile.length<10)return json({ok:false,error:'Name and valid mobile required'},400);
 const s=await settings(env),copies=Math.max(1,Math.floor(Number(b.copies||1))),slots=[1,2,4,5,6,9,10,12].includes(Number(b.layout_slots))?Number(b.layout_slots):4;
 const items=Array.isArray(b.items)?b.items:[];if(!items.length)return json({ok:false,error:'At least one file is required'},400);
 const groups={bw:{pages:0,sheets:0,rate:0,amount:0},color:{pages:0,sheets:0,rate:0,amount:0}};
 for(const it of items){const m=it&&it.mode==='color'?'color':'bw';groups[m].pages+=Math.max(1,Number(it.pages||1))}
 for(const m of ['bw','color']){
  const exact=Number(s[`${m}_a4_${slots}`]||0);let rate=exact;
  if(rate<=0){rate=Number(s[m==='color'?'price_color':'price_bw']||0);if(copies>=25&&Number(s.tier_25)>0)rate=Number(s.tier_25);else if(copies>=10&&Number(s.tier_10)>0)rate=Number(s.tier_10);else if(copies>=5&&Number(s.tier_5)>0)rate=Number(s.tier_5);else if(copies>=1&&Number(s.tier_1)>0)rate=Number(s.tier_1)}
  groups[m].rate=rate;groups[m].sheets=groups[m].pages?Math.ceil(groups[m].pages/slots):0;groups[m].amount=groups[m].sheets*rate*copies;
 }
 const subtotal=groups.bw.amount+groups.color.amount,discount=Math.max(0,Math.min(100,Number(s.global_discount||0))),delivery=Number(s.delivery||0),total=Math.max(0,Math.round((subtotal*(1-discount/100)+delivery)*100)/100);
 const id='PP-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomUUID().slice(0,6).toUpperCase();
 const upload_token=crypto.randomUUID()+crypto.randomUUID(); const upload_token_hash=await sha256hex(upload_token);
 const notes=JSON.stringify({slots,copies,discount,delivery,sheets:groups.bw.sheets+groups.color.sheets,bw:groups.bw,color:groups.color,items:items.map(x=>({name:String(x.name||''),type:String(x.type||''),pages:Math.max(1,Number(x.pages||1)),mode:x.mode==='color'?'color':'bw'}))});
 await env.DB.prepare(`INSERT INTO orders(id,customer_name,mobile,pages,copies,print_mode,paper,amount_paise,payment_method,payment_status,order_status,created_at,updated_at,upload_token_hash,utr,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,name,mobile,groups.bw.pages+groups.color.pages,copies,(groups.bw.pages&&groups.color.pages)?'mixed':(groups.color.pages?'color':'bw'),String(b.paper||'A4'),Math.round(total*100),'cash','PENDING','PENDING',now(),now(),upload_token_hash,' ',notes).run();
 return json({ok:true,order_id:id,upload_token,amount:total,breakdown:groups});
}

if(p==='/api/order/files/upload'&&req.method==='POST'){
 const b=await req.json();const id=String(b.order_id||''),token=String(b.upload_token||''),fileId=String(b.file_id||'');
 const row=await env.DB.prepare('SELECT id,upload_token_hash FROM orders WHERE id=?').bind(id).first();
 if(!row||!row.upload_token_hash||!(await sha256hex(token)===row.upload_token_hash))return json({ok:false,error:'Invalid upload token'},403);
 if(!fileId||!/^[a-zA-Z0-9_-]{1,80}$/.test(fileId)||typeof b.data!=='string'||!b.data)return json({ok:false,error:'Invalid file'},400);
 const stub=env.PRINT_ROOM.get(env.PRINT_ROOM.idFromName('print-files'));
 await stub.fetch('https://print-files/put-file',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({order_id:id,file_id:fileId,name:String(b.name||fileId),type:String(b.type||'application/octet-stream'),size:Number(b.size||0),mode:b.mode==='color'?'color':'bw',pages:Math.max(1,Number(b.pages||1)),data:b.data})});
 return json({ok:true,file_id:fileId});
}
if(p==='/api/owner/order-files'&&req.method==='GET'){
 if(!await isOwner(req,env))return json({ok:false,error:'Unauthorized'},401);
 const id=String(u.searchParams.get('order_id')||'');if(!id)return json({ok:false,error:'Order ID required'},400);
 const stub=env.PRINT_ROOM.get(env.PRINT_ROOM.idFromName('print-files'));const r=await stub.fetch('https://print-files/list-files?order_id='+encodeURIComponent(id));return new Response(r.body,r);
}
if(p==='/api/owner/order-file'&&req.method==='GET'){
 if(!await isOwner(req,env))return json({ok:false,error:'Unauthorized'},401);
 const id=String(u.searchParams.get('order_id')||''),fid=String(u.searchParams.get('file_id')||'');if(!id||!fid)return json({ok:false,error:'File required'},400);
 const stub=env.PRINT_ROOM.get(env.PRINT_ROOM.idFromName('print-files'));return stub.fetch('https://print-files/get-file?order_id='+encodeURIComponent(id)+'&file_id='+encodeURIComponent(fid));
}
if(p==='/api/owner/order-files/delete'&&req.method==='POST'){
 if(!await isOwner(req,env))return json({ok:false,error:'Unauthorized'},401);
 const b=await req.json();const id=String(b.order_id||''),fid=String(b.file_id||'');if(!id)return json({ok:false,error:'Order ID required'},400);
 const stub=env.PRINT_ROOM.get(env.PRINT_ROOM.idFromName('print-files'));const r=await stub.fetch('https://print-files/delete-file',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({order_id:id,file_id:fid})});return new Response(r.body,r);
}
if(p==='/api/owner/order-files/delete-all'&&req.method==='POST'){
 if(!await isOwner(req,env))return json({ok:false,error:'Unauthorized'},401);
 const b=await req.json();const id=String(b.order_id||'');if(!id)return json({ok:false,error:'Order ID required'},400);
 const stub=env.PRINT_ROOM.get(env.PRINT_ROOM.idFromName('print-files'));const r=await stub.fetch('https://print-files/delete-order',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({order_id:id})});return new Response(r.body,r);
}
return env.ASSETS.fetch(req);
}catch(e){return json({ok:false,error:e?.message||String(e)},500)}}};

export class PrintRoom {
  constructor(state){this.state=state;this.ready=this.state.storage.get('files_meta').then(x=>this.meta=x||{})}
  async save(){await this.state.storage.put('files_meta',this.meta)}
  async putChunks(key,b64){const size=100000;let i=0;for(;i<b64.length;i+=size)await this.state.storage.put(key+':'+(i/size),b64.slice(i,i+size));return Math.ceil(b64.length/size)}
  async delChunks(key,chunks){for(let i=0;i<(chunks||0);i++)await this.state.storage.delete(key+':'+i)}
  async getChunks(key,chunks){let s='';for(let i=0;i<chunks;i++)s+=await this.state.storage.get(key+':'+i);return s}
  async fetch(req){await this.ready;const u=new URL(req.url),p=u.pathname;
    if(p==='/put-file'&&req.method==='POST'){
      const b=await req.json(),id=String(b.order_id||''),fid=String(b.file_id||'');if(!id||!fid||typeof b.data!=='string')return json({ok:false,error:'Invalid file'},400);
      const key='f:'+id+':'+fid;const old=this.meta[key];if(old)await this.delChunks(key,old.chunks);
      const chunks=await this.putChunks(key,b.data);this.meta[key]={order_id:id,file_id:fid,name:String(b.name||fid),type:String(b.type||'application/octet-stream'),size:Number(b.size||0),mode:b.mode==='color'?'color':'bw',pages:Math.max(1,Number(b.pages||1)),chunks,created:Date.now(),expires:Date.now()+86400000};await this.save();return json({ok:true});
    }
    if(p==='/list-files'){
      const id=String(u.searchParams.get('order_id')||''),files=[];for(const [k,v] of Object.entries(this.meta)){if(v?.order_id===id&&v.file_id){if(v.expires<Date.now()){await this.delChunks(k,v.chunks);delete this.meta[k];continue}files.push({file_id:v.file_id,name:v.name,type:v.type,size:v.size,mode:v.mode,pages:v.pages})}}await this.save();return json({ok:true,files});
    }
    if(p==='/get-file'){
      const id=String(u.searchParams.get('order_id')||''),fid=String(u.searchParams.get('file_id')||''),key='f:'+id+':'+fid,v=this.meta[key];if(!v)return json({ok:false,error:'File not found'},404);if(v.expires<Date.now()){await this.delChunks(key,v.chunks);delete this.meta[key];await this.save();return json({ok:false,error:'Temporary file expired'},410)}const data=await this.getChunks(key,v.chunks);const bin=atob(data),out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return new Response(out,{headers:{'content-type':v.type||'application/octet-stream','content-disposition':`inline; filename="${encodeURIComponent(v.name)}"`,'cache-control':'no-store'}});
    }
    if(p==='/delete-file'&&req.method==='POST'){
      const b=await req.json(),id=String(b.order_id||''),fid=String(b.file_id||''),key='f:'+id+':'+fid,v=this.meta[key];if(v){await this.delChunks(key,v.chunks);delete this.meta[key];await this.save()}return json({ok:true});
    }
    if(p==='/delete-order'&&req.method==='POST'){
      const b=await req.json(),id=String(b.order_id||'');for(const [k,v] of Object.entries(this.meta)){if(v?.order_id===id){await this.delChunks(k,v.chunks);delete this.meta[k]}}await this.save();return json({ok:true});
    }
    return json({ok:false,error:'Not found'},404);
  }
}