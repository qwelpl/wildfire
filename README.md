# Burn

A daily word puzzle. Answer four clues, each of which has several right
answers. Every letter you use burns, so no letter can appear in two
answers. Stuck? Hint gives the length and first letter of a word that
still leaves a way through.

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

The generator builds each puzzle from the hand-picked answers. It
favors sets where the obvious answers mostly fit (usually one clue's
first guess gets in the way), with several working combinations and
familiar words. Players can use any accepted synonym on top of that. Puzzle 1 is
October 30, 2026, and the list wraps after the last puzzle.
