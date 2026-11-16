-- Poker School: a beginner series replaces the five hand-picked clips (RAY, 16 Nov 2026).
--
-- What was there: five unrelated videos typed in by hand, mostly intermediate strategy and
-- "craziest hand ever" clips. Nothing refreshes them despite the fetched_at column implying
-- something should, and the `channel` column had been filled with captions ("APT High Roller
-- · dealer mistake") rather than channel names.
--
-- What this puts there: EasyPoker's introduction course, in teaching order. One channel, one
-- series, start to finish -- the rules, the hands, which cards to play and where you are
-- sitting. Every id below was verified against YouTube's own oembed endpoint,
-- so the titles and the channel are theirs and not mine, and none of them is a dead embed.
--
-- Idempotent: safe to run twice. Nothing outside fy.poker_video is touched.

begin;

delete from fy.poker_video
 where league_id = (select id from fy.league where id = 'f212f041-5731-41d7-957e-e09ccfb6f788');

-- KuSR4-cVb30, the overview, is NOT here: it is age-restricted on YouTube, so the embed
-- refuses to play and the page shows "this content is age-restricted" instead of a video.
-- oembed does not reveal that; it only showed up on the page itself. Rules leads instead.

insert into fy.poker_video (league_id, rank, youtube_id, title, channel, tag, fetched_at, yard_id) values
  ('f212f041-5731-41d7-957e-e09ccfb6f788', 1, 'q5dcnvCa7MA', 'Poker Rules | How to Play Poker Course | Tutorial for Beginners', 'EasyPoker', 'Start here',   now(), 1),
  ('f212f041-5731-41d7-957e-e09ccfb6f788', 2, '89rrbdPzx8g', 'Poker Hands & Hand Rankings | Beginners Guide on How to Play Poker', 'EasyPoker', 'Hands',     now(), 1),
  ('f212f041-5731-41d7-957e-e09ccfb6f788', 3, 'yb087Skdhbg', 'Poker Starting Hands | Best to Worst | How to Play Poker', 'EasyPoker', 'Which cards',         now(), 1),
  ('f212f041-5731-41d7-957e-e09ccfb6f788', 4, '8HwXEo2WgeI', 'Poker Positions | How to Play Poker', 'EasyPoker', 'Where you sit',                            now(), 1);

commit;

-- Check: four rows, one channel, in teaching order.
-- select rank, tag, channel, title from fy.poker_video order by rank;
