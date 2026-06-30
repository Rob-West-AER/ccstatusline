# Install the prebuilt "Smart zone" ccstatusline on this machine

You are an agent installing a customized build of **ccstatusline** (a Claude Code status line)
from a personal fork. The fork ships a **prebuilt bundle**, so you do **not** need to build
anything — only `node` and `npm` are required. Follow the steps in order and run the verification
at the end.

- Fork / source: `github:Rob-West-AER/ccstatusline#smart-zone`
- What's new: a **Context Limit Bar** widget that shows context usage against a configurable token
  limit (default **130k**) and renders with the label **`Smart zone:`**. The percentage is not
  capped at 100%, so usage past the limit reads above 100%.
- Use the JSON-editing commands below as written (they merge into existing files and won't clobber
  unrelated settings). Don't hand-edit unless a command fails.

---

## Step 0 — Prerequisites

Confirm Node and npm are available:
```sh
node --version
npm --version
```
If either is missing, install Node.js (LTS) first, then continue. No `bun` is needed.

## Step 1 — Install the prebuilt package globally

```sh
npm install -g github:Rob-West-AER/ccstatusline#smart-zone
```
This installs a self-contained `ccstatusline` binary onto the global PATH. Confirm:
```sh
ccstatusline --version
```
You should see a version number (e.g. `2.2.22`) and exit code 0.

> If `ccstatusline` is "command not found", your npm global bin dir isn't on PATH. Find it with
> `npm prefix -g` (binary lives in that dir, or its `bin` subfolder) and either add it to PATH or
> use the full path to the binary in Step 2.

## Step 2 — Point Claude Code at it

Update `~/.claude/settings.json` so the status line runs the installed binary. This command
preserves all other keys and only sets `statusLine`:
```sh
node -e "const fs=require('fs'),os=require('os'),p=require('path');const f=p.join(os.homedir(),'.claude','settings.json');const j=fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')):{};j.statusLine={type:'command',command:'ccstatusline',padding:0};fs.mkdirSync(p.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(j,null,2));console.log('updated',f);"
```
(If `ccstatusline` is not on PATH, replace `command:'ccstatusline'` with the full path to the
binary, using forward slashes.)

## Step 3 — Add the "Smart zone" widget to the status line layout

ccstatusline keeps its own layout config at `~/.config/ccstatusline/settings.json` (separate from
Claude's settings). This command adds the widget to the first status line if it isn't already
present, creating a minimal config if none exists. It will not remove existing widgets.
```sh
node -e "const fs=require('fs'),os=require('os'),p=require('path');const f=p.join(os.homedir(),'.config','ccstatusline','settings.json');let j;try{j=JSON.parse(fs.readFileSync(f,'utf8'))}catch{j={version:1,lines:[[{id:'model',type:'model',color:'cyan'},{id:'sep',type:'separator'}],[],[]]}};j.lines=j.lines||[[],[],[]];const has=j.lines.some(l=>Array.isArray(l)&&l.some(w=>w&&w.type==='context-limit-bar'));if(!has){j.lines[0]=j.lines[0]||[];j.lines[0].push({id:'smart-zone-'+Date.now(),type:'context-limit-bar',metadata:{limit:'130k'}});fs.mkdirSync(p.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(j,null,2));console.log('added context-limit-bar to line 1')}else{console.log('context-limit-bar already present, no change')}"
```
- The limit is set via `metadata.limit` (`"130k"`, or a raw integer like `"130000"`, or `"1.5m"`).
  Omitting it defaults to 130k.
- To change the limit later interactively: run `ccstatusline`, edit the line, select **Context Limit
  Bar**, press **`l`** to set the limit and **`p`** to cycle the bar style.

## Step 4 — Verify

Feed a sample payload to the binary and confirm the widget renders. This works in bash, PowerShell,
or cmd:
```sh
node -e "process.stdout.write(JSON.stringify({model:{id:'claude-opus-4'},context_window:{context_window_size:200000,current_usage:{input_tokens:16000,output_tokens:2000,cache_creation_input_tokens:0,cache_read_input_tokens:0}}}))" | ccstatusline
```
**Expected:** a colorized line containing something like `Smart zone: [██░░░░…] 16k/130k (12%)` and
exit code 0. If you see `Smart zone:` in the output, the install succeeded.

Open a new Claude Code session (or wait for the next prompt) to see it live.

---

## Updating later

When the fork's `smart-zone` branch gets a new build pushed, re-run the global install — npm git
installs are not cached the way `npx` is, so this re-fetches:
```sh
npm install -g github:Rob-West-AER/ccstatusline#smart-zone
```

## Reverting

Restore the published version in `~/.claude/settings.json`:
```sh
node -e "const fs=require('fs'),os=require('os'),p=require('path');const f=p.join(os.homedir(),'.claude','settings.json');const j=JSON.parse(fs.readFileSync(f,'utf8'));j.statusLine={type:'command',command:'npx -y ccstatusline@latest',padding:0};fs.writeFileSync(f,JSON.stringify(j,null,2));console.log('reverted')"
```
Optionally uninstall: `npm uninstall -g ccstatusline`.

## Troubleshooting

- **`npx -y github:...` fails with `ECOMPROMISED / Lock compromised`** — this is a local npm/npx
  lock-heartbeat bug, often triggered by antivirus touching the npx cache. Use the **global install**
  in Step 1 instead (it doesn't hit the npx lock). It does not indicate a problem with the fork.
- **Status line is blank** — confirm Step 4 prints output; if it does but Claude Code shows nothing,
  re-check that `~/.claude/settings.json` `statusLine.command` resolves (full path if not on PATH).
- **Widget not visible but install works** — the layout config (Step 3) on this machine may not
  include `context-limit-bar`; re-run Step 3 or add it via the `ccstatusline` TUI.
