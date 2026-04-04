
// ---- CONFIG CHECK ----
// USE_SUPABASE is true only when config.js has real credentials
const USE_SUPABASE = (
  typeof SUPABASE_URL !== 'undefined' &&
  typeof SUPABASE_KEY !== 'undefined' &&
  SUPABASE_URL &&
  SUPABASE_KEY &&
  !SUPABASE_URL.includes('your-project') &&
  !SUPABASE_KEY.includes('your-anon')
);
if(USE_SUPABASE) document.getElementById('dbBanner').style.display='none';

// ---- SUPABASE CLIENT ----
// The UMD bundle exposes the global as `supabase` (lowercase), not `window.supabase`
let db = null;
if(USE_SUPABASE) {
  try {
    // supabase-js v2 UMD exposes window.supabase = { createClient, ... }
    db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch(e) {
    console.error('Supabase client init failed:', e);
  }
}

// ---- DATA (localStorage fallback) ----
const COLORS=['#1A3A5C','#2D6A4F','#B8901A','#7B3F00','#3A3080','#8B1A1A','#1A5C3A','#5C3A1A'];
function avatarColor(name){let h=0;for(let c of name)h=(h*31+c.charCodeAt(0))%COLORS.length;return COLORS[h]}
function initials(name){return name.split(' ').map(w=>w[0]||'').join('').toUpperCase().slice(0,2)||'✝'}
function timeAgo(ts){
  const d=(Date.now()-ts)/1000;
  if(d<60)return'just now';if(d<3600)return Math.floor(d/60)+'m ago';
  if(d<86400)return Math.floor(d/3600)+'h ago';if(d<604800)return Math.floor(d/86400)+'d ago';
  return new Date(ts).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'});
}
function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}

function loadLocal(){try{return JSON.parse(localStorage.getItem('hisstory_t')||'[]')}catch{return[]}}
function saveLocal(arr){localStorage.setItem('hisstory_t',JSON.stringify(arr))}

let testimonies = [];
let activeTag = null;
let formTags = [];

const SEED = [
  {id:1,name:'Evelyn Osei',role:'Redeemed Church, Accra',body:'I had been battling infertility for seven years. Every doctor said it was impossible. But God. After joining a prayer group and trusting His word, I conceived naturally. My daughter is now four years old and she fills our home with joy. What the enemy said was barren, God declared fruitful.',verse:'Psalm 113:9',tags:['healing','prayer','family'],ts:Date.now()-1296000000,amens:24,comments:[{author:'Pastor James',text:'Glory to God! Thank you for sharing this, Evelyn.',ts:Date.now()-500000}]},
  {id:2,name:'Daniel Fernandez',role:'Living Hope Church, Goa',body:'I was deeply in addiction for over a decade — alcohol, broken relationships, lost jobs. The night I hit rock bottom I cried out to God for the first time in years. He met me right there on that floor. Three years clean now, restored marriage, and I volunteer in our church recovery ministry every Friday.',verse:'2 Corinthians 5:17',tags:['deliverance','salvation','restoration'],ts:Date.now()-864000000,amens:31,comments:[]},
  {id:3,name:'Grace Mutua',role:'Nairobi Baptist, Kenya',body:'God provided for my university fees in the most miraculous way. I had prayed and trusted, submitted my application believing. Three days before the deadline, an anonymous letter arrived with the exact amount needed — not a rupee more, not a rupee less. He is Jehovah Jireh.',verse:'Philippians 4:19',tags:['provision','faith','youth'],ts:Date.now()-432000000,amens:18,comments:[{author:'Rachel T.',text:'This gave me so much hope for my own situation, thank you!',ts:Date.now()-200000}]},
];

function initData(){
  testimonies = loadLocal();
  if(!testimonies.length){testimonies=JSON.parse(JSON.stringify(SEED));saveLocal(testimonies);}
}

async function loadTestimonies(){
  if(!USE_SUPABASE || !db){initData();render();return}
  try{
    const{data,error}=await db
      .from('testimonies')
      .select('*, testimony_tags(tag), testimony_comments(id,author,body,created_at)')
      .order('created_at',{ascending:false});
    if(error){
      console.error('Supabase load error:', error.message, error.details, error.hint);
      showToast('⚠ Could not load from database: '+error.message);
      initData();render();return;
    }
    testimonies=data.map(r=>({
      id:r.id,
      name:r.name,
      role:r.role||'',
      body:r.body,
      verse:r.verse||'',
      tags:(r.testimony_tags||[]).map(x=>x.tag),
      comments:(r.testimony_comments||[]).map(c=>({
        author:c.author,
        text:c.body,
        ts:new Date(c.created_at).getTime()
      })),
      ts:new Date(r.created_at).getTime(),
      amens:r.amens||0
    }));
    render();
  }catch(e){
    console.error('loadTestimonies exception:',e);
    initData();render();
  }
}

// ---- MODAL ----
function openModal(){
  document.getElementById('fName').value='';
  document.getElementById('fRole').value='';
  document.getElementById('fBody').value='';
  document.getElementById('fVerse').value='';
  document.getElementById('fTagInput').value='';
  formTags=[];renderFormTags();
  document.getElementById('overlay').classList.add('open');
}
function closeModal(){document.getElementById('overlay').classList.remove('open')}
document.getElementById('overlay').addEventListener('click',function(e){if(e.target===this)closeModal()})

function addTagVal(v){if(!formTags.includes(v)&&formTags.length<7){formTags.push(v);renderFormTags()}}
function addTag(){
  const v=document.getElementById('fTagInput').value.trim().toLowerCase().replace(/[^a-z0-9\-]/g,'');
  if(v&&!formTags.includes(v)&&formTags.length<7){formTags.push(v);renderFormTags()}
  document.getElementById('fTagInput').value='';
}
function removeTag(t){formTags=formTags.filter(x=>x!==t);renderFormTags()}
function renderFormTags(){
  document.getElementById('tagsPreview').innerHTML=formTags.map(t=>`<button class="tag-remove" onclick="removeTag('${t}')">${t} ✕</button>`).join('');
}

async function submitTestimony(){
  const name=document.getElementById('fName').value.trim();
  const body=document.getElementById('fBody').value.trim();
  if(!name){alert('Please enter your name.');return}
  if(body.length<20){alert('Please share a bit more — your testimony can encourage others greatly!');return}

  const role=document.getElementById('fRole').value.trim()||null;
  const verse=document.getElementById('fVerse').value.trim()||null;

  const t={
    id:Date.now(),name,role:role||'',body,verse:verse||'',
    tags:[...formTags],ts:Date.now(),amens:0,comments:[]
  };

  if(USE_SUPABASE && db){
    try{
      // Insert testimony row — approved:true makes it visible under the RLS policy
      const{data,error}=await db
        .from('testimonies')
        .insert({name,role,body,verse,approved:true})
        .select('id')
        .single();

      if(error){
        console.error('Insert error:', error.message, error.details, error.hint);
        alert('Could not save to database:\n'+error.message+'\n\nCheck your Supabase RLS policies and column names.');
        return;
      }

      // Insert tags linked to the new testimony UUID
      if(formTags.length){
        const{error:tagErr}=await db
          .from('testimony_tags')
          .insert(formTags.map(tag=>({testimony_id:data.id,tag})));
        if(tagErr) console.error('Tag insert error:',tagErr.message);
      }

      // Use the real UUID from Supabase as the local id too
      t.id=data.id;
    }catch(e){
      console.error('submitTestimony exception:',e);
      alert('Unexpected error saving testimony. See console for details.');
      return;
    }
  } else {
    // localStorage-only mode
    saveLocal([t,...loadLocal()]);
  }

  testimonies.unshift(t);
  closeModal();render();
  showToast('✝ Your testimony has been published. May it bless many!');
}

// ---- COMMENTS ----
function toggleComments(id){
  const el=document.getElementById('cw-'+id);
  if(!el)return;
  const vis=el.style.display==='none'||!el.style.display;
  el.style.display=vis?'block':'none';
}
async function postComment(id){
  const a=document.getElementById('ca-'+id).value.trim();
  const b=document.getElementById('cb-'+id).value.trim();
  if(!a||!b)return;
  const c={author:a,text:b,ts:Date.now()};
  const t=testimonies.find(x=>x.id==id);
  if(!t)return;
  if(USE_SUPABASE&&db){
    try{
      const{error}=await db.from('testimony_comments').insert({testimony_id:id,author:a,body:b});
      if(error){console.error('Comment error:',error.message);alert('Could not save comment:\n'+error.message);return}
    }catch(e){console.error(e)}
  } else {
    saveLocal(testimonies);
  }
  t.comments.push(c);
  document.getElementById('ca-'+id).value='';
  document.getElementById('cb-'+id).value='';
  document.getElementById('clist-'+id).innerHTML=renderComments(t.comments);
  document.querySelector(`[data-cc="${id}"]`).textContent=t.comments.length;
}
function renderComments(comments){
  return comments.map(c=>`<div class="comment"><div class="comment-author">${esc(c.author)}</div><div class="comment-text">${esc(c.text)}</div><div class="comment-date">${timeAgo(c.ts)}</div></div>`).join('');
}

// ---- AMENS ----
async function toggleAmen(id){
  const t=testimonies.find(x=>x.id==id);if(!t)return;
  const k='amen_'+id,had=localStorage.getItem(k);
  if(had){t.amens=Math.max(0,t.amens-1);localStorage.removeItem(k)}
  else{t.amens++;localStorage.setItem(k,'1')}
  if(USE_SUPABASE&&db){
    try{await db.from('testimonies').update({amens:t.amens}).eq('id',id)}catch(e){console.error(e)}
  }
  const btn=document.querySelector(`[data-amen="${id}"]`);
  if(btn){btn.textContent='🙏 Amen · '+t.amens;btn.classList.toggle('liked',!had)}
}

// ---- TAG FILTER ----
function filterByTag(tag){activeTag=activeTag===tag?null:tag;renderFeed();renderTagCloud()}

// ---- RENDER ----
function render(){renderFeed();renderStats();renderTagCloud()}

function renderFeed(){
  const q=document.getElementById('searchInput').value.trim().toLowerCase();
  const sort=document.getElementById('sortSelect').value;
  const bar=document.getElementById('filterBar');
  let list=testimonies.filter(t=>{
    const mt=!activeTag||t.tags.includes(activeTag);
    const mq=!q||t.name.toLowerCase().includes(q)||t.body.toLowerCase().includes(q)||t.tags.some(tg=>tg.includes(q))||(t.role||'').toLowerCase().includes(q);
    return mt&&mq;
  });
  if(sort==='oldest')list.sort((a,b)=>a.ts-b.ts);
  else if(sort==='amens')list.sort((a,b)=>b.amens-a.amens);
  else list.sort((a,b)=>b.ts-a.ts);

  if(activeTag||q){
    bar.style.display='flex';
    bar.innerHTML=`<span class="filter-lbl">Filtering:</span>`
      +(activeTag?`<span class="tag-pill active">${activeTag}</span>`:'')
      +(q?`<span class="tag-pill" style="background:var(--gold-light);color:var(--gold)">"${esc(q)}"</span>`:'')
      +`<button class="filter-clear" onclick="clearFilters()">Clear</button>`;
  } else bar.style.display='none';

  const feed=document.getElementById('feed');
  if(!list.length){
    feed.innerHTML=`<div class="empty"><div class="empty-icon">✝</div><p>No testimonies found. Be the first to share yours.</p></div>`;
    return;
  }
  feed.innerHTML=list.map(t=>{
    const amenBg=localStorage.getItem('amen_'+t.id);
    return`<div class="card">
  <div class="card-accent"></div>
  <div class="card-body">
    <span class="quote-mark">"</span>${esc(t.body)}"
    ${t.verse?`<div style="font-size:13px;color:var(--gold);margin-top:8px;font-family:'EB Garamond',serif;font-style:italic">— ${esc(t.verse)}</div>`:''}
  </div>
  <div class="card-meta-row">
    <div style="display:flex;align-items:center;gap:10px;flex:1">
      <div class="avatar" style="background:${avatarColor(t.name)}">${initials(t.name)}</div>
      <div><div class="card-name">${esc(t.name)}</div>${t.role?`<div class="card-role">${esc(t.role)}</div>`:''}</div>
    </div>
    <div class="card-date">${timeAgo(t.ts)}</div>
  </div>
  ${t.tags.length?`<div class="card-tags">${t.tags.map(tg=>`<span class="card-tag" onclick="filterByTag('${tg}')">${tg}</span>`).join('')}</div>`:''}
  <div class="card-footer">
    <button class="card-action amen ${amenBg?'liked':''}" data-amen="${t.id}" onclick="toggleAmen(${JSON.stringify(t.id)})">🙏 Amen · ${t.amens}</button>
    <button class="card-action" onclick="toggleComments(${JSON.stringify(t.id)})">💬 <span data-cc="${t.id}">${t.comments.length}</span></button>
  </div>
  <div id="cw-${t.id}" style="display:none">
    <div class="comments-wrap">
      <div id="clist-${t.id}">${renderComments(t.comments)}</div>
      <div class="comment-form">
        <div class="comment-row">
          <input class="comment-input" id="ca-${t.id}" placeholder="Your name" style="max-width:140px">
          <input class="comment-input" id="cb-${t.id}" placeholder="Encourage or respond…" onkeydown="if(event.key==='Enter')postComment(${JSON.stringify(t.id)})">
          <button class="btn btn-sm btn-gold" onclick="postComment(${JSON.stringify(t.id)})">Post</button>
        </div>
      </div>
    </div>
  </div>
</div>`;
  }).join('');
}

function clearFilters(){activeTag=null;document.getElementById('searchInput').value='';render()}

function renderStats(){
  document.getElementById('statTotal').textContent=testimonies.length;
  document.getElementById('statAmens').textContent=testimonies.reduce((s,t)=>s+t.amens,0);
  document.getElementById('statComments').textContent=testimonies.reduce((s,t)=>s+t.comments.length,0);
}

function renderTagCloud(){
  const counts={};
  testimonies.forEach(t=>t.tags.forEach(tg=>counts[tg]=(counts[tg]||0)+1));
  const tags=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  document.getElementById('tagCloud').innerHTML=tags.length
    ?tags.map(([t,n])=>`<span class="tag-pill ${activeTag===t?'active':''}" onclick="filterByTag('${t}')">${t} <span style="opacity:.55">${n}</span></span>`).join('')
    :'<span style="font-size:12px;color:var(--muted)">No tags yet</span>';
}

function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),4000);
}

// ---- INIT ----
// loadTestimonies handles both Supabase and localStorage modes
loadTestimonies();
