
exports.handler = async function(event) {
  try {
    const API_KEY = process.env.YT_API_KEY;
    if (!API_KEY) return { statusCode: 500, body: JSON.stringify({ error: "Missing API key" }) };
    const { channelId, max = 6, pageToken } = event.queryStringParameters || {};
    if (!channelId) return { statusCode: 400, body: JSON.stringify({ error: "Missing channelId" }) };

    const p = new URLSearchParams({
      key: API_KEY,
      channelId,
      part: "snippet,id",
      order: "date",
      type: "video",
      maxResults: String(Math.min(parseInt(max,10)||6, 12)),
    });
    if (pageToken) p.set("pageToken", pageToken);

    const resp = await fetch("https://www.googleapis.com/youtube/v3/search?" + p.toString());
    if (!resp.ok) {
      const txt = await resp.text();
      return { statusCode: resp.status, body: txt };
    }
    const data = await resp.json();
    const payload = {
      items: (data.items||[]).map(it => ({
        id: it.id.videoId,
        title: it.snippet.title,
        publishedAt: it.snippet.publishedAt,
        thumb: (it.snippet.thumbnails.high || it.snippet.thumbnails.medium || {}).url || ""
      })),
      nextPageToken: data.nextPageToken || null
    };
    return { statusCode: 200, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" }, body: JSON.stringify(payload) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
