# Crawler

There is a room at the bottom.

A real-time dungeon horde. Same bones as the old turn-based crawler — BSP halls, Rogue / Warrior / Wizard, scraps of writing on the floor — new loop. You move. Your weapon works without you. The dark does not wait its turn.

## Play

```bash
cd dungeon-horde
python3 -m http.server 8765 --bind 127.0.0.1
```

Open [http://localhost:8765](http://localhost:8765).

| | |
|---|---|
| WASD / arrows | Move |
| 1 / 2 / 3 | Pick a class or an upgrade |
| Esc | Pause |
| M | Mute |
| Enter | Descend / retry |

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
