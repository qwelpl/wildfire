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

Each clue accepts its hand-picked answers (`tools/groups.mjs`) plus
synonyms pulled from WordNet and Datamuse (`tools/expanded.json`).
Wrong-sense matches are removed in `tools/blocklist.mjs`.

To refresh the synonym lists (needs `pip install nltk wordfreq` and the
WordNet corpus):

```sh
python3 tools/expand.py
```

To rebuild `js/puzzles.js`:

```sh
node tools/generate.mjs 120
```

The generator keeps only sets of clues with exactly one solution across
every accepted word, where the solution uses hand-picked answers and at
least two clues have their most obvious answer as a trap. Puzzle 1 is
October 30, 2026, and the list wraps after the last puzzle.
