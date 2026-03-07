import test, { type TestContext } from "node:test";

import { execSync } from "child_process";
import { writeFile } from "fs/promises";
import path from "path";
import { createTempDependentPackage } from "../test/dependent";

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
	const consumerName = "consumer-test"
	const dirPath = await createTempDependentPackage({
		t, packageJSON: {
			name: consumerName,
		}
	});

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
	const consumerVersion = "1.5.3"
	const dirPath = await createTempDependentPackage({
		t, packageJSON: {
			version: consumerVersion
		}
	});

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
