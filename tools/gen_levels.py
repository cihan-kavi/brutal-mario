#!/usr/bin/env python3
"""Generates the LEVELS array inside index.html.

Rows are painted by column range so platforms always line up with the pits
below them. Row 13 is the walking floor; the game appends the bedrock course
with spikes under every pit at load time.
"""
import re
from pathlib import Path

WIDTH = 100
ROWS = 14
FLOOR = 13


def blank():
    return [[' '] * WIDTH for _ in range(ROWS)]


def paint(grid, row, start, end, ch):
    for c in range(start, min(end, WIDTH - 1) + 1):
        grid[row][c] = ch


def put(grid, row, col, ch):
    grid[row][col] = ch


def floor_plan(grid, segments):
    """segments: list of (start, end, char) painted on the floor row."""
    for start, end, ch in segments:
        paint(grid, FLOOR, start, end, ch)


def rows(grid):
    return [''.join(r).rstrip() or ' ' for r in grid]


levels = []


def add(name, grid, extras):
    levels.append({'name': name, 'map': rows(grid), 'extras': extras})


# ------------------------------------------------- 1-1  the level of lies
# The gentle opening level, except nothing in it is honest: the floor lies,
# the coin blocks lie, and the empty air holds a block. Every trap here is
# survivable except the fake floor, so it teaches the rules cheaply.
g = blank()
floor_plan(g, [(0, 9, '#'), (13, 23, '#'), (26, 39, '#'),
               (43, 56, '#'), (61, 75, '#'), (79, 99, '#')])
# A coin, a coin, and a goomba in a box.
put(g, 11, 5, '?')
put(g, 11, 6, 'T')
put(g, 11, 7, '?')
# The floor keeps going. It does not.
paint(g, FLOOR, 24, 25, 'F')
# Empty air that answers back, and the coin it is hiding.
paint(g, 11, 32, 34, 'I')
put(g, 7, 33, '?')
# The last step before the pit is a spring, and the sky above it is not empty.
put(g, FLOOR, 39, 'P')
put(g, 4, 43, '?')
put(g, 4, 44, 'T')
put(g, 4, 45, '?')
# A pit furnished with one skull block and two helpful stones that are fake.
put(g, 12, 58, 'X')
paint(g, 12, 59, 60, 'F')
# One real coin block, then three that are not.
put(g, 11, 63, '?')
for c in (65, 67, 69):
    put(g, 11, c, 'T')
# The cannon: climb up for the coin and the stone under it fires you away.
paint(g, 10, 71, 72, 'B')
put(g, 10, 73, 'L')
put(g, 8, 72, '?')
put(g, 11, 86, '?')
put(g, 11, 90, 'T')
put(g, 12, 93, 'G')
add("1-1: Taş Zemin", g, [
    {'type': 'goomba', 'x': 20, 'y': 12},
    {'type': 'goomba', 'x': 50, 'y': 12},
    {'type': 'goomba', 'x': 85, 'y': 12},
])

# ------------------------------------------------- 1-2  the bridge is a lie
# The bridge across the chasm is entirely fake and collapses onto the real
# catwalk hiding one row below it. After the chasm the level stops repeating
# itself: a staircase, then a short hop with an invisible block waiting for
# whoever jumps from the edge instead of a step early.
g = blank()
floor_plan(g, [(0, 19, '#'), (49, 58, '#'), (72, 77, '#'), (80, 99, '#')])
paint(g, 10, 20, 45, 'F')
for start, end in ((20, 24), (28, 31), (35, 37), (41, 45)):
    paint(g, 12, start, end, '#')
put(g, 11, 8, '?')
put(g, 11, 14, '?')
# Staircase out of the chasm. Both steps are wide enough for a full jump, and
# the far end of the top one is fake, so running off it costs the view only.
paint(g, 11, 60, 64, '#')
paint(g, 9, 66, 70, '#')
put(g, 9, 71, 'F')
put(g, 7, 68, '?')
# The last hop looks like the ones before it. It is not: two invisible blocks
# stand just past the edge, low enough that a late jump slams into them and
# high enough that a takeoff one tile earlier sails over.
put(g, 10, 78, 'I')
put(g, 11, 78, 'I')
put(g, 12, 92, 'G')
add("1-2: Sahte Köprü", g, [
    {'type': 'goomba', 'x': 55, 'y': 12},
    {'type': 'goomba', 'x': 84, 'y': 12},
])

# ---------------------------------------------------------------- 1-3
g = blank()
floor_plan(g, [(0, 19, '#'), (60, 69, '#'), (74, 91, '#')])
for start in (20, 27, 34, 41, 48, 55):
    paint(g, 10, start, start + 3, 'I')
put(g, 11, 21, '?')
put(g, 12, 85, 'G')
add("1-3: Görünmez Köprü", g, [])

# ------------------------------------------------- 2-1  climb the tower
# Zigzag of stone ledges rising to a flag at the very top. Every ledge has a
# fake stone lip on its right, so the obvious "one more step" drops you.
g = blank()
floor_plan(g, [(0, 15, '#')])
paint(g, 12, 16, 18, '#')
ledges = [(11, 18, 23), (9, 26, 31), (7, 34, 39), (5, 42, 47), (3, 50, 55), (1, 58, 65)]
for row, left, right in ledges:
    paint(g, row, left, right, '#')
    paint(g, row, right + 1, right + 3, 'F')
for row, col in ((9, 20), (7, 28), (5, 36), (3, 44)):
    put(g, row, col, '?')
put(g, 9, 22, 'T')
put(g, 5, 38, 'T')
put(g, 0, 61, 'G')
add("2-1: Taş Kule", g, [
    {'type': 'goomba', 'x': 20, 'y': 10},
    {'type': 'goomba', 'x': 36, 'y': 6},
    {'type': 'flying', 'x': 30, 'y': 8},
    {'type': 'flying', 'x': 50, 'y': 4},
])

# ------------------------------------------------- 2-2  read the ceiling
# A stone roof lined with hanging spikes seals the level. One gap in it sits
# above one spring; every other spring fires you straight into the spikes.
# The wall in the middle makes that spring the only way through.
g = blank()
floor_plan(g, [(0, 99, '#')])
paint(g, 6, 6, 85, '#')
paint(g, 7, 6, 52, '^')
paint(g, 7, 58, 85, '^')
paint(g, 6, 53, 57, ' ')
for r in range(7, FLOOR + 1):
    paint(g, r, 60, 61, '|')
put(g, FLOOR, 55, 'P')
for c in (14, 26, 34, 42, 70, 80):
    put(g, FLOOR, c, 'P')
for c in (30, 45, 72):
    put(g, 3, c, '?')
put(g, 12, 90, 'G')
add("2-2: Diken Tavan", g, [
    {'type': 'goomba', 'x': 22, 'y': 12},
    {'type': 'goomba', 'x': 46, 'y': 12},
    {'type': 'flying', 'x': 45, 'y': 3},
    {'type': 'goomba', 'x': 88, 'y': 12},
])

# ------------------------------------------------- 2-3  keep running
# Crumble stone holds for half a second after you step on it, so the bridges
# only carry you while you keep moving. Solid blocks are the breathers.
g = blank()
islands = [(0, 8), (26, 34), (52, 60), (78, 99)]
floor_plan(g, [(a, b, '#') for a, b in islands])
for left, right in ((9, 25), (35, 51), (61, 77)):
    paint(g, 12, left, right, 'C')
    for col in range(left + 5, right, 6):
        put(g, 12, col, '#')
for col in (12, 18, 24, 38, 44, 50, 64, 70, 76):
    put(g, 10, col, '?')
put(g, 12, 95, 'G')
add("2-3: Çöken Köprü", g, [
    {'type': 'goomba', 'x': 30, 'y': 12},
    {'type': 'goomba', 'x': 56, 'y': 12},
    {'type': 'flying', 'x': 17, 'y': 8},
    {'type': 'flying', 'x': 43, 'y': 8},
    {'type': 'flying', 'x': 69, 'y': 8},
])

# ------------------------------------------------- 3-1  the castle
# Spikes hang from the ceiling over the walkways, so you may only jump where
# nothing hangs above you. Conveyors speed you up right where a pit waits,
# and the stone elevators over the pits are the calm way across.
g = blank()
floor_plan(g, [(0, 13, '#'), (14, 19, 'V'), (20, 25, '#'), (30, 43, '#'),
               (48, 57, '#'), (58, 63, 'V'), (64, 67, '#'), (72, 79, '#'),
               (80, 85, 'V'), (86, 99, '#')])
paint(g, 5, 6, 95, '#')
for left, right in ((14, 19), (34, 39), (58, 63), (80, 85)):
    for r in range(6, 9):
        paint(g, r, left, right, '#')
    paint(g, 9, left, right, '^')
for left, right in ((30, 33), (48, 51), (72, 75)):
    paint(g, 10, left, right, '#')
paint(g, 11, 27, 28, 'M')
paint(g, 11, 69, 70, 'M')
for col in (22, 40, 64, 88):
    put(g, 11, col, 'T')
for col in (24, 42, 66, 86):
    put(g, 11, col, '?')
put(g, 12, 96, 'G')
add("3-1: Taş Şato", g, [
    {'type': 'goomba', 'x': 22, 'y': 12},
    {'type': 'goomba', 'x': 36, 'y': 12},
    {'type': 'goomba', 'x': 54, 'y': 12},
    {'type': 'flying', 'x': 45, 'y': 7},
    {'type': 'flying', 'x': 76, 'y': 7},
    {'type': 'flying', 'x': 90, 'y': 8},
])

# ---------------------------------------------------------------- 3-4
g = blank()
floor_plan(g, [(0, 9, '#'), (14, 23, '#'), (28, 37, '#'), (42, 51, '#'),
               (56, 65, '#'), (70, 99, '#')])
for c in (20, 46, 62):
    put(g, FLOOR, c, 'P')
put(g, FLOOR, 33, 'L')
paint(g, FLOOR, 74, 81, 'V')
paint(g, 10, 10, 13, 'F')
paint(g, 10, 24, 27, 'I')
paint(g, 10, 38, 41, 'M')
paint(g, 10, 52, 55, 'C')
paint(g, 10, 66, 69, 'B')
paint(g, 4, 15, 25, '^')
paint(g, 4, 40, 50, '^')
paint(g, 4, 58, 68, '^')
put(g, 11, 36, 'X')
put(g, 11, 78, 'X')
put(g, 12, 96, 'G')
add("3-4: Carol'un Gazabı", g, [
    {'type': 'goomba', 'x': 16, 'y': 12},
    {'type': 'goomba', 'x': 44, 'y': 12},
    {'type': 'flying', 'x': 30, 'y': 5},
    {'type': 'flying', 'x': 60, 'y': 4},
    {'type': 'flying', 'x': 86, 'y': 6},
])


def emit():
    out = ['const LEVELS = [']
    for lv in levels:
        out.append('  {')
        out.append(f'    name: "{lv["name"]}",')
        out.append(f'    spawn: [2, {FLOOR}],')
        out.append('    map: [')
        for row in lv['map']:
            out.append(f'      "{row}",')
        out.append('    ],')
        if lv['extras']:
            out.append('    extras: [')
            for e in lv['extras']:
                out.append(f"      {{ type: '{e['type']}', x: {e['x']}, y: {e['y']} }},")
            out.append('    ]')
        else:
            out.append('    extras: []')
        out.append('  },')
    out.append('];')
    return '\n'.join(out)


target = Path(__file__).resolve().parent.parent / 'index.html'
html = target.read_text(encoding='utf-8')
new_html, count = re.subn(
    r'const LEVELS = \[[\s\S]*?\n\];\n\nlet tiles',
    emit() + '\n\nlet tiles',
    html,
)
if count != 1:
    raise SystemExit(f'expected exactly one LEVELS block, replaced {count}')
target.write_text(new_html, encoding='utf-8')
print(f'wrote {len(levels)} levels')
