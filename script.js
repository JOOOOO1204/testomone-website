// =============================================================
//  HisStory — Christian Testimony Site
//  script.js  |  All declarations at top to avoid TDZ errors
// =============================================================

// ---- ALL STATE VARIABLES (declared first, before any function) ----
var testimonies = [];
var activeTag   = null;
var formTags    = [];
var db          = null;
let can_record = false;
let is_recorcing =false;
let recorder = null;
let chunks = [];
let file;
let AudioID;
const playback = document.querySelector('.playback'); 
const mic_btn = document.querySelector('#mic'); 
const audioUpload = document.querySelector('.audio-upload'); 

// ---- CONFIG CHECK ----
var USE_SUPABASE = (
  typeof SUPABASE_URL !== 'undefined' &&
  typeof SUPABASE_KEY !== 'undefined' &&
  SUPABASE_URL &&
  SUPABASE_KEY &&
  !SUPABASE_URL.includes('your-project') &&
  !SUPABASE_KEY.includes('your-anon')
);

// Hide setup banner if Supabase is configured
if (USE_SUPABASE) {
  var banner = document.getElementById('dbBanner');
  if (banner) banner.style.display = 'none';
}

// ---- SUPABASE CLIENT ----
if (USE_SUPABASE) {
  try {
    // supabase-js v2 UMD exposes the global `supabase` object
    db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch (e) {
    console.error('Supabase client init failed:', e);
  }
}

// ---- HELPERS ----
var COLORS = ['#1A3A5C','#2D6A4F','#B8901A','#7B3F00','#3A3080','#8B1A1A','#1A5C3A','#5C3A1A'];

function avatarColor(name) {
  var h = 0;
  for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % COLORS.length;
  return COLORS[h];
}

function initials(name) {
  return name.split(' ').map(function(w){ return w[0] || ''; }).join('').toUpperCase().slice(0,2) || '✝';
}

function timeAgo(ts) {
  var d = (Date.now() - ts) / 1000;
  if (d < 60)     return 'just now';
  if (d < 3600)   return Math.floor(d / 60) + 'm ago';
  if (d < 86400)  return Math.floor(d / 3600) + 'h ago';
  if (d < 604800) return Math.floor(d / 86400) + 'd ago';
  return new Date(ts).toLocaleDateString('en-IN', {day:'numeric', month:'long', year:'numeric'});
}

function esc(s) {
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ---- LOCAL STORAGE ----
function loadLocal() {
  try { return JSON.parse(localStorage.getItem('hisstory_t') || '[]'); }
  catch (e) { return []; }
}

function saveLocal(arr) {
  localStorage.setItem('hisstory_t', JSON.stringify(arr));
}

// ---- SEED DATA ----
// var SEED = [
//   {
//     id: 1, name: 'Evelyn Osei', role: 'Redeemed Church, Accra',
//     body: 'I had been battling infertility for seven years. Every doctor said it was impossible. But God. After joining a prayer group and trusting His word, I conceived naturally. My daughter is now four years old and she fills our home with joy. What the enemy said was barren, God declared fruitful.',
//     verse: 'Psalm 113:9', tags: ['healing','prayer','family'],
//     ts: Date.now() - 1296000000, amens: 24,
//     comments: [{author:'Pastor James', text:'Glory to God! Thank you for sharing this, Evelyn.', ts: Date.now() - 500000}]
//   },
//   {
//     id: 2, name: 'Daniel Fernandez', role: 'Living Hope Church, Goa',
//     body: 'I was deeply in addiction for over a decade — alcohol, broken relationships, lost jobs. The night I hit rock bottom I cried out to God for the first time in years. He met me right there on that floor. Three years clean now, restored marriage, and I volunteer in our church recovery ministry every Friday.',
//     verse: '2 Corinthians 5:17', tags: ['deliverance','salvation','restoration'],
//     ts: Date.now() - 864000000, amens: 31, comments: []
//   },
//   {
//     id: 3, name: 'Grace Mutua', role: 'Nairobi Baptist, Kenya',
//     body: 'God provided for my university fees in the most miraculous way. I had prayed and trusted, submitted my application believing. Three days before the deadline, an anonymous letter arrived with the exact amount needed. He is Jehovah Jireh.',
//     verse: 'Philippians 4:19', tags: ['provision','faith','youth'],
//     ts: Date.now() - 432000000, amens: 18,
//     comments: [{author:'Rachel T.', text:'This gave me so much hope for my own situation, thank you!', ts: Date.now() - 200000}]
//   }
// ];

// function initData() {
//   testimonies = loadLocal();
//   if (!testimonies.length) {
//     testimonies = JSON.parse(JSON.stringify(SEED));
//     saveLocal(testimonies);
//   }
// }

// ---- LOAD FROM SUPABASE ----
async function loadTestimonies() {
  if (!USE_SUPABASE || !db) { initData(); render(); return; }
  try {
    var res = await db
      .from('testimonies')
      .select('*, testimony_tags(tag), testimony_comments(id,author,body,created_at)')
      .order('created_at', { ascending: false });

    if (res.error) {
      console.error('Supabase load error:', res.error.message, res.error.details, res.error.hint);
      showToast('⚠ Could not load from database: ' + res.error.message);
      initData(); render(); return;
    }

    testimonies = res.data.map(function(r) {
      return {
        id:       r.id,
        name:     r.name,
        role:     r.role || '',
        body:     r.body,
        verse:    r.verse || '',
        tags:     (r.testimony_tags || []).map(function(x){ return x.tag; }),
        comments: (r.testimony_comments || []).map(function(c) {
          return { author: c.author, text: c.body, ts: new Date(c.created_at).getTime() };
        }),
        ts:    new Date(r.created_at).getTime(),
        amens: r.amens || 0,
        Audio : r.Audio

      };
    });
    render();
  } catch (e) {
    console.error('loadTestimonies exception:', e);
    initData(); render();
  }
}

// Audio overlay
mic_btn.addEventListener('click', ToggleMIC());

function audioRoverlay(){

  document.getElementById('REC-overlay').classList.add('open')
  SetupAudio()
}
function audioRoverlayrem(){
  
  document.getElementById('REC-overlay').classList.remove('open')
}



function SetupAudio(){
  console.log("Audio setup");
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices
    .getUserMedia({audio:true})
    .then(setupStream)
    .catch(err => {
      console.error(err)
    });
  }
}

function setupStream(stream) {
  recorder = new MediaRecorder(stream);
  recorder.ondataavailable = e => {
    chunks.push(e.data);
  }

  recorder.onstop = e => {
    let blob = new Blob(chunks, {type: "audio/opus; codecs=opus"});
    console.log(blob)
    chunks = [];
    file = blob
    const audioURL = window.URL.createObjectURL(blob);

    playback.src = audioURL;
    // console.log("audioURL:",audioURL )
  }

  can_record = true;
  // return blob;
}

function ToggleMIC(){
  

  if (!can_record) return;
  is_recorcing = !is_recorcing

  if (is_recorcing) {
    recorder.start();
    console.log("Audio REC");
    mic_btn.classList.add("recording");
  } 
  else{
      recorder.stop();
      console.log("Audio stop");
      mic_btn.classList.remove("recording");

  }


}

const UploadAudio = async ()  => {

  AudioID = `audio-${Date.now()}.opus`;

  const {error} = await db.storage.from("audio").upload(AudioID , file , { contentType: 'audio/opus'})
  console.log(file)
  
  if (error) {
    console.error("ERROR UPLOAD AUDIO ", error.message);
  }

  const {data} = await db.storage.from("audio").getPublicUrl(AudioID)
  // data.getPublicUrl = let PPublicUrl
  // AudioID = `https://sghtuzfcdmpqdvhiqtmd.supabase.co/storage/v1/object/public/audio/${AudioID}`
  // console.log("PublicURL:",AudioID)
  document.getElementById('REC-overlay').classList.remove('open')

};
audioUpload.addEventListener('click', UploadAudio);




// ---- MODAL ----
function openModal() {
  document.getElementById('fName').value  = '';
  document.getElementById('fRole').value  = '';
  document.getElementById('fBody').value  = '';
  document.getElementById('fVerse').value = '';
  document.getElementById('fTagInput').value = '';
  formTags = [];
  renderFormTags();
  document.getElementById('overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('overlay').classList.remove('open');
}

document.getElementById('overlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// ---- TAGS ----
function addTagVal(v) {
  if (!formTags.includes(v) && formTags.length < 7) {
    formTags.push(v);
    renderFormTags();
  }
}

function addTag() {
  var v = document.getElementById('fTagInput').value.trim().toLowerCase().replace(/[^a-z0-9\-]/g, '');
  if (v && !formTags.includes(v) && formTags.length < 7) {
    formTags.push(v);
    renderFormTags();
  }
  document.getElementById('fTagInput').value = '';
}

function removeTag(t) {
  formTags = formTags.filter(function(x){ return x !== t; });
  renderFormTags();
}

function renderFormTags() {
  document.getElementById('tagsPreview').innerHTML = formTags.map(function(t) {
    return '<button class="tag-remove" onclick="removeTag(\'' + t + '\')">' + t + ' ✕</button>';
  }).join('');
}

// ---- SUBMIT TESTIMONY ----
async function submitTestimony() {
  var name = document.getElementById('fName').value.trim();
  var body = document.getElementById('fBody').value.trim();
  if (!name) { alert('Please enter your name.'); return; }
  if (body.length < 1) { alert('Please share a bit more — your testimony can encourage others greatly!'); return; }

  var role  = document.getElementById('fRole').value.trim()  || null;
  var verse = document.getElementById('fVerse').value.trim() || null;
  console.log(AudioID)

  var t = {
    id: Date.now(), 
    name: name, 
    role: role || '',
    body: body, 
    verse: verse || '',
    tags: formTags.slice(), 
    ts: Date.now(), 
    amens: 0, 
    comments: [],
    Audio :AudioID
  };

  if (USE_SUPABASE && db) {
    try {
      var res = await db
        .from('testimonies')
        .insert({ name: name, role: role, body: body, verse: verse, approved: true , Audio :AudioID })
        .select('id')
        .single();

      if (res.error) {
        console.error('Insert error:', res.error.message, res.error.details, res.error.hint);
        alert('Could not save to database:\n' + res.error.message + '\n\nCheck your Supabase RLS policies.');
        return;
      }

      if (formTags.length) {
        var tagRows = formTags.map(function(tag) { return { testimony_id: res.data.id, tag: tag }; });
        var tagRes = await db.from('testimony_tags').insert(tagRows);
        if (tagRes.error) console.error('Tag insert error:', tagRes.error.message);
      }

      t.id = res.data.id;
    } catch (e) {
      console.error('submitTestimony exception:', e);
      alert('Unexpected error saving testimony. See browser console for details.');
      return;
    }
  } else {
    saveLocal([t].concat(loadLocal()));
  }

  testimonies.unshift(t);
  closeModal();
  render();
  showToast('✝ Your testimony has been published. May it bless many!');
}

// ---- COMMENTS ----
function toggleComments(id) {
  var el = document.getElementById('cw-' + id);
  if (!el) return;
  el.style.display = (el.style.display === 'none' || !el.style.display) ? 'block' : 'none';
}

async function postComment(id) {
  var a = document.getElementById('ca-' + id).value.trim();
  var b = document.getElementById('cb-' + id).value.trim();
  if (!a || !b) return;

  var t = testimonies.find(function(x){ return x.id == id; });
  if (!t) return;

  if (USE_SUPABASE && db) {
    try {
      var res = await db.from('testimony_comments').insert({ testimony_id: id, author: a, body: b });
      if (res.error) {
        console.error('Comment error:', res.error.message);
        alert('Could not save comment:\n' + res.error.message);
        return;
      }
    } catch (e) { console.error(e); }
  } else {
    saveLocal(testimonies);
  }

  t.comments.push({ author: a, text: b, ts: Date.now() });
  document.getElementById('ca-' + id).value = '';
  document.getElementById('cb-' + id).value = '';
  document.getElementById('clist-' + id).innerHTML = renderComments(t.comments);
  var cc = document.querySelector('[data-cc="' + id + '"]');
  if (cc) cc.textContent = t.comments.length;
}

function renderComments(comments) {
  return comments.map(function(c) {
    return '<div class="comment">'
      + '<div class="comment-author">' + esc(c.author) + '</div>'
      + '<div class="comment-text">'  + esc(c.text)   + '</div>'
      + '<div class="comment-date">'  + timeAgo(c.ts) + '</div>'
      + '</div>';
  }).join('');
}

// ---- AMENS ----
async function toggleAmen(id) {
  var t = testimonies.find(function(x){ return x.id == id; });
  if (!t) return;
  var k = 'amen_' + id, had = localStorage.getItem(k);
  if (had) { t.amens = Math.max(0, t.amens - 1); localStorage.removeItem(k); }
  else      { t.amens++; localStorage.setItem(k, '1'); }

  if (USE_SUPABASE && db) {
    try { await db.from('testimonies').update({ amens: t.amens }).eq('id', id); }
    catch (e) { console.error(e); }
  }

  var btn = document.querySelector('[data-amen="' + id + '"]');
  if (btn) { btn.textContent = '🙏 Amen · ' + t.amens; btn.classList.toggle('liked', !had); }
}

// ---- TAG FILTER ----
function filterByTag(tag) {
  activeTag = (activeTag === tag) ? null : tag;
  renderFeed();
  renderTagCloud();
}

function clearFilters() {
  activeTag = null;
  document.getElementById('searchInput').value = '';
  render();
}

// ---- RENDER ALL ----
function render() { renderFeed(); renderStats(); renderTagCloud(); renderAudio() }

function renderFeed() {
  var q    = document.getElementById('searchInput').value.trim().toLowerCase();
  var sort = document.getElementById('sortSelect').value;
  var bar  = document.getElementById('filterBar');

  var list = testimonies.filter(function(t) {
    var mt = !activeTag || t.tags.includes(activeTag);
    var mq = !q
      || t.name.toLowerCase().includes(q)
      || t.body.toLowerCase().includes(q)
      || t.tags.some(function(tg){ return tg.includes(q); })
      || (t.role || '').toLowerCase().includes(q);
    return mt && mq;
  });

  if (sort === 'oldest') list.sort(function(a,b){ return a.ts - b.ts; });
  else if (sort === 'amens') list.sort(function(a,b){ return b.amens - a.amens; });
  else list.sort(function(a,b){ return b.ts - a.ts; });

  if (activeTag || q) {
    bar.style.display = 'flex';
    bar.innerHTML = '<span class="filter-lbl">Filtering:</span>'
      + (activeTag ? '<span class="tag-pill active">' + activeTag + '</span>' : '')
      + (q ? '<span class="tag-pill" style="background:var(--gold-light);color:var(--gold)">"' + esc(q) + '"</span>' : '')
      + '<button class="filter-clear" onclick="clearFilters()">Clear</button>';
  } else {
    bar.style.display = 'none';
  }

  var feed = document.getElementById('feed');
  if (!list.length) {
    feed.innerHTML = '<div class="empty"><div class="empty-icon">✝</div><p>No testimonies found. Be the first to share yours.</p></div>';
    return;
  }

  feed.innerHTML = list.map(function(t) {
    var amenActive = !!localStorage.getItem('amen_' + t.id);
    return '<div class="card">'
      + '<div class="card-accent"></div>'
      + '<div class="card-body"><span class="quote-mark">"</span>' + esc(t.body) + '"'
      + (t.verse ? '<div style="font-size:13px;color:var(--gold);margin-top:8px;font-family:\'EB Garamond\',serif;font-style:italic">— ' + esc(t.verse) + '</div>' : '')
      + '</div>'
      + '<div class="card-meta-row">'
      +   '<div style="display:flex;align-items:center;gap:10px;flex:1">'
      +     '<div class="avatar" style="background:' + avatarColor(t.name) + '">' + initials(t.name) + '</div>'
      +     '<div><div class="card-name">' + esc(t.name) + '</div>'
      +     (t.role ? '<div class="card-role">' + esc(t.role) + '</div>' : '') + '</div>'
      +         '<div>'+ renderAudio(t.Audio) + '</div>'
      +   '</div>'
      +   '<div class="card-date">' + timeAgo(t.ts) + '</div>'
      + '</div>'
      + (t.tags.length ? '<div class="card-tags">' + t.tags.map(function(tg){ return '<span class="card-tag" onclick="filterByTag(\'' + tg + '\')">' + tg + '</span>'; }).join('') + '</div>' : '')
      + '<div class="card-footer">'
      +   '<button class="card-action amen ' + (amenActive ? 'liked' : '') + '" data-amen="' + t.id + '" onclick="toggleAmen(\'' + t.id + '\')">🙏 Amen · ' + t.amens + '</button>'
      +   '<button class="card-action" onclick="toggleComments(\'' + t.id + '\')">💬 <span data-cc="' + t.id + '">' + t.comments.length + '</span></button>'
      + '</div>'
      + '<div id="cw-' + t.id + '" style="display:none">'
      +   '<div class="comments-wrap">'
      +     '<div id="clist-' + t.id + '">' + renderComments(t.comments) + '</div>'
      +     '<div class="comment-form">'
      +       '<div class="comment-row">'
      +         '<input class="comment-input" id="ca-' + t.id + '" placeholder="Your name" style="max-width:140px">'
      +         '<input class="comment-input" id="cb-' + t.id + '" placeholder="Encourage or respond…" onkeydown="if(event.key===\'Enter\')postComment(\'' + t.id + '\')">'
      +         '<button class="btn btn-sm btn-gold" onclick="postComment(\'' + t.id + '\')">Post</button>'
      +       '</div>'
      +     '</div>'
      +   '</div>'
      + '</div>'
      + '</div>';
  }).join('');
}

function renderAudio(audiolink) {
  if (audiolink) {
    return  '<audio  src="https://sghtuzfcdmpqdvhiqtmd.supabase.co/storage/v1/object/public/audio/'+audiolink+'" controls></audio>'}
    else return ""

}

function renderStats() {
  document.getElementById('statTotal').textContent    = testimonies.length;
  document.getElementById('statAmens').textContent    = testimonies.reduce(function(s,t){ return s + t.amens; }, 0);
  document.getElementById('statComments').textContent = testimonies.reduce(function(s,t){ return s + t.comments.length; }, 0);
}

function renderTagCloud() {
  var counts = {};
  testimonies.forEach(function(t) {
    t.tags.forEach(function(tg){ counts[tg] = (counts[tg] || 0) + 1; });
  });
  var tags = Object.entries(counts).sort(function(a,b){ return b[1] - a[1]; });
  document.getElementById('tagCloud').innerHTML = tags.length
    ? tags.map(function(entry) {
        var t = entry[0], n = entry[1];
        return '<span class="tag-pill ' + (activeTag === t ? 'active' : '') + '" onclick="filterByTag(\'' + t + '\')">' + t + ' <span style="opacity:.55">' + n + '</span></span>';
      }).join('')
    : '<span style="font-size:12px;color:var(--muted)">No tags yet</span>';
}

function showToast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function(){ t.classList.remove('show'); }, 4000);
}

// ---- INIT ----
loadTestimonies();
