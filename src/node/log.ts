import type { TestContext } from "node:test";

export type InfoLog = {
	info(line: string): void;
}

export type ErrorLog = {
	error(line: string): void;
}

export type Log = InfoLog & ErrorLog & {
	write(chunk: string): void;
};

let _standardLog: Log | null = null;
/** a `Log` that writes to stdout and stderr without any filtering or prefixing */
export function standardLog(): Log {
	if (_standardLog === null) {
		_standardLog = {
			info: (line) => process.stdout.write(line + "\n"),
			write: (chunk) => process.stdout.write(chunk),
			error: (line) => process.stderr.write(line),
		};
	}

	return _standardLog;
}

export function subLog({
	parent: log,
	prefix = "",
}: {
	parent: Log,
	prefix?: string,
}): Log {
	if (!prefix.endsWith(" ") && !prefix.endsWith("\n") && !prefix.endsWith("\t")) {
		prefix = prefix + " ";
	}

	return {
		info: (line) => log.info(`${prefix}${line}`),
		error: (line) => log.error(`${prefix}${line}`),
		write: (chunk) => log.write(chunk),
	}
}

export function testLog(t: TestContext): Log {
	let buffer = "";
	t.after(() => {
		if (buffer !== "") {
			t.diagnostic(buffer);
		}
	})
	return {
		info: (line) => {
			if (buffer !== "") {
				t.diagnostic(buffer);
				buffer = "";
			}
			t.diagnostic(`[info] ${line}`)
		},
		error: (line) => {
			if (buffer !== "") {
				t.diagnostic(buffer);
				buffer = "";
			}
			t.diagnostic(`[error] ${line}`)
		},
		write: (chunk) => {
			buffer += chunk;
		},
	}
}
