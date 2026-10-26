import path from 'node:path';
import os from 'node:os';
import {promises as fs,existsSync} from 'node:fs';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const TEXT_EXTENSIONS=new Set(['.txt','.md','.markdown','.csv','.tsv','.json','.jsonl','.py','.ipynb','.js','.mjs','.jsx','.ts','.tsx','.html','.css','.tex','.rst','.yaml','.yml','.sql','.r','.c','.cpp','.h','.java','.go','.rs']);
export const DOCUMENT_EXTENSIONS=new Set(['.pdf','.docx','.pptx']);
const MAX_BYTES=20*1024*1024;
const MAX_TEXT=100000;
const helper=fileURLToPath(new URL('../scripts/extract_document.py',import.meta.url));
let python;
export function findPython(){
  if(python)return python;
  const bundled=path.join(os.homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','python','python.exe');
  for(const candidate of [process.env.LEARNMORE_PYTHON_BIN,existsSync(bundled)?bundled:null,'python3','python'].filter(Boolean)){
    const r=spawnSync(candidate,['-c','import sys; print(sys.version_info.major)'],{encoding:'utf8',timeout:5000,windowsHide:true});
    if(!r.error&&r.status===0&&r.stdout.trim()==='3')return python=candidate;
  }
  throw new Error('读取 PDF、Word 和 PPT 需要 Python 3。请安装 Python，或设置 LEARNMORE_PYTHON_BIN。文本文件可直接导入。');
}
function extractDocument(file,ext){return new Promise((resolve,reject)=>{
  const child=spawn(findPython(),[helper,file,ext],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='',error='',settled=false;
  const done=(err,result)=>{if(settled)return;settled=true;clearTimeout(timer);if(err)reject(err);else resolve(result);};
  const timer=setTimeout(()=>{child.kill();done(new Error('文件解析超时，请拆分文件后重试。'));},30000);
  child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
  child.stdout.on('data',chunk=>{output+=chunk;if(output.length>1000000){child.kill();done(new Error('文件文本过多，请拆分后导入。'));}});
  child.stderr.on('data',chunk=>{error=(error+chunk).slice(-1000);});
  child.on('error',()=>done(new Error('文档解析器无法启动，请检查 Python 配置。')));
  child.on('close',code=>{try{const r=JSON.parse(output);if(code!==0||r.error)throw new Error(r.error||'文件无法解析。');done(null,r);}catch(e){done(new Error(e.message==='文件无法解析。'?e.message:output.trim().startsWith('{')?e.message:'文件无法解析，请检查格式或是否加密。'));}});
});}
export async function importMaterial({name,base64},runtime){
  if(typeof name!=='string'||typeof base64!=='string')throw new Error('请选择有效文件。');
  const safeName=path.basename(name.replaceAll('\\','/')).slice(0,250);
  const ext=path.extname(safeName).toLowerCase();
  if(!TEXT_EXTENSIONS.has(ext)&&!DOCUMENT_EXTENSIONS.has(ext))throw new Error('暂不支持该格式，请使用 PDF、DOCX、PPTX 或文本文件。');
  if(!base64||base64.length>Math.ceil(MAX_BYTES/3)*4||base64.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))throw new Error('文件内容无效，或超过 20 MB。');
  const bytes=Buffer.from(base64,'base64');if(bytes.length>MAX_BYTES)throw new Error('单个文件不能超过 20 MB。');
  let result;
  if(TEXT_EXTENSIONS.has(ext)){
    let text=bytes[0]===0xff&&bytes[1]===0xfe?bytes.subarray(2).toString('utf16le'):bytes.toString('utf8').replace(/^\uFEFF/,'');
    if(text.includes('\0'))throw new Error('这个文件包含二进制内容，请改用文本或支持的文档格式。');
    result={text,truncated:text.length>MAX_TEXT};
  }else{
    await fs.mkdir(runtime,{recursive:true});const temporary=await fs.mkdtemp(path.join(runtime,'import-'));
    try{const file=path.join(temporary,'document'+ext);await fs.writeFile(file,bytes);result=await extractDocument(file,ext);}finally{await fs.rm(temporary,{recursive:true,force:true});}
  }
  if(!result.text.trim())throw new Error(ext==='.pdf'?'没有提取到文字。这可能是扫描版 PDF，请提供文字版或复制需要学习的内容。':'文件中没有可学习的正文。');
  return {name:safeName,text:result.text.slice(0,MAX_TEXT),kind:DOCUMENT_EXTENSIONS.has(ext)?ext.slice(1).toUpperCase():'文本文件',truncated:result.truncated||result.text.length>MAX_TEXT,pages:result.pages};
}
