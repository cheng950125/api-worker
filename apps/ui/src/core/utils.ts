import type { UsageLog } from "./types";

/**
 * Formats a datetime string for display.
 *
 * Args:
 *   value: ISO datetime string or nullable value.
 *
 * Returns:
 *   A human-friendly datetime string or "-".
 */
const pad2 = (value: number) => String(value).padStart(2, "0");

export const formatDateTime = (value?: string | null) => {
	if (!value) {
		return "-";
	}
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "-";
	}
	return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
		date.getDate(),
	)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(
		date.getSeconds(),
	)}`;
};

const formatInTimeZone = (
	value: string | null | undefined,
	timeZone: string,
	parts: Array<"year" | "month" | "day" | "hour" | "minute" | "second">,
	separator: { date: string },
): string => {
	if (!value) {
		return "-";
	}
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "-";
	}
	const formatter = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	});
	const dateParts = formatter.formatToParts(date);
	const pick = (type: string) =>
		dateParts.find((part) => part.type === type)?.value ?? "00";
	const dateText = `${pick("year")}-${pick("month")}-${pick("day")}`;
	const timeText = parts.includes("second")
		? `${pick("hour")}:${pick("minute")}:${pick("second")}`
		: `${pick("hour")}:${pick("minute")}`;
	return `${dateText}${separator.date}${timeText}`.trim();
};

export const formatChinaDateTime = (value?: string | null) =>
	formatInTimeZone(
		value,
		"Asia/Shanghai",
		["year", "month", "day", "hour", "minute", "second"],
		{ date: " " },
	);

export const toChinaDateTimeInput = (value?: string | null) => {
	if (!value) {
		return "";
	}
	const formatted = formatInTimeZone(
		value,
		"Asia/Shanghai",
		["year", "month", "day", "hour", "minute"],
		{ date: "T" },
	);
	return formatted === "-" ? "" : formatted;
};

export const toChinaIsoFromInput = (value?: string | null) => {
	if (!value) {
		return null;
	}
	const raw = value.trim();
	if (!raw) {
		return null;
	}
	const [datePart, timePart] = raw.split("T");
	if (!datePart || !timePart) {
		return null;
	}
	const [year, month, day] = datePart.split("-").map(Number);
	const [hour, minute] = timePart.split(":").map(Number);
	if (
		Number.isNaN(year) ||
		Number.isNaN(month) ||
		Number.isNaN(day) ||
		Number.isNaN(hour) ||
		Number.isNaN(minute)
	) {
		return null;
	}
	const utcMillis = Date.UTC(year, month - 1, day, hour - 8, minute);
	return new Date(utcMillis).toISOString();
};

/**
 * Toggles channel or token status between active and disabled.
 *
 * Args:
 *   value: Current status value.
 *
 * Returns:
 *   Next status value.
 */
export const toggleStatus = (value: string) =>
	value === "active" ? "disabled" : "active";

/**
 * Returns Beijing date string (YYYY-MM-DD).
 *
 * Args:
 *   date: Optional date value.
 *
 * Returns:
 *   Beijing date string.
 */
export const getBeijingDateString = (date: Date = new Date()) => {
	const formatter = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Shanghai",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	return formatter.format(date);
};

export type PageItem = number | "ellipsis";

export const buildPageItems = (current: number, total: number): PageItem[] => {
	if (total <= 6) {
		return Array.from({ length: total }, (_, index) => index + 1);
	}
	const items: PageItem[] = [1, 2, 3];
	if (current > 3 && current < total - 1) {
		items.push("ellipsis", current);
	}
	items.push("ellipsis", total - 1, total);
	return items.filter((item, index, array) => {
		if (item === "ellipsis" && array[index - 1] === "ellipsis") {
			return false;
		}
		if (typeof item === "number") {
			return array.indexOf(item) === index;
		}
		return true;
	});
};

export type UsageStatusDetail = {
	label: string;
	tone: "success" | "warning" | "danger" | "default";
};

export const buildUsageStatusDetail = (log: UsageLog): UsageStatusDetail => {
	const statusCode = log.upstream_status ?? null;
	const tone =
		log.status === "warn"
			? "warning"
			: log.status === "ok" && !log.error_code
				? "success"
				: log.error_code
					? "danger"
					: "default";
	if (statusCode !== null && statusCode !== undefined) {
		return {
			label: String(statusCode),
			tone,
		};
	}
	return {
		label: log.status === "warn" ? "告警" : "未知",
		tone,
	};
};

export const loadColumnPrefs = (
	storageKey: string,
	defaults: string[],
): string[] => {
	if (typeof window === "undefined") {
		return defaults;
	}
	try {
		const raw = window.localStorage.getItem(storageKey);
		if (!raw) {
			return defaults;
		}
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) {
			return defaults;
		}
		const set = new Set(parsed.filter((item) => typeof item === "string"));
		const ordered = defaults.filter((id) => set.has(id));
		return ordered.length > 0 ? ordered : defaults;
	} catch (_error) {
		return defaults;
	}
};

export const persistColumnPrefs = (storageKey: string, next: string[]) => {
	if (typeof window === "undefined") {
		return;
	}
	window.localStorage.setItem(storageKey, JSON.stringify(next));
};

export const loadPageSizePref = (
	storageKey: string,
	fallback: number,
): number => {
	if (typeof window === "undefined") {
		return fallback;
	}
	try {
		const raw = window.localStorage.getItem(storageKey);
		if (!raw) {
			return fallback;
		}
		const value = Number(raw);
		if (Number.isNaN(value) || value <= 0) {
			return fallback;
		}
		return value;
	} catch (_error) {
		return fallback;
	}
};

export const persistPageSizePref = (storageKey: string, value: number) => {
	if (typeof window === "undefined") {
		return;
	}
	window.localStorage.setItem(storageKey, String(value));
};
