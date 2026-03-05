import * as vite from 'vite';
import path from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import { builtinModules, } from 'node:module';
import assert from 'assert';
import { SourceMapConsumer } from 'source-map';
import { fileURLToPath } from 'url';

export function testEntryFilePath() {
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = path.dirname(__filename);
	return path.resolve(__dirname, '../client/plugin.js');
}

export interface BuildTestArtifactConfig {
	testPattern?: string,
	outputDirPath?: string | null,
}

export async function buildTestArtifact({
	testPattern = "./**/*.{test|spec}.{js|ts}",
	outputDirPath = null,
}: BuildTestArtifactConfig = {}): Promise<{ code: string, remap: ((stack: string) => string) | null }> {

	if (outputDirPath) {
		mkdirSync(outputDirPath, { recursive: true });
	}

	const runner = "node:test"; // TODO: dynamic

	const viteOutput = await vite.build({
		configFile: false,
		build: {
			lib: {
				entry: testEntryFilePath(),
				formats: ['cjs'],
				fileName: 'main',
			},
			minify: false,
			write: outputDirPath !== null,
			outDir: outputDirPath ?? undefined,
			rollupOptions: {
				external: ['obsidian', 'electron', ...builtinModules],
				treeshake: false,
			},
		},
		mode: "test",
		root: process.cwd(),
		plugins: [
			{
				name: 'tests',
				enforce: "pre",
				resolveId(id) {
					if (id === "virtual:tests") {
						return "\0virtual:tests";
					}
				},
				load(id) {
					if (id === "\0virtual:tests") {
						return `import.meta.glob("${testPattern}", { eager: true, base: "./" });`
					}
				}
			},
			{
				name: 'dynamic-test-runner',
				enforce: "pre",
				resolveId(id, importer) {
					if (!id.endsWith("dynamic.js")) {
						return;
					}
					const resolved = importer ? path.resolve(path.dirname(importer), id) : id;
					const dynamicRunnerPath = "/obsidian-test/dist/client/runners/dynamic.js";
					if (resolved.endsWith(dynamicRunnerPath)) {
						if (runner === "node:test") {
							return path.join(resolved.slice(0, -dynamicRunnerPath.length), "obsidian-test", "dist", "client", "runners", "node.js");
						}
					}
				},
			},
		],
	});

	assert(Array.isArray(viteOutput));
	assert(viteOutput[0])

	if (outputDirPath) {
		writeFileSync(path.join(outputDirPath, "main.js"), viteOutput[0].output[0].code, "utf8")
	}

	return {
		code: viteOutput[0].output[0].code,
		remap: viteOutput[0].output[0].map ? await createRemapper(viteOutput[0].output[0].map) : null,
	}
}

async function createRemapper(map: vite.Rollup.SourceMap) {
	const sourceMapConsumer = await new SourceMapConsumer(map)

	const STACK_LINE_RE =
		/^\s*at (.*?) \((.*?):(\d+):(\d+)\)$|^\s*at (.*?):(\d+):(\d+)$/;

	return function remapStack(stack: string) {
		return stack
			.split("\n")
			.map(line => {
				const match = STACK_LINE_RE.exec(line);
				if (!match) return line;

				const file = match[2] ?? match[5];
				const lineNum = Number(match[3] ?? match[6]);
				const columnNum = Number(match[4] ?? match[7]);

				if (!file || !lineNum || !columnNum) return line;

				const original = sourceMapConsumer.originalPositionFor({
					line: lineNum,
					column: columnNum,
				});

				if (!original.source) return line;

				const fn = match[1] ?? "<anonymous>";
				return `    at ${fn} (${original.source}:${original.line}:${original.column})`;
			})
			.join("\n");
	}

}
