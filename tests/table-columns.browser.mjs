import test from "node:test";
import { createRequire } from "node:module";
const localRequire = createRequire(import.meta.url);
const assert = localRequire('node:assert/strict');
const fs = localRequire('node:fs/promises');
const path = localRequire('node:path');
const os = localRequire('node:os');
const http = localRequire('node:http');

let chromium;
try { ({ chromium } = localRequire('playwright')); }
catch { ({ chromium } = createRequire(path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json'))('playwright')); }
const webpack = localRequire('next/dist/compiled/webpack/webpack').webpack;

test('column picker persistence, isolation, validation, sorting, dialogs and export', async () => {
  const directory = await fs.mkdtemp(path.resolve('tmp/table-columns-'));
  await fs.writeFile(path.join(directory,'loader.cjs'), `const ts=require(${JSON.stringify(localRequire.resolve('typescript'))});module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},fileName:this.resourcePath}).outputText;};`);
  await fs.writeFile(path.join(directory,'navigation.ts'), 'export function usePathname(){return "/test";}');
  const compiler = webpack({ mode:'development', entry:path.resolve('tests/table-columns.fixture.tsx'), output:{path:directory,filename:'bundle.js'}, resolve:{extensions:['.tsx','.ts','.js'],alias:{'next/navigation':path.join(directory,'navigation.ts')}},module:{rules:[{test:/\.tsx?$/,exclude:/node_modules/,use:path.join(directory,'loader.cjs')}]}});
  await new Promise((resolve,reject)=>compiler.run((error,stats)=>compiler.close(()=>error||stats.hasErrors()?reject(error||Error(stats.toString())):resolve())));
  const css = await fs.readFile('app/globals.css','utf8');
  const server=http.createServer(async(req,res)=>{res.setHeader('Content-Type',req.url==='/bundle.js'?'text/javascript':'text/html');res.end(req.url==='/bundle.js'?await fs.readFile(path.join(directory,'bundle.js')):`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}:root{--font-geist-sans:Arial;--font-geist-mono:monospace}body{font-family:Arial}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`)});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url=`http://127.0.0.1:${server.address().port}`;
  const table=()=>page.locator('table[data-table-id="test-main"]').first();
  const picker=()=>page.locator('[data-column-picker-for="test-main"]').first();
  const open=async()=>{if(!await picker().locator('details').evaluate(e=>e.open))await picker().locator('summary').click(); await picker().locator('.table-column-options').waitFor({state:'visible'});};
  try {
    await page.goto(url); await table().waitFor(); const originalTop = (await table().boundingBox()).y; await open();
    assert.equal((await table().boundingBox()).y, originalTop, 'Dropdown does not shift the table layout');
    await picker().locator('summary').press('Escape'); assert.equal(await picker().locator('details').evaluate(e=>e.open),false); await open();
    assert.equal(await picker().getByRole('checkbox',{checked:true}).count(),3);
    await page.getByLabel('Input Zulu',{exact:true}).fill('saved value'); await open();
    await picker().getByLabel('Input',{exact:true}).uncheck();
    assert.equal(await table().locator('td[data-column-id="c1"]').first().isVisible(),false);
    assert.equal(await page.locator('table[data-table-id="test-empty"] td').getAttribute('colspan'),'3');
    const emptyPicker=page.locator('[data-column-picker-for="test-empty"]'); await emptyPicker.locator('summary').click(); await emptyPicker.getByLabel('Qty',{exact:true}).uncheck();
    assert.equal(await page.locator('table[data-table-id="test-empty"] td').getAttribute('colspan'),'2');
    assert.equal(await picker().getByLabel('Qty',{exact:true}).isChecked(),true);
    await table().locator('th[data-column-id="c0"]').click();
    assert.equal(await table().locator('tbody tr').first().locator('td').first().textContent(),'Zulu'); await open();
    await picker().getByLabel('Input',{exact:true}).check();
    assert.equal(await page.getByLabel('Input Zulu',{exact:true}).inputValue(),'saved value');
    await page.getByLabel('Input Zulu',{exact:true}).fill(''); await open();
    await picker().getByLabel('Input',{exact:true}).uncheck();await picker().getByLabel('Qty',{exact:true}).uncheck();
    assert.equal(await picker().getByLabel('Nama',{exact:true}).isDisabled(),true);
    await page.getByRole('button',{name:'Validate',exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll('table[data-table-id="test-main"] [data-column-hidden="true"]').length===0);
    await open(); assert.equal(await picker().getByRole('checkbox',{checked:true}).count(),3);
    await picker().getByLabel('Input',{exact:true}).uncheck();
    await page.reload();await open();assert.equal(await picker().getByLabel('Input',{exact:true}).isChecked(),false);
    await page.getByRole('button',{name:'Open shared table',exact:true}).click();
    assert.equal(await page.getByRole('dialog').locator('td').getAttribute('colspan'),'2');
    await page.getByRole('button',{name:'Close shared',exact:true}).click();
    await page.goto(url+'?account=accountB');await open();assert.equal(await picker().getByRole('checkbox',{checked:true}).count(),3);
    await page.goto(url+'?account=accountA&new=1');await open();assert.equal(await picker().getByLabel('Input',{exact:true}).isChecked(),false);assert.equal(await picker().getByLabel('Baru',{exact:true}).isChecked(),true);
    await picker().getByRole('button',{name:'Tampilkan semua',exact:true}).click();assert.equal(await picker().getByRole('checkbox',{checked:true}).count(),4);
    await page.getByRole('button',{name:'1 item',exact:true}).click();
    const dialog=page.getByRole('dialog');
    assert.equal(await dialog.locator('summary').count(),0,'Item dialogs do not have column selection');
    assert.equal(await dialog.locator('th').count(),6);
    await dialog.getByRole('button',{name:'Tutup',exact:true}).click();
    const link=page.getByRole('button',{name:'SPH001',exact:true});assert.equal(await link.locator('span').evaluate(e=>getComputedStyle(e).fontSize),'12px');assert.equal(await link.evaluate(e=>getComputedStyle(e).textAlign),'left');
    const invoice=page.locator('table[data-table-id="invoices"]');const invPicker=page.locator('[data-column-picker-for="invoices"]'); assert.equal(await invoice.locator('.table-column-picker').count(),0); assert.equal(await invPicker.evaluate(e=>e.closest('.customer-table-wrap')===null),true);await invPicker.locator('summary').click();await invPicker.getByLabel('OMSET',{exact:true}).uncheck();
    const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download Excel',exact:true}).click();const file=await download;const bytes=await fs.readFile(await file.path());assert.ok(bytes.includes(Buffer.from('OMSET')),'Hidden columns remain in exported workbook');
    await fs.mkdir(path.resolve('outputs'),{recursive:true});
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.resolve('outputs/table-columns-mobile.png'),fullPage:true});
    assert.deepEqual(errors,[]);
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
});
