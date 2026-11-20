# Resource planning and cleanup

Reuse a suitable checkout, runtime, dependencies and supported caches. Use the
host or project's designated scratch and output locations. Otherwise keep one
task-owned `work/` namespace in the workspace and put deliverables in the
project's output location.

## Estimate the peak before heavy work

Before a build, test batch, render, model run or large transfer, identify the
stages that can overlap. Include child processes, work delegated to other agents
on the same machine, and existing jobs competing for capacity. Use the OS task
monitor, filesystem free-space readings, existing device tools or measurements
from a comparable run. A small edit or read needs no machine-wide inventory.
In this toolkit, `doctor --project PROJECT --json` reports CPU parallelism,
free and total host memory, and free bytes on the project volume. Check the
job's container limits and other volumes separately where applicable. Use GPU
telemetry only for jobs using a GPU. Missing readings are unknown.

| Resource | What to check before starting |
| --- | --- |
| CPU | Check the logical CPUs available to the job and current load. Count simultaneous workers and any threads each worker starts. Set the tool's job, thread or test parallelism to leave room for the host and other active work. |
| Host RAM | Start from currently available memory. Estimate peak additional use as fixed job overhead plus the peak memory of each worker active in the same stage. Allow for overlapping stages, the OS and variation between inputs. |
| GPU memory | For GPU work, check current usage and free dedicated VRAM on each selected device. Count model copies, batches, temporary buffers and workers placed on that device. For shared or unified memory, account for its use in the host RAM estimate. Adding shared RAM to dedicated VRAM, or pooling independent GPUs on paper, overstates what a device can hold. |
| Disk | Resolve the actual volumes for downloads, caches, extraction, OS temporary files, build scratch and outputs. On each volume, subtract the largest sum of **new allocations present at the same time** from current free space. Include partial downloads, unpacked files, staging or backup copies and final outputs while they coexist. Existing files already consume part of the measured baseline. |
| I/O, network and time | For an I/O-bound job, check competing reads and writes on the same device. For a transfer, estimate bytes and elapsed time at the observed rate, including likely retries. Check that the chosen batch fits the available time. |

Ordinary planning defaults are one heavy job at a time, a 10 GiB free-space
reserve on affected volumes, review at 1 GiB of temporary growth, a 2 GiB limit
on optional expansion and normal diagnostic logs below 20 MiB. Use the project's
configured values where supplied. Set a reasoned budget before starting larger
authorized work. The host and job tools provide measurements and controls.

For example, suppose a build has 8 logical CPUs and 6 GiB of available RAM. One
coordinator using 0.5 GiB and two single-threaded workers peaking at 1.25 GiB
each need about 3 GiB together. Four workers would leave just 0.5 GiB available.
Start with two. If the same volume has 12 GiB free and a 0.4 GiB download, 0.9 GiB
extracted tree and 0.3 GiB output coexist, expect 10.4 GiB free at peak. That
crosses the ordinary growth review point and leaves only 0.4 GiB above the
reserve. Recheck the volume before extraction.

When an estimate is uncertain, start one worker on a bounded representative
sample, such as a short clip, small batch or single build target. Measure peak
usage and temporary growth, then adjust the batch size, parallelism or stage
order. Recheck at the next expensive stage. If paging, disk contention, GPU
memory pressure or sustained slowdown appears, throttle or pause task-owned
work. Leave unrelated jobs under their owners' control.

## Close out completed, failed or interrupted work

1. **Reconcile the task record.** Track owned paths and processes, their purpose,
   and what needs to survive in the existing task record. Include failed attempts
   and intermediate outputs. On resumption or abandonment, inspect which items
   still exist and which jobs still run. Keep credentials and private logs out
   of the record.
2. **Inspect recorded scratch.** For paths registered beneath
   `work/project-workflow/TASK_ID/`, use `finish --project PROJECT --task TASK_ID`.
   Omit `--task` for a project-wide view of registered entries. Use
   the CLI's top-level `--help` for registration fields. `finish` produces a read-only
   cleanup plan and reports free space on the project volume. The agent or host
   performs process inspection and cleanup.
3. **Check ownership and consumers.** Resolve each candidate's absolute path,
   verify its task boundary and inspect links or junctions. Check active jobs,
   open handles where available, and other agents or tools using it. For a
   checkout, inspect staged, unstaged, untracked and ignored material as well
   as unique commits before deciding whether anything needs recovery. Keep the
   item when its owner or a consumer is uncertain. Cleanup of earlier tasks
   requires explicit scope covering those tasks. Age, size and directory names
   alone cannot establish ownership.
4. **Release verified resources.** Stop unneeded task-owned servers, watchers and
   children through the tool that started them. Send verified disposable files
   and directories to the [platform trash](#recoverable-file-cleanup) under the
   existing task authorization. Use the managing client's recoverable
   archive for managed worktrees where available. Preserve deliverables, useful
   source, selected designs and evidence, shared caches, dirty work and unique
   history. Honor host approval controls and any rejected operation.
5. **Verify the result.** Check that stopped jobs have exited, removed paths are
   absent and retained deliverables remain accessible. If reporting recovered
   space, measure free space again on the affected volume. Recycling a file or
   moving it on that volume may leave usage unchanged. Report remaining material
   scratch with its purpose, approximate size and the event that makes it
   removable.

## Recoverable file cleanup

For routine cleanup, use the current account's Recycle Bin or Trash. Pass one
verified absolute path at a time after the ownership, link and active-consumer
checks above. For a managed worktree, use the managing client's archive.

| Platform | How to move and recover the item |
| --- | --- |
| Windows | Use File Explorer's Recycle Bin on a supported volume. In an interactive PowerShell session, use the `Microsoft.VisualBasic.FileIO.FileSystem` overload for the item type (`DeleteFile` or `DeleteDirectory`) with `RecycleOption.SendToRecycleBin` and `UICancelOption.ThrowException`. Cancel any prompt offering permanent deletion. In the Recycle Bin, match the item and original location before using Restore. [Windows file API](https://learn.microsoft.com/en-us/dotnet/api/microsoft.visualbasic.fileio.filesystem.deletefile) · [Directory API](https://learn.microsoft.com/en-us/dotnet/api/microsoft.visualbasic.fileio.filesystem.deletedirectory) |
| Linux | Use the file manager's Move to Trash action, or an available `gio trash "$absolute_path"` for the verified path. Use `gio trash --list` or the file manager to match the original path and find the entry to restore. On a headless host, check support for the account and target filesystem before moving anything. [GIO manual](https://manpages.debian.org/trixie/libglib2.0-bin/gio.1.en.html) |
| macOS | Use Finder's Move to Trash, or Foundation's `FileManager.trashItem(at:resultingItemURL:)` for the verified file URL. Use the returned URL to identify the item if macOS renames it. In Finder, select the matching item in Trash and use Put Back when available. [Foundation API](https://developer.apple.com/documentation/foundation/filemanager/trashitem%28at%3Aresultingitemurl%3A%29) |

If the volume or session cannot provide recoverable trash (for example, some
network shares, CI runners or containers), leave the item in place and record
its path, size and reason for retention. If the operation fails or is rejected,
inspect the source and recovery location before reporting its state. Honor the
host's decision. Permanent removal requires separate authorization for the exact
items. Never silently fall back to `Remove-Item` or `rm`, or empty a shared bin
as part of task cleanup.

Confirm that the original path is absent and the matching item is recoverable.
Report it as moved to Trash. Claim freed disk space only after measuring the
affected volume again.

## Retire the ledger entry

After an owned path is gone, preview retiring that specific ledger entry with
`resource-remove --project PROJECT --task ID --path RELATIVE_PATH`. Add
`--apply` to record the removal. Existing paths must be dealt with separately.
Overlapping directory and file registrations keep their detail rows. Use the
deduplicated `measuredBytes` total for observed logical file sizes.

Writers share a lock beside the ledger and replace the ledger atomically.
If a write times out, check the owner recorded in `resources.json.lock` (host,
PID and acquisition time). Retry once the owner finishes. After a crash,
confirm the owner has stopped before removing its abandoned lock and any
identified staging file. Preserve the last valid ledger. The registry accepts
up to 1,000 entries and 16 MiB of UTF-8 metadata. If an older writer left 1,001, retire an already absent
entry to bring it back within the limit.
