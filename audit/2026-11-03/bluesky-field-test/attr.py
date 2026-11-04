# Attribution score for a results dir: share of issues whose reported location is app code
# (not a design-system file), plus the top locations still stuck on shared components.
import json, glob, os, re, collections, sys
DS = [r'^src/components/', r'^src/view/com/util/', r'^src/lib/custom-animations/', r'^src/alf/']
OVERLAY = {'NUX sheet over Home (InviteFriendsAnnouncement)', 'Post options menu (sheet)', 'Share menu (sheet)', 'Composer', 'Home again'}
ds = lambda f: any(re.match(p, f) for p in DS)
res = sys.argv[1]
tot = app = noloc = 0; stuck = collections.Counter(); per_via = collections.Counter()
for f in sorted(glob.glob(res + '/*.json')):
    if os.path.basename(f).startswith('_'): continue
    d = json.load(open(f)); s = d['snapshot']['screen']
    if 'Storybook' in s or s in OVERLAY: continue
    for i in d['issues']:
        tot += 1
        loc = i.get('location') or i.get('source')
        if not loc: noloc += 1; continue
        if ds(loc['file']): stuck[(i['ruleId'], f"{loc['file']}:{loc['line']}")] += 1
        else: app += 1
print(f"{res}: {tot} issues, {app} at app files ({100*app/max(tot,1):.0f}%), {noloc} without location")
for (r, l), n in stuck.most_common(8): print(f"  stuck {n:3} {r:22} {l}")
