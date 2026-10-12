# PrintPay Direct Print Agent - no R2, no permanent file storage.
# Windows + Python 3.10+. The PDF exists only temporarily on this PC while printing.
import os,time,tempfile,threading,requests,websocket
BASE_URL=os.environ.get('PRINTPAY_URL','https://YOUR-PRINTPAY-URL').rstrip('/')
DESKTOP_KEY=os.environ.get('PRINTPAY_DESKTOP_KEY','CHANGE-ME-PRINTPAY')
seen=set(); active=set()

def ws_url(order_id):
    return BASE_URL.replace('https://','wss://').replace('http://','ws://')+f'/ws/desktop?order_id={order_id}'

def print_file(path,copies):
    # Uses Windows' registered PDF Print verb. For silent printing, install a PDF reader
    # that exposes a Print verb (e.g. Adobe Reader). No cloud storage is used.
    for _ in range(max(1,int(copies or 1))):
        os.startfile(path,'print')
        time.sleep(2.5)

def handle_job(job):
    oid=job['id']; active.add(oid); path=None
    try:
        ws=websocket.create_connection(ws_url(oid),header=[f'x-desktop-key: {DESKTOP_KEY}'],timeout=30)
        ws.send('{"type":"hello","role":"desktop"}')
        chunks=[]; expected=None; started=False
        deadline=time.time()+180
        while time.time()<deadline:
            ws.settimeout(10)
            try: msg=ws.recv()
            except websocket.WebSocketTimeoutException: continue
            if isinstance(msg,str):
                import json
                m=json.loads(msg)
                if m.get('type')=='start': expected=int(m.get('size',0)); started=True
                elif m.get('type')=='end' and started: break
                elif m.get('type')=='ready': pass
            else:
                chunks.append(msg)
        data=b''.join(chunks)
        if not data or (expected and len(data)!=expected): raise RuntimeError(f'incomplete print file ({len(data)}/{expected})')
        fd,path=tempfile.mkstemp(prefix='PrintPay-',suffix='.pdf');os.close(fd)
        with open(path,'wb') as f:f.write(data)
        print_file(path,job.get('copies',1))
        requests.post(BASE_URL+'/api/desktop/printed',headers={'x-desktop-key':DESKTOP_KEY,'content-type':'application/json'},json={'order_id':oid},timeout=20).raise_for_status()
        try: ws.send('{"type":"done"}')
        except: pass
        ws.close();seen.add(oid);print('PRINTED',oid)
    except Exception as e: print('Job',oid,'error:',e)
    finally:
        active.discard(oid)
        if path:
            try: os.remove(path)
            except: pass

def main():
    print('PrintPay Direct Print Agent started. R2/storage is NOT used.')
    while True:
        try:
            r=requests.get(BASE_URL+'/api/desktop/jobs',headers={'x-desktop-key':DESKTOP_KEY},timeout=30);r.raise_for_status()
            for job in r.json().get('jobs',[]):
                oid=job['id']
                if oid in seen or oid in active: continue
                threading.Thread(target=handle_job,args=(job,),daemon=True).start()
        except Exception as e: print('Agent:',e)
        time.sleep(3)
if __name__=='__main__': main()
