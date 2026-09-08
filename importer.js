const clean=v=>String(v??'').trim();
export const normalize=s=>clean(s).replace(/[\s（）()：:／/]+/g,'').toLowerCase();
const aliases={'系统':'操作系统（Android）','操作系统':'操作系统（Android）','os':'操作系统（Android）','cpu':'处理器 / 应用CPU','处理器':'处理器 / 应用CPU','屏幕':'LCD/LED','显示屏':'LCD/LED','电池':'标称电压/容量','电池容量':'标称电压/容量','重量':'重量（g）','尺寸':'尺寸（mm）','wifi':'WIFI','蓝牙版本':'蓝牙','内存容量':'内存','产品型号':'型号','产品名称':'型号','品牌名称':'品牌'};
export function canonical(s){return aliases[normalize(s)]||clean(s)}
export function csvRows(text,delimiter=','){
 const rows=[];let row=[],v='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){v+='"';i++}else quoted=!quoted}else if(c===delimiter&&!quoted){row.push(v);v=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(v);rows.push(row);row=[];v=''}else v+=c}
 if(v||row.length){row.push(v);rows.push(row)}if(quoted)throw Error('引号未闭合，请检查 CSV 文件。');return rows;
}
export function rowsToMatrix(input,fallback='导入产品'){
 let rows=input.map(r=>r.map(clean)).filter(r=>r.some(Boolean));
 const header=rows.findIndex(r=>/^(对比项目|参数|参数名称|参数名|项目|规格|specification|parameter)$/i.test(r[0]||'')&&r.slice(1).some(Boolean));
 if(header>=0)rows=rows.slice(header);
 else {const first=rows[0]||[];if(first.length===2){rows=[['参数',fallback],...rows]}else if(first.length>2){rows[0]=['参数',...first.slice(1)]}else throw Error('未识别到参数表。请使用第一列为参数名、后续列为产品的表格。')}
 const indexes=rows[0].map((x,i)=>i>0&&x?i:0).filter(Boolean);
 if(!indexes.length)throw Error('未识别到产品名称。');
 const result=[['参数',...indexes.map(i=>rows[0][i])],...rows.slice(1).filter(r=>r[0]&&r[0]!=='图片').map(r=>[canonical(r[0]),...indexes.map(i=>r[i]||'')])];
 if(result.length<3)throw Error('参数不足，请至少提供两项参数。');if(result.length>300||indexes.length>30)throw Error('单次最多导入 30 个产品、300 行参数，请拆分文档。');return result;
}
export function textToMatrix(text,name){
 const lines=text.split(/\r?\n/).map(clean).filter(Boolean);const rows=[];
 for(const line of lines){const m=line.match(/^([^:：\t]{1,50})\s*[:：\t]\s*(.+)$/);if(m)rows.push([canonical(m[1]),m[2]])}
 if(rows.length<2)throw Error('未能可靠识别参数。请转为每行「参数名：参数值」的 TXT，或使用 Excel/CSV 表格；扫描版 PDF 需先做 OCR。');
 const model=rows.find(r=>r[0]==='型号')?.[1]||name;return [['参数',model],...rows];
}
function xml(text){const d=new DOMParser().parseFromString(text,'application/xml');if(d.getElementsByTagName('parsererror').length)throw Error('文档结构损坏，无法读取。');return d}
const els=(n,t)=>Array.from(n.getElementsByTagNameNS('*',t));
async function openZip(buffer){
 const zip=await JSZip.loadAsync(buffer);const size=Object.values(zip.files).reduce((n,f)=>n+(f._data?.uncompressedSize||0),0);
 if(size>40*1024*1024||Object.keys(zip.files).length>2500)throw Error('文档解压后过大，请拆分后重试。');return zip;
}
export async function extractDocument(file){
 if(file.size>10*1024*1024)throw Error('文件超过 10 MB，请拆分后导入。');if(!file.size)throw Error('文件为空。');
 const ext=file.name.split('.').pop().toLowerCase(),name=file.name.replace(/\.[^.]+$/,'');const buffer=await file.arrayBuffer();
 if(['csv','txt'].includes(ext)){
  let text=new TextDecoder('utf-8').decode(buffer);if(text.includes('\uFFFD'))text=new TextDecoder('gb18030').decode(buffer);
  const delim=text.split(/\r?\n/)[0].includes('\t')?'\t':',';
  return [{name:'提取结果',matrix:ext==='csv'?rowsToMatrix(csvRows(text,delim),name):textToMatrix(text,name)}];
 }
 if(ext==='xlsx'){
  const zip=await openZip(buffer);if(!zip.file('xl/workbook.xml'))throw Error('不是有效的 XLSX 工作簿。');
  const wb=xml(await zip.file('xl/workbook.xml').async('string'));const rel=xml(await zip.file('xl/_rels/workbook.xml.rels').async('string'));
  const targets=Object.fromEntries(els(rel,'Relationship').map(r=>[r.getAttribute('Id'),r.getAttribute('Target')]));
  const shared=zip.file('xl/sharedStrings.xml')?els(xml(await zip.file('xl/sharedStrings.xml').async('string')),'si').map(x=>els(x,'t').map(t=>t.textContent).join('')):[];
  const result=[];let failures=0;
  for(const sheet of els(wb,'sheet')){
   const target=targets[sheet.getAttribute('r:id')];if(!target)continue;const path=target.startsWith('/')?target.slice(1):'xl/'+target;
   const entry=zip.file(path);if(!entry)continue;const doc=xml(await entry.async('string'));
   const rows=els(doc,'row').map(row=>{const values=[];for(const c of els(row,'c')){const ref=c.getAttribute('r')||'A1';let idx=0;for(const ch of ref.replace(/[0-9]/g,''))idx=idx*26+ch.charCodeAt(0)-64;const t=c.getAttribute('t'),v=els(c,'v')[0]?.textContent||'';values[idx-1]=t==='s'?(shared[Number(v)]||''):t==='inlineStr'?els(c,'t').map(x=>x.textContent).join(''):v}return Array.from(values,x=>x||'')});
   try{result.push({name:sheet.getAttribute('name')||'数据表',matrix:rowsToMatrix(rows,name)})}catch{failures++}
  }
  if(!result.length)throw Error('工作簿中没有可识别的参数表。第一列应为参数名，后续各列为产品。');
  result.forEach(x=>x.note=failures?`${failures} 个工作表未识别为参数表，已跳过。`:'');return result;
 }
 if(ext==='docx'){
  const zip=await openZip(buffer),entry=zip.file('word/document.xml');if(!entry)throw Error('不是有效的 Word DOCX 文档。');const doc=xml(await entry.async('string'));
  const result=[];for(const table of els(doc,'tbl')){const rows=els(table,'tr').map(r=>els(r,'tc').map(c=>els(c,'t').map(t=>t.textContent).join('')));try{result.push({name:`表格 ${result.length+1}`,matrix:rowsToMatrix(rows,name)})}catch{}}
  return result.length?result:[{name:'正文参数',matrix:textToMatrix(els(doc,'p').map(p=>els(p,'t').map(x=>x.textContent).join('')).join('\n'),name)}];
 }
 if(ext==='pdf'){
  const pdfjs=await import('./vendor/pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.min.mjs',import.meta.url).href;
  const pdf=await pdfjs.getDocument({data:new Uint8Array(buffer),isEvalSupported:false}).promise;
  try{if(pdf.numPages>50)throw Error('PDF 超过 50 页，请只保留产品参数页后导入。');let text='';for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);const content=await page.getTextContent();let lastY=null;for(const item of content.items){if(!('str'in item))continue;const y=Math.round(item.transform[5]);if(lastY!==null&&Math.abs(y-lastY)>3)text+='\n';text+=item.str+' ';if(item.hasEOL){text+='\n';lastY=null}else lastY=y}text+='\n'}return [{name:'PDF 文字参数',matrix:textToMatrix(text,name)}]}finally{await pdf.destroy()}
 }
 throw Error('暂不支持该格式。请使用 XLSX、CSV、DOCX、文字版 PDF 或 TXT。');
}
export function matrixToProducts(matrix,side,source){
 const result=[];for(let i=1;i<matrix[0].length;i++){const name=clean(matrix[0][i]);if(!name)continue;const params={};for(const row of matrix.slice(1)){if(row[0]){const key=canonical(row[0]);if(Object.hasOwn(params,key))throw Error(`参数「${key}」重复，请合并后再确认。`);params[key]=clean(row[i])||'未提供'}}
  if(Object.values(params).filter(x=>x&&x!=='未提供').length<2)throw Error(`${name} 至少需要两项有效参数。`);
  result.push({id:'local-'+crypto.randomUUID(),name,model:params['型号']||name,brand:params['品牌']||(side==='urovo'?'UROVO':'自定义竞品'),urovo:side==='urovo',params,source,imported:true,image:''})}
 if(!result.length)throw Error('请填写产品名称。');return result;
}
