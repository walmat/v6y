import json,sys
d=json.load(open(sys.argv[1]))
print(d['snapshot']['screen'],len(d['issues']))
maxd=int(sys.argv[2]) if len(sys.argv)>2 else 60
def walk(n,dep=0):
  t=(n.get('text') or '')[:40]
  if dep<maxd: print(' '*dep+n['type'],n.get('component'),n.get('role',''),repr(n.get('label','')) if 'label' in n else '','I' if n.get('interactive') else '','H' if n.get('hidden') else '',repr(t) if t else '')
  for c in n['children']: walk(c,dep+1)
walk(d['snapshot']['root'])
