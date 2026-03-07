import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
	subLog,
	testLog, type Log } from "../node/log.ts";
import type { TestContext } from "node:test";

/** 
 * Creates a temporary directory somewhere on the filesystem with a package.json file.  Installs "obsidian-test" as a 
 * dependency, and cleans the directory at the end of the test.
 * 
 * @returns the path to the temporary directory
 */
export async function createTempDependentPackage({
	t,
	packageJSON = {},
	log = testLog(t),
}: {
	t: TestContext;
	log?: Log | null;
	packageJSON?: {
		type?: "module" | "commonjs",
		name?: string;
		version?: string;
		description?: string;
		author?: string;
	}
}): Promise<string> {
	const root: string = process.cwd();

	const dirPath = await fs.mkdtemp(path.join(os.tmpdir(), "obsidian-test-consumer-"));
	t.after(() => fs.rm(dirPath, { recursive: true }));


	await fs.writeFile(
		path.join(dirPath, "package.json"),
		JSON.stringify(packageJSON, null, 2)
	);

	const env = { ...process.env };
	const envKeys = Object.keys(env);
	for (const key of envKeys) {
		if (key.startsWith("npm_package_")) {
			delete env[key];
		}
	}

	const output = execSync(`npm install ${root}`, { cwd: dirPath, env, stdio: 'pipe' });
	if (log !== null) {
		const childLog = subLog({ parent: log, prefix: '[npm install]' })
		output.toString().split("\n").forEach(line => childLog.info(line));
	}

	return dirPath;
}
