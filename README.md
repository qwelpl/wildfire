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

Each clue accepts its hand-picked answers (`tools/groups.mjs`) plus every
synonym found automatically in three sources: Moby Thesaurus II, WordNet
and the Datamuse API (`tools/expanded.json`, about 200 words per clue).
Words in `tools/blocklist.mjs` are removed.

To refresh the synonym lists (needs `pip install nltk wordfreq` and the
WordNet corpus; downloads Moby on first run):

```sh
python3 tools/expand.py
```

To rebuild `js/puzzles.js`:

```sh
node tools/generate.mjs 120
```

The generator builds each puzzle from the hand-picked answers: exactly
one combination of them shares no letters, and at least two clues have
their most obvious answer as a trap. Players can use any accepted
synonym, so other routes through a puzzle may exist. Puzzle 1 is
October 30, 2026, and the list wraps after the last puzzle.
