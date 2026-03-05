export function encodeExitCode(code: "1" | "0") {
	return `\nEXIT_CODE::${code}`
}

export function parseExitCodeOrNull(line: string, onFail?: (e: unknown) => void) {
	try {
		parseExitCodeOrThrow(line);
	} catch (e) {
		onFail?.(e);
		return null
	}
}

export function parseExitCodeOrThrow(line: string) {
	const prefix = "EXIT_CODE::";
	if (!line.startsWith(prefix)) {
		throw new Error(`Line does not match expected pattern "${prefix}<number>", found "${line}"`);
	}

	// NaN if unparsable
	const int = parseInt(line.slice(prefix.length));
	if (int !== 0 && int !== 1) {
		throw new Error(`Exit code was not 0 or 1: ${int}`);
	}

	return int;
}
