import json,glob,os,collections,sys
OVERLAY={'NUX sheet over Home (InviteFriendsAnnouncement)','Post options menu (sheet)','Share menu (sheet)','Composer','Home again'}
def keys(d_, incl_overlay=False):
  out=collections.Counter()
  for f in glob.glob(d_+'/*.json'):
    if os.path.basename(f).startswith('_'): continue
    d=json.load(open(f)); s=d['snapshot']['screen']
    if 'Storybook' in s: continue
    if (s in OVERLAY) != incl_overlay: continue
    for i in d['issues']:
      o=(i.get('ownerSources') or [{}])[0]
      src=i.get('source') or {}
      out[(i['ruleId'], f"{src.get('file')}:{src.get('line')}", f"{o.get('file')}:{o.get('line')}")]+=1
  return out
a=keys(sys.argv[1], '-o' in sys.argv); b=keys(sys.argv[2], '-o' in sys.argv)
print('GONE:'); [print('  ',k,a[k]) for k in sorted(a) if k not in b]
print('NEW:'); [print('  ',k,b[k]) for k in sorted(b) if k not in a]
print('CHANGED COUNT:'); [print('  ',k,a[k],'->',b[k]) for k in sorted(a) if k in b and a[k]!=b[k]]
