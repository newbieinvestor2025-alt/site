
const CONFIG = {
  channelUrl: "https://www.youtube.com/@NewbieInvestor_2025",
  contactEmail: "info@newbieinvestor.org",
  pageSize: 9
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

let translations = {};
let lang = (['uk','en'].includes(localStorage.getItem('lang'))
  ? localStorage.getItem('lang')
  : (navigator.language?.toLowerCase().startsWith('uk') ? 'uk' : 'en'));

async function loadLang(nextLang) {
  try {
    const res = await fetch(`/assets/i18n/${nextLang}.json`);
    translations = await res.json();

    lang = nextLang;
    localStorage.setItem('lang', lang);
    document.documentElement.setAttribute('lang', lang);

    applyI18n();                 // достатньо тут
    // renderPage()/renderStats() зробить loadVideos() після фетча
  } catch (err) {
    console.error("Translation load error:", err);
  }
}

function t(key) {
  return translations[key] ?? key;
}

function applyI18n() {
  // тексти
  document.querySelectorAll('[data-i]').forEach(el => {
    const key = el.getAttribute('data-i');
    const val = t(key);
    if (val) el.textContent = val;
  });

  // атрибути (aria-label, title, placeholder, і т.д.)
  document.querySelectorAll('[data-i-attr]').forEach(el => {
    const key = el.getAttribute('data-i');
    const attrs = el.getAttribute('data-i-attr')?.split(',').map(s => s.trim()) || [];
    const val = t(key);
    attrs.forEach(a => { if (val) el.setAttribute(a, val); });
  });

  // підсвічуємо активну мову
  document.querySelectorAll('.lang button').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === lang);
  });
}

// --- UTM helper ---
function withUTM(url, extra = {}) {
  try {
    const u = new URL(url);
    const base = { utm_source: 'site', utm_medium: 'button', ...extra };
    Object.entries(base).forEach(([k, v]) => u.searchParams.set(k, v));
    return u.toString();
  } catch {
    // Якщо URL конструктор недоступний або url кривий — повертаємо оригінал без UTM
    return url;
  }
}

function smartScrollToTop() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const opts = reduce ? {} : { behavior: 'smooth' };
  document.getElementById('videoGrid')?.scrollIntoView(opts);
}

function escapeHTML(str="") {
  return str.replace(/[&<>"']/g, m => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[m]));
}

// header links
for (const el of ['#watchBtn','#watchBtn2']) {
  const node = $(el);
  if (node) node.href = withUTM(CONFIG.channelUrl, { utm_campaign: 'header' }) || CONFIG.channelUrl;
}
$('#subscribeBtn')?.setAttribute(
  'href',
  withUTM(CONFIG.channelUrl, { utm_campaign: 'header-sub', sub_confirmation: '1' })
);
$('#contactEmail').textContent = CONFIG.contactEmail;
$('#channelLink')?.setAttribute(
  'href',
  withUTM(CONFIG.channelUrl, { utm_campaign: 'footer' })
);
$('#subscribeBtnFooter')?.setAttribute(
  'href',
  withUTM(CONFIG.channelUrl, { utm_campaign: 'footer-sub', sub_confirmation: '1' })
);
$('#year').textContent = new Date().getFullYear();

// video rendering
let allVideos = [];

// --- Hash-based pagination ---
function getPageFromHash() {
  const m = location.hash.match(/page=(\d+)/);
  const n = m ? parseInt(m[1], 10) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function renderCard(v, opts={mini:false}) {
  const date = new Date(v.published).toLocaleDateString(
    lang==='uk' ? 'uk-UA' : 'en-US',
    { year:'numeric', month:'long', day:'numeric' }
  );
  return `
    <a class="card${opts.mini ? ' mini' : ''}" href="${vurl(v.id)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHTML(v.title)}">
      <img class="thumb" alt="${escapeHTML(v.title)}" loading="lazy" src="${v.thumbnail||thumb(v.id)}"/>
      <div class="body">
        <div class="title">${escapeHTML(v.title)}</div>
        <div class="meta">${date} · YouTube</div>
      </div>
    </a>
  `;
}

function setHashPage(n) {
  if (getPageFromHash() !== n) {
    history.replaceState(null, '', `#page=${n}`);
  }
}

let page = getPageFromHash();

// реагуємо, якщо користувач вручну змінює #page у URL
window.addEventListener('hashchange', () => {
  const newPage = getPageFromHash();
  if (newPage !== page) {
    page = newPage;
    renderPage();
    smartScrollToTop();
  }
});

const grid = $('#videoGrid'), gridMini = $('#videoGridMini');
const prevBtn = $('#prevBtn'), nextBtn = $('#nextBtn'), pageInfo = $('#pageInfo');

// Numbers formatting
const fmt = n => Number(n||0).toLocaleString(lang==='uk'?'uk-UA':'en-US');
let _lastStats = null;
let _lastVideosLen = 0;

function renderStats(stats, videosLen) {
  _lastStats = stats || null;
  _lastVideosLen = videosLen || 0;

  if (stats) {
    $('#totalVideos').textContent = fmt(stats.videoCount != null ? stats.videoCount : videosLen);
    $('#subs').textContent = (stats.subscriberCount != null) ? fmt(stats.subscriberCount) : '—';
    $('#views').textContent = (stats.viewCount != null) ? fmt(stats.viewCount) : '—';
  } else {
    $('#totalVideos').textContent = fmt(videosLen);
    $('#subs').textContent = '—';
    $('#views').textContent = '—';
  }
}

const thumb = id => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
const vurl  = id => `https://youtu.be/${id}`;

function renderPage(){
  if (!grid) return;

  const totalPages = Math.max(1, Math.ceil(allVideos.length / CONFIG.pageSize));
  if (page > totalPages) {
    page = totalPages;
    setHashPage(page);
  }

  const start = (page-1)*CONFIG.pageSize;
  const items = allVideos.slice(start, start+CONFIG.pageSize);

  if (!items.length) {
    showMessage(t('noVideos'));
    if (pageInfo) pageInfo.textContent = `0 / 0`;
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    return;
  }

  grid.innerHTML = items.map(v => renderCard(v)).join('');
  if (pageInfo) pageInfo.textContent = `${page} / ${totalPages}`;
  if (prevBtn) prevBtn.disabled = page <= 1;
  if (nextBtn) nextBtn.disabled = page >= totalPages;
  setHashPage(page);

  const latestBtn = $('#latestVideoBtn');
  if (latestBtn) {
    if (allVideos[0]) {
      latestBtn.href = vurl(allVideos[0].id);
      latestBtn.classList.remove('disabled');
    } else {
      latestBtn.removeAttribute('href');
      latestBtn.classList.add('disabled');
    }
  }
  if (gridMini) {
    gridMini.innerHTML = allVideos[0] ? renderCard(allVideos[0], {mini:true}) : '';
  }
}

function showMessage(msg) {
  grid.innerHTML = `<p class="muted">${msg}</p>`;
  const live = document.getElementById('gridStatus');
  if (live) live.textContent = msg;
}


prevBtn.addEventListener('click', () => {
  if (page > 1) {
    page--;
    renderPage();
    smartScrollToTop();
  }
});

nextBtn.addEventListener('click', () => {
  const tp = Math.ceil(allVideos.length / CONFIG.pageSize);
  if (page < tp) {
    page++;
    renderPage();
    smartScrollToTop();
  }
});

window.addEventListener('keydown', (e) => {
  const totalPages = Math.max(1, Math.ceil(allVideos.length / CONFIG.pageSize));
  if (e.key === 'ArrowLeft' && page > 1) {
    e.preventDefault();
    page--; renderPage(); smartScrollToTop();
  } else if (e.key === 'ArrowRight' && page < totalPages) {
    e.preventDefault();
    page++; renderPage(); smartScrollToTop();
  }
});

async function loadVideos(){
  try{
    showMessage(t('loading'));
    const res = await fetch('/.netlify/functions/videos?max=36'); // try to fetch up to 36 items when API key is present
    if(!res.ok) throw new Error('HTTP '+res.status);
    const data = await res.json();
    const videos = data.videos || [];
    allVideos = videos.sort((a,b)=> new Date(b.published) - new Date(a.published));
    renderPage();

    // stats
    renderStats(data.stats || null, videos.length);
  }catch(err){
    console.error(err);
    showMessage(t('failed'));
    prevBtn.disabled = nextBtn.disabled = true;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadLang(lang);   // 1) спершу переклад, щоб "Loading..." було локалізовано
  } finally {
    loadVideos();           // 2) потім уже фетчимо відео
  }

  // Перемикачі мови
  document.querySelectorAll('[data-lang]').forEach(btn => {
    btn.addEventListener('click', e => {
      const next = e.currentTarget.dataset.lang;
      if (next && next !== lang) loadLang(next);
    });
  });
});
