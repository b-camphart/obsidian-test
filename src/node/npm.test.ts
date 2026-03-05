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

	return execSync(cmd, { cwd, stdio: "pipe", env });
}

test("resolve package name", async (t: TestContext) => {
	const root = process.cwd();
	t.assert.ok(root.endsWith("obsidian-test"));

	const dirPath = await mkdtemp(path.join(tmpdir(), "obsidian-test-consumer-"))
	t.after(() => rm(dirPath, { recursive: true }));
	t.diagnostic(`Created test dir at ${dirPath}`)

	const consumerName = "consumer-test"
	await writeFile(
		path.join(dirPath, "package.json"),
		JSON.stringify({ name: consumerName }, null, 2)
	);

	run(`npm install ${root}`, dirPath);

	await writeFile(
		path.join(dirPath, "index.js"),
		`
		const { resolvePackageName } = require("obsidian-test/node");
		const packageName = resolvePackageName();
		if (packageName !== "${consumerName}") {
			throw new Error(\`Package name was "\${packageName}"\, expected "${consumerName}"
				env: \${JSON.stringify(process.env, null, 2)}
			\`);
		}
		`
	);

	run("node index.js", dirPath);
})

test("resolve package version", async (t: TestContext) => {
	const root = process.cwd();
	t.assert.ok(root.endsWith("obsidian-test"));

	const dirPath = await mkdtemp(path.join(tmpdir(), "obsidian-test-consumer-"))
	t.after(() => rm(dirPath, { recursive: true }));
	t.diagnostic(`Created test dir at ${dirPath}`)

	const consumerVersion = "1.5.3"
	await writeFile(
		path.join(dirPath, "package.json"),
		JSON.stringify({ version: consumerVersion }, null, 2)
	);

	run(`npm install ${root}`, dirPath);

	await writeFile(
		path.join(dirPath, "index.js"),
		`
		const { resolvePackageVersion } = require("obsidian-test/node");
		const version = resolvePackageVersion();
		if (version !== "${consumerVersion}") {
			throw new Error(\`Package version was "\${version}"\, expected "${consumerVersion}"
				env: \${JSON.stringify(process.env, null, 2)}
			\`);
		}
		`
	);

	run("node index.js", dirPath);
})
