import { run as run_tests } from "node:test";
import { inspect } from "util";

import { run as run_embeds, type EmbeddedContext } from "../embedded.js";
import type * as runner from "./dynamic.js";
import { Socket } from "net";
import { encodeExitCode } from "../../io.js";
import {
	Notice,
	type App } from "obsidian";
import { spec } from "node:test/reporters";
import { Writable } from "stream";

function testRunner(ctx: EmbeddedContext, app: App) {

	process.env.FORCE_COLOR = "1";

	return new Promise<string>(resolve => {
		run_tests({
			files: [],
			isolation: "none",
			setup: async (stream) => {
				const console_log = console.log;
				console.log = ctx.log;

				const tests = new Map<string, "running" | "passed" | "failed">();
				const checkCompleted = () => {
					if (tests.values().every(status => status !== "running")) {
						// trick node:test into exiting
						process.emit("beforeExit",
							tests.values().every(status => status === "passed") ? 0 : 1
						);
					}
				}

				let completionTimeout: undefined | NodeJS.Timeout;
				stream.on("test:start", (test) => {
					tests.set(test.name, "running");
				});
				stream.on("test:pass", test => {
					tests.set(test.name, "passed");
					clearTimeout(completionTimeout);
					completionTimeout = setTimeout(checkCompleted, 100);
				});
				stream.on("test:fail", test => {
					tests.set(test.name, "failed");
					clearTimeout(completionTimeout);
					completionTimeout = setTimeout(checkCompleted, 100);
				});

				stream.on("test:summary", (summary) => {
					new Notice(`Tests completed.\n` +
						`${summary.counts.tests} tests found.\n` +
						`${summary.counts.passed} tests passed.\n` +
						`${summary.counts.tests - summary.counts.passed} tests failed.`)

					setTimeout(() => {
						console.log = console_log;
						resolve(encodeExitCode(summary.success ? "0" : "1"));
					}, 100);
				});

				stream.compose(spec).pipe(new Writable({
					write(chunk, _encoding, callback) {
						if (chunk instanceof Buffer) {
							ctx.log(chunk.toString("utf8"))
						}
						callback();
					}
				}))

				await run_embeds(ctx, app);
			},
		});
	})
}

export const run: typeof runner.run = (app, portOrAddress) => {
	const socket = new Socket();
	socket.once("error", (e) => {
		console.error(
			new Error("could not connect to external socket", {
				cause: e,
			}),
		);
		testRunner({
			log: console.log,
		}, app);
	});

	async function onSocketConnected() {
		const endMessage = await testRunner({
			log: (...args) => {
				let msg = args
					.map((arg) => {
						if (typeof arg === "string") {
							return arg;
						} else {
							return inspect(arg);
						}
					})
					.join(" ");
				if (!msg.endsWith("\n")) {
					msg += "\n";
				}
				socket.write(msg);
			}
		}, app);
		socket.end(endMessage);
	}

	if (typeof portOrAddress === "string") {
		socket.connect(portOrAddress, onSocketConnected);
	} else {
		socket.connect({ port: portOrAddress }, onSocketConnected);
	}
}




