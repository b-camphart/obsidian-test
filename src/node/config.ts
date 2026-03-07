import type { TestConfig } from "./run.ts";

type Awaitable<T> = T | PromiseLike<T>;


/**
 * Allows a setup script to extend the test configuration.
 *
 * This hook is only executed when running the CLI. It is not used when calling
 * `runTest()` programmatically.
 *
 * Registered functions will be executed in order before the test run begins.
 * Each function receives the current config and may either mutate it or return
 * a new config object. Functions may be async.
 */
export function extendTestConfig(fn: (config: TestConfig) => Awaitable<void | TestConfig>) {
	configResolvedFns.push(fn);
}

// deriving so function docs will show full signature, not this type
type ConfigResolvedFn = Parameters<typeof extendTestConfig>[0];

const configResolvedFns: Array<ConfigResolvedFn> = [];

export async function resolveConfig(config: TestConfig) {
	for (const fn of configResolvedFns) {
		const newConfig = await fn(config);
		if (newConfig) {
			config = newConfig;
		}
	}
	return config;
}
