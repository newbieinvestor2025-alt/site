// netlify/functions/videos.js
// Supports two modes:
// 1) With YT_API_KEY: gets channel stats + uploads (paginated) via YouTube Data API.
// 2) Without key: falls back to public RSS (last ~15 items).

const fetchFn = (...args) => (typeof fetch !== 'undefined' ? fetch(...args) : import('node-fetch').then(m => m.default(...args)));

exports.handler = async (event) => {
  try {
    const CHANNEL_ID = process.env.CHANNEL_ID;
    if (!CHANNEL_ID) return json(500, { error: 'Missing CHANNEL_ID env var' });

    const MAX = clamp(parseInt((event.queryStringParameters||{}).max || '24', 10), 1, 100);
    const API_KEY = process.env.YT_API_KEY;

    if (API_KEY) {
      // Use YouTube Data API
      const chanUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails,statistics&id=${CHANNEL_ID}&key=${API_KEY}`;
      const chanRes = await fetchFn(chanUrl);
      if (!chanRes.ok) throw new Error('channels API failed: ' + chanRes.status);
      const chan = await chanRes.json();
      const item = chan.items && chan.items[0];
      if (!item) throw new Error('Channel not found');
      const uploadsId = item.contentDetails.relatedPlaylists.uploads;
      const stats = item.statistics || {};

      let videos = [];
      let pageToken = undefined;
      while (videos.length < MAX) {
        const remain = Math.min(50, MAX - videos.length);
        const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
        url.searchParams.set('part', 'snippet,contentDetails');
        url.searchParams.set('playlistId', uploadsId);
        url.searchParams.set('maxResults', String(remain));
        if (pageToken) url.searchParams.set('pageToken', pageToken);
        url.searchParams.set('key', API_KEY);
        const r = await fetchFn(url.toString());
        if (!r.ok) throw new Error('playlistItems API failed: ' + r.status);
        const j = await r.json();
        for (const it of (j.items||[])) {
          const id = it.contentDetails?.videoId;
          const s = it.snippet || {};
          if (!id) continue;
          videos.push({
            id,
            title: s.title || '',
            published: s.publishedAt || it.contentDetails?.videoPublishedAt || '',
            thumbnail: s.thumbnails?.high?.url || s.thumbnails?.medium?.url || s.thumbnails?.default?.url || ''
          });
        }
        pageToken = j.nextPageToken;
        if (!pageToken) break;
      }

      videos.sort((a,b)=> new Date(b.published) - new Date(a.published));
      return json(200, {
        videos,
        stats: {
          videoCount: Number(stats.videoCount || videos.length),
          viewCount: Number(stats.viewCount || 0),
          subscriberCount: Number(stats.subscriberCount || 0)
        }
      });
    } else {
      // Fallback to RSS
      const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
      const resp = await fetchFn(feedUrl, { headers: { 'User-Agent': 'NetlifyFunction/1.0' } });
      if (!resp.ok) throw new Error('RSS fetch failed: ' + resp.status);
      const xml = await resp.text();
      const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(m => m[1]);
      const pick = (re, s) => ((s.match(re) || [])[1] || '').trim();
      const videos = entries.slice(0, MAX).map(e => {
        const id = pick(/<yt:videoId>(.*?)<\/yt:videoId>/, e);
        const title = pick(/<title>([\s\S]*?)<\/title>/, e);
        const published = pick(/<published>(.*?)<\/published>/, e);
        const thumb = pick(/<media:thumbnail[^>]*url="([^"]+)"/i, e) || `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
        return { id, title, published, thumbnail: thumb };
      }).filter(v => v.id);
      return json(200, { videos, stats: null });
    }
  } catch (e) {
    return json(500, { error: e.message });
  }
};

function json(statusCode, obj){
  return { statusCode, headers: {'Content-Type':'application/json','Cache-Control':'public, max-age=300'}, body: JSON.stringify(obj) };
}
function clamp(n, min, max){ return Math.max(min, Math.min(max, isNaN(n)?min:n)); }
