import test, { type TestContext } from "node:test";

import { execSync } from "child_process";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

function run(cmd: string, cwd: string) {
	const env = { ...process.env };
	const envKeys = Object.keys(env);
	for (const key of envKeys) {
		if (key.startsWith("npm_package_")) {
			delete env[key];
		}
	}

	const output = execSync(cmd, { cwd, env, stdio: 'pipe' }).toString();
	return output.split("\n");
}


test("Building consumer package", async (t: TestContext) => {
	const root = process.cwd();
	t.assert.ok(root.endsWith("obsidian-test"));

	// we do not support cjs NODE code, however

	await test(`cjs plugin code`, async (t: TestContext) => {
		const dirPath = await mkdtemp(path.join(tmpdir(), "obsidian-test-consumer-"));
		t.after(() => rm(dirPath, { recursive: true }));
		t.diagnostic(`Created test dir at ${dirPath}`)

		await writeFile(
			path.join(dirPath, "package.json"),
			JSON.stringify({
				type: "commonjs",
				name: "obsidian-test-consumer",
				version: "1.5.3",
				description: "tests obsidian-test from the consumer side",
				author: "me",
			}, null, 2)
		);

		run(`npm install ${root}`, dirPath);

		await writeFile(
			path.join(dirPath, "glob.test.js"),
			`
			const { embedded } = require("obsidian-test");
			embedded((app) => {
				throw "Expected error";
			})
			`
		);

		await writeFile(
			path.join(dirPath, "index.mjs"),
			`
			import { buildTestArtifact } from "obsidian-test/node";
			console.log((await buildTestArtifact({
				testPattern: "./*.test.js"
			})).code);
			`
		);

		const output = run("node index.mjs", dirPath).join("\n");
		t.assert.ok(output.includes(`throw "Expected error";`))
	});

	await test(`esm plugin code`, async (t: TestContext) => {
		const dirPath = await mkdtemp(path.join(tmpdir(), "obsidian-test-consumer-"))
		t.after(() => rm(dirPath, { recursive: true }));
		t.diagnostic(`Created test dir at ${dirPath}`)

		await writeFile(
			path.join(dirPath, "package.json"),
			JSON.stringify({
				type: "module",
				name: "obsidian-test-consumer",
				version: "1.5.3",
				description: "tests obsidian-test from the consumer side",
				author: "me",
			}, null, 2)
		);

		run(`npm install ${root}`, dirPath);

		await writeFile(
			path.join(dirPath, "glob.test.js"),
			`
			import { embedded } from "obsidian-test";
			embedded((app) => {
				throw "Expected error";
			})
			`
		);

		await writeFile(
			path.join(dirPath, "index.js"),
			`
			import { buildTestArtifact } from "obsidian-test/node";
			console.log((await buildTestArtifact({
				testPattern: "./*.test.js"
			})).code);
			`
		);

		const output = run("node index.js", dirPath).join("\n");
		t.assert.ok(output.includes(`throw "Expected error";`))
	})
})
