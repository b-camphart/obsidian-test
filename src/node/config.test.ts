import test, { type TestContext } from "node:test";

import { execSync } from "child_process";
import { writeFile, readdir } from "fs/promises";
import path from "path";

import { createTempDependentPackage } from "../test/dependent.js";

function run(cmd: string, cwd: string) {
	const env = { ...process.env };
	const envKeys = Object.keys(env);
	for (const key of envKeys) {
		if (key.startsWith("npm_package_")) {
			delete env[key];
		}
	}

	return execSync(cmd, { cwd, env, stdio: 'pipe' });
}


test("Resolving config", async (t: TestContext) => {

	const dirPath = await createTempDependentPackage({
		t, packageJSON: {
			type: "module",
			name: "obsidian-test-consumer",
			version: "1.5.3",
			description: "tests obsidian-test from the consumer side",
			author: "me",
			scripts: {
				"test": `obsidian-test --setup ./setup.js`
			}
		}
	});

	const obsidianJsonPath = path.join(dirPath, "obsidian.json");
	await writeFile(
		obsidianJsonPath,
		JSON.stringify({ vaults: [] })
	);

	const vaultPath = path.join(dirPath, "test-vault");
	await writeFile(
		path.join(dirPath, "setup.js"),
		`
			import { extendTestConfig } from "obsidian-test/node";

			extendTestConfig(config => {
				return {
					...config,
					launch: {
						...config.launch,
						cmd: "non-existant-program-id",
						obsidianConfigPath: "${obsidianJsonPath}",
					}
				}
			});

			extendTestConfig(config => {
				config.launch.vaultPath = "${vaultPath}";
			})
			`
	);

	t.assert.throws(
		() => run("npm run test", dirPath),
		{
			message: /^Command failed: npm run test\n\[Obsidian Process\] Exit code 127, "non-existant-program-id" not found/
		}
	);

	const entries = await readdir(vaultPath, { recursive: true });
	t.assert.deepStrictEqual(
		new Set(entries),
		new Set([
			".obsidian",
			".obsidian/community-plugins.json",
			".obsidian/plugins",
			".obsidian/plugins/embedded-test-runner",
			".obsidian/plugins/embedded-test-runner/data.json",
			".obsidian/plugins/embedded-test-runner/main.js",
			".obsidian/plugins/embedded-test-runner/manifest.json",
		]),
		`expected entries within test vault`
	);

})
