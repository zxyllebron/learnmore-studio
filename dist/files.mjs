export const supportedExtensions=new Set('txt md markdown csv tsv json jsonl py ipynb js mjs jsx ts tsx html css tex rst yaml yml sql r c cpp h java go rs pdf docx pptx'.split(' '));
const skippedDirectories=new Set(['node_modules','.git','.codex','.openai','.learnmore-runtime','.sites-runtime','dist','build','__pycache__']);
export function isLearningFile(name){
  const parts=name.replaceAll('\\','/').split('/');
  if(parts.some(p=>p.startsWith('.')||skippedDirectories.has(p)))return false;
  const basename=parts.at(-1);
  if(/^(?:auth|credentials|secrets|package-lock|pnpm-lock|yarn\.lock)(?:\.|$)/i.test(basename))return false;
  return supportedExtensions.has(basename.split('.').at(-1).toLowerCase());
}
export function signature(materials){
  let hash=2166136261;
  for(const m of materials)for(const ch of m.name+'\0'+m.text){hash^=ch.codePointAt(0);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(16);
}
export async function droppedFiles(transfer){
  const results=[];
  async function visit(entry,prefix='',depth=0){
    if(results.length>=80||depth>8)return;
    const name=prefix+entry.name;
    if(entry.isFile){if(isLearningFile(name)){const file=await new Promise((resolve,reject)=>entry.file(resolve,reject));results.push({file,name});}}
    else if(entry.isDirectory&&!entry.name.startsWith('.')&&!skippedDirectories.has(entry.name)){
      const reader=entry.createReader();let children;
      do{children=await new Promise((resolve,reject)=>reader.readEntries(resolve,reject));for(const child of children)await visit(child,name+'/',depth+1);}while(children.length&&results.length<80);
    }
  }
  const entries=Array.from(transfer.items||[]).filter(i=>i.kind==='file').map(i=>i.webkitGetAsEntry?.()).filter(Boolean);
  // Capture files and entries synchronously, before the browser clears the drag data store.
  const fallback=Array.from(transfer.files||[]);
  if(entries.length){for(const entry of entries)await visit(entry);}else for(const file of fallback)results.push({file,name:file.name});
  if(results.length>=80)results.truncated=true;return results;
}
