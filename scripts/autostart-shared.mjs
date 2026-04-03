import path from "node:path";

export const autostartTaskName = "api-worker-dev-autostart";
export const linuxAutostartServiceName = `${autostartTaskName}.service`;

export const interactiveEnableOptions = [
	{ flag: "--no-ui", label: "关闭热加载 UI" },
	{ flag: "--no-attempt-worker", label: "不启动调用执行器 attempt-worker" },
	{ flag: "--no-hot-cache", label: "禁用热缓存 KV_HOT" },
	{ flag: "--remote-d1", label: "连接云端 D1/KV（执行仍在本地）" },
	{ flag: "--remote-worker", label: "主 worker / attempt-worker 走远端预览" },
];

export const uiBuildModeOptions = [
	{ mode: "1", label: "构建 UI（--build-ui）", flags: ["--build-ui"] },
	{
		mode: "2",
		label: "跳过 UI 预构建（--skip-ui-build）",
		flags: ["--skip-ui-build"],
	},
];

export const backgroundLogModeOptions = [
	{ mode: "1", label: "写入日志文件（默认）", flags: [] },
	{
		mode: "2",
		label: "关闭后台日志（--log-mode none）",
		flags: ["--log-mode", "none"],
	},
];

export const escapeForSingleQuotedPowerShell = (value) =>
	String(value).replace(/'/g, "''");

export const normalizeDevArgs = (args) =>
	args
		.filter(Boolean)
		.map((item) => item.trim())
		.filter((item) => item.length > 0 && item !== "--bg");

export const buildTaskArguments = (args) => {
	const normalizedArgs = normalizeDevArgs(args);
	return ["run", "dev", "--", ...normalizedArgs, "--bg"];
};

export const encodePowerShellCommand = (script) =>
	Buffer.from(script, "utf16le").toString("base64");

export const parseInteractiveSelection = (raw, maxIndex) => {
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

export const buildInteractiveEnableArgs = (selection) =>
	parseInteractiveSelection(selection, interactiveEnableOptions.length).map(
		(index) => interactiveEnableOptions[index - 1].flag,
	);

export const parseUiBuildModeArgs = (selection) => {
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

export const parseBackgroundLogModeArgs = (selection) => {
	const mode = String(selection ?? "").trim();
	if (mode.length === 0) {
		return [];
	}
	const matched = backgroundLogModeOptions.find((item) => item.mode === mode);
	if (!matched) {
		throw new Error("后台日志策略无效，请输入 1 / 2。");
	}
	return matched.flags;
};

export const quoteSystemdArgument = (arg) => {
	const text = String(arg);
	if (text.length === 0) {
		return '""';
	}
	if (/^[A-Za-z0-9_@%+=:,./-]+$/u.test(text)) {
		return text;
	}
	return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
};

export const buildLinuxAutostartUnit = ({ bunCommand, repoRoot, args }) => {
	const command = [bunCommand, ...buildTaskArguments(args)]
		.map((item) => quoteSystemdArgument(item))
		.join(" ");

	return [
		"[Unit]",
		"Description=api-worker 开发服务自启动",
		"After=default.target",
		"",
		"[Service]",
		"Type=simple",
		`WorkingDirectory=${quoteSystemdArgument(repoRoot)}`,
		`ExecStart=${command}`,
		"Restart=on-failure",
		"RestartSec=3",
		"",
		"[Install]",
		"WantedBy=default.target",
		"",
	].join("\n");
};

export const parseSystemctlShowOutput = (text) =>
	String(text)
		.split(/\r?\n/u)
		.map((line) => line.trim())
		.filter(Boolean)
		.reduce((result, line) => {
			const [key, ...rest] = line.split("=");
			if (key) {
				result[key] = rest.join("=");
			}
			return result;
		}, {});

export const getLinuxAutostartPaths = (homeDirectory) => {
	const userUnitDir = path.join(homeDirectory, ".config", "systemd", "user");
	return {
		userUnitDir,
		servicePath: path.join(userUnitDir, linuxAutostartServiceName),
	};
};
