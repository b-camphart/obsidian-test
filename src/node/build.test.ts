import test, { type TestContext } from "node:test";

import { execSync } from "child_process";
import { readFile, writeFile } from "fs/promises";
import path from "path";

import {
	cleanNPMEnv,
	createTempDependentPackage } from "../test/dependent.js";
import { randomBytes } from "crypto";

function run(cmd: string, cwd: string) {
	return execSync(cmd, { cwd, env: cleanNPMEnv(), stdio: 'pipe' });
}


test("Building consumer package", async () => {
	const requireInclude = (source: string, ...members: string[]) => `const { ${members.join(", ")} } = require("${source}");`;
	const importInclude = (source: string, ...members: string[]) => `import { ${members.join(", ")} } from "${source}";`;

	const supportedClientCode = [
		{ ext: "cjs", includePattern: requireInclude, moduleType: "commonjs" as const },
		{ ext: "mjs", includePattern: importInclude, moduleType: "module" as const },
		{ ext: "ts", includePattern: importInclude, moduleType: "module" as const },
	];

	for (const { ext: clientExt, includePattern: clientImportPattern, moduleType } of supportedClientCode) {

		await test(`Run  against ${clientExt}`, async (t: TestContext) => {
			const dirPath = await createTempDependentPackage({
				t, packageJSON: {
					type: moduleType,
					name: "obsidian-test-consumer",
					version: "1.5.3",
					description: "tests obsidian-test from the consumer side",
					author: "me",
				}
			})

			const expectedErrorStr = `new Error("Expected error ${randomBytes(16).toString("hex")}")`;
			await writeFile(
				path.join(dirPath, "glob.test." + clientExt),
				`
					${clientImportPattern("obsidian-test", "embedded")}
					embedded((app) => {
						throw ${expectedErrorStr};
					})
					`
			);

			const expectedArtifactPath = path.join(dirPath, "artifact.js");
			await writeFile(
				path.join(dirPath, "index.mjs"),
				`
					${importInclude("obsidian-test/node", "buildTestArtifact")}
					${importInclude("fs", "writeFileSync")}
					const artifact = await buildTestArtifact({
						testPattern: "./*.test.${clientExt}"
					});
					writeFileSync("${expectedArtifactPath}", artifact.code, "utf8");
					`
			);

			const output = run("node index.mjs", dirPath);
			const artifact = await readFile(expectedArtifactPath, "utf8");
			if (!artifact.includes(expectedErrorStr)) {
				output.toString("utf8").split("\n").forEach(t.diagnostic.bind(t));
				throw new Error(`buildTestArtifact did not include glob file` +
					`\nExpected build output to include "${expectedErrorStr}"` +
					`\nArtifact::\n${artifact}\nEOF`);
			}
		})

	}
})
