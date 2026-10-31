# Wildfire

A daily word puzzle. One corner of a 5×5 letter board is on fire. Spell
words by sliding across touching letters; every word has to use at least
one burning tile, and the rest of its tiles catch. Burn the whole board
in as few words as you can. Par is the fewest the generator found.

Stuck? Hint marks where a good word starts, and a second tap shows the
whole word.

## Run

It's a static page with no build step. Open `index.html`, or serve the
folder:

```sh
python3 -m http.server 8765
```

## Data

`js/words.js` and `tools/common.txt` come from `tools/words.py`, which
combines the [an-array-of-english-words](https://www.npmjs.com/package/an-array-of-english-words)
dictionary with [wordfreq](https://pypi.org/project/wordfreq/)
frequencies:

- the game accepts about 78,000 words (anything reasonably known)
- par and hints only use about 16,000 familiar words that WordNet knows

```sh
pip install wordfreq nltk
python tools/words.py path/to/an-array-of-english-words/index.json
```

`js/boards.js` comes from `tools/generate.mjs`. It deals random grids
with English letter weights, finds every familiar word on each one, and
runs a beam search for the shortest set of words that burns every tile.
Boards with par from 5 to 7 are kept.

```sh
node tools/generate.mjs 365
```

Board 1 is October 31, 2026, and the list wraps after the last board.

The earlier game, Burn, is kept at the `burn-v1` tag.
