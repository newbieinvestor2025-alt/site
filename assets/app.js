
// Simple client for YouTube list with pagination via Netlify Function
const channelId = "UCPnRzDl-Iq02iaLMjtjUEXA"; // <-- replace with your UC... ID
const grid = document.getElementById('videoGrid');
const moreBtn = document.getElementById('loadMore');
const locale = document.documentElement.lang === 'uk' ? 'uk-UA' : 'en-US';
let nextPageToken = null;

function card(v){
  const d = new Date(v.publishedAt).toLocaleDateString(locale);
  return `<a class="card" href="https://youtu.be/${v.id}" target="_blank" rel="noopener">
    <img class="thumb" alt="${v.title}" loading="lazy" src="${v.thumb}"/>
    <div class="body"><div class="title">${v.title}</div><div class="meta">${d} · YouTube</div></div>
  </a>`;
}

async function load(pageToken=null){
  moreBtn.disabled = true;
  const url = new URL('/.netlify/functions/youtube-latest', window.location.origin);
  url.searchParams.set('channelId', channelId);
  url.searchParams.set('max', '6');
  if(pageToken) url.searchParams.set('pageToken', pageToken);
  const r = await fetch(url);
  const data = await r.json();
  (data.items||[]).forEach(it => grid.insertAdjacentHTML('beforeend', card(it)));
  nextPageToken = data.nextPageToken || null;
  moreBtn.disabled = !nextPageToken;
  moreBtn.textContent = nextPageToken ? (document.documentElement.lang==='uk' ? 'Показати ще' : 'Load more') : (document.documentElement.lang==='uk' ? 'Більше немає' : 'No more videos');
}

moreBtn.addEventListener('click', ()=>{ if(nextPageToken) load(nextPageToken); });
load();
