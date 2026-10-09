import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { apiRequest } from './supplier-notes-api.mjs';
const [command,id,invoiceNo,filePath,confirmation]=process.argv.slice(2);
if (!['inspect','upload-ttb','download'].includes(command)||!/^id_[A-Za-z0-9]+$/.test(id??'')) throw new Error('Usage: inspect id | upload-ttb id invoiceNo file --confirmed | download id invoiceNo output.pdf');
const base=process.env.INVOICE_DOCUMENTS_API_BASE_URL||'https://mpm-dashboard-v2.vercel.app';
const token=process.env.INVOICE_DOCUMENTS_API_TOKEN;
const path='/api/invoice-documents/'+encodeURIComponent(id);
const row=(await (await apiRequest(base,token,path)).json()).data;
if(command==='inspect') console.log(JSON.stringify(row));
else {
  if(row.invoiceNo!==invoiceNo) throw new Error('Invoice identity mismatch');
  if(command==='upload-ttb') {
    if(confirmation!=='--confirmed')throw new Error('Explicit upload authorization required');
    const f=new FormData();f.set('invoiceNo',invoiceNo);f.set('expectedTtbSha256',row.ttbSignedFileSha256);
    f.set('signedTtbFile',new Blob([await readFile(filePath)]),basename(filePath));
    console.log(JSON.stringify(await (await apiRequest(base,token,path,{method:'PATCH',body:f})).json()));
  }else{
    const r=await apiRequest(base,token,path+'/download');
    if(!r.headers.get('content-type')?.includes('application/pdf'))throw new Error('Expected PDF');
    await writeFile(filePath,Buffer.from(await r.arrayBuffer()));console.log(JSON.stringify({invoiceNo,filePath}));
  }
}
