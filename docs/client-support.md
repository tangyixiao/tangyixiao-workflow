# Client support

Use separate evidence for source validity, installation, client discovery, actual
invocation, and real project delivery. Do not promote one stage into all others.
This alpha targets a portable Skill folder and an existing Node.js 22+ runtime.

| Surface | Supported mechanism / intended use | Evidence boundary |
| --- | --- | --- |
| Source CLI | `node bin/pwf.mjs ...` | Core interface; run the supplied tests and actual command locally |
| Installed CLI | Explicit skill folder's `runtime/bin/pwf.mjs` | Installer must supply its required local runtime; verify status/readback |
| Codex | Install `skills/tangyixiao-workflow` into an explicit discovery directory, conventionally `~/.codex/skills/tangyixiao-workflow` | Initial local target; discovery and actual invocation remain to be verified on the target client |
| Other Skill-capable clients | Same Markdown/reference format where the client supports it | Format compatibility only; not individually installed or run in this alpha |
| Global/project AGENTS instructions | Small explicit adapter or managed project block | Does not automatically load in every client; respect its own discovery semantics |
| Platform plugin / MCP | Potential later packaging of the same core | Not supplied, installed or tested by this version |

The installer takes an explicit folder and does not find every client, rewrite
their configuration, change providers/authentication, or install another runtime.
Presence of a client's skills directory is not evidence that the client itself is
installed or that an active session loaded this Skill.

For Codex, inspect installation with `status --destination ...`, let the client
rediscover Skills through its supported mechanism, and make a new explicit
`$tangyixiao-workflow` invocation against a bounded local project. Check the actual
tool result and changed paths. A shell command or `doctor` result alone cannot
prove UI discovery or model behavior. Record the tested client/version and the
actual observed stage in delivery evidence, not a permanent universal badge.

Task authorization still comes from the human and host. The Skill cannot grant
external publishing rights, override a read-only request, or enforce OS disk quotas.
If a tool is unavailable or a host rejects an operation, report that boundary;
do not fall back to a different tool just to evade the control.
