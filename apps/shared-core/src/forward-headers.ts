const HOP_BY_HOP_REQUEST_HEADERS = [
	"connection",
	"keep-alive",
	"proxy-authenticate",
	"proxy-authorization",
	"proxy-connection",
	"te",
	"trailer",
	"transfer-encoding",
	"upgrade",
	"expect",
	"http2-settings",
];

function parseConnectionHeaderTokens(value: string | null): string[] {
	if (!value) {
		return [];
	}
	return value
		.split(",")
		.map((item) => item.trim().toLowerCase())
		.filter((item) => item.length > 0);
}

/**
 * Removes hop-by-hop request headers before proxying to an upstream server.
 */
export function sanitizeUpstreamRequestHeaders(baseHeaders: Headers): Headers {
	const headers = new Headers(baseHeaders);
	const connectionTokens = parseConnectionHeaderTokens(
		headers.get("connection"),
	);
	for (const headerName of HOP_BY_HOP_REQUEST_HEADERS) {
		headers.delete(headerName);
	}
	for (const headerName of connectionTokens) {
		headers.delete(headerName);
	}
	return headers;
}
