#!/usr/bin/env python3
"""Fire each cue from a timeline, screenshot after each one."""
import sys, json, subprocess, time, os

timeline_file = sys.argv[1]
api           = sys.argv[2]
capdir        = sys.argv[3]
repaint_wait  = float(sys.argv[4])
display_num   = sys.argv[5]
tmux_session  = sys.argv[6]

data   = json.load(open(timeline_file))
cues   = data.get('cues', [])
scenes = data.get('scenes', {})

PRIMER_BASE = "/Users/james/Repos/wibandwob-dos/scratch/backrooms-runs/2026-03-03T13-13-23-377Z/primers"

def api_post(path, body):
    r = subprocess.run(['curl','-sf','-X','POST',f'{api}{path}',
                        '-H','Content-Type: application/json',
                        '-d', json.dumps(body)], capture_output=True, text=True)
    try: return json.loads(r.stdout)
    except: return {}

def api_get(path):
    r = subprocess.run(['curl','-sf',f'{api}{path}'], capture_output=True, text=True)
    try: return json.loads(r.stdout)
    except: return {}

def resolve_primer(filename):
    # Absolute paths pass through; bare filenames get PRIMER_BASE prepended
    if filename.startswith('/'):
        return filename
    return os.path.join(PRIMER_BASE, filename)

def screenshot(label, expected):
    time.sleep(repaint_wait)
    subprocess.run(['screencapture','-x','-D',display_num, f'{capdir}/{label}.png'])
    pane = subprocess.run(['tmux','capture-pane','-t',tmux_session,'-p'],
                          capture_output=True, text=True)
    open(f'{capdir}/{label}.txt','w').write(pane.stdout)
    state = api_get('/state')
    json.dump(state, open(f'{capdir}/{label}_state.json','w'), indent=2)
    app  = state.get('app',{})
    wins = [w for w in state.get('windows',[]) if w.get('appType') != 'wibwob-agent']
    print(f"  📸 {label}  theme:{app.get('theme','?')}  non-agent-windows:{len(wins)}")
    for w in wins:
        print(f"       {w.get('appType','?'):<25} {w.get('title','?')[:50]}")
    with open(f'{capdir}/expected.jsonl','a') as f:
        f.write(json.dumps({"step":label,"expected":expected})+'\n')

def close_all():
    """Close every window — used at VJ smoke test start for clean canvas."""
    state = api_get('/state')
    for w in state.get('windows', []):
        api_post('/windows/close', {'id': w['id']})
    time.sleep(0.6)

def close_non_agent():
    """Close everything except the Wib&Wob agent window."""
    state = api_get('/state')
    for w in state.get('windows',[]):
        if w.get('appType') != 'wibwob-agent':
            api_post('/windows/close', {'id': w['id']})
    time.sleep(0.4)

def open_window(win):
    o = win.get('open',{})
    if o.get('type') == 'primer':
        api_post('/view/primer/open', {'filePath': resolve_primer(o['file'])})
    elif o.get('type') == 'figlet':
        api_post('/commands/run', {'id':'figlet.open',
                                   'args':{'text':o['text'],'font':o.get('font','standard')}})
    time.sleep(0.3)

print("  Clearing desktop (VJ mode — all windows including agent)...")
close_all()

for i, cue in enumerate(cues):
    t     = cue.get('at',{}).get('t', 0)
    label = f'{i+1:02d}-cue_t{int(t)}s'

    if 'scene' in cue:
        scene_name = cue['scene']
        scene      = scenes.get(scene_name, {})
        expected   = f"SCENE:{scene_name} theme:{scene.get('theme','?')} windows:{len(scene.get('windows',[]))}"
        print(f"\n  ▶  T={t}s  {expected}")
        if scene.get('theme'):
            api_post('/commands/run', {'id':'theme.set','args':{'name':scene['theme']}})
        close_non_agent()
        for win in scene.get('windows',[]):
            open_window(win)

    elif 'patch' in cue:
        patch  = cue['patch']
        adds   = len(patch.get('set',[]))
        closes = len(patch.get('close',[]))
        expected = f"PATCH +{adds}win -{closes}win"
        print(f"\n  ▶  T={t}s  {expected}")
        if patch.get('theme'):
            api_post('/commands/run', {'id':'theme.set','args':{'name':patch['theme']}})
        for win in patch.get('set',[]):
            open_window(win)

    elif 'command' in cue:
        cmd      = cue['command']
        expected = f"CMD:{cmd['id']} args:{cmd.get('args',{})}"
        print(f"\n  ▶  T={t}s  {expected}")
        api_post('/commands/run', {'id':cmd['id'],'args':cmd.get('args',{})})

    screenshot(label, expected)

print("\n  ✓ All cues fired")
