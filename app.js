// app.js 修复关键部分
// 1. 恢复竞品联动逻辑
// 替换原 initSelectors()

function initSelectors(){

  // 左侧 UROVO 产品
  $('#left-product').replaceChildren(
    ...all()
      .filter(p=>p.urovo)
      .map(option)
  );

  $('#left-product').value = leftId;


  // 找当前 UROVO 产品所属分组
  const group = data.groups.find(
    g => g.products.some(
      p => p.id === leftId
    )
  );


  // 只取当前组里的竞品
  let right = group
    ? group.products.filter(
        p => !p.urovo
      )
    : [];


  // 防止没有匹配
  if(!right.length){
    right = all().filter(
      p => !p.urovo
    );
  }


  // 如果当前竞品不在列表里，重置
  if(!right.some(
      p => p.id === rightId
  )){
      rightId = right[0]?.id;
  }


  $('#right-product').replaceChildren(
    ...right.map(option)
  );


  $('#right-product').value = rightId;
}


// 2. 品牌墙模块独立，不修改产品对比逻辑

async function loadBrandWall(){
  const grid=document.querySelector('#brand-grid');
  if(!grid)return;

  try{
    const res=await fetch('./brand.json');
    const brands=await res.json();

    grid.replaceChildren(
      ...brands.map(b=>{
        const card=document.createElement('article');
        card.className='brand-card';

        card.innerHTML=`
          <img src="${b.logo}" alt="${b.name}">
          <h3>${b.name}</h3>
          <p>${b.category}</p>
        `;

        card.onclick=()=>window.open(b.website,'_blank');
        return card;
      })
    );
  }catch(e){
    grid.textContent='品牌数据加载失败';
  }
}


function switchView(view){

  const brand=document.querySelector('#brand-page');

  if(view==='brands'){
    document.querySelector('.compare-stage').closest('main')
      .hidden=true;

    brand.hidden=false;
    loadBrandWall();

  }else{

    document.querySelector('.compare-stage').closest('main')
      .hidden=false;

    brand.hidden=true;
  }
}


document.addEventListener('DOMContentLoaded',()=>{

  document.querySelector('#dock-brands')
    ?.addEventListener(
      'click',
      ()=>switchView('brands')
    );

  document.querySelector('#dock-compare')
    ?.addEventListener(
      'click',
      ()=>switchView('compare')
    );

});
