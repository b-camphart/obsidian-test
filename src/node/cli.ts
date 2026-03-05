import { program } from "commander";

import { resolvePackageName } from "./npm.js";
import run from "./run.js";
import path from "node:path";
import { standardTestVaultPath } from "./obsidian.js";

program
	.option(
		"-p, --testPattern <pattern>",
		"Glob pattern for test files (default: \"./**/*{test|spec}.{js|ts}\")"
	)
	.option(
		"--cache-path <path>",
		"Path to cache directory"
	)
	.option(
		"--vault-path <path>",
		"Path to vault directory relative to the project's cwd"
	)
	.option(
		"--obsidian-cmd <cmd>",
		"The command to use to launch obsidian.  Defaults to 'obsidian' but your system may be different"
	)
	.option(
		"--obsidian-config-path <path>",
		"The path to the 'obsidian.json' file that contains the registered vaults.  You may need to search your system for this."
	)
	.option(
		"--force",
		"Force re-running tests (ignore cache)"
	)
	.parse(process.argv);

const options = program.opts();

process.exitCode = await run({
	build: {
		testPattern: options.testPattern,
	},
	launch: {
		vaultPath: options.vaultPath ? (path.join(process.cwd(), options.vaultPath)) : standardTestVaultPath({
			cwd: process.cwd(),
			packageName: resolvePackageName(),
		}),
		cmd: options.obsidianCmd,
		obsidianConfigPath: options.obsidianConfigPath,
	},
	cachePath: options.cachePath,
	forceRerun: options.force,
}) ?? undefined;


