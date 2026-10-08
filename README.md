# Crawler

There is a room at the bottom.

A real-time dungeon horde. Same bones as the old turn-based crawler — BSP halls, Rogue / Warrior / Wizard, scraps of writing on the floor — new loop. You move. Your weapon works without you. The dark does not wait its turn.

## Play

Live: [https://crawler.tabyen.workers.dev/](https://crawler.tabyen.workers.dev/). GitHub Pages is a static copy without the wall: [https://tabyen.github.io/dungeon-horde/](https://tabyen.github.io/dungeon-horde/).

To play **and** keep score locally:

```bash
npm install
npm run dev
```

Open [http://localhost:8787](http://localhost:8787). **The wall** on the title screen is the board. Type a name. **Make a room** gives a code friends can share (`?room=AB3K7Q`).

Game files only, no board:

```bash
python3 -m http.server 8765 --bind 0.0.0.0
```

Then [http://localhost:8765](http://localhost:8765). If the Worker is also running on 8787, the Pages-style server will still talk to it.

First deploy (needs a Cloudflare account):

```bash
npx wrangler login
npx wrangler d1 create crawler-scores
```

Put the printed `database_id` into `wrangler.toml`, then `npm run deploy`. The game and `/api` share one Worker URL. Custom domain later, when you have one.

| | |
|---|---|
| WASD / arrows | Move |
| Drag (phone) | Move — a stick appears under your thumb |
| 1 / 2 / 3 | Pick a class, a difficulty, or an upgrade |
| Esc / Pause | Pause |
| M | Mute |
| Enter | Descend / retry |
| B | The wall (title) |

Phones and tablets: open the same URL, tap Descend, pick a champion, pick how dark, drag anywhere to walk. Attacks still fire themselves. Add to Home Screen if you want it fullscreen.

## Difficulty

After the champion: **Lantern** (easy, most light), **Candle** (normal, a little light), **No Light** (hard, almost dark). Less light is harder. Spawn rate, enemy health and damage, your HP, how far you can see, and how soon elites arrive all change.

You do not aim. Knives, a circling blade, or homing motes fire on their own. Kill enough and the lantern steadies — pick a gift. Stairs in the far room go deeper. Deeper is worse.

## Classes

- **Rogue** — fast, thin, throwing knives
- **Warrior** — heavy, circling steel
- **Wizard** — fragile, homing light

## Why this repo

The Godot crawler at `games/crawler` is a turn-based mystery floor-crawler. This is the change of direction: keep the dungeon, throw out the turns.

```bash
npm test
```
