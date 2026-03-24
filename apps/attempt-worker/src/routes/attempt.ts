import { Hono } from "hono";
import type { AppEnv } from "../env";

const ATTEMPT_RESPONSE_PATH_HEADER = "x-ha-attempt-response-path";
const ATTEMPT_LATENCY_HEADER = "x-ha-attempt-latency-ms";
const ATTEMPT_UPSTREAM_REQUEST_ID_HEADER = "x-ha-attempt-upstream-request-id";
const ATTEMPT_ERROR_CODE_HEADER = "x-ha-attempt-error-code";
const DISPATCH_ATTEMPT_INDEX_HEADER = "x-ha-dispatch-attempt-index";
const DISPATCH_CHANNEL_ID_HEADER = "x-ha-dispatch-channel-id";
const STREAM_OPTIONS_UNSUPPORTED_SNIPPET = "unsupported parameter";
const STREAM_OPTIONS_PARAM_NAME = "stream_options";

type AttemptRequest = {
	method: string;
	target: string;
	fallbackTarget?: string | null;
	headers?: Array<[string, string]>;
	bodyText?: string | null;
	timeoutMs?: number;
	responsePath?: string | null;
	fallbackPath?: string | null;
};

type DispatchAttemptRequest = AttemptRequest & {
	channelId?: string | null;
	streamOptionsInjected?: boolean;
	strippedBodyText?: string | null;
};

type DispatchRequest = {
	attempts?: DispatchAttemptRequest[];
};

type AttemptExecutionResult = {
	response: Response;
	responsePath: string;
	latencyMs: number;
};

const attempt = new Hono<AppEnv>();

function normalizeRequestId(headers: Headers): string | null {
	const candidates = [
		"x-request-id",
		"request-id",
		"x-correlation-id",
		"cf-ray",
		"openai-request-id",
	];
	for (const key of candidates) {
		const value = headers.get(key);
		if (value && value.trim()) {
			return value.trim();
		}
	}
	return null;
}

function normalizeMessage(value: string | null): string | null {
	if (!value) {
		return null;
	}
	const trimmed = value.trim();
	if (!trimmed) {
		return null;
	}
	return trimmed;
}

function isStreamOptionsUnsupportedMessage(message: string | null): boolean {
	const normalized = normalizeMessage(message)?.toLowerCase();
	if (!normalized) {
		return false;
	}
	return (
		normalized.includes(STREAM_OPTIONS_UNSUPPORTED_SNIPPET) &&
		normalized.includes(STREAM_OPTIONS_PARAM_NAME)
	);
}

async function fetchWithTimeout(
	url: string,
	init: RequestInit,
	timeoutMs: number,
): Promise<Response> {
	if (timeoutMs <= 0) {
		return fetch(url, init);
	}
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(url, {
			...init,
			signal: controller.signal,
		});
	} finally {
		clearTimeout(timer);
	}
}

async function extractErrorMessage(response: Response): Promise<string | null> {
	const contentType = response.headers.get("content-type") ?? "";
	if (contentType.includes("application/json")) {
		const payload = await response
			.clone()
			.json()
			.catch(() => null);
		if (payload && typeof payload === "object") {
			const record = payload as Record<string, unknown>;
			const error =
				record.error && typeof record.error === "object"
					? (record.error as Record<string, unknown>)
					: null;
			const message =
				typeof error?.message === "string"
					? error.message
					: typeof record.message === "string"
						? record.message
						: null;
			return normalizeMessage(message);
		}
	}
	const text = await response
		.clone()
		.text()
		.catch(() => "");
	return normalizeMessage(text);
}

function buildErrorResponse(
	error: unknown,
	responsePath: string,
	latencyMs: number,
): Response {
	const isTimeout =
		error instanceof Error &&
		(error.name === "AbortError" || error.message.includes("upstream_timeout"));
	const errorCode = isTimeout
		? "proxy_upstream_timeout"
		: "proxy_upstream_fetch_exception";
	const outHeaders = new Headers({
		"content-type": "application/json",
	});
	outHeaders.set(ATTEMPT_RESPONSE_PATH_HEADER, responsePath);
	outHeaders.set(ATTEMPT_LATENCY_HEADER, String(latencyMs));
	outHeaders.set(ATTEMPT_ERROR_CODE_HEADER, errorCode);
	return new Response(
		JSON.stringify({
			error: {
				code: errorCode,
				message:
					error instanceof Error && error.message ? error.message : errorCode,
			},
		}),
		{
			status: 599,
			headers: outHeaders,
		},
	);
}

async function executeSingleAttempt(
	body: AttemptRequest,
	overrideBodyText?: string | null,
): Promise<AttemptExecutionResult> {
	const start = Date.now();
	const timeoutMs = Math.max(0, Math.floor(Number(body.timeoutMs ?? 0)));
	const headers = new Headers();
	for (const [key, value] of body.headers ?? []) {
		headers.set(key, value);
	}
	headers.delete("host");
	headers.delete("content-length");

	const requestInit: RequestInit = {
		method: body.method,
		headers,
		body: overrideBodyText ?? body.bodyText ?? undefined,
	};
	let responsePath = body.responsePath?.trim() || body.target;
	try {
		let response = await fetchWithTimeout(body.target, requestInit, timeoutMs);
		if (
			(response.status === 400 || response.status === 404) &&
			body.fallbackTarget
		) {
			response = await fetchWithTimeout(body.fallbackTarget, requestInit, timeoutMs);
			responsePath = body.fallbackPath?.trim() || body.fallbackTarget;
		}
		return {
			response,
			responsePath,
			latencyMs: Date.now() - start,
		};
	} catch (error) {
		return {
			response: buildErrorResponse(error, responsePath, Date.now() - start),
			responsePath,
			latencyMs: Date.now() - start,
		};
	}
}

function attachAttemptHeaders(
	source: AttemptExecutionResult,
	extraHeaders?: Record<string, string>,
): Response {
	const outHeaders = new Headers(source.response.headers);
	outHeaders.set(ATTEMPT_RESPONSE_PATH_HEADER, source.responsePath);
	outHeaders.set(ATTEMPT_LATENCY_HEADER, String(source.latencyMs));
	const upstreamRequestId = normalizeRequestId(source.response.headers);
	if (upstreamRequestId) {
		outHeaders.set(ATTEMPT_UPSTREAM_REQUEST_ID_HEADER, upstreamRequestId);
	}
	if (extraHeaders) {
		for (const [key, value] of Object.entries(extraHeaders)) {
			outHeaders.set(key, value);
		}
	}
	return new Response(source.response.body, {
		status: source.response.status,
		statusText: source.response.statusText,
		headers: outHeaders,
	});
}

attempt.post("/", async (c) => {
	const body = await c.req.json<AttemptRequest>().catch(() => null);
	if (!body?.target || !body?.method) {
		return c.json({ error: "invalid_attempt_payload" }, 400);
	}
	const result = await executeSingleAttempt(body);
	return attachAttemptHeaders(result);
});

attempt.post("/dispatch", async (c) => {
	const body = await c.req.json<DispatchRequest>().catch(() => null);
	const attempts = Array.isArray(body?.attempts) ? body.attempts : [];
	if (attempts.length === 0) {
		return c.json({ error: "invalid_dispatch_payload" }, 400);
	}
	let lastResult: {
		result: AttemptExecutionResult;
		attemptIndex: number;
		channelId: string;
	} | null = null;
	for (let attemptIndex = 0; attemptIndex < attempts.length; attemptIndex += 1) {
		const item = attempts[attemptIndex];
		if (!item?.target || !item?.method) {
			continue;
		}
		const channelId = String(item.channelId ?? "");
		let result = await executeSingleAttempt(item);
		if (
			item.streamOptionsInjected &&
			item.strippedBodyText &&
			!result.response.ok
		) {
			const message = await extractErrorMessage(result.response);
			if (isStreamOptionsUnsupportedMessage(message)) {
				result = await executeSingleAttempt(item, item.strippedBodyText);
			}
		}
		lastResult = {
			result,
			attemptIndex,
			channelId,
		};
		if (result.response.ok) {
			return attachAttemptHeaders(result, {
				[DISPATCH_ATTEMPT_INDEX_HEADER]: String(attemptIndex),
				[DISPATCH_CHANNEL_ID_HEADER]: channelId,
			});
		}
	}
	if (!lastResult) {
		return c.json({ error: "dispatch_no_valid_attempt" }, 400);
	}
	return attachAttemptHeaders(lastResult.result, {
		[DISPATCH_ATTEMPT_INDEX_HEADER]: String(lastResult.attemptIndex),
		[DISPATCH_CHANNEL_ID_HEADER]: lastResult.channelId,
	});
});

export default attempt;
