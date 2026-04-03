#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import {
	autostartTaskName,
	backgroundLogModeOptions,
	buildInteractiveEnableArgs,
	buildLinuxAutostartUnit,
	buildTaskArguments,
	encodePowerShellCommand,
	escapeForSingleQuotedPowerShell,
	getLinuxAutostartPaths,
	interactiveEnableOptions,
	linuxAutostartServiceName,
	parseBackgroundLogModeArgs,
	parseSystemctlShowOutput,
	parseUiBuildModeArgs,
	uiBuildModeOptions,
} from "./autostart-shared.mjs";

const rawArgs = process.argv.slice(2);
const action = rawArgs[0]?.trim().toLowerCase() ?? "interactive";
const devArgs = rawArgs.slice(1);
const repoRoot = process.cwd();

const resolveBunCommand = () => {
	if (process.env.BUN_BIN && existsSync(process.env.BUN_BIN)) {
		return process.env.BUN_BIN;
	}
	const npmExec = process.env.npm_execpath;
	if (npmExec && existsSync(npmExec)) {
		const npmExecBaseName = path.basename(npmExec).toLowerCase();
		if (npmExecBaseName === "bun" || npmExecBaseName === "bun.exe") {
			return npmExec;
		}
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
	if (process.platform === "win32") {
		const whereResult = spawnSync("where.exe", ["bun"], { encoding: "utf8" });
		if (whereResult.status === 0) {
			const firstMatch = whereResult.stdout
				.split(/\r?\n/u)
				.map((item) => item.trim())
				.find(Boolean);
			if (firstMatch) {
				return firstMatch;
			}
		}
	}
	return "bun";
};

const printUsage = () => {
	console.log("用法:");
	console.log("  bun run autostart");
	console.log(
		"  bun run autostart -- enable [dev 参数，空格分隔，例如 --no-ui --remote-d1]",
	);
	console.log("  bun run autostart -- disable");
	console.log("  bun run autostart -- status");
};

const ensureWindows = () => {
	if (process.platform !== "win32") {
		throw new Error("当前不是 Windows 环境。");
	}
};

const ensureLinux = () => {
	if (process.platform !== "linux") {
		throw new Error("当前不是 Linux 环境。");
	}
};

const runCommand = (command, args, fallbackMessage, options = {}) => {
	const result = spawnSync(command, args, { encoding: "utf8" });
	if (result.error) {
		if (options.allowFailure) {
			return result;
		}
		throw result.error;
	}
	if (!options.allowFailure && result.status !== 0) {
		const errorText = result.stderr?.trim() || result.stdout?.trim();
		throw new Error(errorText || fallbackMessage);
	}
	return result;
};

const runPowerShell = (script) => {
	const encodedCommand = encodePowerShellCommand(script);
	const result = runCommand(
		"powershell.exe",
		["-NoProfile", "-NonInteractive", "-EncodedCommand", encodedCommand],
		"PowerShell 执行失败。",
	);
	return result.stdout.trim();
};

const runPowerShellJson = (script) => {
	const stdout = runPowerShell(script);
	if (!stdout) {
		return null;
	}
	return JSON.parse(stdout);
};

const runSystemctlUser = (args, options = {}) =>
	runCommand(
		"systemctl",
		["--user", ...args],
		"systemctl --user 执行失败。",
		options,
	);

const ensureLinuxSystemdUser = () => {
	ensureLinux();
	const result = runSystemctlUser(["show-environment"], { allowFailure: true });
	if (result.error?.code === "ENOENT") {
		throw new Error(
			"未找到 systemctl，当前 Linux 环境无法使用 systemd --user 自启动。",
		);
	}
	if (result.error) {
		throw result.error;
	}
	if (result.status !== 0) {
		const errorText = result.stderr?.trim() || result.stdout?.trim();
		throw new Error(
			errorText || "当前 Linux 会话未启用 systemd --user，无法配置自启动。",
		);
	}
};

const buildScheduledTaskLauncher = (args) => {
	const bunCommand = resolveBunCommand();
	const escapedBunCommand = escapeForSingleQuotedPowerShell(bunCommand);
	const escapedRepoRoot = escapeForSingleQuotedPowerShell(repoRoot);
	const argumentList = buildTaskArguments(args)
		.map((item) => `'${escapeForSingleQuotedPowerShell(item)}'`)
		.join(", ");
	const hiddenLauncherScript = [
		"$ErrorActionPreference = 'Stop'",
		`Start-Process -FilePath '${escapedBunCommand}' -ArgumentList @(${argumentList}) -WorkingDirectory '${escapedRepoRoot}' -WindowStyle Hidden`,
	].join("\n");

	return {
		execute: "powershell.exe",
		arguments: `-NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand ${encodePowerShellCommand(hiddenLauncherScript)}`,
	};
};

const getWindowsAutostartInfo = () => {
	ensureWindows();
	const taskName = escapeForSingleQuotedPowerShell(autostartTaskName);
	return runPowerShellJson(`
$ErrorActionPreference = 'Stop'
$task = Get-ScheduledTask -TaskName '${taskName}' -ErrorAction SilentlyContinue
if ($null -eq $task) {
  [pscustomobject]@{
    enabled = $false
  } | ConvertTo-Json -Compress
  return
}
$action = $task.Actions | Select-Object -First 1
[pscustomobject]@{
  enabled = $true
  taskName = $task.TaskName
  state = [string]$task.State
  execute = $action.Execute
  arguments = $action.Arguments
  workingDirectory = $action.WorkingDirectory
} | ConvertTo-Json -Compress
`);
};

const enableWindowsAutostart = (args) => {
	ensureWindows();
	const escapedTaskName = escapeForSingleQuotedPowerShell(autostartTaskName);
	const launcher = buildScheduledTaskLauncher(args);
	const escapedExecute = escapeForSingleQuotedPowerShell(launcher.execute);
	const escapedArguments = escapeForSingleQuotedPowerShell(launcher.arguments);
	const escapedRepoRoot = escapeForSingleQuotedPowerShell(repoRoot);

	const result = runPowerShellJson(`
$ErrorActionPreference = 'Stop'
$userId = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction -Execute '${escapedExecute}' -Argument '${escapedArguments}' -WorkingDirectory '${escapedRepoRoot}'
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName '${escapedTaskName}' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'api-worker 开发服务自启动' -Force | Out-Null
[pscustomobject]@{
  taskName = '${escapedTaskName}'
  execute = $action.Execute
  arguments = $action.Arguments
  workingDirectory = $action.WorkingDirectory
} | ConvertTo-Json -Compress
`);

	console.log("✅ 已开启自启动。");
	console.log(`计划任务: ${result.taskName}`);
	console.log(`程序: ${result.execute}（隐藏启动器）`);
	console.log(`参数: ${result.arguments}`);
	console.log(`工作目录: ${result.workingDirectory}`);
};

const disableWindowsAutostart = () => {
	ensureWindows();
	const taskName = escapeForSingleQuotedPowerShell(autostartTaskName);
	const result = runPowerShellJson(`
$ErrorActionPreference = 'Stop'
$task = Get-ScheduledTask -TaskName '${taskName}' -ErrorAction SilentlyContinue
if ($null -eq $task) {
  [pscustomobject]@{ removed = $false } | ConvertTo-Json -Compress
  return
}
Unregister-ScheduledTask -TaskName '${taskName}' -Confirm:$false
[pscustomobject]@{ removed = $true } | ConvertTo-Json -Compress
`);
	if (result?.removed) {
		console.log("✅ 已关闭自启动。");
		console.log(`已删除计划任务: ${autostartTaskName}`);
		return;
	}
	console.log("ℹ️ 当前未开启自启动。");
};

const printWindowsAutostartStatus = () => {
	const task = getWindowsAutostartInfo();
	if (!task?.enabled) {
		console.log("ℹ️ 自启动状态：未开启。");
		return;
	}
	console.log("✅ 自启动状态：已开启。");
	console.log(`计划任务: ${task.taskName}`);
	console.log(`任务状态: ${task.state}`);
	console.log(`程序: ${task.execute}`);
	console.log(`参数: ${task.arguments}`);
	console.log(`工作目录: ${task.workingDirectory}`);
};

const getLinuxAutostartInfo = () => {
	ensureLinuxSystemdUser();
	const { servicePath } = getLinuxAutostartPaths(homedir());
	if (!existsSync(servicePath)) {
		return {
			enabled: false,
			installed: false,
			serviceName: linuxAutostartServiceName,
			servicePath,
		};
	}

	const result = runSystemctlUser(
		[
			"show",
			linuxAutostartServiceName,
			"--no-pager",
			"--property=LoadState,UnitFileState,ActiveState,SubState,FragmentPath",
		],
		{ allowFailure: true },
	);
	if (result.error) {
		throw result.error;
	}

	const details = parseSystemctlShowOutput(result.stdout);
	const unitFileState = details.UnitFileState ?? "unknown";
	return {
		enabled: unitFileState.startsWith("enabled"),
		installed: true,
		serviceName: linuxAutostartServiceName,
		servicePath,
		unitFileState,
		activeState: details.ActiveState ?? "unknown",
		subState: details.SubState ?? "unknown",
		fragmentPath: details.FragmentPath || servicePath,
	};
};

const enableLinuxAutostart = (args) => {
	ensureLinuxSystemdUser();
	const { userUnitDir, servicePath } = getLinuxAutostartPaths(homedir());
	mkdirSync(userUnitDir, { recursive: true });

	const bunCommand = resolveBunCommand();
	writeFileSync(
		servicePath,
		buildLinuxAutostartUnit({ bunCommand, repoRoot, args }),
		"utf8",
	);

	runSystemctlUser(["daemon-reload"]);
	runSystemctlUser(["enable", "--now", linuxAutostartServiceName]);

	console.log("✅ 已开启自启动。");
	console.log(`systemd 用户服务: ${linuxAutostartServiceName}`);
	console.log(`服务文件: ${servicePath}`);
	console.log(`工作目录: ${repoRoot}`);
	console.log(`命令: ${[bunCommand, ...buildTaskArguments(args)].join(" ")}`);
};

const disableLinuxAutostart = () => {
	ensureLinuxSystemdUser();
	const { servicePath } = getLinuxAutostartPaths(homedir());
	const existed = existsSync(servicePath);
	const disableResult = runSystemctlUser(
		["disable", "--now", linuxAutostartServiceName],
		{ allowFailure: true },
	);

	if (existsSync(servicePath)) {
		rmSync(servicePath, { force: true });
	}

	runSystemctlUser(["daemon-reload"]);
	runSystemctlUser(["reset-failed", linuxAutostartServiceName], {
		allowFailure: true,
	});

	if (existed || disableResult.status === 0) {
		console.log("✅ 已关闭自启动。");
		console.log(`已移除 systemd 用户服务: ${linuxAutostartServiceName}`);
		return;
	}
	console.log("ℹ️ 当前未开启自启动。");
};

const printLinuxAutostartStatus = () => {
	const service = getLinuxAutostartInfo();
	if (!service.installed) {
		console.log("ℹ️ 自启动状态：未开启。");
		console.log(`服务文件: ${service.servicePath}`);
		return;
	}

	if (service.enabled) {
		console.log("✅ 自启动状态：已开启。");
	} else {
		console.log("ℹ️ 自启动状态：已安装但未启用。");
	}
	console.log(`systemd 用户服务: ${service.serviceName}`);
	console.log(`启用状态: ${service.unitFileState}`);
	console.log(`当前状态: ${service.activeState}/${service.subState}`);
	console.log(`服务文件: ${service.fragmentPath}`);
};

const enableAutostart = (args) => {
	if (process.platform === "win32") {
		enableWindowsAutostart(args);
		return;
	}
	if (process.platform === "linux") {
		enableLinuxAutostart(args);
		return;
	}
	throw new Error(
		"当前仅支持 Windows 计划任务或 Linux systemd --user 自启动。",
	);
};

const disableAutostart = () => {
	if (process.platform === "win32") {
		disableWindowsAutostart();
		return;
	}
	if (process.platform === "linux") {
		disableLinuxAutostart();
		return;
	}
	throw new Error(
		"当前仅支持 Windows 计划任务或 Linux systemd --user 自启动。",
	);
};

const showStatus = () => {
	if (process.platform === "win32") {
		printWindowsAutostartStatus();
		return;
	}
	if (process.platform === "linux") {
		printLinuxAutostartStatus();
		return;
	}
	throw new Error(
		"当前仅支持 Windows 计划任务或 Linux systemd --user 自启动。",
	);
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
				console.log("");
				console.log("后台日志策略（单选）:");
				for (const option of backgroundLogModeOptions) {
					console.log(`${option.mode}. ${option.label}`);
				}
				const logMode = await rl.question("请选择后台日志策略（默认 1）: ");
				enableAutostart([
					...args,
					...uiBuildArgs,
					...parseBackgroundLogModeArgs(logMode),
				]);
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
