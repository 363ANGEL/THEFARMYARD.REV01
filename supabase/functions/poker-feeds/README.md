# poker-feeds

Daily refresh for the two Poker Room feed modules (BUILD-PLAN, "Poker Room feeds", 11 Oct):

- **Poker Scandal Sheet** → `fy.poker_news`: the five most controversy-flavoured stories from the PokerNews, Card Player and Poker.org RSS feeds, each with the article's own `og:image` (hotlinked, not copied). Accusations are worded as accusations.
- **Poker School** → `fy.poker_video`: five YouTube videos of five minutes or less (intermediate tips plus wild / funny hands), ranked by view count. Videos already on the board are skipped, so each run picks a fresh five.

The page (`poker.js`) reads both through `fy.poker_feeds()`. `schema.sql` seeds the design's day-one content, so the modules are never empty before the first run.

## Deploy (RAY, once)

```sh
supabase login
supabase link --project-ref sqansmcqddrvbgqnrxfs
supabase secrets set YOUTUBE_API_KEY=<key from Google Cloud → YouTube Data API v3>
supabase secrets set FEEDS_SECRET=<any long random string>
supabase functions deploy poker-feeds --no-verify-jwt
```

Test it:

```sh
curl -H "x-feeds-secret: <FEEDS_SECRET>" https://sqansmcqddrvbgqnrxfs.supabase.co/functions/v1/poker-feeds
```

## Schedule (daily, 06:00 UTC)

Dashboard → Integrations → Cron (pg_cron + pg_net), or in the SQL editor:

```sql
select cron.schedule('fy_poker_feeds', '0 6 * * *', $$
  select net.http_get(
    url := 'https://sqansmcqddrvbgqnrxfs.supabase.co/functions/v1/poker-feeds',
    headers := '{"x-feeds-secret": "<FEEDS_SECRET>"}'::jsonb);
$$);
```

(`create extension if not exists pg_net;` first if the project does not have it.)

## Notes

- The RSS URLs in `SOURCES` are the sites' published feeds as of Oct 2026; if one 404s the run just skips that source.
- If no story scores on the scandal vocabulary, yesterday's sheet stays. Same for videos when fewer than five fresh ones qualify.
- Writes use the service role; members can only read these tables (RLS).
