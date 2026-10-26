import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {importMaterial,findPython} from '../lib/imports.mjs';
import {isLearningFile,signature,droppedFiles} from '../dist/files.mjs';
import {createServer} from '../server.mjs';
import {tutorView} from '../dist/views.mjs';

test('tutor renders file-derived answers as text rather than executable HTML',()=>{
  const html=tutorView({chat:[{role:'assistant',text:'<img src=x onerror=alert(1)> **公式**'}, {role:'user\" onclick=\"alert(1)',text:'test'}],draft:'</textarea><script>alert(1)</script>',busy:null,materials:[],page:'overview',pages:{overview:'概览'}});
  assert.ok(!html.includes('<img src=x'));assert.ok(!html.includes('<script>'));assert.match(html,/&lt;img/);assert.ok(!html.includes('class="chat-message user" onclick='));
});

test('folder selection excludes hidden, dependency and credential files',()=>{
  for(const name of ['notes/lesson.pdf','笔记.docx','slides.pptx','project/src/main.py','notes.md'])assert.equal(isLearningFile(name),true,name);
  for(const name of ['.env','.git/config','project/node_modules/a/readme.md','notes/secrets.json','photo.png','old.doc'])assert.equal(isLearningFile(name),false,name);
  assert.notEqual(signature([{name:'a',text:'123'}]),signature([{name:'a',text:'124'}]));
});
test('dragging a folder traverses nested learning files',async()=>{
  const file={name:'lesson.md'};
  const entry={name:'lesson.md',isFile:true,file:resolve=>resolve(file)};
  let read=false;
  const directory={name:'notes',isDirectory:true,createReader:()=>({readEntries:resolve=>{resolve(read?[]:[entry]);read=true;}})};
  const result=await droppedFiles({items:[{kind:'file',webkitGetAsEntry:()=>directory}],files:[]});
  assert.deepEqual(result,[{file,name:'notes/lesson.md'}]);
});
test('text import preserves Chinese and handles UTF-16 while rejecting binary',async()=>{
  const text='机器学习：ŷ = 2x + 1，x = 3，预测值 = 7。';
  for(const bytes of [Buffer.from(text),Buffer.concat([Buffer.from([255,254]),Buffer.from(text,'utf16le')])]){
    const result=await importMaterial({name:'学习笔记.txt',base64:bytes.toString('base64')},os.tmpdir());assert.equal(result.text,text);
  }
  await assert.rejects(importMaterial({name:'a.txt',base64:Buffer.from([0,1,2]).toString('base64')},os.tmpdir()),/二进制/);
  await assert.rejects(importMaterial({name:'a.txt',base64:'not valid!'},os.tmpdir()),/内容无效/);
  await assert.rejects(importMaterial({name:'a.exe',base64:'YWJj'},os.tmpdir()),/暂不支持/);
});
test('Word and PPT import extracts paragraphs in document and numeric slide order',async t=>{
  let python;try{python=findPython();}catch{t.skip('Optional Python 3 is unavailable');return;}
  const folder=await fs.mkdtemp(path.join(os.tmpdir(),'learnmore-import-test-'));
  try{
    const script=`import zipfile,sys,os\np=sys.argv[1]\nwith zipfile.ZipFile(os.path.join(p,'notes.docx'),'w') as z:\n z.writestr('word/document.xml','<w:document xmlns:w="urn:word"><w:body><w:p><w:r><w:t>Chinese 学习: loss function</w:t></w:r></w:p></w:body></w:document>')\nwith zipfile.ZipFile(os.path.join(p,'notes.pptx'),'w') as z:\n for n in [10,2,1]: z.writestr('ppt/slides/slide%d.xml'%n,'<a:slide xmlns:a="urn:draw"><a:p><a:r><a:t>Topic %d</a:t></a:r></a:p></a:slide>'%n)\n`;
    const result=spawnSync(python,['-c',script,folder],{encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);
    const word=await importMaterial({name:'notes.docx',base64:(await fs.readFile(path.join(folder,'notes.docx'))).toString('base64')},folder);assert.match(word.text,/Chinese 学习: loss function/);
    const ppt=await importMaterial({name:'notes.pptx',base64:(await fs.readFile(path.join(folder,'notes.pptx'))).toString('base64')},folder);assert.ok(ppt.text.indexOf('Topic 1\n')<ppt.text.indexOf('Topic 2'));assert.ok(ppt.text.indexOf('Topic 2')<ppt.text.indexOf('Topic 10'));
    assert.deepEqual((await fs.readdir(folder)).filter(name=>name.startsWith('import-')),[]);
  }finally{await fs.rm(folder,{recursive:true,force:true});}
});
test('import HTTP endpoint reads actual selected file bytes',async()=>{
  const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{const response=await fetch(`http://127.0.0.1:${server.address().port}/api/import`,{method:'POST',headers:{'X-Learnmore-Client':'1','Content-Type':'application/json'},body:JSON.stringify({name:'lesson.md',base64:Buffer.from('梯度下降通过梯度更新参数。').toString('base64')})});assert.equal(response.status,200);assert.equal((await response.json()).text,'梯度下降通过梯度更新参数。');}finally{await new Promise(resolve=>server.close(resolve));}
});

test('text PDF import extracts the real page text',async t=>{
  let python;try{python=findPython();}catch{t.skip('Optional Python is unavailable');return;}
  if(spawnSync(python,['-c','import pypdf'],{windowsHide:true}).status!==0){t.skip('Optional pypdf is unavailable');return;}
  const stream='BT /F1 12 Tf 72 720 Td (Linear regression y = 2x + 1) Tj ET';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let pdf='%PDF-1.4\n';const offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
  const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n `).join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const folder=await fs.mkdtemp(path.join(os.tmpdir(),'learnmore-pdf-test-'));
  try{const result=await importMaterial({name:'lesson.pdf',base64:Buffer.from(pdf).toString('base64')},folder);assert.match(result.text,/Linear regression y = 2x \+ 1/);assert.equal(result.pages,1);assert.equal(result.truncated,false);assert.deepEqual(await fs.readdir(folder),[]);}finally{await fs.rm(folder,{recursive:true,force:true});}
});
