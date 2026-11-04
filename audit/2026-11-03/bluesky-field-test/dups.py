import json,glob,os,collections,sys
OVER={'NUX sheet over Home (InviteFriendsAnnouncement)','Post options menu (sheet)','Share menu (sheet)','Composer','Home again'}
c=collections.Counter()
for f in glob.glob(sys.argv[1]+'/*.json'):
    if os.path.basename(f).startswith('_'): continue
    d=json.load(open(f)); s=d['snapshot']['screen']
    if 'Storybook' in s or s in OVER: continue
    for i in d['issues']:
        if i['ruleId']=='duplicate-label': c[(s, i['message'].split('"')[1])]+=1
print(sys.argv[1], sum(c.values()), dict(sorted(c.items())))
