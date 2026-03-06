export {
	runTest,
	forceRunTest,
} from "./run.js";

export { onConfigResolved } from "./config.ts";

export {
	buildTestArtifact
} from "./build.js";

export {
	runObsidian,
	runObsidianUntil,
	standardDataPath,
	standardPluginPath,
	standardPluginsPath,
	standardManifestPath,
	standardMainFilePath,
	standardPluginStylePath,
	standardTestVaultPath,
	standardCommunityPluginsJsonPath,
	writeManifest,
	writeDataJSON,
	writePluginStyles,
	writePluginMainFile,
	makeManifest,
	prepareObsidianPlugin,
	enablePlugin,
} from "./obsidian.js";

export {
	resolvePackage,
	resolvePackageName,
	resolvePackageVersion,
	resolvePackageDescriptionOrNull,
} from "./npm.ts"

export type { MakeManifestInput, LaunchConfig } from "./obsidian.js"
