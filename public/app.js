const $=id=>document.getElementById(id);
let selected=[],orderId=null,paid=false,finalPdf=null,settings={},pollTimer=null,printSocket=null,keepAliveTimer=null,printCompleted=false;
let cleanupIndex=0,cleanupSource=null,cleanupBusy=false;
const DEFAULT_EDIT={brightness:0,contrast:0,crop:0,scale:100,sharpness:0,bwClean:false};

async function loadSettings(){
  try{
    const r=await fetch('/api/public-settings',{cache:'no-store'});
    const d=await r.json();
    settings=(d&&typeof d==='object')?d:{};
  }catch(e){settings={};}
  $('brandName').textContent=settings.business_name||'PrintPay';
  calc();
}
function mode(){return document.querySelector('input[name=mode]:checked')?.value||'bw'}
function num(v,fallback=0){const n=Number(v);return Number.isFinite(n)?n:fallback}
function pricePerPage(copies){
  const base=mode()==='color'?num(settings.price_color,0):num(settings.price_bw,0);
  if(copies>=25&&num(settings.tier_25,0)>0)return num(settings.tier_25);
  if(copies>=10&&num(settings.tier_10,0)>0)return num(settings.tier_10);
  if(copies>=5&&num(settings.tier_5,0)>0)return num(settings.tier_5);
  if(copies>=1&&num(settings.tier_1,0)>0)return num(settings.tier_1);
  return base;
}
function calc(){
  const pages=Math.max(1,selected.reduce((n,f)=>n+num(f.pages,1),0));
  const copies=Math.max(1,Math.floor(num($('copies')?.value,1)));
  const rate=pricePerPage(copies);
  let total=rate*pages*copies;
  total*=1-Math.max(0,Math.min(100,num(settings.global_discount,0)))/100;
  total+=num(settings.delivery,0);
  total=Math.max(0,Math.round(total*100)/100);
  if($('amount'))$('amount').textContent='₹'+total.toFixed(2).replace(/\.00$/,'');
  if($('rateInfo'))$('rateInfo').textContent=`₹${rate}/page • ${pages} page × ${copies} copy • ${selected.length} file(s)`;
  return{pages,copies,total,rate};
}
function esc(v){return String(v).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]))}
function cloneEdit(e){return {...DEFAULT_EDIT,...(e||{})}}
function cleanupLabel(e){
  const a=[];
  if(num(e.brightness)!==0)a.push(`Brightness ${num(e.brightness)>0?'+':''}${num(e.brightness)}`);
  if(num(e.contrast)!==0)a.push(`Contrast ${num(e.contrast)>0?'+':''}${num(e.contrast)}`);
  if(num(e.crop)!==0)a.push(`Crop ${num(e.crop)}%`);
  if(num(e.scale,100)!==100)a.push(`Scale ${num(e.scale,100)}%`);
  if(num(e.sharpness)!==0)a.push(`Sharpness ${num(e.sharpness)}`);
  if(e.bwClean)a.push('B&W cleanup');
  return a.length?a.join(' • '):'Default print quality • No changes applied';
}
function renderFiles(){
  $('fileCount').textContent=`${selected.length} file${selected.length===1?'':'s'}`;
  $('fileList').innerHTML=selected.map((f,i)=>`<div class="file"><div class="file-main"><span>📎 ${esc(f.name)}</span><small>${f.type==='application/pdf'?`${f.pages||1} page(s)`:'1 page'} • ${(f.size/1024/1024).toFixed(2)} MB</small><small class="file-edit">${esc(cleanupLabel(f._edit))}</small></div><div class="file-actions"><button type="button" data-edit="${i}" class="edit-file">👁️ Preview</button><button type="button" data-remove="${i}">Remove</button></div></div>`).join('');
  const edited=selected.filter(f=>cleanupLabel(f._edit)!=='Default print quality • No changes applied').length;
  if($('cleanupSummary'))$('cleanupSummary').textContent=selected.length?`${edited}/${selected.length} file edited • Preview each file before sending`:'Add a file to start preview and cleanup';
  calc();
}
async function getPdfPages(file){try{const buf=await file.arrayBuffer();const pdf=await window.pdfjsLib.getDocument({data:buf}).promise;return pdf.numPages}catch{return 1}}
$('files').onchange=async e=>{
  const incoming=[...e.target.files];e.target.value='';if(!incoming.length)return;
  const start=selected.length;
  selected.push(...incoming.map(f=>Object.assign(f,{pages:1,_edit:cloneEdit()})));
  renderFiles();
  for(let i=start;i<selected.length;i++)if(selected[i].type==='application/pdf')selected[i].pages=await getPdfPages(selected[i]);
  renderFiles();
  openCleanup(start);
};
$('fileList').addEventListener('click',e=>{
  const edit=e.target.closest('[data-edit]');
  const rem=e.target.closest('[data-remove]');
  if(edit){openCleanup(Number(edit.dataset.edit));return}
  if(rem){selected.splice(Number(rem.dataset.remove),1);renderFiles()}
});
$('clearFiles').onclick=()=>{selected=[];finalPdf=null;closeCleanup();renderFiles()};
document.querySelectorAll('input[name=mode]').forEach(x=>x.addEventListener('change',()=>{calc();if(cleanupIndex>=0&&cleanupSource)renderCleanupPreview()}));
$('copies').addEventListener('input',calc);

function editFromInputs(){return{brightness:num($('brightness').value),contrast:num($('contrast').value),crop:num($('crop').value),scale:num($('scale').value,100),sharpness:num($('sharpness').value),bwClean:$('bwClean').checked}}
function setEditInputs(e){e=cloneEdit(e);$('brightness').value=e.brightness;$('contrast').value=e.contrast;$('crop').value=e.crop;$('scale').value=e.scale;$('sharpness').value=e.sharpness;$('bwClean').checked=!!e.bwClean;updateEditLabels()}
function updateEditLabels(){
  $('brightnessVal').textContent=String($('brightness').value);$('contrastVal').textContent=String($('contrast').value);$('cropVal').textContent=$('crop').value+'%';$('scaleVal').textContent=$('scale').value+'%';$('sharpnessVal').textContent=$('sharpness').value;
}
function adjustCanvas(source,edit){
  edit=cloneEdit(edit);
  const cropPct=Math.max(0,Math.min(25,num(edit.crop)))/100;
  const scalePct=Math.max(70,Math.min(130,num(edit.scale,100)))/100;
  const sx=Math.floor(source.width*cropPct),sy=Math.floor(source.height*cropPct),sw=Math.max(1,source.width-sx*2),sh=Math.max(1,source.height-sy*2);
  const maxDim=2400,base=Math.min(1,maxDim/Math.max(sw,sh)),w=Math.max(1,Math.round(sw*base)),h=Math.max(1,Math.round(sh*base));
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});
  x.filter=`brightness(${100+num(edit.brightness)}%) contrast(${100+num(edit.contrast)}%)`;x.drawImage(source,sx,sy,sw,sh,0,0,w,h);x.filter='none';
  if(edit.bwClean&&mode()==='bw'){const d=x.getImageData(0,0,w,h),a=d.data;for(let i=0;i<a.length;i+=4){const g=a[i]*.299+a[i+1]*.587+a[i+2]*.114;const v=g>165?255:g<90?0:g;a[i]=a[i+1]=a[i+2]=v}x.putImageData(d,0,0)}
  const sharp=num(edit.sharpness);if(sharp>0){const d=x.getImageData(0,0,w,h),src=d.data,out=new Uint8ClampedArray(src),s=Math.min(.45,sharp*.16);for(let y=1;y<h-1;y++)for(let xx=1;xx<w-1;xx++){const i=(y*w+xx)*4;for(let ch=0;ch<3;ch++){const v=src[i+ch]*(1+4*s)-s*(src[i-4+ch]+src[i+4+ch]+src[i-w*4+ch]+src[i+w*4+ch]);out[i+ch]=Math.max(0,Math.min(255,v))}}d.data.set(out);x.putImageData(d,0,0)}
  c._scale=scalePct;return c;
}
async function sourceForFile(file){
  if(file.type==='application/pdf'){
    const buf=await file.arrayBuffer(),pdf=await window.pdfjsLib.getDocument({data:buf}).promise,page=await pdf.getPage(1);const base=page.getViewport({scale:1.5}),limit=1800,rs=Math.min(1.5,limit/Math.max(base.width,base.height)),vp=page.getViewport({scale:rs});const c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;return c;
  }
  const img=new Image();const url=URL.createObjectURL(file);img.src=url;await new Promise((res,rej)=>{img.onload=res;img.onerror=rej});URL.revokeObjectURL(url);return img;
}
async function openCleanup(index=0){
  if(!selected[index])return;cleanupIndex=index;cleanupSource=null;$('cleanupModal').classList.remove('hidden');$('cleanupFileName').textContent=selected[index].name+(selected[index].type==='application/pdf'?' • first page preview':'');setEditInputs(selected[index]._edit);try{cleanupSource=await sourceForFile(selected[index]);renderCleanupPreview()}catch(e){alert('Preview তৈরি করা যায়নি। Fileটি আবার নির্বাচন করুন।');closeCleanup()}
}
function renderCleanupPreview(){if(!cleanupSource)return;updateEditLabels();const c=adjustCanvas(cleanupSource,editFromInputs()),pc=$('previewCanvas');pc.width=c.width;pc.height=c.height;pc.getContext('2d').drawImage(c,0,0);}
['brightness','contrast','crop','scale','sharpness'].forEach(id=>$(id).addEventListener('input',renderCleanupPreview));$('bwClean').addEventListener('change',renderCleanupPreview);
$('openCleanup').onclick=()=>openCleanup(0);$('closeCleanup').onclick=closeCleanup;$('resetCleanup').onclick=()=>{setEditInputs(DEFAULT_EDIT);renderCleanupPreview()};
$('applyCleanup').onclick=()=>{if(!selected[cleanupIndex])return;selected[cleanupIndex]._edit=editFromInputs();renderFiles();const next=cleanupIndex+1;if(next<selected.length)openCleanup(next);else closeCleanup()};
function closeCleanup(){$('cleanupModal').classList.add('hidden');cleanupSource=null}

async function createOrder(){
  const name=$('name').value.trim(),mobile=$('mobile').value.trim();
  if(!name||mobile.length<10||!selected.length){alert('নাম, সঠিক মোবাইল এবং অন্তত একটি file দিন।');return null}
  const c=calc();if(c.total<=0){alert('Price settings ঠিক নেই। Owner panel-এ B&W/Colour price সেট করুন।');return null}
  const r=await fetch('/api/order/create',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({customer_name:name,mobile,pages:c.pages,copies:c.copies,print_mode:mode(),paper:$('paper').value})});let d={};try{d=await r.json()}catch{}if(!r.ok||!d.ok){alert(d.error||`Order তৈরি হয়নি (${r.status})`);return null}orderId=d.order_id;return d
}
function chooseBnVoice(){const vs=('speechSynthesis'in window)?speechSynthesis.getVoices():[];return vs.find(v=>/^bn(-|_)/i.test(v.lang))||vs.find(v=>/bengali|bangla/i.test(v.name+' '+v.lang))||null}
function speakOrderAmount(amount){
  if(!('speechSynthesis'in window))return;
  try{speechSynthesis.resume();const u=new SpeechSynthesisUtterance(`গ্রাহক আপনাকে প্রিন্ট করার জন্য ফাইল পাঠিয়েছে। ${Number(amount).toFixed(0)} টাকা সংগ্রহ করে প্রিন্ট করে দিন।`);u.lang='bn-IN';u.rate=.78;u.pitch=1;const v=chooseBnVoice();if(v)u.voice=v;speechSynthesis.cancel();speechSynthesis.speak(u)}catch(e){console.warn(e)}
}
$('cash').onclick=async()=>{const btn=$('cash');btn.disabled=true;try{if('speechSynthesis'in window)speechSynthesis.resume();const d=await createOrder();if(!d)return;paid=false;finalPdf=null;window.currentAmount=Number(d.amount||0);showReady('আপনার ফাইল দোকানে পৌঁছে গেছে। কাউন্টারে টাকা দিন। টাকা গ্রহণ করার পর প্রিন্ট স্বয়ংক্রিয়ভাবে শুরু হবে।');speakOrderAmount(window.currentAmount);preparePdfEarly();connectCustomerSocket()}finally{btn.disabled=false}};
async function preparePdfEarly(){try{finalPdf=await buildPdfBlob()}catch(e){console.error(e)}}
function showReady(msg){enablePrintLock();$('result').classList.remove('hidden');$('resultText').innerHTML=`<b>Order ID:</b> ${esc(orderId)}<br><b>Amount:</b> ₹${Number(window.currentAmount||calc().total).toFixed(2).replace(/\.00$/,'')}<br><span>${msg}</span><div id="paymentState" style="margin-top:8px;font-weight:800;color:#b45309">⏳ Counter payment pending</div>`;startPaymentPolling()}
function enablePrintLock(){printCompleted=false;window.onbeforeunload=e=>{if(!printCompleted){e.preventDefault();e.returnValue='';return ''}};if('wakeLock'in navigator)navigator.wakeLock.request('screen').then(lock=>{window._printWakeLock=lock}).catch(()=>{});clearInterval(keepAliveTimer);keepAliveTimer=setInterval(()=>{if(orderId&&!printCompleted)fetch('/api/order/status?id='+encodeURIComponent(orderId),{cache:'no-store'}).catch(()=>{})},15000)}
function disablePrintLock(){printCompleted=true;window.onbeforeunload=null;clearInterval(keepAliveTimer);keepAliveTimer=null;try{if(window._printWakeLock)window._printWakeLock.release()}catch{}}
function focusPrintStatus(){const r=$('result');if(r)r.scrollIntoView({behavior:'smooth',block:'center'})}
function startPaymentPolling(){clearInterval(pollTimer);pollTimer=setInterval(async()=>{if(!orderId)return;try{const r=await fetch('/api/order/status?id='+encodeURIComponent(orderId),{cache:'no-store'});const d=await r.json();if(d.ok&&d.order.payment_status==='PAID'){clearInterval(pollTimer);paid=true;window.currentAmount=Number(d.order.amount_paise||0)/100;const st=$('paymentState');if(st){st.textContent='✅ Payment Received — automatic printing শুরু হচ্ছে…';st.style.color='#15803d'}focusPrintStatus();await startDirectPrint()}}catch(e){console.error(e)}},1000)}
function addCanvasToPdf(doc,c){const pw=doc.internal.pageSize.getWidth(),ph=doc.internal.pageSize.getHeight(),contentScale=c._scale||1,ratio=Math.min(pw/c.width,ph/c.height)*contentScale,dw=c.width*ratio,dh=c.height*ratio,x=(pw-dw)/2,y=(ph-dh)/2;doc.addImage(c.toDataURL('image/jpeg',.92),'JPEG',x,y,dw,dh)}
async function pdfPageCanvas(page,edit){const base=page.getViewport({scale:1.5}),limit=2400,rs=Math.min(1.5,limit/Math.max(base.width,base.height)),vp=page.getViewport({scale:rs});const c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;return adjustCanvas(c,edit)}
async function imageToCanvas(file){const src=await sourceForFile(file);return adjustCanvas(src,file._edit)}
async function buildPdfBlob(){if(!selected.length)return null;const {jsPDF}=window.jspdf,fmt=$('paper').value==='A3'?'a3':$('paper').value==='Legal'?'legal':'a4',doc=new jsPDF({unit:'pt',format:fmt});let first=true;for(const f of selected){const edit=f._edit;if(f.type==='application/pdf'){const buf=await f.arrayBuffer(),pdf=await window.pdfjsLib.getDocument({data:buf}).promise;for(let p=1;p<=pdf.numPages;p++){if(!first)doc.addPage();first=false;addCanvasToPdf(doc,await pdfPageCanvas(await pdf.getPage(p),edit))}}else{if(!first)doc.addPage();first=false;addCanvasToPdf(doc,await imageToCanvas(f))}}finalPdf=doc.output('blob');return finalPdf}
function connectCustomerSocket(){
  try{const proto=location.protocol==='https:'?'wss':'ws',ws=new WebSocket(`${proto}://${location.host}/ws/order/${encodeURIComponent(orderId)}`);printSocket=ws;ws.binaryType='arraybuffer';ws.onopen=()=>ws.send(JSON.stringify({type:'hello',role:'customer'}));ws.onmessage=async e=>{if(typeof e.data!=='string')return;try{const m=JSON.parse(e.data);if(m.type==='ready'&&m.paid)await sendPdfChunks(ws,finalPdf||await buildPdfBlob());if(m.type==='paid'){const st=$('paymentState');if(st){st.textContent='💵 Payment Received — automatic printing শুরু হচ্ছে…';st.style.color='#15803d'}await sendPdfChunks(ws,finalPdf||await buildPdfBlob())}if(m.type==='printed'){const st=$('paymentState');if(st)st.textContent='✅ Payment Received — Printing completed';disablePrintLock()}}catch(err){console.error(err)}};ws.onerror=()=>{const st=$('paymentState');if(st)st.textContent='⚠️ Print Station connection সমস্যা। Desktop software চালু রাখুন এবং Print Station Key/Printer settings মিলিয়ে নিন।'};ws.onclose=()=>{if(!printCompleted&&paid){setTimeout(()=>{if(orderId&&!printCompleted)connectCustomerSocket()},1500)}}}catch(e){console.error(e)}}
async function startDirectPrint(){if(!printSocket||printSocket.readyState!==WebSocket.OPEN)return connectCustomerSocket();if(paid)await sendPdfChunks(printSocket,finalPdf||await buildPdfBlob())}
async function sendPdfChunks(ws,blob){if(!blob||ws.readyState!==WebSocket.OPEN)return;const buf=await blob.arrayBuffer();ws.send(JSON.stringify({type:'start',order_id:orderId,name:`${orderId}.pdf`,size:buf.byteLength}));const chunk=256*1024;for(let i=0;i<buf.byteLength;i+=chunk){while(ws.bufferedAmount>2*1024*1024)await new Promise(r=>setTimeout(r,10));ws.send(buf.slice(i,Math.min(i+chunk,buf.byteLength)))}ws.send(JSON.stringify({type:'end'}));const st=$('paymentState');if(st)st.textContent='📨 File Print Station-এ পাঠানো হয়েছে…'}
$('makePdf').onclick=()=>{if(paid)startDirectPrint();else alert('কাউন্টারে টাকা দেওয়ার পরে Print স্বয়ংক্রিয়ভাবে হবে।')};
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&orderId&&!printCompleted&&!printSocket)connectCustomerSocket()});
loadSettings();
