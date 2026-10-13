const $=id=>document.getElementById(id);
let selected=[],orderId=null,paid=false,finalPdf=null,settings={},pollTimer=null,printSocket=null,keepAliveTimer=null,printCompleted=false;
async function loadSettings(){const r=await fetch('/api/public-settings',{cache:'no-store'});settings=await r.json();$('brandName').textContent=settings.business_name||'PrintPay';calc()}
function mode(){return document.querySelector('input[name=mode]:checked').value}
function pricePerPage(copies){const base=mode()==='color'?Number(settings.price_color||0):Number(settings.price_bw||0);if(copies>=25&&Number(settings.tier_25)>0)return Number(settings.tier_25);if(copies>=10&&Number(settings.tier_10)>0)return Number(settings.tier_10);if(copies>=5&&Number(settings.tier_5)>0)return Number(settings.tier_5);if(copies>=1&&Number(settings.tier_1)>0)return Number(settings.tier_1);return base}
function calc(){const pages=Math.max(1,selected.reduce((n,f)=>n+Number(f.pages||1),0));const copies=Math.max(1,Number($('copies').value||1));const rate=pricePerPage(copies);let total=rate*pages*copies;total*=1-Math.max(0,Math.min(100,Number(settings.global_discount||0)))/100;total+=Number(settings.delivery||0);total=Math.max(0,Math.round(total));$('amount').textContent='₹'+total;$('rateInfo').textContent=`₹${rate}/page • ${pages} page × ${copies} copy • ${selected.length} file(s)`;return{pages,copies,total,rate}}
function esc(v){return String(v).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]))}
function renderFiles(){
  $('fileCount').textContent=`${selected.length} file${selected.length===1?'':'s'}`;
  $('fileList').innerHTML=selected.map((f,i)=>`<div class="file"><div class="file-main"><span>📎 ${esc(f.name)}</span><small>${f.type==='application/pdf'?`${f.pages||1} page(s)`:'1 page'} • ${(f.size/1024/1024).toFixed(2)} MB</small></div><div class="file-actions"><button type="button" data-remove="${i}">Remove</button></div></div>`).join('');
  calc();
}
async function getPdfPages(file){try{const buf=await file.arrayBuffer();const pdf=await window.pdfjsLib.getDocument({data:buf}).promise;return pdf.numPages}catch{return 1}}
$('files').onchange=async e=>{
  const incoming=[...e.target.files];
  e.target.value='';
  if(!incoming.length)return;
  const start=selected.length;
  selected.push(...incoming.map(f=>Object.assign(f,{pages:1})));
  renderFiles();
  for(let i=start;i<selected.length;i++)if(selected[i].type==='application/pdf')selected[i].pages=await getPdfPages(selected[i]);
  renderFiles();
};
$('fileList').addEventListener('click',e=>{const b=e.target.closest('[data-remove]');if(!b)return;selected.splice(Number(b.dataset.remove),1);renderFiles()});
$('clearFiles').onclick=()=>{selected=[];finalPdf=null;renderFiles()};
['copies','brightness','contrast','sharpness','crop','scale'].forEach(id=>$(id)?.addEventListener('input',calc));document.querySelectorAll('input[name=mode]').forEach(x=>x.addEventListener('change',calc));
async function createOrder(){const name=$('name').value.trim(),mobile=$('mobile').value.trim();if(!name||mobile.length<10||!selected.length){alert('নাম, সঠিক মোবাইল এবং অন্তত একটি file দিন।');return null}const c=calc();const r=await fetch('/api/order/create',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({customer_name:name,mobile,pages:c.pages,copies:c.copies,print_mode:mode(),paper:$('paper').value})});let d={};try{d=await r.json()}catch{}if(!r.ok||!d.ok){alert(d.error||`Order তৈরি হয়নি (${r.status})`);return null}orderId=d.order_id;return d}
$('cash').onclick=async()=>{const btn=$('cash');btn.disabled=true;try{const d=await createOrder();if(!d)return;paid=false;finalPdf=null;window.currentAmount=d.amount;showReady('কাউন্টারে টাকা দিন। Owner Login করে Payment Received চাপলেই print job চালু হবে।');speakAmount(d.amount)}finally{btn.disabled=false}};
function showReady(msg){enablePrintLock();$('result').classList.remove('hidden');$('resultText').innerHTML=`<b>Order ID:</b> ${esc(orderId)}<br><b>Amount:</b> ₹${window.currentAmount||calc().total}<br><span>${msg}</span><div id="paymentState" style="margin-top:8px;font-weight:800;color:#b45309">⏳ Counter payment pending</div>`;startPaymentPolling()}
function speakAmount(amount){if(!('speechSynthesis'in window))return;const u=new SpeechSynthesisUtterance(`আপনি আপনার ${amount} টাকা সংগ্রহ করুন`);u.lang='bn-IN';u.rate=.9;u.pitch=1;speechSynthesis.cancel();speechSynthesis.speak(u)}
function enablePrintLock(){printCompleted=false;window.onbeforeunload=e=>{if(!printCompleted){e.preventDefault();e.returnValue='';return ''}};if('wakeLock'in navigator)navigator.wakeLock.request('screen').then(lock=>{window._printWakeLock=lock}).catch(()=>{});clearInterval(keepAliveTimer);keepAliveTimer=setInterval(()=>{if(orderId&&!printCompleted)fetch('/api/order/status?id='+encodeURIComponent(orderId),{cache:'no-store'}).catch(()=>{})},15000)}
function disablePrintLock(){printCompleted=true;window.onbeforeunload=null;clearInterval(keepAliveTimer);keepAliveTimer=null;try{if(window._printWakeLock)window._printWakeLock.release()}catch{}}
function focusPrintStatus(){const r=$('result');if(r)r.scrollIntoView({behavior:'smooth',block:'center'})}
function startPaymentPolling(){clearInterval(pollTimer);pollTimer=setInterval(async()=>{if(!orderId)return;try{const r=await fetch('/api/order/status?id='+encodeURIComponent(orderId),{cache:'no-store'});const d=await r.json();if(d.ok&&d.order.payment_status==='PAID'){clearInterval(pollTimer);paid=true;const st=$('paymentState');if(st){st.textContent='✅ Payment Received — preparing direct print…';st.style.color='#15803d'}focusPrintStatus();await startDirectPrint()}}catch(e){console.error(e)}},2000)}
function adjustCanvas(source){
  const cropPct=Math.max(0,Math.min(25,Number($('crop').value||0)))/100;
  const scalePct=Math.max(50,Math.min(150,Number($('scale').value||100)))/100;
  const sx=Math.floor(source.width*cropPct),sy=Math.floor(source.height*cropPct),sw=Math.max(1,source.width-sx*2),sh=Math.max(1,source.height-sy*2);
  const maxDim=3000;const base=Math.min(1,maxDim/Math.max(sw,sh));const w=Math.max(1,Math.round(sw*base)),h=Math.max(1,Math.round(sh*base));
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});
  x.filter=`brightness(${100+Number($('brightness').value||0)}%) contrast(${100+Number($('contrast').value||0)}%)`;
  x.drawImage(source,sx,sy,sw,sh,0,0,w,h);x.filter='none';
  if($('bwClean').checked&&mode()==='bw'){const d=x.getImageData(0,0,w,h),a=d.data;for(let i=0;i<a.length;i+=4){const g=a[i]*.299+a[i+1]*.587+a[i+2]*.114;const v=g>165?255:g<90?0:g;a[i]=a[i+1]=a[i+2]=v}x.putImageData(d,0,0)}
  const sharp=Number($('sharpness').value||0);if(sharp>0){const d=x.getImageData(0,0,w,h),src=d.data,out=new Uint8ClampedArray(src),s=Math.min(0.45,sharp*.16);for(let y=1;y<h-1;y++)for(let xx=1;xx<w-1;xx++){const i=(y*w+xx)*4;for(let cch=0;cch<3;cch++){const v=src[i+cch]*(1+4*s)-s*(src[i-4+cch]+src[i+4+cch]+src[i-w*4+cch]+src[i+w*4+cch]);out[i+cch]=Math.max(0,Math.min(255,v))}}d.data.set(out);x.putImageData(d,0,0)}
  c._scale=scalePct;return c;
}
async function imageToCanvas(file){const img=new Image();img.src=URL.createObjectURL(file);await new Promise((res,rej)=>{img.onload=res;img.onerror=rej});const c=adjustCanvas(img);URL.revokeObjectURL(img.src);return c}
function addCanvasToPdf(doc,c){const pw=doc.internal.pageSize.getWidth(),ph=doc.internal.pageSize.getHeight();const contentScale=c._scale||1;const ratio=Math.min(pw/c.width,ph/c.height)*contentScale;const dw=c.width*ratio,dh=c.height*ratio;const x=(pw-dw)/2,y=(ph-dh)/2;doc.addImage(c.toDataURL('image/jpeg',.94),'JPEG',x,y,dw,dh)}
async function pdfPageCanvas(page){const base=page.getViewport({scale:2});const limit=2600;const rs=Math.min(2,limit/Math.max(base.width,base.height));const vp=page.getViewport({scale:rs});const c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;return adjustCanvas(c)}
async function makePdf(){if(!paid){alert('Payment Received হওয়ার পর Print করা যাবে।');return null}if(!selected.length)return null;const {jsPDF}=window.jspdf;const fmt=$('paper').value==='A3'?'a3':$('paper').value==='Legal'?'legal':'a4';const doc=new jsPDF({unit:'pt',format:fmt});let first=true;for(const f of selected){if(f.type==='application/pdf'){const buf=await f.arrayBuffer();const pdf=await window.pdfjsLib.getDocument({data:buf}).promise;for(let p=1;p<=pdf.numPages;p++){if(!first)doc.addPage();first=false;const page=await pdf.getPage(p);addCanvasToPdf(doc,await pdfPageCanvas(page))}}else{if(!first)doc.addPage();first=false;addCanvasToPdf(doc,await imageToCanvas(f))}}finalPdf=doc.output('blob');return finalPdf}
async function startDirectPrint(){try{focusPrintStatus();const blob=finalPdf||await makePdf();if(!blob)throw new Error('PDF তৈরি হয়নি');const proto=location.protocol==='https:'?'wss':'ws';const ws=new WebSocket(`${proto}://${location.host}/ws/order/${encodeURIComponent(orderId)}`);printSocket=ws;ws.binaryType='arraybuffer';ws.onopen=()=>ws.send(JSON.stringify({type:'hello',role:'customer'}));ws.onmessage=e=>{if(typeof e.data==='string'){try{const m=JSON.parse(e.data);if(m.type==='ready')sendPdfChunks(ws,blob);if(m.type==='printed'){const st=$('paymentState');if(st)st.textContent='✅ Payment Received — Printing completed';disablePrintLock()}}catch{}}};ws.onerror=()=>{const st=$('paymentState');if(st)st.textContent='⚠️ Print connection failed. Keep this page open and press “Send to Printer” again.';showRetryButton()};ws.onclose=()=>{}}catch(e){console.error(e);showRetryButton()}}
function showRetryButton(){if($('retryPrint'))return;const b=document.createElement('button');b.id='retryPrint';b.textContent='🖨️ Send to Printer Again';b.onclick=startDirectPrint;$('result').appendChild(b)}
async function sendPdfChunks(ws,blob){const buf=await blob.arrayBuffer();ws.send(JSON.stringify({type:'start',order_id:orderId,name:`${orderId}.pdf`,size:buf.byteLength}));const chunk=64*1024;for(let i=0;i<buf.byteLength;i+=chunk){while(ws.bufferedAmount>1024*1024)await new Promise(r=>setTimeout(r,50));ws.send(buf.slice(i,Math.min(i+chunk,buf.byteLength)))}ws.send(JSON.stringify({type:'end'}));const st=$('paymentState');if(st)st.textContent='📨 Print file sent to shop Print Station…'}
$('makePdf').onclick=async()=>{try{const b=await makePdf();if(b)await startDirectPrint()}catch(e){alert(e.message||'PDF তৈরি হয়নি')}};
$('savePdf').onclick=async()=>{try{const b=finalPdf||await makePdf();if(!b)return;const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=(orderId||'PrintPay')+'.pdf';a.click()}catch(e){alert(e.message||'PDF তৈরি হয়নি')}};
$('printPdf').onclick=async()=>{try{const b=finalPdf||await makePdf();if(!b)return;const url=URL.createObjectURL(b),w=window.open(url);if(w)w.onload=()=>w.print()}catch(e){alert(e.message||'PDF তৈরি হয়নি')}};
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&paid&&!printCompleted&&(!printSocket||printSocket.readyState!==WebSocket.OPEN))startDirectPrint().catch(()=>{})});
renderFiles();loadSettings();
