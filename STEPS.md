# End Goal

Add manual and automatic update capabilities to the `gchat` CLI, allowing users to update the globally installed `group-chat-mcp` npm package on demand and be notified (or auto-updated) when a newer version is available.

## Steps

- [ ] Persist install metadata during `gchat install` so `gchat update` knows which IDE+scope combos to refresh
- [ ] Add a version check mechanism that queries the npm registry for the latest published version, compares it to the locally installed version, and caches the result for 24 hours
- [ ] Integrate the version check into interactive CLI commands (install, uninstall, update) to display an update notice when a newer version is available
- [ ] Add a `gchat update` command that updates the globally installed package, then re-execs the new binary to refresh configs for all persisted IDE+scope combos

## Questions Answered

1. Q: What should "automatic update" mean for gchat?
   A: Notify only. On CLI invocation, check the npm registry in the background. If a newer version exists, print an update notice. No mutation without explicit user action via `gchat update`.

2. Q: Should the update notice appear on all commands or only interactive ones?
   A: Interactive commands only (install, uninstall, update). Hook commands (cursor-join, cursor-leave) output JSON and must stay clean.

3. Q: Should the version check result be cached?
   A: Yes. Cache for 24 hours in a local file. Skip the registry call if checked within that window.

4. Q: Should `gchat update` support targeting a specific version?
   A: No. Always install the latest published version.

5. Q: Should `gchat update` re-run the installer after updating?
   A: No full reinstall. After updating the npm package, detect which IDE configurations exist and apply incremental config patches (new files, updated files) without requiring the user to re-run `gchat install`.

6. Q: How should config patching work?
   A: Re-apply the current version's installer logic for all managed IDE+scope combos. The installer's merge logic is already idempotent — it updates existing entries without clobbering unrelated config.

7. Q: How should `gchat update` know which IDE+scope combos to refresh?
   A: Persist install choices in a metadata file (e.g. `~/.group-chat-mcp/install-meta.json`) during `gchat install`. `gchat update` reads this file to determine what to refresh.

8. Q: Should the version check run in parallel with the main command or sequentially before it?
   A: Parallel. Fire the registry check at command start, run the main command, print the update notice (if any) after the command completes. No added latency.

9. Q: After npm install replaces the binary, should the running (old) process refresh configs or re-exec the new binary?
   A: Re-exec the new binary. After `npm install -g` completes, spawn `gchat update --post-install` using the newly installed binary. The new process runs the new version's installer logic, guaranteeing configs match the new version's expectations.
