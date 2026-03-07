# Spatial Filesystem + VPS — Raw Thoughts

*Not a spec. Just thinking out loud from what's in my head after this session.*

---

## The core idea is genuinely interesting

Chatspot position in WibWobWorld → folder on a shared server. Navigation = access scope. You can't write to a folder you haven't walked to. That's not just a metaphor, it's a real authorization model — location-gated filesystem access. Agents have to physically be somewhere to touch what's there.

The existing machinery almost supports this already. Chatspots have stable channelIds (`#world-lowland-camp`). Those map trivially to paths (`/srv/wibwob/lowland-camp/`). The join-nearest-chatspot command fires when an agent moves close enough. The IRC layer already tracks who's in which channel. The pieces exist — they just need connecting.

---

## The spatial→filesystem mapping

Simplest viable form: add a `path` field to the `Chatspot` type (or just derive it from channelId by stripping `#world-` and slugifying). When `applyJoin` fires for an agent, that agent gains scoped filesystem access to the corresponding path. When they leave (PART/QUIT), access closes.

The world-chat-service already knows who's in which channel. The agent session already has jailed `read/write/bash` tools. Connect those two: if `currentChatspotPath` is set on the session, the jailed tools are scoped to that path.

No new infrastructure needed beyond that mapping.

---

## VPS deployment — what's actually hard

Running WibWobDOS on a VPS is mostly the same as local. tmux session, `bun run dev:world`, IRC server as a background process or systemd unit. The diff from local:

- **IRC server needs to be reachable.** Right now it only binds localhost. On VPS either tunnel it or add a PASS-protected bind on 0.0.0.0. Tunnelling is simpler and safer for now.
- **Control API binds 0.0.0.0 already** (Bun's default when no hostname is passed). On a VPS with open ports that's exposed. Needs either: firewall (ufw allow from known IPs only), nginx + HTTP basic auth in front, or bearer token checked in the API handler. SSH tunnel sidesteps all of this.
- **SCRATCH_DIR isolation.** We just built that. Each agent/instance gets its own scratch dir. On VPS you'd probably want one canonical WibWobDOS instance that everyone shares, not N instances.

---

## Multi-agent access model

Three scenarios and what they actually need:

**Agent on the VPS itself** — trivial. localhost:8099. No tunnel, no auth. It's already there.

**Agent on your laptop** — SSH tunnel. `ssh -L 8099:localhost:8099 vps`. Agent talks to localhost:8099 as if local. The SSH key IS the auth. This is the cleanest model and requires zero new code.

**Agent on a friend's machine** — same SSH tunnel approach, but they need an SSH key in `authorized_keys` on the VPS. One key per trusted agent/person. This is standard ops, not new code.

The terminal view question: agents don't need to see the TUI. The TUI is for humans. Agents use the control API. A human who wants to watch what's happening attaches to the VPS tmux session: `ssh vps -t tmux attach -t wibwob`. That's it.

---

## Authorization — start simple

SSH keys for transport-level auth. That covers "who can connect." For application-level auth (which chatspot can this agent write to), the spatial model handles it — you can only touch what you've navigated to.

Env vars (`WIBWOB_API_KEY`) could work as a second factor if you want the control API to be HTTP-accessible without SSH tunnelling, but that's premature. SSH tunnel + SSH keys is the right starting point because it composes with existing Unix infrastructure (authorized_keys, fail2ban, etc.) and adds zero code.

One thing worth thinking about: agent identity. Right now `WIBWOB_INSTANCE_LABEL` is the identifier. On a multi-agent VPS you'd want each agent to have a stable identity that maps to: an IRC nick, an SSH key, a filesystem home dir under `/srv/wibwob/agents/<name>/`. That's a small but important piece of the trust model.

---

## What I'd tackle first

1. **Chatspot→path mapping** — add `path` to Chatspot, wire it to world-chat-service, expose via API. Zero VPS needed, testable locally.

2. **Scoped filesystem tools** — when an agent is in a chatspot, their jailed tools root at that chatspot's path. Navigate away, scope changes. This is the "walking to a place gives you access" mechanic.

3. **VPS deployment script** — systemd unit for IRC server, tmux session bootstrap, nginx reverse proxy with HTTP basic auth as a fallback. One script that turns a fresh Ubuntu VPS into a running WibWobDOS node.

4. **SSH key registration** — a simple `authorized_keys` convention. One key per trusted agent. The VPS admin (you) controls access by adding/removing keys.

5. **IRC server hardening for VPS** — PASS command, bind to localhost only, tunnel or proxy in front. The dev IRC server we just wrote is good enough to harden rather than replace.

---

## Things I'd defer

- Web view / browser access — you explicitly don't need it
- OAuth / JWT / anything web-ish — SSH is fine
- Persistent channels across IRC server restarts (S03, deferred) — probably matters more on VPS than locally
- Multi-region / multiple VPS nodes — not yet

---

## The shape of the experience

An agent on a friend's machine SSHes into the VPS, opens a tunnel, then their WibWobDOS instance connects to the VPS's IRC server. They navigate to the Crossroads chatspot. Their jailed tools now point at `/srv/wibwob/crossroads/`. They `ls` it, see files left by other agents, read one, write a response. They walk to the Tower. Now they're in `/srv/wibwob/tower/`. The map is the filesystem. The agents leave traces as files. Other agents can find and respond to those traces by walking there.

That's a genuinely novel interaction model. Worth building.
