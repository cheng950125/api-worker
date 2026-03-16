import type { D1Database } from "@cloudflare/workers-types";
import type { Bindings } from "../env";
import { nowIso } from "../utils/time";

const DEFAULT_LOG_RETENTION_DAYS = 30;
const DEFAULT_SESSION_TTL_HOURS = 12;
const DEFAULT_CHECKIN_SCHEDULE_TIME = "00:10";
const DEFAULT_MODEL_FAILURE_COOLDOWN_MINUTES = 10;
const DEFAULT_PROXY_STREAM_USAGE_MODE = "full";
const DEFAULT_PROXY_STREAM_USAGE_MAX_BYTES = 0;
const DEFAULT_PROXY_STREAM_USAGE_MAX_PARSERS = 0;
const RETENTION_KEY = "log_retention_days";
const SESSION_TTL_KEY = "session_ttl_hours";
const ADMIN_PASSWORD_HASH_KEY = "admin_password_hash";
const CHECKIN_SCHEDULE_TIME_KEY = "checkin_schedule_time";
const MODEL_FAILURE_COOLDOWN_KEY = "model_failure_cooldown_minutes";

export type RuntimeProxyConfig = {
	stream_usage_mode: string;
	stream_usage_max_bytes: number;
	stream_usage_max_parsers: number;
	usage_queue_enabled: boolean;
	usage_queue_bound: boolean;
	usage_queue_active: boolean;
};

async function readSetting(
	db: D1Database,
	key: string,
): Promise<string | null> {
	const setting = await db
		.prepare("SELECT value FROM settings WHERE key = ?")
		.bind(key)
		.first<{ value?: string }>();
	return setting?.value ? String(setting.value) : null;
}

async function upsertSetting(
	db: D1Database,
	key: string,
	value: string,
): Promise<void> {
	await db
		.prepare(
			"INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
		)
		.bind(key, value, nowIso())
		.run();
}

function parsePositiveNumber(value: string | null, fallback: number): number {
	if (!value) {
		return fallback;
	}
	const parsed = Number(value);
	if (!Number.isNaN(parsed) && parsed > 0) {
		return parsed;
	}
	return fallback;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
	if (!value) {
		return fallback;
	}
	const parsed = Number(value);
	if (!Number.isNaN(parsed) && parsed > 0) {
		return Math.floor(parsed);
	}
	return fallback;
}

function parseNonNegativeInt(value: string | undefined, fallback: number): number {
	if (value === undefined || value === null || value === "") {
		return fallback;
	}
	const parsed = Number(value);
	if (!Number.isNaN(parsed) && parsed >= 0) {
		return Math.floor(parsed);
	}
	return fallback;
}

function normalizeStreamUsageMode(value: string | undefined): string {
	const normalized = (value ?? "").toLowerCase();
	if (normalized === "off" || normalized === "full" || normalized === "lite") {
		return normalized;
	}
	return DEFAULT_PROXY_STREAM_USAGE_MODE;
}

/**
 * Returns runtime proxy configuration derived from environment variables.
 *
 * @param env - Worker bindings.
 * @returns Runtime proxy configuration for display.
 */
export function getRuntimeProxyConfig(env: Bindings): RuntimeProxyConfig {
	const usageQueueEnabled = env.PROXY_USAGE_QUEUE_ENABLED !== "false";
	const usageQueueBound = Boolean(env.USAGE_QUEUE);
	return {
		stream_usage_mode: normalizeStreamUsageMode(env.PROXY_STREAM_USAGE_MODE),
		stream_usage_max_bytes: parseNonNegativeInt(
			env.PROXY_STREAM_USAGE_MAX_BYTES,
			DEFAULT_PROXY_STREAM_USAGE_MAX_BYTES,
		),
		stream_usage_max_parsers: parseNonNegativeInt(
			env.PROXY_STREAM_USAGE_MAX_PARSERS,
			DEFAULT_PROXY_STREAM_USAGE_MAX_PARSERS,
		),
		usage_queue_enabled: usageQueueEnabled,
		usage_queue_bound: usageQueueBound,
		usage_queue_active: usageQueueEnabled && usageQueueBound,
	};
}

/**
 * Returns the log retention days from settings or default fallback.
 */
export async function getRetentionDays(db: D1Database): Promise<number> {
	const value = await readSetting(db, RETENTION_KEY);
	return parsePositiveNumber(value, DEFAULT_LOG_RETENTION_DAYS);
}

/**
 * Updates the log retention days setting.
 */
export async function setRetentionDays(
	db: D1Database,
	days: number,
): Promise<void> {
	const value = Math.max(1, Math.floor(days)).toString();
	await upsertSetting(db, RETENTION_KEY, value);
}

/**
 * Returns the session TTL hours from settings or default fallback.
 */
export async function getSessionTtlHours(db: D1Database): Promise<number> {
	const value = await readSetting(db, SESSION_TTL_KEY);
	return parsePositiveNumber(value, DEFAULT_SESSION_TTL_HOURS);
}

/**
 * Updates the session TTL hours setting.
 */
export async function setSessionTtlHours(
	db: D1Database,
	hours: number,
): Promise<void> {
	const value = Math.max(1, Math.floor(hours)).toString();
	await upsertSetting(db, SESSION_TTL_KEY, value);
}

/**
 * Returns the admin password hash.
 */
export async function getAdminPasswordHash(
	db: D1Database,
): Promise<string | null> {
	return readSetting(db, ADMIN_PASSWORD_HASH_KEY);
}

/**
 * Updates the admin password hash.
 */
export async function setAdminPasswordHash(
	db: D1Database,
	hash: string,
): Promise<void> {
	if (!hash) {
		return;
	}
	await upsertSetting(db, ADMIN_PASSWORD_HASH_KEY, hash);
}

/**
 * Returns whether the admin password is set.
 */
export async function isAdminPasswordSet(db: D1Database): Promise<boolean> {
	const hash = await getAdminPasswordHash(db);
	return Boolean(hash);
}

export async function getCheckinScheduleTime(db: D1Database): Promise<string> {
	const timeRaw = await readSetting(db, CHECKIN_SCHEDULE_TIME_KEY);
	return timeRaw && timeRaw.length > 0
		? timeRaw
		: DEFAULT_CHECKIN_SCHEDULE_TIME;
}

export async function setCheckinScheduleTime(
	db: D1Database,
	time: string,
): Promise<void> {
	await upsertSetting(db, CHECKIN_SCHEDULE_TIME_KEY, time);
}

export async function getModelFailureCooldownMinutes(
	db: D1Database,
): Promise<number> {
	const value = await readSetting(db, MODEL_FAILURE_COOLDOWN_KEY);
	return parsePositiveNumber(value, DEFAULT_MODEL_FAILURE_COOLDOWN_MINUTES);
}

export async function setModelFailureCooldownMinutes(
	db: D1Database,
	minutes: number,
): Promise<void> {
	const value = Math.max(1, Math.floor(minutes)).toString();
	await upsertSetting(db, MODEL_FAILURE_COOLDOWN_KEY, value);
}

/**
 * Loads generic settings as a key/value map.
 */
export async function listSettings(
	db: D1Database,
): Promise<Record<string, string>> {
	const result = await db.prepare("SELECT key, value FROM settings").all();
	const map: Record<string, string> = {};
	for (const row of result.results ?? []) {
		map[String(row.key)] = String(row.value);
	}
	return map;
}
