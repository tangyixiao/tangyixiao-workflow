# Resources and completion mode

Use the receiving host/project's scratch and output locations. Otherwise keep one
task-owned `work/` namespace within the workspace. Reuse a suitable checkout,
runtime, dependencies, and supported caches before creating copies. An unrelated
directory's name, age, or size does not establish ownership or disposability.

The adoption configuration offers adjustable ordinary-task defaults: retain
10 GiB free, review temporary growth at 1 GiB, stop optional expansion at 2 GiB,
bound normal logs to 20 MiB, and run one heavy job at a time. These are planning
defaults, not OS-enforced quotas. A legitimately larger task should define its
budget before growth and estimate peak simultaneous source/download/build copies.
Reduce task-owned concurrency when pressure is visible; do not kill unrelated jobs.

## Owned scratch and the executable boundary

The toolkit records explicitly registered scratch beneath
`work/project-workflow/TASK_ID/`. Use `resource-add --help` for registration fields.
Registration records purpose and declared disposability; it is not proof that no
other task or process uses a path, and is not permission to delete it.

Use `finish --project PROJECT` or add `--task TASK_ID` to inspect recorded scratch
and the cleanup plan. **This version does not execute cleanup or stop processes.**
Do not invent `finish --apply`, a sweep daemon, or an automatic cache purge.

For separately authorized manual cleanup, inspect resolved boundaries and links,
active consumers, dirty/untracked/ignored work, unique commits, and recovery needs.
Prefer a managed client's recoverable archive for its worktrees. Preserve another
task's resources even if they occupy space. Respect host approval/deletion controls;
do not change tools to bypass a rejected operation.

Before finishing or abandoning an approach, reconcile task-created paths and
processes, including intermediate designs and failed attempts. Stop unneeded
task-owned servers/watchers through the tool that started them. Keep useful source,
selected designs, and necessary final evidence. Report material retained scratch
with its purpose and when it becomes removable. A recycle operation or same-volume
move is not evidence of recovered free space.

The record is local task metadata. Never store credentials, complete private logs,
or another project's file contents in it. The toolkit does not scan every drive,
observe all agents, enforce disk quotas, or certify a clean machine.
