const te = new TextEncoder();
const td = new TextDecoder();

function json(data, status=200, extra={}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {'content-type':'application/json; charset=utf-8', ...extra}
  });
}
function now(){ return new Date().toISOString(); }
function b64(buf){ return btoa(String.fromCharCode(...new Uint8Array(buf))); }
function unb64(s){ return Uint8Array.from(atob(s), c=>c.charCodeAt(0)); }

async function sha256(text){
  const h=await crypto.subtle.digest('SHA-256', te.encode(text));
  return b64(h);
}
async function hmac(secret,text){
  const key=await crypto.subtle.importKey('raw',te.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return b64(await crypto.subtle.sign('HMAC',key,te.encode(text)));
}
async function pbkdf2(password,salt){
  const key=await crypto.subtle.importKey('raw',te.encode(password),'PBKDF2',false,['deriveBits']);
  return b64(await crypto.subtle.deriveBits({name:'PBKDF2',salt:te.encode(salt),iterations:100000,hash:'SHA-256'},key,256));
}
async function ensureSettings(env){
  const defaults={
    business_name:'PrintPay',price_bw:'2',price_color:'8',delivery:'0',upi_qr:'',
    logo_url:'',global_discount:'0',tier_1:'0',tier_5:'0',tier_10:'0',tier_25:'0'
  };
  for(const [k,v] of Object.entries(defaults)){
    await env.DB.prepare("INSERT OR IGNORE INTO settings(key,value,updated_at) VALUES(?,?,?)")
      .bind(k,v,now()).run();
  }
}
async function initOwner(env){
  await ensureSettings(env);
  const row=await env.DB.prepare("SELECT id FROM owners WHERE username='owner'").first();
  if(row) return;
  if(!env.ADMIN_INITIAL_PASSWORD) return;
  const salt=crypto.randomUUID();
  const hash=await pbkdf2(env.ADMIN_INITIAL_PASSWORD,salt);
  await env.DB.prepare("INSERT INTO owners(username,password_hash,password_salt,created_at,updated_at) VALUES('owner',?,?,?,?,?)")
    .bind(hash,salt,now(),now()).run();
}
async function sessionCookie(env){
  const token=crypto.randomUUID()+crypto.randomUUID();
  const digest=await sha256(token);
  await env.DB.prepare("INSERT OR REPLACE INTO settings(key,value,updated_at) VALUES('session_'+?, ?, ?)")
    .bind(digest, token, now()).run();
  return `pp_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`;
}
async function isOwner(req,env){
  const cookie=req.headers.get('Cookie')||'';
  const m=cookie.match(/(?:^|;\s*)pp_session=([^;]+)/);
  if(!m) return false;
  const token=m[1];
  const digest=await sha256(token);
  const row=await env.DB.prepare("SELECT value FROM settings WHERE key=?").bind('session_'+digest).first();
  return !!row && row.value===token;
}
async function settings(env){
  await ensureSettings(env);
  const rs=await env.DB.prepare("SELECT key,value FROM settings").all();
  const out={};
  for(const r of rs.results) if(!r.key.startsWith('session_')) out[r.key]=r.value;
  return out;
}
function money(p){ return Math.round(Number(p||0)); }
async function markPaid(env,orderId,paymentId=null){
  await env.DB.prepare("UPDATE orders SET payment_status='PAID',order_status='READY',razorpay_payment_id=COALESCE(?,razorpay_payment_id),updated_at=? WHERE id=?")
    .bind(paymentId,now(),orderId).run();
}

export default {
  async fetch(req,env){
    try{
      await initOwner(env);
      const u=new URL(req.url);
      const path=u.pathname;

      if(path==='/api/health') return json({ok:true,service:'PrintPay',time:now()});
      if(path==='/api/public-settings') return json(await settings(env));

      if(path==='/api/owner/login' && req.method==='POST'){
        const b=await req.json();
        const row=await env.DB.prepare("SELECT * FROM owners WHERE username=?").bind(String(b.username||'')).first();
        if(!row || !b.password) return json({ok:false,error:'Invalid login'},401);
        const hash=await pbkdf2(b.password,row.password_salt);
        if(hash!==row.password_hash) return json({ok:false,error:'Invalid login'},401);
        return json({ok:true},{'Set-Cookie':await sessionCookie(env)});
      }
      if(path==='/api/owner/logout'){
        return json({ok:true},{'Set-Cookie':'pp_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'});
      }
      if(path==='/api/owner/settings' && req.method==='GET'){
        if(!await isOwner(req,env)) return json({ok:false,error:'Unauthorized'},401);
        return json(await settings(env));
      }
      if(path==='/api/owner/settings' && req.method==='POST'){
        if(!await isOwner(req,env)) return json({ok:false,error:'Unauthorized'},401);
        const b=await req.json();
        for(const [k,v] of Object.entries(b)){
          if(k.startsWith('session_')) continue;
          await env.DB.prepare("INSERT OR REPLACE INTO settings(key,value,updated_at) VALUES(?,?,?)").bind(k,String(v??''),now()).run();
        }
        return json({ok:true,settings:await settings(env)});
      }
      if(path==='/api/owner/orders'){
        if(!await isOwner(req,env)) return json({ok:false,error:'Unauthorized'},401);
        const rs=await env.DB.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 500").all();
        return json(rs.results);
      }
      if(path==='/api/owner/cash-paid' && req.method==='POST'){
        if(!await isOwner(req,env)) return json({ok:false,error:'Unauthorized'},401);
        const b=await req.json();
        await markPaid(env,String(b.order_id));
        return json({ok:true});
      }

      if(path==='/api/order/create' && req.method==='POST'){
        const b=await req.json();
        const name=String(b.customer_name||'').trim(), mobile=String(b.mobile||'').trim();
        if(!name||!mobile) return json({ok:false,error:'Name and mobile required'},400);
        const s=await settings(env);
        const pages=Math.max(1,Number(b.pages||1)), copies=Math.max(1,Number(b.copies||1));
        const mode=b.print_mode==='color'?'color':'bw';
        const base=(mode==='color'?Number(s.price_color):Number(s.price_bw))*pages*copies;
        const discount=Math.max(0,Math.min(100,Number(s.global_discount||0)));
        const total=Math.max(0,Math.round(base*(1-discount/100)+Number(s.delivery||0)));
        const id='PP-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomUUID().slice(0,6).toUpperCase();
        const method='cash';
        await env.DB.prepare(`INSERT INTO orders(id,customer_name,mobile,pages,copies,print_mode,paper,amount_paise,payment_method,payment_status,order_status,created_at,updated_at,utr,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .bind(id,name,mobile,pages,copies,mode,String(b.paper||'A4'),total*100,method,'PENDING','PENDING',now(),now(),String(b.utr||''),String(b.notes||'')).run();

        return json({ok:true,order_id:id,amount:total,payment:'cash',payment_status:'PENDING'});
      }

      if(path==='/api/order/status'){
        const id=u.searchParams.get('id');
        const row=await env.DB.prepare("SELECT id,customer_name,mobile,pages,copies,print_mode,paper,amount_paise,payment_method,payment_status,order_status,created_at,utr FROM orders WHERE id=?").bind(id).first();
        if(!row) return json({ok:false,error:'Not found'},404);
        return json({ok:true,order:row});
      }

      if(path==='/api/order/upload' && req.method==='POST'){
        const fd=await req.formData();
        const id=String(fd.get('order_id')||'');
        const file=fd.get('file');
        if(!id || !file || typeof file.arrayBuffer!=='function') return json({ok:false,error:'File required'},400);
        const row=await env.DB.prepare("SELECT id FROM orders WHERE id=?").bind(id).first();
        if(!row) return json({ok:false,error:'Order not found'},404);
        const key=`orders/${id}/${crypto.randomUUID()}-${String(file.name||'upload').replace(/[^a-zA-Z0-9._-]/g,'_')}`;
        await env.FILES.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:file.type||'application/octet-stream'}});
        await env.DB.prepare("UPDATE orders SET file_key=?,updated_at=? WHERE id=?").bind(key,now(),id).run();
        return json({ok:true,key});
      }

      if(path==='/') return env.ASSETS.fetch(req);
      return env.ASSETS.fetch(req);
    }catch(e){
      return json({ok:false,error:e?.message||String(e)},500);
    }
  }
};
