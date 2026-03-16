#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const BUN_CMD = (() => {
	if (process.env.BUN_BIN && existsSync(process.env.BUN_BIN)) {
		return process.env.BUN_BIN;
	}
	const npmExec = process.env.npm_execpath;
	if (npmExec && npmExec.toLowerCase().includes("bun")) {
		return npmExec;
	}
	if (process.env.BUN_INSTALL) {
		const candidate = path.join(
			process.env.BUN_INSTALL,
			"bin",
			process.platform === "win32" ? "bun.exe" : "bun",
		);
		if (existsSync(candidate)) {
			return candidate;
		}
	}
	return "bun";
})();

const commands = [
	{ name: "worker", cmd: BUN_CMD, args: ["run", "dev:worker"] },
	{ name: "ui", cmd: BUN_CMD, args: ["run", "dev:ui"] },
];

const children = new Map();
let shuttingDown = false;

const shutdown = (code = 0) => {
	if (shuttingDown) {
		return;
	}
	shuttingDown = true;
	for (const child of children.values()) {
		if (!child.killed) {
			child.kill("SIGINT");
		}
	}
	process.exit(code);
};

for (const command of commands) {
	const child = spawn(command.cmd, command.args, { stdio: "inherit" });
	children.set(command.name, child);
	child.on("error", (error) => {
		if (error.code === "ENOENT") {
			console.error(
				"❌ 未找到 Bun，请确认已安装并配置 PATH，或设置 BUN_BIN 指向 bun 可执行文件。",
			);
			shutdown(1);
			return;
		}
		console.error(`❌ 启动 ${command.name} 失败: ${error.message}`);
		shutdown(1);
	});
	child.on("exit", (code) => {
		if (shuttingDown) {
			return;
		}
		if (code && code !== 0) {
			shutdown(code);
			return;
		}
		const allExited = Array.from(children.values()).every(
			(item) => item.exitCode !== null,
		);
		if (allExited) {
			shutdown(0);
		}
	});
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
