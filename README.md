# Burn

A daily word puzzle. Answer four clues, each of which has several right
answers. Every letter you use burns, so no letter can appear in two
answers. Only one combination works.

## Run

It's a static site. Open `index.html`, or serve the folder:

```sh
python3 -m http.server
```

## Puzzles

`js/puzzles.js` is generated from the clue groups in `tools/groups.mjs`:

```sh
node tools/generate.mjs 120
```

The generator only keeps sets of clues with exactly one solution, where
at least two clues have their most obvious answer as a trap. Puzzle 1 is
October 30, 2026, and the list wraps after the last puzzle.
