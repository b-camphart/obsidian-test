import fs from "fs/promises";
import path from "path";
import assert from "assert";
import crypto from "crypto";
import treeKill from "tree-kill";
import { exec, type Serializable } from "child_process";
import type { PluginManifest } from "obsidian";

import { latestPackageVersion, resolvePackage, resolvePackageDescriptionOrNull, resolvePackageName, resolvePackageVersion } from "./npm.js";
import { existsSync } from "fs";
import { type Log, standardLog } from "./log.js";

// file system
interface DirectoryMaker {
	mkdir: typeof fs.mkdir;
}

interface FileWriter {
	writeFile: typeof fs.writeFile;
}

interface FileReader {
	readFile: typeof fs.readFile;
}

interface ExistChecker {
	exists: typeof existsSync;
}

/** @returns `${cwd}/node_modules/.cache/obsidian-test/${packageName}-test-vault` */
export function standardTestVaultPath({
	cwd = process.cwd(),
	packageName = resolvePackageName(),
}: {
	cwd?: string;
	packageName?: string;
} = {}) {
	return path.join(
		cwd,
		"node_modules",
		".cache",
		"obsidian-test",
		`${packageName}-test-vault`,
	);
}

/** @returns `${vaultPath}/.obsidian/plugins` using the os path separator */
export function standardPluginsPath({ vaultPath }: { vaultPath: string }) {
	return path.join(vaultPath, ".obsidian", "plugins");
}

/** 
 * @returns `${vaultPath}/.obsidian/plugins/${pluginId}` using the os path separator 
 */
export function standardPluginPath({ vaultPath, pluginId }: { vaultPath: string, pluginId: string }) {
	return path.join(standardPluginsPath({ vaultPath }), pluginId);
}

/** @returns `${vaultPath}/.obsidian/plugins/${pluginId}/manifest.json` using the os path separator */
export function standardManifestPath({ vaultPath, pluginId }: { vaultPath: string, pluginId: string }) {
	return path.join(standardPluginPath({ vaultPath, pluginId }), "manifest.json");
}

/** writes the stringified manifest to the standard manifest path */
export async function writeManifest({ vaultPath, manifest, fileSystem = fs }: {
	vaultPath: string,
	manifest: MakeManifestInput,
	fileSystem?: DirectoryMaker & FileWriter;
}) {
	const pluginDirPath = standardPluginPath({ vaultPath, pluginId: manifest.id });
	const manifestPath = standardManifestPath({ vaultPath, pluginId: manifest.id });
	const fullManifest = makeManifest(manifest);
	const written = JSON.stringify(fullManifest, null, 2);

	await fileSystem.mkdir(pluginDirPath, { recursive: true });
	await fileSystem.writeFile(manifestPath, written, "utf8");

	return {
		pluginDirPath,
		path: manifestPath,
		manifest: fullManifest,
		writtenData: written,
	}
}

/**
 * Creates a normalized `PluginManifest` object for an Obsidian plugin.
 *
 * Defaults:
 * - `name` defaults to the provided `id`
 * - `version` defaults to the version from package.json
 * - `minAppVersion` defaults to the latest available Obsidian version
 * - `description`, `author`, and `authorUrl` default to empty strings
 * - `isDesktopOnly` defaults to `false`
 * - If `version` resolves to `null` or `undefined`, it is set to `"<unknown>"`
 *
 * @returns A fully populated `PluginManifest` object.
*/
export function makeManifest(partialManifest: Partial<PluginManifest> & Pick<PluginManifest, 'id'>): PluginManifest {
	const pkg = resolvePackage();

	const {
		id,
		name = id,
		version = resolvePackageVersion(pkg),
		minAppVersion = latestPackageVersion("obsidian"),
		description = resolvePackageDescriptionOrNull(pkg) ?? "",
		author = "",
		authorUrl = "",
		isDesktopOnly = false
	} = partialManifest;

	return {
		id,
		name,
		version,
		minAppVersion,
		description,
		author,
		authorUrl,
		isDesktopOnly,
	}
}

export type MakeManifestInput = Parameters<typeof makeManifest>[0];

/** @returns `${vaultPath}/.obsidian/plugins/${pluginId}/data.json` using the os path separator */
export function standardDataPath({ vaultPath, pluginId }: { vaultPath: string, pluginId: string }) {
	return path.join(standardPluginPath({ vaultPath, pluginId }), "data.json");
}

export async function writeDataJSON({ vaultPath, pluginId, json, fileSystem = fs }: {
	vaultPath: string;
	pluginId: string;
	json: object,
	fileSystem?: DirectoryMaker & FileWriter;
}) {
	const pluginDirPath = standardPluginPath({ vaultPath, pluginId });
	const dataPath = standardDataPath({ vaultPath, pluginId });
	const data = JSON.stringify(json);

	await fileSystem.mkdir(pluginDirPath, { recursive: true });
	await fileSystem.writeFile(dataPath, data, "utf8");

	return {
		path: dataPath,
		pluginDirPath,
		data,
	}
}

/** @returns `${vaultPath}/.obsidian/plugins/${pluginId}/main.js` using the os path separator */
export function standardMainFilePath({ vaultPath, pluginId }: { vaultPath: string, pluginId: string }) {
	return path.join(standardPluginPath({ vaultPath, pluginId }), "main.js");
}

export async function writePluginMainFile({ vaultPath, pluginId, code, fileSystem = fs }: {
	vaultPath: string,
	pluginId: string,
	code: string;
	fileSystem?: DirectoryMaker & FileWriter;
}) {
	const pluginDirPath = standardPluginPath({ vaultPath, pluginId });
	const mainFilePath = standardMainFilePath({ vaultPath, pluginId })

	await fileSystem.mkdir(pluginDirPath, { recursive: true })
	await fileSystem.writeFile(mainFilePath, code, "utf8");

	return {
		pluginDirPath,
		path: mainFilePath,
	}
}

/** @returns `${vaultPath}/.obsidian/plugins/${pluginId}/styles.css` using the os path separator */
export function standardPluginStylePath({ vaultPath, pluginId }: { vaultPath: string, pluginId: string }) {
	return path.join(standardPluginPath({ vaultPath, pluginId }), "styles.css");
}

/** writes the provided content to the plugin's styles.css file */
export async function writePluginStyles({ vaultPath, pluginId, content, fileSystem = fs }: {
	vaultPath: string,
	pluginId: string,
	content: string;
	fileSystem?: DirectoryMaker & FileWriter;
}) {
	const pluginDirPath = standardPluginPath({ vaultPath, pluginId });
	const mainFilePath = standardPluginStylePath({ vaultPath, pluginId })

	await fileSystem.mkdir(pluginDirPath, { recursive: true })
	await fileSystem.writeFile(mainFilePath, content, "utf8");

	return {
		pluginDirPath,
		path: mainFilePath,
	}
}

/** @returns `${vaultPath}/.obsidian/community-plugins.json` */
export function standardCommunityPluginsJsonPath({ vaultPath }: { vaultPath: string }): string {
	return path.join(vaultPath, ".obsidian", "community-plugins.json");
}

/** */
export async function enablePlugin({ vaultPath, pluginId, fileSystem = {
	readFile: fs.readFile,
	writeFile: fs.writeFile,
	exists: existsSync,
} }: {
	vaultPath: string,
	pluginId: string,
	fileSystem?: FileWriter & FileReader & ExistChecker;
}) {
	const obsidianPath = path.join(vaultPath, ".obsidian");
	const pluginsJsonPath = standardCommunityPluginsJsonPath({ vaultPath });

	const enabledPluginList = [pluginId];
	if (fileSystem.exists(pluginsJsonPath)) {
		const existingData = JSON.parse(await fileSystem.readFile(pluginsJsonPath, "utf8"));
		assert(Array.isArray(existingData));
		enabledPluginList.push(...existingData);
	}

	await fileSystem.writeFile(pluginsJsonPath, JSON.stringify(enabledPluginList), "utf8");

	return {
		enabledPlugins: enabledPluginList,
		enabledPluginsPath: pluginsJsonPath,
		obsidianPath,
	}
}

/** 
 * attempts to resolve the path to the obsidian.json file that holds the list of registered vaults
 * First checks for the `OBSIDIAN_CONFIG_PATH` env variable, then uses the default `~/.config/obisidan/obsidian.json`
 */
export function resolveObsidianConfigPath() {
	const obsidianConfigPath = process.env['OBSIDIAN_CONFIG_PATH'] ||
		// TODO: os selection
		path.join(process.env['HOME'] ?? '', ".config", "obsidian", "obsidian.json");
	if (!existsSync(obsidianConfigPath)) {
		throw new Error(`Obsidian config path "${obsidianConfigPath}" does not exist.\n` +
			`Find the "obsidian.json" file on your system and add that path to the "OBSIDIAN_CONFIG_PATH" ` +
			`environment variable.`)
	}
	return obsidianConfigPath;
}

/** registers the provided vault path as a vault in obsidian so it can be opened */
export async function addVault({
	vaultPath,
	open = true,
	obsidianConfigPath = resolveObsidianConfigPath(),
	fileSystem = fs,
}: {
	vaultPath: string;
	/** if the vault should be open on launch */
	open?: boolean;
	/** the path to obsidian.json that holds the list of registered vaults */
	obsidianConfigPath?: string;
	fileSystem?: FileReader & FileWriter;
}) {
	const obsidianConfig: { vaults: Record<string, { path: string; ts: number, open?: boolean }> } = JSON.parse(await fileSystem.readFile(obsidianConfigPath, "utf8"));
	if (open) {
		for (const vault of Object.values(obsidianConfig.vaults)) {
			if (vault.open) {
				delete vault.open;
			}
		}
	}
	const vault_id = crypto.hash("md5", vaultPath);
	obsidianConfig.vaults[vault_id] = {
		path: vaultPath,
		ts: Date.now(),
		open,
	};

	await fileSystem.writeFile(obsidianConfigPath, JSON.stringify(obsidianConfig), { encoding: "utf8" });
}

/**
 * Writes a plugin to the standard location for the provided vault path and enables it (unless `enabled` is `false`).
 */
export async function prepareObsidianPlugin({
	vaultPath,
	manifest,
	artifact,
	data,
	enabled = true,
	fileSystem = {
		mkdir: fs.mkdir,
		readFile: fs.readFile,
		writeFile: fs.writeFile,
		exists: existsSync,
	},
}: ObsidianPluginConfig & {
	vaultPath: string;

	// dependencies
	fileSystem?: Parameters<typeof writeManifest>[0]["fileSystem"] & Parameters<typeof enablePlugin>[0]["fileSystem"] & Parameters<typeof writeDataJSON>[0]["fileSystem"];
}) {
	const pluginId = manifest.id;

	await fileSystem.mkdir(standardPluginsPath({ vaultPath }), { recursive: true });

	const [
		manifestRes,
		mainFileRes,
		stylesRes,
		dataFileRes,
		_enabledRes,
	] = await Promise.all([
		writeManifest({ vaultPath, manifest, fileSystem }),
		writePluginMainFile({ vaultPath, pluginId, code: artifact.code, fileSystem }),
		artifact.style ? writePluginStyles({ vaultPath, pluginId, content: artifact.style, fileSystem }) : null,
		data ? writeDataJSON({ vaultPath, pluginId, json: data, fileSystem }) : null,
		enabled ? enablePlugin({ vaultPath, pluginId: manifest.id, fileSystem, }) : null,
	]);

	return {
		/** the path to the plugin's directory */
		path: manifestRes.pluginDirPath,
		["manifest.json"]: {
			path: manifestRes.path,
			content: manifestRes.writtenData,
			manifest: manifestRes.manifest,
		},
		["main.js"]: {
			path: mainFileRes.path,
		},
		["styles.css"]: stylesRes === null ? null : {
			path: stylesRes.path,
		},
		["data.json"]: dataFileRes === null ? null : {
			path: dataFileRes.path,
			content: dataFileRes.data,
		},
	}
}

type BasicSubProcess = { pid?: number; kill(): void; };
async function launchObsidianInVaultPath<SubProcess extends BasicSubProcess>({
	vaultPath,
	cmd = "obsidian",
	obsidianConfigPath,
	os,
	fileSystem,
}: LaunchConfig & {
	os: {
		runCommand: (command: string) => SubProcess;
	},
	fileSystem?: Parameters<typeof addVault>[0]["fileSystem"]
}): Promise<{
	/** the command used to launch obsidian */
	cmd: string;
	/** @param signal `SIGTERM` by default */
	kill(signal?: string | number): Promise<void>;
	subProcess: SubProcess;
}> {
	// ensure the vault is registered in obsidian
	await addVault({ vaultPath, obsidianConfigPath, fileSystem });

	const subProcess = os.runCommand(execObsidianURICmd({ cmd, uriParts: { path: vaultPath } }));
	const pid = subProcess.pid;
	if (pid === undefined) {
		subProcess.kill();
		throw new Error(`obsidian process did not spawn with a process id`)
	}

	const kill = (signal?: string | number) => {
		return new Promise<void>((resolve, reject) => {
			treeKill(pid, signal, (e) => {
				if (e) {
					return reject(e)
				}
				resolve();
			})
		})
	}

	return {
		cmd,
		kill,
		subProcess,
	}
}

/** customize how obsidian is launched */
export interface LaunchConfig {
	/** path to the vault to open */
	vaultPath: string;
	/** the command to run to launch obsidian.  Defaults to "obsidian" */
	cmd?: string;
	/** the path to obsidian.json that holds the list of registered vaults */
	obsidianConfigPath?: string;
}

/** must provide at least one argument */
export function obsidianURI({
	/** path to the vault to open */
	path
}: {
	path?: string
}) {
	let query = "?";
	if (path) {
		query += `path=${encodeURIComponent(path)}`
	}
	if (query === "?") {
		throw new Error(`no query parts provided`)
	}
	return `obsidian://open${query}`
}

/** 
 * returns the command string to use when executing obsidian with a uri 
 * E.G. `obsidian "obsidian://open?path=foo/bar/bazz"`
 */
export function execObsidianURICmd({
	uriParts,
	cmd = "obsidian"
}: {
	/** URI-encoded obsidian uri */
	uriParts: Parameters<typeof obsidianURI>[0];
	/** the command to run to launch obsidian.  Defaults to "obsidian" */
	cmd?: string;
}) {
	return `${cmd} "${obsidianURI(uriParts)}"`
}

/** Runs obsidian, returning once obsidian closes with the exit code */
export async function runObsidian({
	launch = {
		vaultPath: standardTestVaultPath(),
	},
	plugins = [],
	log = standardLog(),
	timeout: timeoutMS,
	fileSystem,
	os = {
		runCommand: exec
	},
}: RunObsidianConfig & {
	fileSystem?: Parameters<typeof prepareObsidianPlugin>[0]["fileSystem"];
	os?: Parameters<typeof launchObsidianInVaultPath<EventfulSubProcess>>[0]["os"];
}) {
	// not using Promise.all to avoid too many open file handles at once
	for (const { manifest, artifact, data } of plugins) {
		await prepareObsidianPlugin({
			vaultPath: launch.vaultPath,
			manifest,
			artifact,
			data,
			fileSystem,
		});
	}

	const launched = await launchObsidianInVaultPath({
		...launch,
		os,
		fileSystem,
	});
	const child_process = launched.subProcess;
	child_process.on("message", (msg) => {
		log.info(msg.toString());
	});
	child_process.on("error", (err) => {
		log.error(String(err));
	});

	return new Promise<number | null>((resolve, reject) => {
		if (timeoutMS !== undefined) {
			const err = new Error(
				`Obsidian did not exit within ${timeoutMS}ms`,
			);
			const timeout = setTimeout(() => {
				launched.kill();
				reject(err);
			}, timeoutMS);
			child_process.on("exit", () => clearTimeout(timeout));
			child_process.on("close", () => clearTimeout(timeout));
		}

		child_process.on("exit", (code) => {
			resolve(code);
		});
		child_process.on("close", (code) => {
			resolve(code);
		});
	});
}

/** the data needed to enable a plugin within an obsidian vault prior to launch */
export interface ObsidianPluginConfig {
	/** customize the manifest for this plugin */
	manifest: MakeManifestInput;
	artifact: {
		/** the main javascript code that obsidian will run, will be written to the plugin's main.js file */
		code: string;
		/** the css code that obsidian will load, will be written to the plugin's style.css file */
		style?: string;
	};
	/** data to be written to the plugin's data.json file */
	data?: unknown;
	/** should the plugin be enabled initially */
	enabled?: boolean;
}

interface RunObsidianBaseConfig {
	/** override the way obsidian is launched */
	launch?: LaunchConfig;
	/** plugins to be installed within the test vault */
	plugins?: Array<ObsidianPluginConfig>;
	log?: Log;
}

export interface RunObsidianConfig extends RunObsidianBaseConfig {
	/** if provided, will force obsidian to close within the number of milliseconds */
	timeout?: number;
}

/** "picks" the events from a normal ChildProcess that the runObsidian* functions are interested in */
interface EventfulSubProcess extends BasicSubProcess {
	on(event: "close", listener: (code: number | null) => void): unknown;
	on(event: "error", listener: (err: Error) => void): unknown;
	on(event: "exit", listener: (code: number | null) => void): unknown;
	on(event: "message", listener: (message: Serializable) => void): unknown;
}

interface RunObsidianUntilConfig<T> extends RunObsidianBaseConfig {
	concurrentRun: () => T | Promise<T>;
}

/** Runs obsidian until the provided function finishes, returning the value. */
export async function runObsidianUntil<T>({
	launch = {
		vaultPath: standardTestVaultPath(),
	},
	plugins = [],
	log = standardLog(),
	concurrentRun,
	fileSystem,
	os = {
		runCommand: exec
	}
}: RunObsidianUntilConfig<T> & {
	fileSystem?: Parameters<typeof prepareObsidianPlugin>[0]["fileSystem"];
	os?: Parameters<typeof launchObsidianInVaultPath<EventfulSubProcess>>[0]["os"];
}) {
	// not using Promise.all to avoid too many open file handles at once
	for (const { manifest, artifact, data } of plugins) {
		await prepareObsidianPlugin({
			vaultPath: launch.vaultPath,
			manifest,
			artifact,
			data,
			fileSystem,
		});
	}

	const launched = await launchObsidianInVaultPath({
		...launch,
		os,
	});
	const controller = new AbortController();
	const subProcess = launched.subProcess;
	subProcess.on("message", (msg) => {
		log.info(msg.toString());
	});
	subProcess.on("error", (err) => {
		log.error(String(err));
	});

	subProcess.on("exit", (code) => {
		if (!controller.signal.aborted) {
			if (code === 127) {
				controller.abort(
					`Exit code ${code}, "${launched.cmd}" not found`
				)
			} else {
				controller.abort(
					`Obsidian exited unexpectedly` + (code === null
						? ""
						: ` with ${code}`),
				);
			}
			log.error(controller.signal.reason);
		}
		controller.abort();
	});
	subProcess.on("close", (code) => {
		if (!controller.signal.aborted) {
			controller.abort(
				`Obsidian closed unexpectedly` + (code === null
					? ""
					: ` with ${code}`),
			);
			log.error(controller.signal.reason);
		}
	});

	try {
		const returnValue = await concurrentRun();
		if (controller.signal.aborted) {
			throw (
				controller.signal.reason ??
				new Error(
					`Concurrent run finished, but obsidian was unexpectedly killed without a reason`,
				)
			);
		}
		return returnValue;
	} finally {
		controller.abort();
		await launched.kill();
	}
}
