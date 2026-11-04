import json,glob,os,collections,sys
for f in sorted(glob.glob(os.environ.get('RES','/var/home/matthew/code/v6y-field/results')+'/*.json')):
  if os.path.basename(f).startswith('_'): continue
  d=json.load(open(f))
  texts=[]
  def walk(n):
    if n.get('hidden'): return
    if n.get('text'): texts.append(n['text'].strip()[:25])
    for c in n['children']: walk(c)
  walk(d['snapshot']['root'])
  c=collections.Counter(i['ruleId'] for i in d['issues'])
  print(f"## {d['snapshot']['screen']}: {dict(c)}")
  if '-t' in sys.argv: print('   ', ' | '.join(texts[:14]))
