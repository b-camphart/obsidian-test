import { execSync } from "child_process";
import { readFileSync } from "fs";
import path from "path";

/**
 * @param {string} packageName 
 */
export function latestPackageVersion(packageName: string) {
	const output = execSync(`npm view ${packageName} version`)
	return output.toString("utf8")
}

type PackageJSON = object;

export function resolvePackage(): PackageJSON {
	const packagePath = path.join(process.cwd(), "package.json");
	try {
		const content = readFileSync(packagePath, "utf8");
		const pkg = JSON.parse(content);
		if (pkg === null || typeof pkg !== "object") {
			throw new Error(`Package.json is not of expected shape`)
		}
		return pkg;
	} catch (e) {
		throw new Error(`Could not read package at ${packagePath}`, { cause: e });
	}
}

function resolveStringFieldFromPackage(field: string, pkg?: PackageJSON): string {
	pkg = pkg ?? resolvePackage();
	if (!(field in pkg)) {
		throw new Error(`'${field}' does not exist in package.json object`)
	}
	const value = pkg[field as keyof typeof pkg];
	if (typeof value !== "string") {
		throw new Error(`'${field}' field of package.json is not a string`)
	}
	return value;
}

function resolveStringFieldFromPackageOrNull(field: string, pkg?: PackageJSON): string | null {
	pkg = pkg ?? resolvePackage();
	if (!(field in pkg)) {
		return null
	}
	const value = pkg[field as keyof typeof pkg];
	if (typeof value !== "string") {
		return null
	}
	return value;
}

export function resolvePackageName(pkg?: PackageJSON): string {
	if (process.env['npm_package_name']) {
		return process.env['npm_package_name'];
	}

	try {
		return resolveStringFieldFromPackage("name", pkg);
	} catch (e) {
		throw new Error(`Could not resolve package name.`, {
			cause: e,
		})
	}
}

export function resolvePackageVersion(pkg?: PackageJSON): string {
	if (process.env['npm_package_version']) {
		return process.env['npm_package_version'];
	}

	try {
		return resolveStringFieldFromPackage("version", pkg);
	} catch (e) {
		throw new Error(`Could not resolve package version.`, {
			cause: e,
		})
	}
}

export function resolvePackageDescriptionOrNull(pkg?: PackageJSON) {
	return resolveStringFieldFromPackageOrNull("description", pkg);
}
