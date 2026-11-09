/** Local-only synthetic browser regression. Provide Playwright externally; no production URL is accepted. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const project = process.cwd();
const current = path.resolve(process.env.REPAIR_CURRENT_SITE || 'out');
const previous = process.env.REPAIR_PREVIOUS_SITE ? path.resolve(process.env.REPAIR_PREVIOUS_SITE) : null;
const output = path.resolve('test-results/repair-e2e'); fs.mkdirSync(output, { recursive: true });
const legacy = JSON.parse(fs.readFileSync('scripts/regression/fixtures/records-v1-587a084.json', 'utf8'));
const copy = value => structuredClone(value);
const KEY = 'ziwei-personal-records-v1', ACTIVE = 'ziwei-active-record-v1';
const basePath = JSON.parse(fs.readFileSync(path.join(current,'precache-manifest.json'))).basePath;
assert.equal(basePath, '/csk', 'these regression scenarios explicitly exercise the target subpath');
const currentVersion = JSON.parse(fs.readFileSync(path.join(current,'precache-manifest.json'))).version;
let served = current, boundaryBundle;
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.txt':'text/plain'};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/__boundary-fixture/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><div id="root"></div><script src="/__boundary-fixture.js"></script>');return;}
  if(url.pathname==='/__boundary-fixture.js'&&boundaryBundle){res.setHeader('Content-Type','application/javascript');res.end(boundaryBundle);return;}
  if(!url.pathname.startsWith(basePath+'/')){res.writeHead(404).end();return;}
  let name=decodeURIComponent(url.pathname.slice(basePath.length+1));if(!name||name.endsWith('/'))name+='index.html';
  const file=path.resolve(served,name);
  if(!file.startsWith(served+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-cache');res.end(fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`, base=origin+basePath+'/';
const results=[],contexts=new Set();let page;
const profile=()=>fs.mkdtempSync(path.join(os.tmpdir(),'csk-r3-'));
async function launch(profileDir=profile(),offline=false){
  const context=await chromium.launchPersistentContext(profileDir,{headless:true,viewport:{width:440,height:956},acceptDownloads:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
  contexts.add(context);await context.setOffline(offline);return context;
}
async function close(context){await Promise.all(context.pages().map(p=>p.close()));await new Promise(resolve=>setTimeout(resolve,300));await context.close();contexts.delete(context);}
async function scenario(name,run){
  const start=Date.now();
  try{const details=await run();results.push({name,status:'PASS',milliseconds:Date.now()-start,details});}
  catch(error){results.push({name,status:'FAIL',milliseconds:Date.now()-start,error:String(error)});if(page&&!page.isClosed())await page.screenshot({path:path.join(output,name+'-failure.png'),fullPage:true}).catch(()=>{});}
  finally{for(const context of [...contexts])await close(context).catch(()=>{});}
  console.log(JSON.stringify(results.at(-1)));
}
const ready=p=>p.locator('[data-testid="cache-status"][data-ready="true"]').waitFor({timeout:30000});
const raw=p=>p.evaluate(key=>localStorage.getItem(key),KEY);
const records=async p=>JSON.parse(await raw(p)).records;
async function upload(p,payload){await p.getByLabel('导入命盘备份',{exact:true}).setInputFiles({name:'qa-synthetic.json',mimeType:'application/json',buffer:Buffer.from(typeof payload==='string'?payload:JSON.stringify(payload))});}
async function download(p,button,filename){const pending=p.waitForEvent('download');await p.getByRole('button',{name:button,exact:true}).click();const saved=path.join(output,filename);await(await pending).saveAs(saved);return fs.readFileSync(saved,'utf8');}
async function fill(p,year='1992',lunar=false){
  if(lunar)await p.getByRole('button',{name:'农历',exact:true}).click();
  await p.getByLabel('出生年份',{exact:true}).selectOption(year);
  await p.getByLabel('出生月份',{exact:true}).selectOption(lunar?'12':'1');
  await p.getByLabel('出生日期',{exact:true}).selectOption(lunar?'15':'1');
  await p.getByLabel('出生小时',{exact:true}).selectOption('12');
  await p.getByLabel('姓名或备注（可选）',{exact:true}).fill('QA_ROUND3_ONLY');
}
async function generate(p){await p.getByRole('button',{name:'立即起盘',exact:true}).click();await p.getByRole('button',{name:'保存命盘',exact:true}).waitFor();}
function damagedEnvelope(){const data=copy(legacy),bad=copy(data.records[0]),last=copy(data.records[0]);data.records[0].id='qa-good-first';bad.id='qa-bad-active';last.id='qa-good-last';bad.chart.palaces[0].stars[0].brightnessRaw={invalid:true};data.records.push(bad,last);return JSON.stringify(data,null,2);}
async function seed(p,value,active){await p.evaluate(({key,value,activeKey,active})=>{localStorage.setItem(key,value);localStorage.setItem(activeKey,active);},{key:KEY,value,activeKey:ACTIVE,active});}
async function waitVersion(p,expected){await p.waitForFunction(async expected=>{
  const worker=navigator.serviceWorker.controller;if(!worker)return false;
  const status=await new Promise(resolve=>{const ch=new MessageChannel();ch.port1.onmessage=e=>{ch.port1.close();resolve(e.data);};worker.postMessage({type:'CACHE_STATUS'},[ch.port2]);setTimeout(()=>resolve(null),1000);});return status?.ready&&status.version===expected;
},expected,{timeout:30000});}

try{
  await scenario('normal-legacy-atomic-boundary-offline',async()=>{
    served=current;const id=profile();let context=await launch(id);page=context.pages()[0]||await context.newPage();
    const errors=[],mutations=[];page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))mutations.push(r.method()+' '+r.url());});
    await page.goto(base,{waitUntil:'networkidle'});await ready(page);
    await page.getByRole('button',{name:'我的命盘',exact:true}).click();await upload(page,legacy);
    await page.getByText('已导入 1 条记录，现有命盘保持保留。',{exact:true}).waitFor();
    assert.deepEqual((await records(page))[0].chart,legacy.records[0].chart);
    await page.locator('.app-record-open').first().click();await page.getByRole('button',{name:'另存为新记录',exact:true}).waitFor();
    await page.getByRole('button',{name:'← 新建命盘',exact:true}).click();await fill(page);await generate(page);await page.getByRole('button',{name:'保存命盘',exact:true}).click();
    await page.getByRole('button',{name:/^我的命盘/}).click();
    const backup=await download(page,'导出本地备份','normal-backup.json');assert.equal(JSON.parse(backup).records.length,2);
    await upload(page,backup);await page.getByText('已导入 2 条记录，现有命盘保持保留。',{exact:true}).waitFor();
    const beforeDelete=await records(page),removeId=beforeDelete[0].id;
    await page.getByRole('button',{name:/^删除 /}).first().click();await page.getByRole('button',{name:'确认删除',exact:true}).click();
    assert.deepEqual(await records(page),beforeDelete.filter(r=>r.id!==removeId));
    const beforeBad=await raw(page);await upload(page,damagedEnvelope());await page.locator('p.app-notice.error').filter({hasText:'brightnessRaw'}).waitFor();assert.equal(await raw(page),beforeBad);
    await page.getByRole('button',{name:'起盘看盘',exact:true}).click();await page.getByRole('button',{name:'← 新建命盘',exact:true}).click();await fill(page,'2050',true);
    await page.getByRole('button',{name:'公历',exact:true}).click();assert.equal(await page.getByLabel('出生年份',{exact:true}).inputValue(),'2051');
    await page.getByRole('button',{name:'农历',exact:true}).click();assert.equal(await page.getByLabel('出生年份',{exact:true}).inputValue(),'2050');
    await generate(page);await page.getByRole('button',{name:'保存命盘',exact:true}).click();
    const boundary=(await records(page))[0];assert.equal(boundary.birthInfo.origInput.year,2051);assert.equal(boundary.birthInfo.origInput.day,27);
    const beforeCold=await raw(page);await close(context);context=await launch(id,true);page=context.pages()[0]||await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
    await page.goto(base,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'另存为新记录',exact:true}).waitFor();assert.equal(await raw(page),beforeCold);
    await page.getByRole('button',{name:'← 新建命盘',exact:true}).click();await fill(page,'1993');await generate(page);await page.getByRole('button',{name:'保存命盘',exact:true}).click();
    assert.equal((await records(page)).length,5);assert.deepEqual(errors,[]);assert.deepEqual(mutations,[]);
    await page.screenshot({path:path.join(output,'offline-saved.png'),fullPage:true});
    return{legacySnapshotUnchanged:true,atomicRejection:true,saveExportImportDelete:true,lunar2050SavedAndReopened:true,offlineProcessRestart:true,offlineNewChartSaved:true,records:5,uncaughtErrors:errors.length};
  });
  await scenario('existing-damaged-active-record-recovery',async()=>{
    served=current;const context=await launch();page=context.pages()[0]||await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.goto(base,{waitUntil:'networkidle'});await ready(page);const original=damagedEnvelope();await seed(page,original,'qa-bad-active');await page.reload({waitUntil:'networkidle'});
    await page.locator('section[aria-label="本地数据恢复"]').waitFor();assert.equal(await page.locator('.app-record-open').count(),2);assert.equal(await raw(page),original);
    assert.equal(await page.getByRole('button',{name:'导入备份',exact:true}).isDisabled(),true);
    assert.equal(await page.getByRole('button',{name:/^删除 /}).first().isDisabled(),true);
    await page.locator('.app-record-open').first().click();assert.equal(await page.getByRole('button',{name:'另存为新记录',exact:true}).isDisabled(),true);
    assert.equal(await download(page,'导出原始数据','damaged-original.json'),original);assert.equal(await raw(page),original);
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),ACTIVE),'qa-bad-active');
    await page.reload({waitUntil:'networkidle'});await page.locator('section[aria-label="本地数据恢复"]').waitFor();assert.equal(await page.locator('.app-record-open').count(),2);assert.deepEqual(errors,[]);
    await page.screenshot({path:path.join(output,'read-only-recovery.png'),fullPage:true});
    await seed(page,'{broken','qa-bad-active');await page.reload({waitUntil:'networkidle'});await page.locator('section[aria-label="本地数据恢复"]').waitFor();assert.equal(await download(page,'导出原始数据','unparseable-original.json'),'{broken');assert.equal(await raw(page),'{broken');
    return{refreshDoesNotCrash:true,validRecordsVisible:2,originalBytesAndOrderPreserved:true,activePointerPreserved:true,rawExportExact:true,mutationsDisabled:true,unparseableDataExportable:true};
  });
  await scenario('render-boundary-fallback',async()=>{
    const esbuild=createRequire(require.resolve('tsx/package.json'))('esbuild');
    const built=await esbuild.build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Boundary from './components/ChartRenderBoundary';function Bad(){throw Error('QA controlled renderer failure')}createRoot(document.getElementById('root')).render(<Boundary canExport onReturn={()=>document.body.dataset.returned='yes'} onExport={()=>document.body.dataset.exported='yes'}><Bad/></Boundary>);`,resolveDir:project,loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic'});
    boundaryBundle=built.outputFiles[0].contents;const context=await launch();page=context.pages()[0]||await context.newPage();await page.goto(origin+'/__boundary-fixture/',{waitUntil:'networkidle'});
    await page.getByText('这份命盘暂时无法显示',{exact:true}).waitFor();await page.getByRole('button',{name:'导出原始数据',exact:true}).click();await page.getByRole('button',{name:'返回记录列表',exact:true}).click();assert.equal(await page.evaluate(()=>document.body.dataset.exported),'yes');assert.equal(await page.evaluate(()=>document.body.dataset.returned),'yes');
    return{controlledRenderFailureCaught:true,recoveryActionsRemainAvailable:true};
  });
  await scenario('service-worker-upgrade-preserves-corrupt-and-good-data',async()=>{
    assert.ok(previous,'REPAIR_PREVIOUS_SITE must point to the unchanged baseline artifact');served=previous;const id=profile();let context=await launch(id);page=context.pages()[0]||await context.newPage();
    await page.goto(base,{waitUntil:'networkidle'});await ready(page);const original=damagedEnvelope();await seed(page,original,'qa-bad-active');await page.getByLabel('姓名或备注（可选）',{exact:true}).fill('QA_UNSAVED_DURING_UPDATE');
    served=current;await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update();});await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration())?.waiting,{},{timeout:30000});
    assert.equal(await page.getByLabel('姓名或备注（可选）',{exact:true}).inputValue(),'QA_UNSAVED_DURING_UPDATE');assert.equal(await raw(page),original);
    await close(context);context=await launch(id);page=context.pages()[0]||await context.newPage();await page.goto(base,{waitUntil:'networkidle'});await ready(page);await waitVersion(page,currentVersion);await page.locator('section[aria-label="本地数据恢复"]').waitFor();assert.equal(await raw(page),original);assert.equal(await page.locator('.app-record-open').count(),2);
    await close(context);context=await launch(id,true);page=context.pages()[0]||await context.newPage();await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('section[aria-label="本地数据恢复"]').waitFor();assert.equal(await raw(page),original);
    return{waitingDoesNotRefreshForm:true,newControllerVersion:currentVersion,originalRecordStringPreserved:true,validRecordsVisible:2,recoveryWorksAfterOfflineColdStart:true};
  });
}finally{
  for(const context of [...contexts])await close(context).catch(()=>{});await new Promise(resolve=>server.close(resolve));
  const report={checkedAt:new Date().toISOString(),scope:'Local-only isolated Chromium; synthetic records only; not iPhone validation',results};fs.writeFileSync('test-results/repair-e2e.json',JSON.stringify(report,null,2)+'\n');
}
if(results.some(r=>r.status!=='PASS'))process.exitCode=1;
