import re,sys,statistics as st
rows=[l.rstrip() for l in open(sys.argv[1])]
d={}
for l in rows:
    m=re.match(r'(\w+) (\w+) (\d+) (.*)',l)
    if not m: continue
    v,k,i,rest=m.groups()
    e=d.setdefault((v,k),{'f0':[],'f1':[],'f2':[],'p99':[],'max':[],'sum':[],'p50':[],'over':[],'presum':[],'premax':[],'left':[]})
    if '[HEAD]' in rest:
        n=rest.split('[HEAD]')[1].split()[1:]
        e['f0'].append(float(n[0]));e['f1'].append(float(n[1]));e['f2'].append(float(n[2]))
    if '[SPIKE]' in rest:
        t=rest.split()
        for a,b in (('p50','p50'),('p99','p99'),('max','max'),('sum','sum'),('over','over16')):
            e[a].append(float(t[t.index(b)+1]))
    if '[PRE]' in rest:
        t=rest.split()
        e['presum'].append(float(t[t.index('sum')+1]));e['premax'].append(float(t[t.index('max')+1]));e['left'].append(float(t[t.index('left')+1]))
for k,e in sorted(d.items()):
    print(k,' '.join(f"{a}={st.median(b):.1f}({min(b):.1f}-{max(b):.1f})" for a,b in e.items() if b))
