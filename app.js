import{extractDocument,matrixToProducts,rowsToMatrix,csvRows,normalize}from'./importer.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const storeKey='urovo-comparison-imports-v1';let data,local=[],groupId='g0',leftId,rightId,category='全部参数',importSheets=[],sourceName='',importJob=0;
const categories=['全部参数','基础性能','外观交互','通信连接','采集与支付','电源续航','环境与认证','其他'];
function cat(key){if(/品牌|型号|特点|操作系统|处理器|CPU|内存|扩展/i.test(key))return'基础性能';if(/外观|LCD|TP|尺寸|重量|物理按键|音频|指示灯|传感器/i.test(key))return'外观交互';if(/WWAN|WIFI|蓝牙|定位|卡槽|物理接口/i.test(key))return'通信连接';if(/前置|后置|扫码|打印机|磁条|IC卡|非接/.test(key))return'采集与支付';if(/电压|容量|续航|充电/.test(key))return'电源续航';if(/温度|湿度|防护|国内|海外/.test(key))return'环境与认证';return'其他'}
function all(){return[...data.groups.flatMap(g=>g.products),...local]}
function current(id){return all().find(p=>p.id===id)}
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n}
function toast(t){$('#toast').textContent=t;$('#toast').hidden=false;setTimeout(()=>$('#toast').hidden=true,3500)}
function option(p){const o=el('option','',p.name+(p.imported?' · 本地导入':''));o.value=p.id;return o}
function initSelectors(){

  // 左侧显示所有 UROVO 产品
  $('#left-product').replaceChildren(
    ...all()
      .filter(p => p.urovo)
      .map(option)
  );

  $('#left-product').value = leftId;


  // 根据当前选择的 UROVO 产品，
  // 找到对应产品组
  const group = data.groups.find(
    g => g.products.some(
      p => p.id === leftId
    )
  );


  // 只显示该组里的竞品
  let right = group
    ? group.products.filter(
        p => !p.urovo
      )
    : [];


  // 如果没有找到对应组，才显示全部竞品（防止报错）
  if(!right.length){
    right = all().filter(
      p => !p.urovo
    );
  }


  // 当前竞品不存在时，自动选择第一个
  if(
    !right.some(
      p => p.id === rightId
    )
  ){
    rightId = right[0]?.id;
  }


  // 更新右侧下拉框
  $('#right-product').replaceChildren(
    ...right.map(option)
  );

  $('#right-product').value = rightId;
}
function drawCard(side,p){if(!p)return;$('#'+side+'-model').textContent=p.model;$('#'+side+'-brand').textContent=p.brand;const img=$('#'+side+'-image');img.hidden=!p.image;$('#'+side+'-no-image').hidden=!!p.image;if(p.image){img.src=p.image;img.alt=p.name+' 产品图片';img.onerror=()=>{img.hidden=true;$('#'+side+'-no-image').hidden=false}}else img.removeAttribute('src');
 const keys=['操作系统（Android）','内存','LCD/LED'];$('#'+side+'-facts').replaceChildren(...keys.filter(k=>p.params[k]).map(k=>{const n=el('span','',p.params[k]);n.title=p.params[k];return n}));
 $('#'+side+'-source').textContent=p.imported?'本地导入 · '+p.source:'来源：'+p.source+' · 第 '+p.column+' 列';$('#'+side+'-table-title').textContent=p.name;
}
function pairRows(){const l=current(leftId),r=current(rightId);if(!l||!r)return[];return[...new Set([...Object.keys(l.params),...Object.keys(r.params)])].filter(k=>!['品牌','型号'].includes(k)).map(k=>({key:k,left:l.params[k]||'未提供',right:r.params[k]||'未提供',category:cat(k),diff:normalize(l.params[k]||'未提供')!==normalize(r.params[k]||'未提供')}))}
function filteredRows(){const q=$('#search').value.toLowerCase().trim();return pairRows().filter(r=>(category==='全部参数'||r.category===category)&&(!$('#only-diff').checked||r.diff)&&(!q||[r.key,r.left,r.right].some(x=>x.toLowerCase().includes(q))))}
function render(){
 const l=current(leftId),r=current(rightId);drawCard('left',l);drawCard('right',r);$('#pair-label').textContent=(l?.model||'')+' 对比 '+(r?.model||'');
 const rows=pairRows();$('#parameter-count').textContent=rows.length+' 项参数';$('#diff-count').textContent=rows.filter(x=>x.diff).length;
 $('#categories').replaceChildren(...categories.filter(c=>c==='全部参数'||rows.some(r=>r.category===c)).map(c=>{const b=el('button','',c);b.type='button';b.setAttribute('role','tab');b.setAttribute('aria-selected',c===category);b.onclick=()=>{category=c;render()};b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const tabs=$$('#categories button'),idx=tabs.indexOf(b),next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(idx+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[next].click();$$('#categories button')[next].focus()};return b}));
 const visible=filteredRows(),body=$('#rows');body.replaceChildren();for(const c of categories.slice(1)){const items=visible.filter(x=>x.category===c);if(!items.length)continue;const head=el('tr','group-row'),cell=el('td','',c+' / '+String(items.length).padStart(2,'0'));cell.colSpan=3;head.append(cell);body.append(head);for(const item of items){const tr=el('tr',item.diff?'different':'');tr.append(el('td','',item.key));for(const v of [item.left,item.right])tr.append(el('td',/^(未公开|未提供|未列)/.test(v)?'value-missing':'',v));body.append(tr)}}
 if(!visible.length){const tr=el('tr','empty-row'),td=el('td','','没有符合条件的参数。试试其他分类或清空搜索。');td.colSpan=3;tr.append(td);body.append(tr)}$('#visible-count').textContent='显示 '+visible.length+' / '+rows.length+' 项';
}
function selectLeft(id){leftId=id;const g=data.groups.find(g=>g.products.some(p=>p.id===id));if(g)groupId=g.id;category='全部参数';initSelectors();render()}
function exportRows(){const l=current(leftId),r=current(rightId);const rows=[['参数',l.name,r.name],...filteredRows().map(x=>[x.key,x.left,x.right]),['来源',l.source,r.source],['参考日期',l.imported?'本地导入':data.date,r.imported?'本地导入':data.date]];const escape=x=>'"'+String(x).replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(escape).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}),a=el('a');a.href=URL.createObjectURL(blob);a.download=(l.model+' vs '+r.model).replace(/[\\/:*?"<>|]/g,'_')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000);toast('已导出当前筛选范围的对比表')}
function saveLocal(next){try{localStorage.setItem(storeKey,JSON.stringify(next));local=next}catch{throw Error('浏览器无法保存产品，可能空间已满或存储被禁用。请删除不需要的导入后重试。')}}
function localList(){const box=$('#local-products');box.replaceChildren();if(!local.length)return;box.append(el('strong','',`本机导入产品 · ${local.length}`));local.forEach(p=>{const row=el('div','local-item'),button=el('button','','删除');row.append(el('span','',p.name),button);button.onclick=()=>{try{saveLocal(local.filter(x=>x.id!==p.id));if(leftId===p.id)leftId=data.groups[0].products[0].id;initSelectors();render();localList()}catch(e){status(e.message,true)}};box.append(row)})}
function status(msg,error=false){$('#import-status').textContent=msg;$('#import-status').className=error?'error':''}
function showMatrix(){const sheet=importSheets[Number($('#import-sheet').value)||0];$('#import-text').value=sheet.matrix.map(r=>r.map(x=>String(x).replace(/[\t\r\n]+/g,' ')).join('\t')).join('\n');status(`识别到 ${sheet.matrix[0].length-1} 个产品、${sheet.matrix.length-1} 项参数。请核对单位、型号和选配说明。${sheet.note||''}`)}
async function upload(file){if(!file)return;const job=++importJob;$('#import-preview').hidden=true;$('#confirm-import').disabled=true;status('正在本地读取并提取参数…');try{const result=await extractDocument(file);if(job!==importJob)return;importSheets=result;sourceName=file.name;$('#import-sheet').replaceChildren(...result.map((s,i)=>{const o=el('option','',s.name);o.value=String(i);return o}));showMatrix();$('#import-preview').hidden=false}catch(e){if(job===importJob)status(e.message||'提取失败，请检查文件格式。',true)}finally{if(job===importJob)$('#confirm-import').disabled=false}}
async function init(){try{const response=await fetch('./data.json');if(!response.ok)throw Error('参考数据暂时无法加载，请刷新页面重试。');data=await response.json();try{const saved=JSON.parse(localStorage.getItem(storeKey)||'[]');if(Array.isArray(saved))local=saved.filter(p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&p.params&&typeof p.params==='object'&&p.imported)}catch{local=[]}
 leftId=data.groups[0].products.find(p=>p.urovo).id;rightId=data.groups[0].products.find(p=>!p.urovo).id;initSelectors();render();
 $('#left-product').onchange=e=>selectLeft(e.target.value);$('#right-product').onchange=e=>{rightId=e.target.value;render()};$('#all-products').onchange=()=>{initSelectors();render()};$('#only-diff').onchange=render;$('#search').oninput=render;$('#export').onclick=exportRows;
 $$('[data-upload]').forEach(b=>b.onclick=()=>{localList();$('#import-dialog').showModal()});$('#upload-file').onchange=e=>upload(e.target.files[0]);$('#import-sheet').onchange=showMatrix;const drop=$('#dropzone');drop.ondragover=e=>{e.preventDefault();drop.classList.add('over')};drop.ondragleave=()=>drop.classList.remove('over');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('over');upload(e.dataTransfer.files[0])};
 $('#confirm-import').onclick=()=>{try{const matrix=rowsToMatrix(csvRows($('#import-text').value,'\t'));const added=matrixToProducts(matrix,$('#import-side').value,sourceName+' / '+importSheets[Number($('#import-sheet').value)||0].name);saveLocal([...local,...added]);if(added[0].urovo)leftId=added[0].id;else rightId=added[0].id;$('#only-diff').checked=false;$('#search').value='';category='全部参数';initSelectors();render();$('#import-dialog').close();toast(`已加入 ${added.length} 个产品，保存在当前浏览器`)}catch(e){status(e.message,true)}};
 }catch(e){$('#pair-label').textContent=e.message;toast(e.message)}}
init();


// ================================
// Competitor Brand Wall Module
// ================================

async function loadBrandWall(){
  const grid=document.querySelector('#brand-grid');
  if(!grid)return;

  try{
    const res=await fetch('./brand.json');
    const brands=await res.json();

    grid.replaceChildren(...brands.map(b=>{
      const card=document.createElement('article');
      card.className='brand-card';
      card.innerHTML=`
        <img src="${b.logo}" alt="${b.name}">
        <h3>${b.name}</h3>
        <p>${b.category}</p>
      `;
      card.onclick=()=>window.open(b.website,'_blank');
      return card;
    }));
  }catch(e){
    grid.textContent='品牌数据加载失败';
  }
}

function switchView(view){
  const compare=document.querySelector('.compare-stage')?.closest('main') || document.querySelector('main');
  const brand=document.querySelector('#brand-page');
  const dockCompare=document.querySelector('#dock-compare');
  const dockBrands=document.querySelector('#dock-brands');

  if(view==='brands'){
    document.querySelectorAll('main > *').forEach(x=>{
      if(x.id!=='brand-page') x.hidden=true;
    });
    brand.hidden=false;
    dockBrands.classList.add('active');
    dockCompare.classList.remove('active');
    loadBrandWall();
  }else{
    document.querySelectorAll('main > *').forEach(x=>{
      if(x.id!=='brand-page') x.hidden=false;
    });
    brand.hidden=true;
    dockCompare.classList.add('active');
    dockBrands.classList.remove('active');
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  document.querySelector('#dock-brands')?.addEventListener('click',()=>switchView('brands'));
  document.querySelector('#dock-compare')?.addEventListener('click',()=>switchView('compare'));
});
