
const electron=require('electron'),fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const {app,BrowserWindow}=electron;
const path=require('path'),os=require('os');
const root=path.resolve(__dirname,'..');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ia-use-test-'));
fs.mkdirSync(path.join(dir,'renderer'),{recursive:true});
fs.mkdirSync(path.join(dir,'shared'),{recursive:true});
for(const name of ['index.html','app.js','injector.js','styles.css']) fs.copyFileSync(path.join(root,'src/renderer',name),path.join(dir,'renderer',name));
fs.copyFileSync(path.join(root,'src/shared/providers.js'),path.join(dir,'shared/providers.js'));
const fixture=`<script>setTimeout(()=>{document.body.innerHTML='<form onsubmit="event.preventDefault()"><fieldset><textarea placeholder="Prompt"></textarea><div class="ProseMirror" role="textbox" contenteditable="true" style="width:300px;height:60px;border:1px solid"></div><button type="submit" aria-label="Send message" onclick="window.sent=(window.sent||0)+1">Send</button></fieldset></form><div data-message-author-role="assistant" class="font-claude-message markdown prose ds-markdown">RISPOSTA DI PROVA COMPLETA</div>'},350)</script>`;
const testSetup=`window.__review={state,mountedPanes,dispatchPromptToProviders,handleOmnibarSend,appendProviderOutputToDoc,setCapturedContext,updateUI};\nAI_PROVIDERS.forEach(p=>p.url=${JSON.stringify('data:text/html,'+encodeURIComponent(fixture))});\n`;
const appPath=path.join(dir,'renderer/app.js');
const source=fs.readFileSync(appPath,'utf8');
if(!source.includes('  // Boot')) throw new Error('Renderer boot marker missing');
fs.writeFileSync(appPath,source.replace('  // Boot',testSetup+'  // Boot'));
app.setPath('userData',dir+'/profile');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let memory='',external=[];
class TestWindow extends BrowserWindow {constructor(options){super({...options,show:false});}loadFile(filename){return super.loadFile(dir+'/renderer/index.html');}}
const moduleElectron={app,BrowserWindow:TestWindow,session:electron.session,Menu:electron.Menu,shell:{openExternal:async url=>external.push(url)},ipcMain:electron.ipcMain,clipboard:{writeText:text=>memory=text,readText:()=>memory},dialog:electron.dialog};
app.whenReady().then(async()=>{
if(app.dock)app.dock.hide();
const context={require:name=>name==='electron'?moduleElectron:require(name),__dirname:root+'/src/main',process,URL};
vm.createContext(context);vm.runInContext(fs.readFileSync(root+'/src/main/main.js','utf8')+'\nglobalThis.getWindow=()=>mainWindow;',context);
let win;for(let i=0;i<100;i++){win=context.getWindow();if(win&&!win.webContents.isLoading())break;await pause(50);}
win.webContents.on('console-message',(_e,_level,message)=>{if(message.includes('Error'))console.error('RENDERER',message)});const js=code=>win.webContents.executeJavaScript(code);
for(let i=0;i<100;i++){if(await js('Boolean(window.__review)'))break;await pause(50);}
await js('electronAPI.copyText("TEST_CLIPBOARD_BRIDGE")');assert.equal(memory,'TEST_CLIPBOARD_BRIDGE');assert.equal(await js('electronAPI.readClipboard()'),'TEST_CLIPBOARD_BRIDGE');console.log('PASS actual sandbox preload + authorized clipboard IPC');
const hidden=JSON.parse(await js("(async()=>{const result=await __review.dispatchPromptToProviders(['deepseek'],'HIDDEN PROMPT',true);const e=__review.mountedPanes.get('deepseek');return JSON.stringify({result,sent:await e.webview.executeJavaScript('window.sent'),value:await e.webview.executeJavaScript('document.querySelector(\"textarea\").value'),display:getComputedStyle(e.pane).display})})()"));
assert.equal(hidden.result.failed.length,0);assert.equal(hidden.sent,1);assert.equal(hidden.value,'HIDDEN PROMPT');assert.equal(hidden.display,'none');console.log('PASS delayed editor + new hidden provider sends exactly once');
await js('document.getElementById("doc-topic-input").value="Test";document.getElementById("btn-step1-generate").click()');await pause(900);
const sync=JSON.parse(await js('JSON.stringify({visible:__review.state.visibleProviders,targets:[...__review.state.selectedTargets]})'));
assert.deepEqual(sync.visible,['chatgpt','venice']);assert.deepEqual(sync.targets,['chatgpt','venice']);console.log('PASS staffetta target synchronization');
await js(`(() => { const el=document.getElementById('unified-doc-textarea'); el.value='DOCUMENTO DA CONSERVARE'; el.dispatchEvent(new Event('input')); window.confirmCount=0; window.confirm=()=>{window.confirmCount++; return false;}; document.getElementById('btn-step2-handover').click(); })()`);
for(let i=0;i<100 && !(await js('window.confirmCount'));i++) await pause(50);
const cancel=JSON.parse(await js(`JSON.stringify({count:window.confirmCount,text:document.getElementById('unified-doc-textarea').value,saved:localStorage.getItem('ia_use_unified_doc')})`));
assert.equal(cancel.count,1);assert.equal(cancel.text,'DOCUMENTO DA CONSERVARE');assert.equal(cancel.saved,'DOCUMENTO DA CONSERVARE');console.log('PASS cancelled step 2 preserves editor + storage');
await pause(50);
await js(`window.confirm=()=>{window.confirmCount++; return true;}; document.getElementById('btn-step2-handover').click()`);
for(let i=0;i<100 && (await js('window.confirmCount'))<2;i++) await pause(50);
const accept=JSON.parse(await js(`JSON.stringify({count:window.confirmCount,text:document.getElementById('unified-doc-textarea').value,saved:localStorage.getItem('ia_use_unified_doc')})`));
assert.equal(accept.count,2);assert.equal(accept.text,'RISPOSTA DI PROVA COMPLETA');assert.equal(accept.saved,accept.text);console.log('PASS accepted step 2 replaces document');
const double=await js('(async()=>{const s=__review.state;s.syncTargetsWithVisible=false;s.selectedTargets=new Set(["deepseek"]);const e=__review.mountedPanes.get("deepseek");await e.webview.executeJavaScript("window.sent=0");document.getElementById("omnibar-input").value="ONLY ONCE";await Promise.all([__review.handleOmnibarSend(),__review.handleOmnibarSend()]);return e.webview.executeJavaScript("window.sent")})()');assert.equal(double,1);console.log('PASS concurrent omnibar clicks do not duplicate sends');
await js(`document.getElementById('sel-relay-ai-2').value='claude'; document.getElementById('btn-step1-generate').click()`);
await pause(500);
const manual=JSON.parse(await js('JSON.stringify({targets:[...__review.state.selectedTargets],visible:__review.state.visibleProviders})'));assert.deepEqual(manual.visible,['chatgpt','claude']);assert.deepEqual(manual.targets,['deepseek']);console.log('PASS manual targets preserved after panel changes');
win.destroy();app.quit();
}).catch(e=>{console.error(e);app.exit(1)});
const timeout=setTimeout(()=>{console.error('Smoke timeout');app.exit(2)},25000);
app.on('will-quit',()=>clearTimeout(timeout));
process.on('exit',()=>{try { fs.rmSync(dir,{recursive:true,force:true}); } catch (_) {} });
