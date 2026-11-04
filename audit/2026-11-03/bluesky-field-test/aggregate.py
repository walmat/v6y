import json,glob,os,collections,sys,re
skip_story = '--story' not in sys.argv
groups=collections.OrderedDict()
for f in sorted(glob.glob(os.environ.get('RES','/var/home/matthew/code/v6y-field/results')+'/*.json')):
  if os.path.basename(f).startswith('_'): continue
  d=json.load(open(f)); scr=d['snapshot']['screen']
  if skip_story == ('Storybook' in scr): continue
  for i in d['issues']:
    s=i.get('source'); loc=f"{s['file']}:{s['line']}:{s['column']}" if s else '(no source)'
    o=i.get('ownerSources') or []
    own=f"{o[0]['file']}:{o[0]['line']}" if o else ''
    k=(i['ruleId'],loc+' <- '+own)
    g=groups.setdefault(k,{'n':0,'screens':set(),'msgs':collections.Counter(),'owners':collections.Counter(),'comp':i.get('component'),'sev':i['severity']})
    g['n']+=1; g['screens'].add(scr)
    g['msgs'][re.sub(r'\d+(\.\d+)?','#',i['message'])[:160]]+=1
    o=i.get('ownerSources') or []
    if o: g['owners'][f"{o[0]['file']}:{o[0]['line']}"]+=1
print(len(groups),'distinct groups')
for idx,((r,loc),g) in enumerate(sorted(groups.items())):
  print(f"[{idx}] {r} {g['sev']} {loc} comp={g['comp']} n={g['n']} screens={len(g['screens'])}")
  for m,c in g['msgs'].most_common(3): print('     msg:',m)
  print('     owners:', list(g['owners'].items())[:4])
