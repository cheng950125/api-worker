#!/usr/bin/env node
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const rawArgs = process.argv.slice(2);
const action = rawArgs[0]?.trim().toLowerCase() ?? "interactive";
const devArgs = rawArgs.slice(1);

const startupFileName = "api-worker-dev-autostart.cmd";
const repoRoot = process.cwd();

const quoteCmdArg = (arg) => {
	if (/[\s"]/u.test(arg)) {
		return `"${arg.replace(/"/g, '""')}"`;
	}
	return arg;
};

const resolveBunCommand = () => {
	if (process.env.BUN_BIN && existsSync(process.env.BUN_BIN)) {
		return process.env.BUN_BIN;
	}
	const npmExec = process.env.npm_execpath;
	if (npmExec?.toLowerCase().includes("bun")) {
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
};

const printUsage = () => {
	console.log("用法:");
	console.log("  bun run autostart");
	console.log(
		"  bun run autostart -- enable [dev 参数，空格分隔，例如 --no-ui --cloud-db]",
	);
	console.log("  bun run autostart -- disable");
	console.log("  bun run autostart -- status");
};

const interactiveEnableOptions = [
	{ flag: "--no-ui", label: "关闭热加载 UI" },
	{ flag: "--no-attempt-worker", label: "不启动调用执行器 attempt-worker" },
	{ flag: "--no-hot-cache", label: "禁用热缓存 KV_HOT" },
	{ flag: "--cloud-db", label: "连接云端数据库" },
];

const uiBuildModeOptions = [
	{ mode: "1", label: "构建 UI（--build-ui）", flags: ["--build-ui"] },
	{
		mode: "2",
		label: "跳过 UI 预构建（--skip-ui-build）",
		flags: ["--skip-ui-build"],
	},
];

const parseInteractiveSelection = (raw, maxIndex) => {
	const text = String(raw ?? "").trim();
	if (text.length === 0) {
		return [];
	}
	const parts = text
		.split(/[\s,，、]+/u)
		.map((item) => item.trim())
		.filter(Boolean);
	const numbers = [];
	for (const part of parts) {
		const value = Number(part);
		if (!Number.isInteger(value) || value < 1 || value > maxIndex) {
			throw new Error(
				`无效编号 "${part}"，请输入 1-${maxIndex} 之间的数字，可用空格分隔。`,
			);
		}
		if (!numbers.includes(value)) {
			numbers.push(value);
		}
	}
	return numbers;
};

const buildInteractiveEnableArgs = (selection) =>
	parseInteractiveSelection(selection, interactiveEnableOptions.length).map(
		(index) => interactiveEnableOptions[index - 1].flag,
	);

const parseUiBuildModeArgs = (selection) => {
	const mode = String(selection ?? "").trim();
	if (mode.length === 0) {
		return ["--skip-ui-build"];
	}
	const matched = uiBuildModeOptions.find((item) => item.mode === mode);
	if (!matched) {
		throw new Error("UI 预构建策略无效，请输入 1 / 2。");
	}
	return matched.flags;
};

const ensureWindows = () => {
	if (process.platform !== "win32") {
		throw new Error("当前仅支持 Windows 自启动脚本。");
	}
	if (!process.env.APPDATA) {
		throw new Error("未找到 APPDATA 环境变量，无法定位启动目录。");
	}
};

const getStartupFilePath = () => {
	ensureWindows();
	const startupDir = path.join(
		process.env.APPDATA,
		"Microsoft",
		"Windows",
		"Start Menu",
		"Programs",
		"Startup",
	);
	mkdirSync(startupDir, { recursive: true });
	return path.join(startupDir, startupFileName);
};

const renderStartupCmd = (bunCommand, args) => {
	const normalizedArgs = [
		...args.filter(Boolean).map((item) => item.trim()),
	].filter((item) => item.length > 0 && item !== "--bg");
	const finalArgs = [...normalizedArgs, "--bg"];
	const finalArgsText = finalArgs.map((item) => quoteCmdArg(item)).join(" ");
	const devCommand = `${quoteCmdArg(bunCommand)} run dev -- ${finalArgsText}`;
	return [
		"@echo off",
		"setlocal",
		`cd /d "${repoRoot}"`,
		`${devCommand}`,
		"endlocal",
		"",
	].join("\r\n");
};

const enableAutostart = (args) => {
	const startupFilePath = getStartupFilePath();
	const bunCommand = resolveBunCommand();
	writeFileSync(startupFilePath, renderStartupCmd(bunCommand, args), "utf8");
	console.log("✅ 已开启自启动。");
	console.log(`启动文件: ${startupFilePath}`);
	console.log(
		`启动参数: ${args.length > 0 ? `${args.join(" ")} --bg` : "--bg"}`,
	);
};

const disableAutostart = () => {
	const startupFilePath = getStartupFilePath();
	if (existsSync(startupFilePath)) {
		rmSync(startupFilePath);
		console.log("✅ 已关闭自启动。");
		console.log(`已删除: ${startupFilePath}`);
		return;
	}
	console.log("ℹ️ 当前未开启自启动。");
};

const showStatus = () => {
	const startupFilePath = getStartupFilePath();
	if (!existsSync(startupFilePath)) {
		console.log("ℹ️ 自启动状态：未开启。");
		return;
	}
	const content = readFileSync(startupFilePath, "utf8");
	const commandLine = content
		.split(/\r?\n/u)
		.find((line) => line.includes(" run dev -- "))
		?.trim();
	console.log("✅ 自启动状态：已开启。");
	console.log(`启动文件: ${startupFilePath}`);
	if (commandLine) {
		console.log(`命令: ${commandLine}`);
	}
};

const runInteractive = async () => {
	console.log("交互模式：自启动配置");
	showStatus();
	console.log("");
	const rl = createInterface({ input, output });
	try {
		while (true) {
			console.log("1. 开始（开启自启动）");
			console.log("2. 关闭（移除自启动）");
			console.log("3. 状态（查看当前配置）");
			console.log("0. 退出");
			const answer = (await rl.question("请选择操作编号: "))
				.trim()
				.toLowerCase();
			if (answer === "0") {
				console.log("已退出交互模式。");
				return;
			}
			if (answer === "1") {
				console.log("");
				console.log("开始自启动：请选择要附加的参数（可多选）");
				for (let i = 0; i < interactiveEnableOptions.length; i += 1) {
					const item = interactiveEnableOptions[i];
					console.log(`${i + 1}. ${item.label}: ${item.flag}`);
				}
				const selection = await rl.question(
					"输入编号（示例: 1 3；直接回车=不附加参数）: ",
				);
				const args = buildInteractiveEnableArgs(selection);
				console.log("");
				console.log("UI 预构建策略（单选）:");
				for (const option of uiBuildModeOptions) {
					console.log(`${option.mode}. ${option.label}`);
				}
				const uiBuildMode = await rl.question(
					"请选择 UI 预构建策略（默认 2）: ",
				);
				const uiBuildArgs = parseUiBuildModeArgs(uiBuildMode);
				const finalArgs = [...args, ...uiBuildArgs];
				enableAutostart(finalArgs);
				return;
			}
			if (answer === "2") {
				disableAutostart();
				return;
			}
			if (answer === "3") {
				showStatus();
				console.log("");
				continue;
			}
			console.log("输入无效，请输入 0 / 1 / 2 / 3。");
		}
	} finally {
		rl.close();
	}
};

const main = async () => {
	if (action === "interactive") {
		await runInteractive();
		return;
	}
	if (action === "help" || action === "--help" || action === "-h") {
		printUsage();
		return;
	}
	if (action === "enable") {
		enableAutostart(devArgs);
		return;
	}
	if (action === "disable") {
		disableAutostart();
		return;
	}
	if (action === "status") {
		showStatus();
		return;
	}
	printUsage();
};

try {
	await main();
} catch (error) {
	console.error(`❌ ${error.message}`);
	process.exit(1);
}
