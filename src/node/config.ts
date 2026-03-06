import type { TestConfig } from "./run.ts";

type Awaitable<T> = T | PromiseLike<T>;

export function onConfigResolved(fn: (config: TestConfig) => Awaitable<void | TestConfig>) {
	configResolvedFns.push(fn);
}

// deriving so `onConfigResolved` docs will show full signature, not this type
type ConfigResolvedFn = Parameters<typeof onConfigResolved>[0];

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
