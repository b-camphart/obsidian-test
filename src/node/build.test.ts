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

	// we do not support cjs NODE code, however

	await test(`cjs plugin code`, async (t: TestContext) => {
		const dirPath = await createTempDependentPackage({
			t, packageJSON: {
				type: "commonjs",
				name: "obsidian-test-consumer",
				version: "1.5.3",
				description: "tests obsidian-test from the consumer side",
				author: "me",
			}
		})

		const expectedErrorStr = `new Error("Expected error ${randomBytes(16).toString("hex")}")`;
		await writeFile(
			path.join(dirPath, "glob.test.js"),
			`
			const { embedded } = require("obsidian-test");
			embedded((app) => {
				throw ${expectedErrorStr};
			})
			`
		);

		const expectedArtifactPath = path.join(dirPath, "artifact.js");
		await writeFile(
			path.join(dirPath, "index.mjs"),
			`
			import { buildTestArtifact } from "obsidian-test/node";
			import { writeFileSync } from "fs";
			const artifact = await buildTestArtifact({
				testPattern: "./*.test.js"
			});
			writeFileSync("${expectedArtifactPath}", artifact.code, "utf8");
			`
		);

		const output = run("node index.mjs", dirPath);
		const artifact = await readFile(expectedArtifactPath, "utf8");
		if (!artifact.includes(expectedErrorStr)) {
			t.diagnostic(output.toString("utf8"));
			throw new Error(`buildTestArtifact did not include glob file` +
				`\nExpected build output to include "${expectedErrorStr}"` +
				`\nArtifact::\n${artifact}\nEOF`);
		}

	});

	await test(`esm plugin code`, async (t: TestContext) => {
		const dirPath = await createTempDependentPackage({
			t, packageJSON: {
				type: "module",
				name: "obsidian-test-consumer",
				version: "1.5.3",
				description: "tests obsidian-test from the consumer side",
				author: "me",
			}
		})

		const expectedErrorStr = `new Error("Expected error ${randomBytes(16).toString("hex")}")`;
		await writeFile(
			path.join(dirPath, "glob.test.js"),
			`
			import { embedded } from "obsidian-test";
			embedded((app) => {
				throw ${expectedErrorStr};
			})
			`
		);

		const expectedArtifactPath = path.join(dirPath, "artifact.js");
		await writeFile(
			path.join(dirPath, "index.js"),
			`
			import { buildTestArtifact } from "obsidian-test/node";
			import { writeFileSync } from "fs";
			const artifact = await buildTestArtifact({
				testPattern: "./*.test.js"
			});
			writeFileSync("${expectedArtifactPath}", artifact.code, "utf8");
			`
		);

		const output = run("node index.js", dirPath);
		const artifact = await readFile(expectedArtifactPath, "utf8");
		if (!artifact.includes(expectedErrorStr)) {
			t.diagnostic(output.toString("utf8"));
			throw new Error(`buildTestArtifact did not include glob file` +
				`\nExpected build output to include "${expectedErrorStr}"` +
				`\nArtifact::\n${artifact}\nEOF`);
		}
	})
})
