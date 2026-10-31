"""Builds tools/expanded.json: every extra word each clue accepts.

Pulls synonyms for each clue word from three sources and merges them:
  - Moby Thesaurus II (public domain, ~30k root words)
  - WordNet (Princeton), every sense of the word
  - Datamuse API, strict synonyms plus top "means like" results
Then keeps single common words (no phrases, names or acronyms) and drops
WordNet antonyms. The generator removes anything in blocklist.mjs.

Setup: pip install nltk wordfreq && python -m nltk.downloader wordnet
Usage: python tools/expand.py
"""
import json
import re
import subprocess
import urllib.parse
import urllib.request
from pathlib import Path

from nltk.corpus import wordnet as wn
from wordfreq import zipf_frequency

HERE = Path(__file__).parent
CACHE = HERE / '.cache'
MOBY_URL = 'https://unpkg.com/moby@1.1.2/words.txt'
MIN_ZIPF = 2.0  # skip words rarer than about 1 per 10 million
WORD = re.compile(r'[a-z]{3,12}')

CACHE.mkdir(exist_ok=True)
groups = json.loads(subprocess.check_output(
    ['node', '-e', "import('./groups.mjs').then(m => console.log(JSON.stringify(m.GROUPS)))"],
    cwd=HERE))


def fetch_json(url):
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.load(r)


def moby():
    path = CACHE / 'moby.txt'
    if not path.exists():
        print('downloading Moby thesaurus...')
        urllib.request.urlretrieve(MOBY_URL, path)
    table = {}
    for line in path.read_text(encoding='latin-1').splitlines():
        root, *words = line.split(',')
        table[root] = words
    return table


def datamuse(word):
    path = CACHE / 'datamuse.json'
    cache = json.loads(path.read_text()) if path.exists() else {}
    if word not in cache:
        q = urllib.parse.quote(word)
        syn = fetch_json(f'https://api.datamuse.com/words?rel_syn={q}&max=200')
        ml = fetch_json(f'https://api.datamuse.com/words?ml={q}&max=100')
        cache[word] = [w['word'] for w in syn + ml]
        path.write_text(json.dumps(cache))
    return cache[word]


def wordnet(word):
    out = set()
    for s in wn.synsets(word):
        for t in [s] + s.similar_tos():
            out.update(l.name() for l in t.lemmas())
    return out


def antonyms(word):
    return {a.name() for s in wn.synsets(word) for l in s.lemmas() for a in l.antonyms()}


thesaurus = moby()
out = {}
for clue, answers in groups.items():
    found = set(thesaurus.get(clue, [])) | wordnet(clue) | set(datamuse(clue))
    opposite = antonyms(clue)
    out[clue] = sorted(
        w.upper() for w in found
        if WORD.fullmatch(w) and not w.startswith(clue) and w not in opposite
        and w.upper() not in answers and zipf_frequency(w, 'en') >= MIN_ZIPF)

(HERE / 'expanded.json').write_text(json.dumps(out, indent=1) + '\n')
sizes = sorted(len(v) for v in out.values())
print(f'{sum(sizes)} extra answers; per clue min {sizes[0]}, median {sizes[len(sizes) // 2]}, max {sizes[-1]}')
