import os, json, time, tempfile, threading, subprocess, queue
from datetime import datetime
import tkinter as tk
from tkinter import ttk, messagebox
import requests, websocket
try:
    import win32print
except Exception:
    win32print = None

APP_NAME='PrintPay Desktop'
CONFIG=os.path.join(os.environ.get('APPDATA', os.path.expanduser('~')), 'PrintPayDesktop', 'config.json')
os.makedirs(os.path.dirname(CONFIG), exist_ok=True)

class App:
    def __init__(self, root):
        self.root=root; root.title(APP_NAME); root.geometry('1100x700'); root.minsize(900,560)
        self.s=requests.Session(); self.base=''; self.desktop_key=''; self.settings={}; self.running=False; self.seen=set(); self.active=set(); self.announced=set(); self.q=queue.Queue(); self.voice_name='' ; self.printers=[]
        self.build_login()
        root.after(300, self.drain_queue)

    def clear(self):
        for w in self.root.winfo_children(): w.destroy()

    def build_login(self):
        self.clear(); f=ttk.Frame(self.root,padding=35); f.pack(fill='both',expand=True)
        ttk.Label(f,text='🖨️ PrintPay Desktop',font=('Segoe UI',24,'bold')).pack(pady=(60,8))
        ttk.Label(f,text='Owner payment + automatic print station',font=('Segoe UI',12)).pack(pady=(0,30))
        form=ttk.Frame(f); form.pack()
        ttk.Label(form,text='PrintPay URL').grid(row=0,column=0,sticky='w',pady=7)
        self.url=ttk.Entry(form,width=55); self.url.grid(row=0,column=1,pady=7)
        ttk.Label(form,text='Owner Username').grid(row=1,column=0,sticky='w',pady=7)
        self.user=ttk.Entry(form,width=55); self.user.insert(0,'owner'); self.user.grid(row=1,column=1,pady=7)
        ttk.Label(form,text='Owner Password').grid(row=2,column=0,sticky='w',pady=7)
        self.pw=ttk.Entry(form,width=55,show='•'); self.pw.grid(row=2,column=1,pady=7)
        ttk.Label(form,text='Print Station Key').grid(row=3,column=0,sticky='w',pady=7)
        self.key=ttk.Entry(form,width=55,show='•'); self.key.grid(row=3,column=1,pady=7)
        ttk.Button(f,text='🔐 Login & Start Print Station',command=self.login).pack(pady=22)
        ttk.Label(f,text='Print Station Key must exactly match Owner → Settings → Print Station Key. Printer names are detected from Windows automatically; you can also type the exact Windows printer name.',wraplength=700,justify='center').pack(pady=10)
        cfg=self.load_config()
        if cfg:
            self.url.insert(0,cfg.get('url','')); self.key.insert(0,cfg.get('key',''))

    def load_config(self):
        try:
            with open(CONFIG,'r',encoding='utf-8') as f:return json.load(f)
        except:return {}
    def save_config(self):
        try:
            with open(CONFIG,'w',encoding='utf-8') as f: json.dump({'url':self.base,'key':self.desktop_key},f)
        except: pass

    def login(self):
        self.base=self.url.get().strip().rstrip('/')
        self.desktop_key=self.key.get().strip()
        if not self.base.startswith('https://') or not self.desktop_key:
            messagebox.showerror('PrintPay','Use your HTTPS PrintPay URL and Print Station Key.') ; return
        try:
            r=self.s.post(self.base+'/api/owner/login',json={'username':self.user.get().strip(),'password':self.pw.get()},timeout=20)
            d=r.json()
            if not r.ok or not d.get('ok'): raise RuntimeError(d.get('error','Login failed'))
            test=self.s.get(self.base+'/api/desktop/settings',headers={'x-desktop-key':self.desktop_key},timeout=15)
            if not test.ok:
                td=test.json() if test.headers.get('content-type','').startswith('application/json') else {}
                raise RuntimeError(td.get('error','Print Station Key is not accepted. Owner Settings-এর key-এর সাথে exact match করুন.'))
            self.save_config(); self.load_settings(); self.build_panel(); self.refresh_orders(); self.running=True
            threading.Thread(target=self.poll_jobs,daemon=True).start()
        except Exception as e: messagebox.showerror('Login failed',str(e))

    def load_settings(self):
        r=self.s.get(self.base+'/api/owner/settings',timeout=20); r.raise_for_status(); self.settings=r.json()
    def build_panel(self):
        self.clear(); top=ttk.Frame(self.root,padding=10); top.pack(fill='x')
        ttk.Label(top,text='🖨️ PrintPay Desktop',font=('Segoe UI',18,'bold')).pack(side='left')
        self.status=ttk.Label(top,text='● Connected'); self.status.pack(side='left',padx=20)
        ttk.Button(top,text='Refresh',command=self.refresh_orders).pack(side='right')
        ttk.Button(top,text='Logout',command=self.logout).pack(side='right',padx=6)
        st=ttk.LabelFrame(self.root,text='Printer Settings',padding=10); st.pack(fill='x',padx=10,pady=5)
        row=ttk.Frame(st); row.pack(fill='x')
        ttk.Label(row,text='B&W Printer').pack(side='left'); self.bw=ttk.Combobox(row,width=30,state='normal'); self.bw.pack(side='left',padx=6); self.bw['values']=self.list_printers(); self.bw.set(self.settings.get('bw_printer','') or (self.bw['values'][0] if self.bw['values'] else ''))
        ttk.Label(row,text='Colour Printer').pack(side='left',padx=(14,0)); self.col=ttk.Combobox(row,width=30,state='normal'); self.col.pack(side='left',padx=6); self.col['values']=self.bw['values']; self.col.set(self.settings.get('color_printer','') or (self.col['values'][0] if self.col['values'] else ''))
        ttk.Button(row,text='🔄 Detect Printers',command=self.refresh_printer_list).pack(side='left',padx=6)
        ttk.Button(row,text='🧪 Test Printer',command=self.test_selected_printer).pack(side='left',padx=6)
        self.auto=tk.BooleanVar(value=self.settings.get('auto_print','1')!='0')
        ttk.Checkbutton(row,text='Automatic Print',variable=self.auto).pack(side='left',padx=8)
        ttk.Button(row,text='💾 Save',command=self.save_station_settings).pack(side='right')
        self.info=ttk.Label(st,text=''); self.info.pack(anchor='w',pady=(6,0))
        if not self.bw.get() and not self.col.get():
            self.info.config(text='No printer detected. Click 🔄 Detect Printers. If still empty, install/restart PrintPay Desktop.')
        cols=('time','id','name','mobile','pages','copies','mode','amount','payment','status','action')
        self.tree=ttk.Treeview(self.root,columns=cols,show='headings',height=20)
        heads={'time':'Date/Time','id':'Order ID','name':'Name','mobile':'Mobile','pages':'Pages','copies':'Copies','mode':'Mode','amount':'Amount','payment':'Payment','status':'Status','action':'Action'}
        widths={'time':150,'id':170,'name':120,'mobile':110,'pages':60,'copies':60,'mode':70,'amount':80,'payment':90,'status':90,'action':140}
        for c in cols:self.tree.heading(c,text=heads[c]);self.tree.column(c,width=widths[c],anchor='center')
        self.tree.pack(fill='both',expand=True,padx=10,pady=8)
        self.tree.bind('<Double-1>',self.double_click)
        self.context=ttk.Label(self.root,text='Double-click a pending order to receive cash payment. Printing starts automatically when enabled.',padding=8)
        self.context.pack(fill='x')
        self.update_info()

    def list_printers(self):
        vals=[]
        # Preferred: native Windows print API via pywin32. This is much more
        # reliable than parsing PowerShell output.
        if win32print is not None:
            try:
                flags = win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
                for item in win32print.EnumPrinters(flags):
                    name = item[2]
                    if name and name not in vals:
                        vals.append(name)
            except Exception:
                pass
        # Fallbacks for machines where pywin32 is unavailable.
        commands=[
            ["powershell.exe","-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-Command",
             "Get-Printer -ErrorAction Stop | Select-Object -ExpandProperty Name"],
            ["powershell.exe","-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-Command",
             "Get-CimInstance Win32_Printer -ErrorAction Stop | Select-Object -ExpandProperty Name"]
        ]
        for args in commands:
            try:
                r=subprocess.run(args,capture_output=True,text=True,timeout=12)
                for x in r.stdout.splitlines():
                    x=x.strip()
                    if x and x not in vals: vals.append(x)
                if vals: break
            except Exception:
                pass
        if not vals:
            try:
                r=subprocess.run(['wmic','printer','get','name'],capture_output=True,text=True,timeout=10)
                for x in r.stdout.splitlines()[1:]:
                    x=x.strip()
                    if x and x not in vals: vals.append(x)
            except Exception:
                pass
        self.printers=vals
        return vals
    def refresh_printer_list(self):
        vals=self.list_printers(); oldbw=self.bw.get(); oldco=self.col.get(); self.bw['values']=vals; self.col['values']=vals
        if oldbw in vals:self.bw.set(oldbw)
        elif vals:self.bw.set(vals[0])
        if oldco in vals:self.col.set(oldco)
        elif vals:self.col.set(vals[0])
        self.update_info()

    def test_selected_printer(self):
        printer=(self.bw.get().strip() or self.col.get().strip())
        if not printer:
            messagebox.showwarning('Printer', 'আগে B&W বা Colour Printer select/type করুন।')
            return
        path=None
        try:
            fd,path=tempfile.mkstemp(prefix='PrintPay-Test-',suffix='.txt');os.close(fd)
            with open(path,'w',encoding='utf-8') as f:
                f.write('PrintPay Printer Test\n\nএই পেজটি শুধু printer setting পরীক্ষা করার জন্য।\n')
            os.startfile(path,'printto',printer)
            messagebox.showinfo('Printer Test', f'Test print পাঠানো হয়েছে:\n{printer}')
        except Exception as e:
            messagebox.showerror('Printer Test', f'Printer কাজ করছে না বা নামটি ভুল:\n{printer}\n\n{e}')
        finally:
            if path:
                try: os.remove(path)
                except: pass

    def update_info(self):
        bw=self.settings.get('bw_printer') or 'Default printer'; co=self.settings.get('color_printer') or 'Default printer'
        self.info.config(text=f"B&W Printer: {bw}   |   Colour Printer: {co}   |   Auto: {'ON' if self.auto.get() else 'OFF'}")

    def save_station_settings(self):
        try:
            payload={'bw_printer':self.bw.get().strip(),'color_printer':self.col.get().strip(),'auto_print':'1' if self.auto.get() else '0'}
            r=self.s.post(self.base+'/api/owner/settings',json=payload,timeout=20); r.raise_for_status(); self.load_settings(); self.update_info(); messagebox.showinfo('PrintPay','Printer settings saved.')
        except Exception as e: messagebox.showerror('Settings',str(e))
    def reload_settings(self):
        try:
            self.load_settings(); self.auto.set(self.settings.get('auto_print','1')!='0'); self.bw.delete(0,'end'); self.bw.insert(0,self.settings.get('bw_printer','')); self.col.delete(0,'end'); self.col.insert(0,self.settings.get('color_printer','')); self.update_info(); self.refresh_orders()
        except Exception as e: messagebox.showerror('Settings',str(e))

    def refresh_orders(self):
        if not self.running and not hasattr(self,'tree'): return
        try:
            r=self.s.get(self.base+'/api/owner/orders',timeout=20); r.raise_for_status(); self.orders=r.json(); self.render_orders()
            self.status.config(text='● Connected')
        except Exception as e:
            if hasattr(self,'status'): self.status.config(text='● Offline')

    def render_orders(self):
        for x in self.tree.get_children():self.tree.delete(x)
        for o in self.orders:
            self.tree.insert('', 'end', iid=o['id'], values=(datetime.fromisoformat(o['created_at'].replace('Z','+00:00')).astimezone().strftime('%d-%m-%Y %H:%M'),o['id'],o['customer_name'],o['mobile'],o['pages'],o['copies'],o['print_mode'],'₹'+format(o['amount_paise']/100,'.2f'),o['payment_status'],o['order_status'],'Double-click'))

    def double_click(self,event):
        iid=self.tree.identify_row(event.y)
        if not iid:return
        o=next((x for x in getattr(self,'orders',[]) if x['id']==iid),None)
        if not o:return
        if o['payment_status']=='PAID':return
        amount=o['amount_paise']/100
        if messagebox.askyesno('Payment Received',f"Customer: {o['customer_name']}\nAmount: ₹{amount:.2f}\n\nCash payment received?\n\nYes = mark PAID and allow printing"):
            try:
                r=self.s.post(self.base+'/api/owner/cash-paid',json={'order_id':iid},timeout=20); d=r.json()
                if not r.ok or not d.get('ok'): raise RuntimeError(d.get('error','Payment failed'))
                self.refresh_orders()
            except Exception as e: messagebox.showerror('Payment',str(e))

    def speak(self,text):
        if self.settings.get('voice_enabled','1')=='0': return
        try:
            safe=text.replace("'","''")
            # Prefer an installed Bengali/Bangla Windows voice; otherwise use the default SAPI voice.
            ps="Add-Type -AssemblyName System.Speech; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; $v=$s.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -match '^bn(-|$)' -or $_.VoiceInfo.Name -match 'Bengali|Bangla' } | Select-Object -First 1; if($v){$s.SelectVoice($v.VoiceInfo.Name)}; $s.Rate=-2; $s.Volume=100; $s.Speak('"+safe+"')"
            subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',ps],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=20,check=False)
        except Exception: pass

    def poll_jobs(self):
        while self.running:
            try:
                self.load_settings()
                if self.auto.get():
                    r=self.s.get(self.base+'/api/desktop/jobs',headers={'x-desktop-key':self.desktop_key},timeout=8);r.raise_for_status()
                    for job in r.json().get('jobs',[]):
                        oid=job['id']
                        if job.get('payment_status')=='PENDING' and oid not in self.announced:
                            self.announced.add(oid)
                            self.speak(f"গ্রাহক আপনাকে প্রিন্ট করার জন্য ফাইল পাঠিয়েছে। {job['amount_paise']/100:.0f} টাকা সংগ্রহ করে প্রিন্ট করে দিন।")
                        if oid not in self.seen and oid not in self.active:
                            self.active.add(oid); threading.Thread(target=self.handle_job,args=(job,),daemon=True).start()
                self.q.put('refresh')
            except Exception:self.q.put('offline')
            time.sleep(1)

    def handle_job(self,job):
        oid=job['id']; path=None
        try:
            ws=websocket.create_connection(self.base.replace('https://','wss://')+'/ws/desktop?order_id='+oid,header=[f'x-desktop-key: {self.desktop_key}'],timeout=20)
            ws.send(json.dumps({'type':'hello','role':'desktop'})); chunks=[]; expected=0; started=False; finished=False; paid=(job.get('payment_status')=='PAID'); deadline=time.time()+300
            while time.time()<deadline:
                ws.settimeout(5)
                try: msg=ws.recv()
                except websocket.WebSocketTimeoutException: continue
                if isinstance(msg,str):
                    m=json.loads(msg)
                    if m.get('type')=='start': expected=int(m.get('size',0)); started=True
                    elif m.get('type')=='paid': paid=True
                    elif m.get('type')=='end' and started: finished=True
                    elif m.get('type')=='printed': break
                else:
                    chunks.append(msg)
                if finished and paid: break
            data=b''.join(chunks)
            if not data or (expected and len(data)!=expected): raise RuntimeError('Incomplete print file. Customer page must remain open.')
            if not paid:
                # Wait briefly for Owner payment approval without downloading again.
                wait_until=time.time()+300
                while time.time()<wait_until and not paid:
                    ws.settimeout(2)
                    try: msg=ws.recv()
                    except websocket.WebSocketTimeoutException: continue
                    if isinstance(msg,str) and json.loads(msg).get('type')=='paid': paid=True
            if not paid: raise RuntimeError('Payment not received.')
            fd,path=tempfile.mkstemp(prefix='PrintPay-',suffix='.pdf');os.close(fd)
            with open(path,'wb') as f:f.write(data)
            mode=job.get('print_mode','bw'); printer=self.settings.get('color_printer' if mode=='color' else 'bw_printer','') or ''
            copies=max(1,int(job.get('copies',1)))
            if not printer: raise RuntimeError('Printer not selected. Open Printer Settings and select a printer.')
            for _ in range(copies):
                os.startfile(path,'printto',printer)
                time.sleep(2)
            self.s.post(self.base+'/api/desktop/printed',headers={'x-desktop-key':self.desktop_key},json={'order_id':oid},timeout=8).raise_for_status()
            try:ws.send(json.dumps({'type':'done'}))
            except:pass
            ws.close();self.seen.add(oid)
        except Exception as e:self.q.put(('error',oid,str(e)))
        finally:
            self.active.discard(oid)
            if path:
                try:os.remove(path)
                except:pass

    def drain_queue(self):
        try:
            while True:
                x=self.q.get_nowait()
                if x=='refresh': self.refresh_orders()
                elif x=='offline' and hasattr(self,'status'): self.status.config(text='● Reconnecting…')
                elif isinstance(x,tuple): messagebox.showerror('Print error',f'{x[1]}\n{x[2]}')
        except queue.Empty:pass
        self.root.after(300,self.drain_queue)

    def logout(self):
        self.running=False
        try:self.s.get(self.base+'/api/owner/logout',timeout=10)
        except:pass
        self.build_login()

root=tk.Tk();
try: ttk.Style().theme_use('clam')
except: pass
App(root); root.mainloop()
