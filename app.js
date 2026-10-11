const $=id=>document.getElementById(id);
let selected=[], orderId=null, paid=false, finalPdf=null, settings={};

async function loadSettings(){
  const r=await fetch('/api/public-settings'); settings=await r.json();
  $('brandName').textContent=settings.business_name||'PrintPay';
  const qr=settings.upi_qr||'';
  if(qr){$('qr').src=qr;$('qrBox').classList.remove('hidden')}
  calc();
}
function mode(){return document.querySelector('input[name=mode]:checked').value}
function calc(){
  const pages=Math.max(1,selected.reduce((n,f)=>n+(f.type==='application/pdf'?(f.pages||1):1),0));
  const copies=Math.max(1,Number($('copies').value||1));
  const rate=mode()==='color'?Number(settings.price_color||8):Number(settings.price_bw||2);
  let total=rate*pages*copies;
  total*=1-Math.max(0,Math.min(100,Number(settings.global_discount||0)))/100;
  total+=Number(settings.delivery||0);
  $('amount').textContent='₹'+Math.max(0,Math.round(total));
  return {pages,copies,total:Math.max(0,Math.round(total))};
}
$('files').onchange=async e=>{
  selected=[...e.target.files].map(f=>Object.assign(f,{pages:1}));
  $('fileList').innerHTML=selected.map(f=>`<div class="file"><span>📎 ${f.name}</span><small>${(f.size/1024/1024).toFixed(2)} MB</small></div>`).join('');
  calc();
};
['copies','brightness','contrast','sharpness'].forEach(id=>$(id).addEventListener('input',calc));
document.querySelectorAll('input[name=mode]').forEach(x=>x.addEventListener('change',calc));
async function createOrder(payment_method){
  const name=$('name').value.trim(), mobile=$('mobile').value.trim();
  if(!name||mobile.length<10||selected.length===0){alert('Name, valid mobile and at least one file are required.');return null}
  const c=calc();
  const r=await fetch('/api/order/create',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
    customer_name:name,mobile,pages:c.pages,copies:c.copies,print_mode:mode(),paper:$('paper').value,payment_method
  })});
  const d=await r.json(); if(!r.ok||!d.ok){alert(d.error||'Could not create order');return null}
  orderId=d.order_id; return d;
}
$('online').onclick=async()=>{
  const d=await createOrder('razorpay'); if(!d)return;
  const options={key:d.key_id,amount:d.amount*100,currency:'INR',name:settings.business_name||'PrintPay',description:'Print order '+d.order_id,order_id:d.razorpay_order_id,prefill:{name:$('name').value,mobile:$('mobile').value},handler:async response=>{
    const r=await fetch('/api/payment/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...response,order_id:d.order_id})});
    const v=await r.json(); if(v.ok){paid=true;showReady('Online payment verified successfully.')}else alert(v.error||'Payment verification failed');
  }};
  new Razorpay(options).open();
};
$('cash').onclick=async()=>{
  const d=await createOrder('cash'); if(!d)return;
  showReady('Cash Counter order created. Please pay at the counter. Printing unlocks after owner confirms cash received.');
  paid=false;
};
function showReady(msg){$('result').classList.remove('hidden');$('resultText').innerHTML=`<b>Order ID:</b> ${orderId}<br><span>${msg}</span>`}
async function imageToCanvas(file){
  const img=new Image(); img.src=URL.createObjectURL(file); await img.decode();
  const c=document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight;
  const x=c.getContext('2d'); x.filter=`brightness(${100+Number($('brightness').value)}%) contrast(${100+Number($('contrast').value)}%)`; x.drawImage(img,0,0);
  if(mode()==='bw'||$('bwClean').checked){
    const d=x.getImageData(0,0,c.width,c.height), a=d.data;
    for(let i=0;i<a.length;i+=4){const y=.299*a[i]+.587*a[i+1]+.114*a[i+2];a[i]=a[i+1]=a[i+2]=y}
    x.putImageData(d,0,0);
  }
  return c;
}
async function makePdf(){
  if(!paid){alert('Payment must be completed and verified before printing. Cash orders unlock after owner approval.');return null}
  if(!selected.length)return null;
  const {jsPDF}=window.jspdf; const doc=new jsPDF({unit:'pt',format:$('paper').value==='A3'?'a3':$('paper').value==='Legal'?'legal':'a4'});
  let first=true;
  for(const f of selected){
    if(!first)doc.addPage(); first=false;
    if(f.type==='application/pdf'){
      const buf=await f.arrayBuffer(); const pdf=await window.pdfjsLib.getDocument({data:buf}).promise;
      for(let p=1;p<=pdf.numPages;p++){if(p>1||!first)doc.addPage(); const page=await pdf.getPage(p); const vp=page.getViewport({scale:1.5}); const c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;doc.addImage(c.toDataURL('image/jpeg',.92),'JPEG',0,0,doc.internal.pageSize.getWidth(),doc.internal.pageSize.getHeight());first=false}
    }else{
      const c=await imageToCanvas(f); doc.addImage(c.toDataURL('image/jpeg',.92),'JPEG',0,0,doc.internal.pageSize.getWidth(),doc.internal.pageSize.getHeight());
    }
  }
  finalPdf=doc.output('blob'); return finalPdf;
}
$('makePdf').onclick=async()=>{const b=await makePdf();if(b)alert('PDF ready. You can Print or Save PDF.')}
$('savePdf').onclick=async()=>{const b=finalPdf||await makePdf();if(!b)return;const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=(orderId||'PrintPay')+'.pdf';a.click()}
$('printPdf').onclick=async()=>{const b=finalPdf||await makePdf();if(!b)return;const url=URL.createObjectURL(b);const w=window.open(url);if(w)w.onload=()=>w.print()}
$('printQR').onclick=()=>{const src=$('qr').src;if(!src)return;const w=window.open('','_blank');w.document.write(`<html><body style="text-align:center;font-family:Arial"><h2>${settings.business_name||'PrintPay'} — UPI QR</h2><img src="${src}" style="width:320px"><script>window.onload=()=>window.print()<\/script></body></html>`)}
loadSettings();
