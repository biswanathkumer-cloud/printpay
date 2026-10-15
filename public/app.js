const $=id=>document.getElementById(id);
let selected=[],orderId=null,uploadToken=null,paid=false,finalPdf=null,settings={},pollTimer=null,printCompleted=false;
let cleanupIndex=-1,cleanupSource=null,cropRect={x:0,y:0,w:1,h:1},drag=null,pdfPage=1,pdfPageCount=1;
const DEFAULT_EDIT={brightness:0,contrast:0,scale:100,sharpness:0,bwClean:false,cropRect:{x:0,y:0,w:1,h:1}};

const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const esc=v=>String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function cloneEdit(e){return {...DEFAULT_EDIT,...(e||{}),cropRect:{...DEFAULT_EDIT.cropRect,...((e||{}).cropRect||{})}}}
function modeOf(f){return f?.mode==='color'?'color':'bw'}
function layoutSlots(){return Math.max(1,Math.floor(n($('layout')?.value,1)))}
function priceFor(mode,slots,copies){
  const key=`${mode}_a4_${slots}`; const exact=n(settings[key],0);
  if(exact>0)return exact;
  const base=n(settings[mode==='color'?'price_color':'price_bw'],0);
  if(copies>=25&&n(settings.tier_25,0)>0)return n(settings.tier_25);
  if(copies>=10&&n(settings.tier_10,0)>0)return n(settings.tier_10);
  if(copies>=5&&n(settings.tier_5,0)>0)return n(settings.tier_5);
  if(copies>=1&&n(settings.tier_1,0)>0)return n(settings.tier_1);
  return base;
}
function breakdown(){
  const copies=Math.max(1,Math.floor(n($('copies')?.value,1))),slots=layoutSlots();
  const groups={bw:selected.filter(f=>modeOf(f)==='bw'),color:selected.filter(f=>modeOf(f)==='color')};
  const out={bw:{pages:0,sheets:0,rate:priceFor('bw',slots,copies),amount:0},color:{pages:0,sheets:0,rate:priceFor('color',slots,copies),amount:0}};
  for(const m of ['bw','color']){out[m].pages=groups[m].reduce((a,f)=>a+n(f.pages,1),0);out[m].sheets=out[m].pages?Math.ceil(out[m].pages/slots):0;out[m].amount=out[m].sheets*out[m].rate*copies;}
  let subtotal=out.bw.amount+out.color.amount;const discount=Math.max(0,Math.min(100,n(settings.global_discount,0)));const delivery=n(settings.delivery,0);const total=Math.max(0,Math.round((subtotal*(1-discount/100)+delivery)*100)/100);
  return {copies,slots,groups,out,subtotal,discount,delivery,total,pages:out.bw.pages+out.color.pages,sheets:out.bw.sheets+out.color.sheets};
}
function calc(){const b=breakdown();if($('amount'))$('amount').textContent='₹'+b.total.toFixed(2).replace(/\.00$/,'');if($('rateInfo'))$('rateInfo').innerHTML=`B&W: ${b.out.bw.pages} page → ${b.out.bw.sheets} A4 × ₹${b.out.bw.rate} × ${b.copies} = ₹${b.out.bw.amount.toFixed(2)}<br>Colour: ${b.out.color.pages} page → ${b.out.color.sheets} A4 × ₹${b.out.color.rate} × ${b.copies} = ₹${b.out.color.amount.toFixed(2)}<br><b>Total print pages: ${b.pages} • A4 sheets: ${b.sheets} • Layout: ${b.slots} image(s)/A4 • Copies: ${b.copies}</b>`;return b}
async function loadSettings(){try{const r=await fetch('/api/public-settings',{cache:'no-store'});settings=await r.json()}catch{settings={}}$('brandName').textContent=settings.business_name||'PrintPay';calc();}
function cleanupLabel(e){e=cloneEdit(e);const a=[];if(n(e.brightness)!==0)a.push(`Brightness ${n(e.brightness)>0?'+':''}${n(e.brightness)}`);if(n(e.contrast)!==0)a.push(`Contrast ${n(e.contrast)>0?'+':''}${n(e.contrast)}`);if(n(e.scale,100)!==100)a.push(`Scale ${n(e.scale,100)}%`);if(n(e.sharpness)!==0)a.push(`Sharpness ${n(e.sharpness)}`);if(e.bwClean)a.push('B&W cleanup');const r=e.cropRect;if(r&&(r.x||r.y||r.w!==1||r.h!==1))a.push('Crop applied');return a.length?a.join(' • '):'No changes';}
function renderFiles(){
  $('fileCount').textContent=`${selected.length} file${selected.length===1?'':'s'}`;
  $('fileList').innerHTML=selected.map((f,i)=>`<div class="file"><div class="thumb" id="thumb-${i}">${f.type==='application/pdf'?'📄':'🖼️'}</div><div class="file-main"><b>${esc(f.name)}</b><small>${f.type==='application/pdf'?`${f.pages||1} page(s)`:'1 image page'} • ${(f.size/1024/1024).toFixed(2)} MB</small><small class="file-edit">${esc(cleanupLabel(f._edit))}</small><small class="hint">${modeOf(f)==='bw'?'B&W':'Colour'} print</small></div><div class="file-actions"><label class="mini-select">Print<select data-mode="${i}" class="file-mode"><option value="bw" ${modeOf(f)==='bw'?'selected':''}>B&W</option><option value="color" ${modeOf(f)==='color'?'selected':''}>Colour</option></select></label><button type="button" data-edit="${i}">👁️ Preview</button><button type="button" data-remove="${i}">Remove</button></div></div>`).join('');
  selected.forEach(async (f,i)=>{
    const t=$(`thumb-${i}`); if(!t)return;
    try{
      if(f.type==='application/pdf'){
        const src=await sourceForFile(f,1); const c=applyImage(src,f._edit,modeOf(f)); const img=document.createElement('img'); img.src=c.toDataURL('image/jpeg',.8); t.innerHTML=''; t.appendChild(img);
      }else{
        const url=URL.createObjectURL(f);const img=new Image();img.src=url;img.onload=()=>URL.revokeObjectURL(url);t.innerHTML='';t.appendChild(img);
      }
    }catch(e){console.warn('thumbnail',e)}
  });
  calc();
}

async function getPdfPages(file){try{const pdf=await window.pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;return pdf.numPages}catch{return 1}}
$('files').onchange=async e=>{const incoming=[...e.target.files];e.target.value='';if(!incoming.length)return;const start=selected.length;selected.push(...incoming.map(f=>Object.assign(f,{pages:1,mode:'bw',_edit:cloneEdit()})));renderFiles();for(let i=start;i<selected.length;i++)if(selected[i].type==='application/pdf')selected[i].pages=await getPdfPages(selected[i]);renderFiles();openCleanup(start)};
$('fileList').addEventListener('change',e=>{const s=e.target.closest('[data-mode]');if(s){selected[Number(s.dataset.mode)].mode=e.target.value;calc();}});
$('fileList').addEventListener('click',e=>{const ed=e.target.closest('[data-edit]'),rm=e.target.closest('[data-remove]');if(ed)return openCleanup(Number(ed.dataset.edit));if(rm){selected.splice(Number(rm.dataset.remove),1);renderFiles()}});
$('clearFiles').onclick=()=>{selected=[];finalPdf=null;closeCleanup();renderFiles()};
$('copies').addEventListener('input',calc);$('layout').addEventListener('change',()=>{calc();if($('layoutHint'))$('layoutHint').textContent=`${selected.length||0} file(s) → ${layoutSlots()} image/page capacity. Example: 10 image হলে 5 image/A4 নির্বাচন করলে 2 A4 page হবে.`});

function editFromInputs(){return{brightness:n($('brightness').value),contrast:n($('contrast').value),scale:n($('scale').value,100),sharpness:n($('sharpness').value),bwClean:$('bwClean').checked,cropRect:{...cropRect}}}
function setEditInputs(e){e=cloneEdit(e);$('brightness').value=e.brightness;$('contrast').value=e.contrast;$('scale').value=e.scale;$('sharpness').value=e.sharpness;$('bwClean').checked=!!e.bwClean;cropRect={...e.cropRect};updateEditLabels()}
function updateEditLabels(){$('brightnessVal').textContent=$('brightness').value;$('contrastVal').textContent=$('contrast').value;$('scaleVal').textContent=$('scale').value+'%';$('sharpnessVal').textContent=$('sharpness').value}
function applyImage(source,edit,forceMode){edit=cloneEdit(edit);const r=edit.cropRect||DEFAULT_EDIT.cropRect;const sx=Math.floor(source.width*r.x),sy=Math.floor(source.height*r.y),sw=Math.max(1,Math.floor(source.width*r.w)),sh=Math.max(1,Math.floor(source.height*r.h));const max=2200,base=Math.min(1,max/Math.max(sw,sh)),w=Math.max(1,Math.round(sw*base)),h=Math.max(1,Math.round(sh*base));const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});x.filter=`brightness(${100+n(edit.brightness)}%) contrast(${100+n(edit.contrast)}%)`;x.drawImage(source,sx,sy,sw,sh,0,0,w,h);x.filter='none';if(forceMode==='bw'){const d=x.getImageData(0,0,w,h),a=d.data;for(let i=0;i<a.length;i+=4){const g=a[i]*.299+a[i+1]*.587+a[i+2]*.114;const v=edit.bwClean?(g>165?255:g<90?0:g):g;a[i]=a[i+1]=a[i+2]=v}x.putImageData(d,0,0)}const sharp=n(edit.sharpness);if(sharp>0){const d=x.getImageData(0,0,w,h),src=d.data,out=new Uint8ClampedArray(src),s=Math.min(.45,sharp*.16);for(let y=1;y<h-1;y++)for(let xx=1;xx<w-1;xx++){const i=(y*w+xx)*4;for(let ch=0;ch<3;ch++){const v=src[i+ch]*(1+4*s)-s*(src[i-4+ch]+src[i+4+ch]+src[i-w*4+ch]+src[i+w*4+ch]);out[i+ch]=Math.max(0,Math.min(255,v))}}d.data.set(out);x.putImageData(d,0,0)}c._scale=n(edit.scale,100)/100;return c}
async function sourceForFile(file,pageNo=1){if(file.type==='application/pdf'){const pdf=await window.pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise,page=await pdf.getPage(pageNo);const base=page.getViewport({scale:1.5}),rs=Math.min(1.5,1800/Math.max(base.width,base.height)),vp=page.getViewport({scale:rs});const c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;return c}const img=new Image(),url=URL.createObjectURL(file);img.src=url;await new Promise((res,rej)=>{img.onload=res;img.onerror=rej});URL.revokeObjectURL(url);return img}
function cropBox(){return $('cropBox')}
function renderCropBox(){const wrap=$('cropStage'),box=cropBox();if(!wrap||!box)return;const r=cropRect;box.style.left=(r.x*100)+'%';box.style.top=(r.y*100)+'%';box.style.width=(r.w*100)+'%';box.style.height=(r.h*100)+'%'}
function pointerPos(ev){const rect=$('cropStage').getBoundingClientRect();return{x:Math.max(0,Math.min(1,(ev.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(ev.clientY-rect.top)/rect.height))}}
function syncCropStage(){const stage=$('cropStage'),canvas=$('previewCanvas');if(!stage||!canvas)return;requestAnimationFrame(()=>{const cw=canvas.getBoundingClientRect().width,ch=canvas.getBoundingClientRect().height;if(cw&&ch){stage.style.width=Math.min(cw,window.innerWidth-42)+'px';stage.style.height=Math.min(ch,window.innerHeight*.58)+'px';renderCropBox()}})}
$('cropBox').addEventListener('pointerdown',e=>{e.preventDefault();const p=pointerPos(e),r=cropRect,edge=.10;let action='move';if(Math.abs(p.x-r.x)<edge)action='left';else if(Math.abs(p.x-(r.x+r.w))<edge)action='right';if(Math.abs(p.y-r.y)<edge)action=action==='move'?'top':action+'top';else if(Math.abs(p.y-(r.y+r.h))<edge)action=action==='move'?'bottom':action+'bottom';drag={action,start:p,rect:{...r}};e.currentTarget.setPointerCapture(e.pointerId)});
$('cropBox').addEventListener('pointermove',e=>{if(!drag)return;const p=pointerPos(e),dx=p.x-drag.start.x,dy=p.y-drag.start.y,r={...drag.rect};if(drag.action==='move'){r.x=Math.max(0,Math.min(1-r.w,r.x+dx));r.y=Math.max(0,Math.min(1-r.h,r.y+dy))}else{if(drag.action.includes('left')){const nx=Math.max(0,Math.min(r.x+dx,r.x+r.w-.03));r.w=drag.rect.w+(drag.rect.x-nx);r.x=nx}if(drag.action.includes('right'))r.w=Math.max(.03,Math.min(1-r.x,drag.rect.w+dx));if(drag.action.includes('top')){const ny=Math.max(0,Math.min(r.y+dy,r.y+r.h-.03));r.h=drag.rect.h+(drag.rect.y-ny);r.y=ny}if(drag.action.includes('bottom'))r.h=Math.max(.03,Math.min(1-r.y,drag.rect.h+dy))}cropRect=r;renderCropBox();renderCleanupPreview()});
$('cropBox').addEventListener('pointerup',()=>drag=null);$('cropBox').addEventListener('pointercancel',()=>drag=null);
async function loadCleanupPage(){const f=selected[cleanupIndex];if(!f)return;try{cleanupSource=await sourceForFile(f,pdfPage);const pc=$('previewCanvas');pc.width=cleanupSource.width;pc.height=cleanupSource.height;renderCleanupPreview();syncCropStage();if(f.type==='application/pdf'){ $('pdfPageNav').classList.remove('hidden'); $('pdfPageLabel').textContent=`PDF page ${pdfPage} / ${pdfPageCount}`;$('pdfPrev').disabled=pdfPage<=1;$('pdfNext').disabled=pdfPage>=pdfPageCount }else $('pdfPageNav').classList.add('hidden')}catch(e){console.error(e);alert('Preview তৈরি করা যায়নি। PDF/Image fileটি আবার নির্বাচন করুন।');closeCleanup()}}
async function openCleanup(i=0){if(!selected[i])return;cleanupIndex=i;pdfPage=1;pdfPageCount=selected[i].pages||1;cleanupSource=null;$('cleanupModal').classList.remove('hidden');$('cleanupFileName').textContent=selected[i].name+(selected[i].type==='application/pdf'?` • ${pdfPageCount} page PDF`:'');setEditInputs(selected[i]._edit);await loadCleanupPage()}
function renderCleanupPreview(){if(!cleanupSource)return;updateEditLabels();const c=applyImage(cleanupSource,editFromInputs(),modeOf(selected[cleanupIndex]));const pc=$('previewCanvas');pc.width=c.width;pc.height=c.height;pc.getContext('2d').drawImage(c,0,0);syncCropStage()}
['brightness','contrast','scale','sharpness'].forEach(id=>$(id).addEventListener('input',renderCleanupPreview));$('bwClean').addEventListener('change',renderCleanupPreview);if($('openCleanup'))$('openCleanup').onclick=()=>openCleanup(0);$('closeCleanup').onclick=closeCleanup;$('resetCleanup').onclick=()=>{setEditInputs(DEFAULT_EDIT);renderCleanupPreview();renderCropBox()};$('pdfPrev').onclick=async()=>{if(pdfPage>1){pdfPage--;await loadCleanupPage()}};$('pdfNext').onclick=async()=>{if(pdfPage<pdfPageCount){pdfPage++;await loadCleanupPage()}};$('applyCleanup').onclick=()=>{if(!selected[cleanupIndex])return;selected[cleanupIndex]._edit=editFromInputs();renderFiles();const next=cleanupIndex+1;if(next<selected.length)openCleanup(next);else closeCleanup()};function closeCleanup(){$('cleanupModal').classList.add('hidden');cleanupSource=null}

async function uploadOrderFiles(){
  if(!orderId||!uploadToken)return false;
  const status=$('resultText');
  try{
    for(let i=0;i<selected.length;i++){
      const f=selected[i];
      const data=await blobToBase64(f);
      const r=await fetch('/api/order/files/upload',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({order_id:orderId,upload_token:uploadToken,file_id:'f'+i,name:f.name,type:f.type,size:f.size,mode:modeOf(f),pages:n(f.pages,1),data})});
      const d=await r.json().catch(()=>({}));
      if(!r.ok||!d.ok)throw new Error(d.error||'File upload failed');
      if(status)status.textContent=`Order ${orderId} • ${i+1}/${selected.length} file uploaded. Counter payment-এর পরে Owner panel-এ file preview হবে.`;
    }
    return true;
  }catch(e){console.error(e);alert('File Owner panel-এ পাঠানো যায়নি: '+(e.message||e));return false}
}
async function createOrder(){const name=$('name').value.trim(),mobile=$('mobile').value.trim();if(!name||mobile.length<10||!selected.length){alert('নাম, সঠিক মোবাইল এবং অন্তত একটি file দিন।');return null}const b=calc();if(b.total<=0){alert('Owner panel-এ B&W/Colour A4 price সেট করুন।');return null}const items=selected.map(f=>({name:f.name,type:f.type,pages:n(f.pages,1),mode:modeOf(f),edit:f._edit}));const r=await fetch('/api/order/create',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({customer_name:name,mobile,paper:$('paper').value,copies:b.copies,layout_slots:b.slots,items})});const d=await r.json().catch(()=>({}));if(!r.ok||!d.ok){alert(d.error||`Order তৈরি হয়নি (${r.status})`);return null}orderId=d.order_id;uploadToken=d.upload_token||'';const ok=await uploadOrderFiles();if(!ok)return null;return d}
$('cash').onclick=async()=>{const btn=$('cash');btn.disabled=true;try{const d=await createOrder();if(!d)return;paid=false;finalPdf=null;window.currentAmount=Number(d.amount||0);showReady(`Order ${orderId} তৈরি হয়েছে। ₹${window.currentAmount} টাকা কাউন্টারে দিন। টাকা নেওয়ার পরে Owner panel-এ Payment Received চাপলে file preview দেখা যাবে।`);startPaymentPolling()}finally{btn.disabled=false}};
function showReady(msg){$('result').classList.remove('hidden');$('resultText').innerHTML=esc(msg);}
async function preparePdfEarly(){try{finalPdf=await buildPdfBlob()}catch(e){console.error(e)}}
function speakBn(text){return new Promise(resolve=>{if(String(settings.voice_enabled)==='0'){resolve(false);return}const fallback=()=>{try{const a=new Audio('https://translate.google.com/translate_tts?ie=UTF-8&tl=bn&client=tw-ob&q='+encodeURIComponent(text));a.playbackRate=.78;a.onended=()=>resolve(true);a.onerror=()=>resolve(false);a.play().catch(()=>resolve(false))}catch(e){resolve(false)}};if(!('speechSynthesis'in window)){fallback();return}try{const speak=()=>{const vs=speechSynthesis.getVoices(),v=vs.find(x=>/^bn(-|_)/i.test(x.lang))||vs.find(x=>/bengali|bangla/i.test((x.name||'')+' '+(x.lang||'')));if(!v){fallback();return}const u=new SpeechSynthesisUtterance(text);u.lang='bn-IN';u.rate=.48;u.pitch=1;u.volume=1;u.voice=v;let done=false;const finish=ok=>{if(done)return;done=true;resolve(ok)};u.onend=()=>finish(true);u.onerror=()=>{speechSynthesis.cancel();fallback()};speechSynthesis.cancel();speechSynthesis.resume();speechSynthesis.speak(u);setTimeout(()=>finish(true),Math.max(12000,text.length*180))};if(speechSynthesis.getVoices().length)speak();else{speechSynthesis.onvoiceschanged=()=>{speechSynthesis.onvoiceschanged=null;speak()};setTimeout(()=>{if(!speechSynthesis.getVoices().length)fallback()},1200)}}catch{fallback()}})}
function enablePrintLock(){window.onbeforeunload=e=>{if(!printCompleted){e.preventDefault();e.returnValue='';return ''}}}
function disablePrintLock(){window.onbeforeunload=null}
function startPaymentPolling(){clearInterval(pollTimer);pollTimer=setInterval(async()=>{if(!orderId)return;try{const r=await fetch('/api/order/status?id='+encodeURIComponent(orderId),{cache:'no-store'}),d=await r.json();if(d.ok&&d.order.payment_status==='PAID'){clearInterval(pollTimer);paid=true;window.currentAmount=Number(d.order.amount_paise||0)/100;const msg=(settings.voice_message||'গ্রাহক আপনাকে প্রিন্ট করার জন্য ফাইল পাঠিয়েছে। ₹{amount} টাকা সংগ্রহ করে প্রিন্ট করে দিন।').replace('{amount}',Number(window.currentAmount).toFixed(0));showReady(`✅ Payment Received — ₹${window.currentAmount.toFixed(0)}। Owner panel-এ file preview ready. দোকান থেকে print করুন।`);await speakBn(msg)}}catch(e){console.error(e)}},1000)}

function blobToBase64(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]||'');r.onerror=reject;r.readAsDataURL(blob)})}
function addCanvas(doc,c,x,y,w,h){doc.addImage(c.toDataURL('image/jpeg',.92),'JPEG',x,y,w,h)}
async function allPagesForFile(f){const out=[];if(f.type==='application/pdf'){const pdf=await window.pdfjsLib.getDocument({data:await f.arrayBuffer()}).promise;for(let p=1;p<=pdf.numPages;p++)out.push(await sourceForFile(f,p))}else out.push(await sourceForFile(f));return out}
async function buildPdfBlob(modeFilter='all'){if(!selected.length)return null;const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'pt',format:'a4'});let first=true;for(const mode of ['bw','color']){if(modeFilter!=='all'&&mode!==modeFilter)continue;const fs=selected.filter(f=>modeOf(f)===mode);const pages=[];for(const f of fs){for(const src of await allPagesForFile(f))pages.push(applyImage(src,f._edit,mode))}if(!pages.length)continue;const slots=layoutSlots(),cols=slots===1?1:slots===2?2:slots===4?2:slots===6?3:3,rows=Math.ceil(slots/cols);const pw=doc.internal.pageSize.getWidth(),ph=doc.internal.pageSize.getHeight(),pad=18,gap=10,cellW=(pw-pad*2-gap*(cols-1))/cols,cellH=(ph-pad*2-gap*(rows-1))/rows;for(let copy=0;copy<Math.max(1,Math.floor(n($('copies')?.value,1)));copy++){for(let i=0;i<pages.length;i+=slots){if(!first)doc.addPage();first=false;for(let j=0;j<slots&&i+j<pages.length;j++){const c=pages[i+j],col=j%cols,row=Math.floor(j/cols),ratio=Math.min(cellW/c.width,cellH/c.height)*(c._scale||1),w=c.width*ratio,h=c.height*ratio,x=pad+col*(cellW+gap)+(cellW-w)/2,y=pad+row*(cellH+gap)+(cellH-h)/2;addCanvas(doc,c,x,y,w,h)}}}}const blob=doc.output('blob');if(modeFilter==='all')finalPdf=blob;return blob}
$('makePdf').onclick=()=>{alert(paid?'Payment Received হয়েছে। Owner panel-এ file preview করে নিজে print করুন।':'আগে কাউন্টারে payment দিন।')};
loadSettings();
