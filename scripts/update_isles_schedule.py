"""Fetch the Islanders schedule from the NHL API and write a trimmed copy to data/.

The NHL API does not send CORS headers, so the site can't call it from the
browser. A GitHub Action runs this script on a schedule and commits the result.
"""

import json
import pathlib
import urllib.request
from datetime import datetime, timezone

API_URL = "https://api-web.nhle.com/v1/club-schedule-season/NYI/now"
OUTPUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "isles-schedule.json"


def trim_team(team):
    return {
        "abbrev": team.get("abbrev"),
        "placeName": {"default": (team.get("placeName") or {}).get("default")},
        "commonName": {"default": (team.get("commonName") or {}).get("default")},
        "score": team.get("score"),
    }


def trim_game(game):
    return {
        "id": game.get("id"),
        "season": game.get("season"),
        "gameType": game.get("gameType"),
        "gameDate": game.get("gameDate"),
        "startTimeUTC": game.get("startTimeUTC"),
        "gameState": game.get("gameState"),
        "venue": {"default": (game.get("venue") or {}).get("default")},
        "tvBroadcasts": [
            {
                "market": b.get("market"),
                "countryCode": b.get("countryCode"),
                "network": b.get("network"),
            }
            for b in game.get("tvBroadcasts") or []
        ],
        "homeTeam": trim_team(game.get("homeTeam") or {}),
        "awayTeam": trim_team(game.get("awayTeam") or {}),
        "gameOutcome": game.get("gameOutcome"),
    }


def main():
    request = urllib.request.Request(API_URL, headers={"User-Agent": "jbfleesny-schedule-bot"})
    with urllib.request.urlopen(request, timeout=30) as response:
        data = json.load(response)

    games = [trim_game(g) for g in data.get("games") or []]
    if not games:
        raise SystemExit("NHL API returned no games; keeping the existing file.")

    previous = None
    if OUTPUT.exists():
        previous = json.loads(OUTPUT.read_text()).get("games")
    if previous == games:
        print("Schedule unchanged.")
        return

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "updatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "games": games,
    }
    OUTPUT.write_text(json.dumps(payload, indent=1) + "\n")
    print(f"Wrote {len(games)} games to {OUTPUT}")


if __name__ == "__main__":
    main()
