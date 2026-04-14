import type { D1Database } from "@cloudflare/workers-types";
import type { ChannelCallTokenRow } from "./channel-call-token-types";

type ChannelCallTokenFilters = {
	channelIds?: string[] | null;
};

const buildWhere = (filters?: ChannelCallTokenFilters) => {
	if (!filters?.channelIds || filters.channelIds.length === 0) {
		return { whereSql: "", bindings: [] as string[] };
	}
	const placeholders = filters.channelIds.map(() => "?").join(", ");
	return {
		whereSql: `WHERE channel_id IN (${placeholders})`,
		bindings: filters.channelIds,
	};
};

export async function listCallTokens(
	db: D1Database,
	filters?: ChannelCallTokenFilters,
): Promise<ChannelCallTokenRow[]> {
	if (filters?.channelIds && filters.channelIds.length === 0) {
		return [];
	}
	const { whereSql, bindings } = buildWhere(filters);
	const statement = db.prepare(
		`SELECT * FROM channel_call_tokens ${whereSql} ORDER BY channel_id ASC, priority ASC, created_at ASC, id ASC`,
	);
	const rows = await statement.bind(...bindings).all<ChannelCallTokenRow>();
	return rows.results ?? [];
}

export async function deleteCallTokensByChannelId(
	db: D1Database,
	channelId: string,
): Promise<void> {
	await db
		.prepare("DELETE FROM channel_call_tokens WHERE channel_id = ?")
		.bind(channelId)
		.run();
}

export type ChannelCallTokenInsertInput = {
	id: string;
	channel_id: string;
	name: string;
	api_key: string;
	priority: number;
	created_at: string;
	updated_at: string;
};

export async function insertCallToken(
	db: D1Database,
	input: ChannelCallTokenInsertInput,
): Promise<void> {
	await db
		.prepare(
			"INSERT INTO channel_call_tokens (id, channel_id, name, api_key, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		)
		.bind(
			input.id,
			input.channel_id,
			input.name,
			input.api_key,
			input.priority,
			input.created_at,
			input.updated_at,
		)
		.run();
}

export async function replaceCallTokensForChannel(
	db: D1Database,
	channelId: string,
	tokens: ChannelCallTokenInsertInput[],
): Promise<void> {
	await deleteCallTokensByChannelId(db, channelId);
	for (const token of tokens) {
		await insertCallToken(db, token);
	}
}

export async function updateCallTokenModels(
	db: D1Database,
	tokenId: string,
	models: string[],
	updatedAt: string,
): Promise<void> {
	const modelsJson = models.length > 0 ? JSON.stringify(models) : null;
	await db
		.prepare(
			"UPDATE channel_call_tokens SET models_json = ?, updated_at = ? WHERE id = ?",
		)
		.bind(modelsJson, updatedAt, tokenId)
		.run();
}
