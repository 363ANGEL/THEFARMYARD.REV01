// Poker Room feeds: refreshes fy.poker_news (Scandal Sheet) and fy.poker_video (Poker School) once a day.
// Deploy:  supabase functions deploy poker-feeds --no-verify-jwt
// Secrets: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected by Supabase; set YOUTUBE_API_KEY and FEEDS_SECRET
//          with `supabase secrets set`. Schedule it (see README.md) to call this URL with header x-feeds-secret.
// Writes go through the service role, so RLS does not apply; members only ever read these tables.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SOURCES: { name: string; url: string }[] = [
  { name: "PokerNews", url: "https://www.pokernews.com/rss.php" },
  { name: "Card Player", url: "https://www.cardplayer.com/poker-news.rss" },
  { name: "Poker.org", url: "https://www.poker.org/feed/" },
];
// Controversy / bad-behaviour vocabulary. Score = how many distinct words hit; ties go to the newer story.
const SCANDAL = ["cheat", "cheating", "scandal", "accus", "ban", "banned", "collusion", "collud", "fraud", "lawsuit", "sued", "arrest",
  "rta", "superuser", "super-user", "bot", "malware", "hack", "angle", "angle-shoot", "controvers", "dispute", "fine", "fined",
  "suspend", "investigat", "allegat", "stole", "theft", "chip dump", "marked cards", "ghost", "multi-account", "refund", "confiscat"];
const YT_QUERIES = ["poker intermediate tips", "poker strategy mistakes intermediate", "controversial poker hand", "craziest poker hand", "funny poker hands"];
const TAG_FOR = (q: string) => /controvers/.test(q) ? "Controversial" : /crazi/.test(q) ? "Crazy hand" : /funny/.test(q) ? "Funny" : "Intermediate";

type Story = { title: string; note: string | null; about: string | null; source: string; url: string; image_url: string | null; published_on: string | null; score: number; ts: number };

const text = (xml: string, tag: string) => {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").trim() : "";
};
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ");
const clean = (u: string | null) => (u && /^https:\/\/[^\s"'<>()]+$/.test(u) ? u : null);

async function fetchText(url: string, ms = 8000): Promise<string> {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try { const r = await fetch(url, { signal: ctrl.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; FarmyardFeeds/1.0)" } }); return r.ok ? await r.text() : ""; }
  catch { return ""; } finally { clearTimeout(t); }
}

async function ogImage(url: string): Promise<string | null> {
  const html = await fetchText(url, 6000); if (!html) return null;
  const m = html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return m ? clean(decode(m[1])) : null;
}

async function stories(): Promise<Story[]> {
  const all: Story[] = [];
  for (const src of SOURCES) {
    const xml = await fetchText(src.url); if (!xml) continue;
    const items = xml.split(/<item[\s>]/i).slice(1);
    for (const it of items) {
      const title = decode(text(it, "title")), link = decode(text(it, "link") || (it.match(/<link[^>]+href=["']([^"']+)["']/i) || [])[1] || "");
      if (!title || !clean(link)) continue;
      const desc = decode(text(it, "description")).replace(/\s+/g, " ").trim();
      const hay = (title + " " + desc).toLowerCase();
      const score = SCANDAL.filter(w => hay.includes(w)).length;
      if (!score) continue;
      const pub = text(it, "pubDate") || text(it, "dc:date"), ts = pub ? Date.parse(pub) : 0;
      all.push({ title: title.slice(0, 160), note: desc ? desc.slice(0, 220) : null, about: null, source: src.name, url: link, image_url: null,
        published_on: ts ? new Date(ts).toISOString().slice(0, 10) : null, score, ts });
    }
  }
  // Word accusations as accusations: a plain "X cheated" headline becomes "X accused of cheating".
  all.forEach(s => { s.title = s.title.replace(/\b(\w[\w .'-]{2,40}?) (cheated|colluded|stole)\b/i, (_m, who, verb) => `${who} accused of ${verb === "cheated" ? "cheating" : verb === "colluded" ? "collusion" : "theft"}`); });
  const seen = new Set<string>();
  const top = all.sort((a, b) => b.score - a.score || b.ts - a.ts).filter(s => { const k = s.title.toLowerCase().slice(0, 60); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 5);
  for (const s of top) s.image_url = await ogImage(s.url);   // hotlinked, never copied
  return top;
}

const iso = (d: string) => { const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(d) || []; return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0)); };
async function videos(key: string, skip: Set<string>) {
  const found: Record<string, { youtube_id: string; title: string; channel: string; tag: string; duration_secs: number; views: number }> = {};
  for (const q of YT_QUERIES) {
    const s = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoDuration=short&order=viewCount&maxResults=15&q=${encodeURIComponent(q)}&key=${key}`).then(r => r.json()).catch(() => null);
    const ids = ((s && s.items) || []).map((i: any) => i.id.videoId).filter((id: string) => id && !skip.has(id));
    if (!ids.length) continue;
    const v = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${ids.join(",")}&key=${key}`).then(r => r.json()).catch(() => null);
    for (const it of (v && v.items) || []) {
      const secs = iso(it.contentDetails?.duration || "");
      if (!secs || secs > 300 || it.snippet?.liveBroadcastContent === "live") continue;        // five minutes or less
      found[it.id] = { youtube_id: it.id, title: decode(it.snippet.title).slice(0, 160), channel: it.snippet.channelTitle || "", tag: TAG_FOR(q), duration_secs: secs, views: Number(it.statistics?.viewCount || 0) };
    }
  }
  // Mix: up to 3 tips + 2 wild hands, each group by view count.
  const list = Object.values(found).sort((a, b) => b.views - a.views);
  const tips = list.filter(v => v.tag === "Intermediate").slice(0, 3), fun = list.filter(v => v.tag !== "Intermediate").slice(0, 2);
  const pick = [...tips, ...fun]; for (const v of list) { if (pick.length >= 5) break; if (!pick.includes(v)) pick.push(v); }
  return pick.sort((a, b) => b.views - a.views).slice(0, 5);
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("FEEDS_SECRET");
  if (secret && req.headers.get("x-feeds-secret") !== secret) return new Response("forbidden", { status: 403 });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { db: { schema: "fy" } });
  const { data: league, error: le } = await sb.from("league").select("id").eq("slug", "farmyard").single();
  if (le || !league) return new Response("no league: " + (le?.message || ""), { status: 500 });
  const out: Record<string, unknown> = {};

  const news = await stories();
  if (news.length) {
    const rows = news.map((s, i) => ({ league_id: league.id, rank: i + 1, title: s.title, note: s.note, about: s.about, source: s.source, url: s.url, image_url: s.image_url, published_on: s.published_on, fetched_at: new Date().toISOString() }));
    const { error } = await sb.from("poker_news").upsert(rows, { onConflict: "league_id,rank" });
    out.news = error ? error.message : rows.length;
  } else out.news = "no scandal stories found; kept yesterday's";

  const key = Deno.env.get("YOUTUBE_API_KEY");
  if (key) {
    const { data: cur } = await sb.from("poker_video").select("youtube_id").eq("league_id", league.id);
    const vids = await videos(key, new Set((cur || []).map((r: any) => r.youtube_id)));   // a fresh five each day
    if (vids.length === 5) {
      const rows = vids.map((v, i) => ({ league_id: league.id, rank: i + 1, ...v, fetched_at: new Date().toISOString() }));
      const { error } = await sb.from("poker_video").upsert(rows, { onConflict: "league_id,rank" });
      out.videos = error ? error.message : rows.length;
    } else out.videos = `only ${vids.length} fresh videos found; kept yesterday's`;
  } else out.videos = "YOUTUBE_API_KEY not set";

  return new Response(JSON.stringify(out), { headers: { "content-type": "application/json" } });
});
