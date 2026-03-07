import fs, { mkdir } from "fs/promises";
import crypto from "crypto";
import {
	type LaunchConfig,
	type MakeManifestInput, type ObsidianPluginConfig, runObsidianUntil, standardTestVaultPath } from "./obsidian.js";
import { buildTestArtifact, type BuildTestArtifactConfig } from "./build.js";
import path from "path";
import { createServer } from "net";
import { latestPackageVersion } from "./npm.js";
import { createReadStream, createWriteStream } from "fs";
import { type Log, standardLog, subLog } from "./log.js";
import { parseExitCodeOrThrow } from "../io.js";

interface RunConfig {
	/** customize how obsidian is launched */
	launch?: LaunchConfig;
	/** customize how the test artifact is built */
	build?: BuildTestArtifactConfig;
	/** customize the manifest used for the test runner plugin that will be used in obsidian */
	manifest?: MakeManifestInput;
	/** additional plugins to install in the test vault */
	plugins?: Array<ObsidianPluginConfig>;
	/** absolute path to a directory where the logs, exit code, and hash will be written */
	log?: Log;
	/** timeout in milliseconds, after which the test will be forced to end with an error */
	timeoutMS?: number;
}

export interface TestConfig extends RunConfig {
	/** absolute path to a directory where the logs, exit code, and hash will be written */
	cachePath?: string;
	/** if `true`, forces the tests to run again, even if a previous run is valid */
	forceRerun?: boolean;
}

/**
 * Builds and runs the tests within obsidian, or re-plays the logs from the previous run if valid.  Returns the exit
 * code from the test run process
 */
export async function runTest(params: TestConfig = {}) {
	const {
		launch = {
			vaultPath: standardTestVaultPath(),
		},
		build,
		manifest = {
			id: "embedded-test-runner",
		},
		plugins,
		cachePath = path.join(process.cwd(), ".obsidian-test"),
		log = standardLog(),
		forceRerun: forceReplay = false,
		timeoutMS,
	} = params;

	const artifact = await buildTestArtifact(build);

	await mkdir(cachePath, { recursive: true })

	const cache = runCache({
		cachePath,
	});

	if (await cache.isValid(artifact.code)) {
		if (forceReplay) {
			log.info("cache hit, but forcing rerun");
		} else {
			log.info("cache hit, replaying logs");
			createReadStream(cache.paths.log, { encoding: "utf8" }).pipe(
				process.stdout,
			);
			return fs.readFile(cache.paths.exitCode, "utf8");
		}
	}

	const logWriter = createWriteStream(cache.paths.log, {
		autoClose: true,
		encoding: "utf8",
	});

	const exitCode = await runObsidianTest({
		launch,
		testPlugin: {
			manifest,
			artifact,
		},
		plugins,
		log,
		internalLogWriter: {
			write(chunk: string) {
				log.write(chunk);
				logWriter.write(chunk)
			},
		},
		timeoutMS,
	}).finally(() => {
		logWriter.close();
	});

	log.info("\n");

	await fs.writeFile(cache.paths.exitCode, String(exitCode), "utf8");

	await fs.writeFile(
		cache.paths.hash,
		cache.hash({
			code: artifact.code,
			exitCode: String(exitCode),
			log: await fs.readFile(cache.paths.log, "utf8"),
		}),
	);

	return exitCode;
}

export default runTest;

function runCache(params: { cachePath: string }) {
	const { cachePath } = params;

	const paths = {
		hash: path.join(cachePath, "hash"),
		exitCode: path.join(cachePath, "exitcode"),
		log: path.join(cachePath, "log"),
	};

	function hash({
		code,
		log,
		exitCode,
	}: {
		code: string;
		log: string;
		exitCode: string;
	}) {
		return crypto.hash(
			"sha1",
			code + log + exitCode + latestPackageVersion("obsidian"),
		);
	}

	return {
		paths,
		hash,
		async isValid(code: string) {
			const previousHash = await readFileOrNull(paths.hash);
			if (!previousHash) {
				console.log("no previous run found");
				return false;
			}

			const previousExitCode = await readFileOrNull(paths.exitCode);
			if (!previousExitCode) {
				console.log("no previous run found");
				return false;
			}

			const previousLog = await readFileOrNull(paths.log);
			if (!previousLog) {
				console.log("no previous run found");
				return false;
			}

			const currentHash = hash({
				code,
				log: previousLog,
				exitCode: previousExitCode,
			});
			return currentHash === previousHash;
		},
	};
}

async function readFileOrNull(
	path: string,
	{
		encoding = "utf8",
		onError,
	}: { encoding?: BufferEncoding; onError?: (e: unknown) => void } = {},
): Promise<string | null> {
	try {
		return await fs.readFile(path, encoding);
	} catch (e) {
		onError?.(e);
		return null;
	}
}

export interface ForceTestConfig extends RunConfig {
	os?: Parameters<typeof runObsidianTest>[0]["os"];
	fileSystem?: Parameters<typeof runObsidianTest>[0]["fileSystem"];
}

/**
 * Launches obsidian pointed at the test vault, returning the test result as a
 * standard error code.
 * 
 * This function does NOT write any output for caching.  To get that behavior, but still force the tests to run, use
 * `runTest` and pass `{ forceRerun: true }`.
 */
export async function forceRunTest({
	build,
	launch,
	manifest = {
		id: "embedded-test-runner",
	},
	plugins,
	log = standardLog(),
	timeoutMS,

	os,
	fileSystem,
}: ForceTestConfig = {}): Promise<0 | 1> {
	return await runObsidianTest({
		launch,
		testPlugin: {
			manifest,
			artifact: await buildTestArtifact(build),
		},
		plugins,
		log,
		internalLogWriter: log,
		timeoutMS,
		os,
		fileSystem,
	});
}

/**
 * creates new server and only returns once it's listening
 */
async function createTestRunnerLogServer() {
	let connectionPromise: PromiseWithResolvers<{
		pipe(fn: (line: string) => void): void;
		exitCode(config?: {
			parseExitCode?: (line: string) => 0 | 1;
			timeoutMS?: number;
		}): Promise<0 | 1>;
	}> | null = null;
	const server = createServer((socket) => {
		connectionPromise?.resolve({
			pipe(fn: (line: string) => void) {
				socket.on("data", (chunk) => fn(chunk.toString("utf8")));
			},
			exitCode: (config) => {
				const parseExitCode = config?.parseExitCode ?? parseExitCodeOrThrow;
				const timeoutMS = config?.timeoutMS ?? 5000;

				return new Promise((resolve, reject) => {
					let timeout = setTimeout(
						reject.bind(
							null,
							new Error(`No data received within ${timeoutMS / 1000} seconds`),
						),
						timeoutMS,
					);
					socket.on("data", () => {
						clearTimeout(timeout);
						timeout = setTimeout(
							reject.bind(
								null,
								new Error(
									`No new data received within ${timeoutMS / 1000} seconds`,
								),
							),
							timeoutMS,
						);
					});

					let lastLine = "";
					socket.on("data", (chunk) => {
						lastLine += chunk.toString("utf8");
						let idx = -1;
						while ((idx = lastLine.indexOf("\n")) !== -1) {
							lastLine = lastLine.slice(idx + 1);
						}
					});

					socket.on("end", () => {
						clearTimeout(timeout);
						try {
							resolve(parseExitCode(lastLine));
						} catch (e) {
							reject(e);
						}
					});
				});
			},
		});
	});
	server.maxConnections = 1;
	await new Promise<void>((resolve) => {
		server.listen(0, resolve);
	});
	const address = server.address();
	if (address === null) {
		server.close();
		throw new Error(`server address is null after listening`);
	}
	return {
		close: () => server.close(),
		address: () => address,
		connection(timeoutMS: number = 5000) {
			if (connectionPromise === null) {
				connectionPromise = Promise.withResolvers();
				const timeout = setTimeout(
					connectionPromise.reject.bind(
						connectionPromise,
						new Error(`No connection received within ${timeoutMS / 1000} seconds`),
					),
					timeoutMS,
				);
				connectionPromise.promise.then(() => {
					clearTimeout(timeout);
				});
			}
			return connectionPromise.promise;
		},
	};
}

/**
 * This function will launch obsidian.
 */
async function runObsidianTest({
	launch,
	plugins = [],
	testPlugin,
	log,
	internalLogWriter,
	timeoutMS,
	os,
	fileSystem,
}: {
	launch?: LaunchConfig;
	plugins?: Array<ObsidianPluginConfig>;
	testPlugin: {
		manifest: MakeManifestInput;
		artifact: {
			code: string;
			remap: null | ((line: string) => string);
		};
	};
	log: Log;
	internalLogWriter: {
		write(chunk: string): void;
	};
	timeoutMS?: number;
	os?: Parameters<typeof runObsidianUntil>[0]["os"];
	fileSystem?: Parameters<typeof runObsidianUntil>[0]["fileSystem"];
}): Promise<0 | 1> {
	const server = await createTestRunnerLogServer();

	try {
		const address = server.address();
		return await runObsidianUntil({
			os,
			fileSystem,
			launch,
			plugins: [
				...plugins,
				{
					...testPlugin,
					data: {
						output:
							typeof address === "string"
								? address
								: address.port,
					},
				},
			],
			log: subLog({ parent: log, prefix: "[Obsidian Process]" }),
			concurrentRun: async () => {
				const socket = await server.connection(timeoutMS);
				let buffer = "";
				socket.pipe((chunk) => {
					if (testPlugin.artifact.remap === null) {
						internalLogWriter.write(chunk);
						return;
					}
					buffer += chunk;
					let idx = -1;
					while ((idx = buffer.indexOf("\n")) !== -1) {
						internalLogWriter.write(
							testPlugin.artifact.remap(buffer.slice(0, idx)) + "\n",
						);
						buffer = buffer.slice(idx + 1);
					}
				});
				const exitCode = await socket.exitCode({ timeoutMS });
				// in case more data was sent without a newline
				if (buffer.length > 0) {
					internalLogWriter.write(
						testPlugin.artifact.remap?.(buffer) ?? buffer
					);
				}
				return exitCode;
			},
		});
	} finally {
		server.close();
	}
}
