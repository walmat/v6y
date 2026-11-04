import json,glob,os,sys
rule=sys.argv[1]; pat=sys.argv[2] if len(sys.argv)>2 else ''
seen=set()
for f in sorted(glob.glob(os.environ.get('RES','/var/home/matthew/code/v6y-field/results')+'/*.json')):
  if os.path.basename(f).startswith('_'): continue
  d=json.load(open(f)); scr=d['snapshot']['screen']
  if 'Storybook' in scr and '--story' not in sys.argv: continue
  for i in d['issues']:
    if i['ruleId']!=rule: continue
    chain=[f"{s['file']}:{s['line']}" for s in [i.get('source')]+(i.get('ownerSources') or []) if s]
    key=(i['message'],tuple(chain[:3]))
    if pat and pat not in ' '.join(chain)+i['message']: continue
    if key in seen: continue
    seen.add(key)
    print(f"- [{scr}] {i['message']}\n    {' <- '.join(chain)}")
