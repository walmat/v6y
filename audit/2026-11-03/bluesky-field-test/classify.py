import json,glob,os,collections
OVERLAY={'NUX sheet over Home (InviteFriendsAnnouncement)','Post options menu (sheet)','Share menu (sheet)','Composer','Home again'}
OUTER={}
def verdict(i):
  r=i['ruleId']; chain=' '.join(f"{s['file']}:{s['line']}" for s in [i.get('source')]+(i.get('ownerSources') or []) if s)
  src=(i.get('source') or {}).get('file','')
  if 'EventStopper' in src: return 'FP'
  if r=='nested-interactive':
      return 'FP' if OUTER.get(i['nodeId'])=='EventStopper' else 'TP'
  if r=='duplicate-label':
    name=i['message'].split('"')[1]
    if name in ('System','Dark','Everyone','People I follow','No one','Notifications'): return 'UNSURE'
    return 'FP'
  if r=='meaningless-label': return 'FP'
  if r=='image-missing-label': return 'FP'  # both inside labelled accessible pressables (banner verdict corrected)
  if r=='text-contrast' and 'NativeSplashScreen' in chain: return 'FP'
  return 'TP'
by=collections.defaultdict(collections.Counter); scr_n=0
for f in sorted(glob.glob(os.environ.get('RES','results')+'/*.json')):
  if os.path.basename(f).startswith('_'): continue
  d=json.load(open(f)); s=d['snapshot']['screen']
  if 'Storybook' in s or s in OVERLAY: continue
  scr_n+=1
  par={}
  def walk(n,anc):
    par[n['id']]=anc
    for c in n['children']: walk(c,anc+[n])
  walk(d['snapshot']['root'],[])
  OUTER.clear()
  for i in d['issues']:
    if i['ruleId']=='nested-interactive':
      o=[a for a in par[i['nodeId']] if a.get('interactive') and a.get('accessible') is not False][-1]
      OUTER[i['nodeId']]='EventStopper' if 'EventStopper' in (o.get('source') or {}).get('file','') else 'other'
  for i in d['issues']: by[i['ruleId']][verdict(i)]+=1
tot=collections.Counter()
for r,c in sorted(by.items()):
  tot+=c; print(r, dict(c))
print('screens',scr_n,'TOTAL',dict(tot), 'precision(excl unsure)=%.0f%%'%(100*tot['TP']/(tot['TP']+tot['FP'])))
