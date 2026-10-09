import assert from 'node:assert/strict';
import {test,mock} from 'node:test';
import {createHash} from 'node:crypto';
import {registerHooks} from 'node:module';
import {PDFDocument} from 'pdf-lib';
registerHooks({resolve(s,c,n){return n(s==='next/server'?'next/server.js':s,c);}});
const token='a'.repeat(43);process.env.INVOICE_DOCUMENTS_API_TOKEN_SHA256=createHash('sha256').update(token).digest('hex');process.env.INVOICE_DOCUMENTS_API_TOKEN_EXPIRES_AT='2099-01-01T00:00:00Z';
let row,called=0,change;
const builder={from(){return this},innerJoin(){return this},where(){return this},limit:async()=>[row]};
mock.module('../db/index.ts',{namedExports:{getDb:async()=>({select:()=>builder})}});
class Conflict extends Error{};class Invalid extends Error{};
mock.module('../app/invoice/payment-history-storage.ts',{namedExports:{InvoiceChangeConflict:Conflict,InvalidPaymentChange:Invalid,persistInvoiceChange:async(db,before,updates,payload,details,actor)=>{called++;change={updates,payload,details,actor};return {...updates,status:'done',processedAt:payload.receivedDate+'T00:00:00.000Z'};}}});
const {POST}=await import('../app/api/invoice-documents/[id]/settle/route.ts');
const pdf=await PDFDocument.create();pdf.addPage();const bytes=await pdf.save();
const payload={expectedInvoiceNo:'INV123',expectedTotalAmount:100,expectedPaidAmount:0,receiptAmount:100,paymentDate:'2026-10-06'};
const ctx={params:Promise.resolve({id:'id_1'})};
function req(p=payload,auth='Bearer '+token){const f=new FormData();f.set('payload',JSON.stringify(p));f.set('paymentProofFile',new Blob([bytes]),'proof.pdf');return new Request('https://test.invalid/api/invoice-documents/id_1/settle',{method:'POST',headers:{Authorization:auth},body:f});}
test('receipt and proof use guarded history transaction; invalid identity/amount/date cannot mutate',async()=>{
 row={id:'id_1',invoiceNo:'INV123',invoiceDate:'2026-10-05',sphStatus:'proses_pengiriman',totalAmount:100,paidAmount:0,status:'pending',processedAt:null,paymentProofFilesJson:[]};
 assert.equal((await POST(req(payload,'Bearer '+'b'.repeat(43)),ctx)).status,401);
 for(const [extra,status] of [[{expectedInvoiceNo:'wrong'},409],[{expectedPaidAmount:1},409],[{receiptAmount:99},409],[{paymentDate:'2099-01-01'},400],[{paidAmount:100},400]]) assert.equal((await POST(req({...payload,...extra}),ctx)).status,status);
 assert.equal(called,0);const r=await POST(req(),ctx);assert.equal(r.status,200);const body=await r.json();assert.equal(body.data.paidAmount,100);assert.equal(body.data.status,'done');assert.equal(change.payload.paymentKind,'receipt');assert.equal(change.payload.expectedPaidAmount,0);assert.equal(change.actor.id,null);assert.equal(change.updates.paymentProofFilesJson.length,1);assert.equal('ttbSignedFileBase64' in change.updates,false);
 row={...row,paidAmount:100,status:'done',processedAt:'2026-10-06T00:00:00.000Z',paymentProofFilesJson:change.updates.paymentProofFilesJson};
 assert.equal((await (await POST(req(),ctx)).json()).data.reused,true);assert.equal(called,1);
 row.status='cancelled';assert.equal((await POST(req(),ctx)).status,404);assert.equal(called,1);
});
