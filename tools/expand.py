"""Finds extra accepted answers for each clue group.

A word is kept when WordNet links it to the clue's senses AND Datamuse's
"means like" lists for at least two of the group's words include it.
Requiring both sources filters out most wrong-sense matches; the rest are
removed by hand in blocklist.mjs.

Setup: pip install nltk wordfreq && python -m nltk.downloader wordnet
Usage: python tools/expand.py   (writes tools/expanded.json)
"""
import concurrent.futures as cf
import json
import re
import subprocess
import urllib.parse
import urllib.request
from pathlib import Path

from nltk.corpus import wordnet as wn
from wordfreq import zipf_frequency

HERE = Path(__file__).parent
CACHE = HERE / '.datamuse-cache.json'
MIN_ZIPF = 2.5  # drop words rarer than about 1 per 3 million

groups = json.loads(subprocess.check_output(
    ['node', '-e', "import('./groups.mjs').then(m => console.log(JSON.stringify(m.GROUPS)))"],
    cwd=HERE))
cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}


def means_like(word):
    if word not in cache:
        q = urllib.parse.urlencode({'ml': word, 'max': 150})
        with urllib.request.urlopen(f'https://api.datamuse.com/words?{q}', timeout=20) as r:
            cache[word] = [item['word'] for item in json.load(r)]
    return cache[word]


def senses(word):
    out = set()
    for s in wn.synsets(word):
        for t in [s] + s.similar_tos():
            out.update(l.name().lower() for l in t.lemmas())
    return out


def antonyms(word):
    return {a.name().lower() for s in wn.synsets(word) for l in s.lemmas() for a in l.antonyms()}


seeds = sorted({w.lower() for clue, answers in groups.items() for w in [clue, *answers]})
with cf.ThreadPoolExecutor(8) as pool:
    list(pool.map(means_like, seeds))
CACHE.write_text(json.dumps(cache))

out = {}
for clue, answers in groups.items():
    words = [clue, *(a.lower() for a in answers)]
    linked = set().union(*map(senses, words))
    opposite = set().union(*map(antonyms, words))
    votes = {}
    for w in words:
        for m in means_like(w):
            votes[m] = votes.get(m, 0) + 1
    out[clue] = sorted(
        w.upper() for w, n in votes.items()
        if n >= 2 and w in linked and w not in opposite and w != clue
        and re.fullmatch(r'[a-z]{3,10}', w) and w.upper() not in answers
        and zipf_frequency(w, 'en') >= MIN_ZIPF)

(HERE / 'expanded.json').write_text(json.dumps(out, indent=1) + '\n')
print(f'{sum(map(len, out.values()))} extra answers across {len(out)} clues')
