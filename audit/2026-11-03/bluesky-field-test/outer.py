import json,glob,os
seen=set()
for f in sorted(glob.glob(os.environ.get('RES','results')+'/*.json')):
  if os.path.basename(f).startswith('_'): continue
  d=json.load(open(f)); scr=d['snapshot']['screen']
  if 'Storybook' in scr: continue
  par={}
  def walk(n,anc):
    par[n['id']]=(n,list(anc))
    for c in n['children']: walk(c,anc+[n])
  walk(d['snapshot']['root'],[])
  for i in d['issues']:
    if i['ruleId']!='nested-interactive': continue
    n,anc=par[i['nodeId']]
    outer=[a for a in anc if a.get('interactive') and a.get('accessible') is not False][-1]
    key=((n.get('source') or {}).get('line'), json.dumps(i.get('ownerSources',[])[:1]), (outer.get('source') or {}).get('file'))
    if key in seen: continue
    seen.add(key)
    os_=outer.get('ownerSources') or []
    print(scr,'| inner',n.get('label'),'| outer',outer['type'],outer.get('role'),repr(outer.get('label')),'acc=',outer.get('accessible'),'props-src', (outer.get('source') or {}).get('file'),(outer.get('source') or {}).get('line'),'<-',[f"{o['file']}:{o['line']}" for o in os_[:2]])
