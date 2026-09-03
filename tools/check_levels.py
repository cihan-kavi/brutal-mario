#!/usr/bin/env python3
"""Reachability check for the levels embedded in index.html.

Models Mario as a one-tile body that can walk, jump and fall. Horizontal
reach comes from the engine constants: a jump lasts 2 * 11.5 / 0.55 = 42
frames at 4.2 px per frame, so a flat jump clears about 5 tiles, and every
tile of height costs part of that arc.

Fake stone counts as empty because it breaks the moment it is touched, so no
level may depend on it. Crumble stone holds for 30 frames after the first
step, which is long enough to run across, so it counts as a real surface.
A spring throws the player 18 px per frame upward, worth about 8 tiles, but
only while the column above it is clear of spikes.
"""
import re
import sys
from collections import deque
from pathlib import Path

SOLID = set('#B?I MC|~TVPL')
SOLID.discard(' ')
LETHAL = set('S^X')
# Horizontal tiles reachable when jumping 0..3 tiles upward.
REACH_UP = [5, 5, 4, 3]
MAX_UP = len(REACH_UP) - 1
MAX_DOWN = 8
REACH_DOWN = 5
# Height a spring reaches, mapped to how far sideways the player can steer.
SPRING_REACH = {4: 6, 5: 5, 6: 4, 7: 3, 8: 2}


def parse_levels(html):
    out = []
    for name, block, extras in re.findall(
        r'name: "(.*?)",\n\s*spawn: \[2, (?:\d+)\],\n\s*map: \[([\s\S]*?)\n\s*\],\n\s*extras: (\[[\s\S]*?\])',
        html,
    ):
        rows = re.findall(r'"([^"]*)"', block)
        width = max(len(r) for r in rows)
        grid = [r.ljust(width) for r in rows]
        bedrock = ''.join('S' if ch == ' ' else '#' for ch in grid[-1])
        grid.append(bedrock)
        out.append((name, grid))
    return out


def at(grid, c, r):
    if r < 0 or r >= len(grid) or c < 0 or c >= len(grid[0]):
        return ' '
    return grid[r][c]


def solid(grid, c, r):
    if r < 0 or r >= len(grid) or c < 0 or c >= len(grid[0]):
        return False
    return grid[r][c] in SOLID


def lethal(grid, c, r):
    if r < 0 or r >= len(grid) or c < 0 or c >= len(grid[0]):
        return False
    return grid[r][c] in LETHAL


def standable(grid, c, r, banned=frozenset()):
    """Player stands on tile (c, r); body occupies (c, r-1)."""
    if (c, r) in banned or not solid(grid, c, r):
        return False
    if solid(grid, c, r - 1) or lethal(grid, c, r - 1) or lethal(grid, c, r):
        return False
    return True


def blind_landings(grid, states):
    """One-tile islands flanked by fake stone: the player cannot see where to land."""
    out = set()
    for c, r in states:
        if solid(grid, c - 1, r) or solid(grid, c + 1, r):
            continue
        if 'F' in (at(grid, c - 1, r), at(grid, c + 1, r)):
            out.add((c, r))
    return out


def fall_from(grid, c, r, banned=frozenset()):
    """Drop down column c starting just below row r; returns landing state."""
    for rr in range(r, len(grid)):
        if lethal(grid, c, rr):
            return None
        if solid(grid, c, rr):
            return (c, rr) if standable(grid, c, rr, banned) else None
    return None


def passable(grid, c, r, c2, r2):
    """True when the body fits through every column between the two footholds.

    Standing on row r puts the body in row r - 1, and a jump lifts it about
    three rows higher, so the crossing needs one of those rows free the whole
    way across. A tall wall leaves none of them free and blocks the jump.
    """
    step = 1 if c2 > c else -1
    between = range(c + step, c2, step)
    if not between:
        return True
    body = min(r, r2) - 1
    return any(
        all(not solid(grid, ci, rp) for ci in between)
        for rp in range(body - MAX_UP, body + 1)
    )


def reachable(grid, start, banned=frozenset()):
    seen = {start}
    q = deque([start])
    while q:
        c, r = q.popleft()
        moves = []
        for dc in (-1, 1):
            if standable(grid, c + dc, r, banned):
                moves.append((c + dc, r))
            else:
                landing = fall_from(grid, c + dc, r, banned)
                if landing:
                    moves.append(landing)
        for dr in range(-MAX_UP, MAX_DOWN + 1):
            span = REACH_UP[-dr] if dr <= 0 else REACH_DOWN
            for dc in range(-span, span + 1):
                target = (c + dc, r + dr)
                if standable(grid, *target, banned=banned) and passable(grid, c, r, *target):
                    moves.append(target)
        if at(grid, c, r) == 'P':
            for up, span in sorted(SPRING_REACH.items()):
                if any(solid(grid, c, rr) or lethal(grid, c, rr) for rr in range(r - up, r)):
                    break
                for dc in range(-span, span + 1):
                    target = (c + dc, r - up)
                    if standable(grid, *target, banned=banned):
                        moves.append(target)
        for m in moves:
            if m not in seen:
                seen.add(m)
                q.append(m)
    return seen


def main():
    html = Path(__file__).resolve().parent.parent.joinpath('index.html').read_text(encoding='utf-8')
    levels = parse_levels(html)
    if not levels:
        sys.exit('no levels parsed')
    failures = 0
    for name, grid in levels:
        floor_row = len(grid) - 2
        start = (2, floor_row)
        goals = [(c, r) for r, row in enumerate(grid) for c, ch in enumerate(row) if ch == 'G']
        problems = []
        if not standable(grid, *start):
            problems.append('spawn is not on solid stone')
        if not goals:
            problems.append('no goal tile')
        seen = reachable(grid, start)

        def reaches_goal(states):
            return all(any(c == gc and r in (gr + 1, gr) for c, r in states) for gc, gr in goals)

        for gc, gr in goals:
            if not any(c == gc and r in (gr + 1, gr) for c, r in seen):
                problems.append(f'goal at col {gc} unreachable')
        blind = blind_landings(grid, seen)
        if goals and reaches_goal(seen) and blind:
            if not reaches_goal(reachable(grid, start, banned=blind)):
                cols = sorted({c for c, _ in blind})
                problems.append(
                    f'only route lands on unmarked one-tile islands among fake stone at cols {cols}')
        widest = max((len(m.group(0)) for m in re.finditer(r' +', grid[floor_row])), default=0)
        status = 'OK ' if not problems else 'FAIL'
        if problems:
            failures += 1
        print(f'{status} {name:24} goals={len(goals)} states={len(seen):4} widest_pit={widest}')
        for p in problems:
            print(f'       - {p}')
    print('\nall levels completable' if not failures else f'\n{failures} level(s) need fixing')
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
