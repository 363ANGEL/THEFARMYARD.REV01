# Chess standings feed

One file per chess.com tournament, written by P05.CHESS.LEAGUE's GitHub Action. The Farmyard reads it; nothing here is edited by hand.

File name: `<tournament-id>.json` (the last path segment of the chess.com tournament URL).

```json
{
  "tournament": "https://www.chess.com/tournament/live/...",
  "updated": "2026-10-10T09:00:00Z",
  "standings": [
    { "username": "chesscom-handle", "rank": 1, "score": 4.5 }
  ]
}
```

`username` is matched to `member.chesscom_username` on the Farmyard. Unknown usernames are shown as-is, unranked for points.
