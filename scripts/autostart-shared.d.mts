export const autostartTaskName: string;
export const linuxAutostartServiceName: string;

export const interactiveEnableOptions: Array<{
	flag: string;
	label: string;
}>;

export const uiBuildModeOptions: Array<{
	mode: string;
	label: string;
	flags: string[];
}>;

export const backgroundLogModeOptions: Array<{
	mode: string;
	label: string;
	flags: string[];
}>;

export function escapeForSingleQuotedPowerShell(value: unknown): string;
export function normalizeDevArgs(args: string[]): string[];
export function buildTaskArguments(args: string[]): string[];
export function encodePowerShellCommand(script: string): string;
export function parseInteractiveSelection(
	raw: unknown,
	maxIndex: number,
): number[];
export function buildInteractiveEnableArgs(selection: unknown): string[];
export function parseUiBuildModeArgs(selection: unknown): string[];
export function parseBackgroundLogModeArgs(selection: unknown): string[];
export function quoteSystemdArgument(arg: unknown): string;
export function buildLinuxAutostartUnit(input: {
	bunCommand: string;
	repoRoot: string;
	args: string[];
}): string;
export function parseSystemctlShowOutput(text: unknown): Record<string, string>;
export function getLinuxAutostartPaths(homeDirectory: string): {
	userUnitDir: string;
	servicePath: string;
};
