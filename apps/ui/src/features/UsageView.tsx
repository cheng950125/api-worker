import { useEffect, useMemo, useState } from "hono/jsx/dom";
import type { UsageLog, UsageQuery } from "../core/types";
import {
	buildPageItems,
	buildUsageStatusDetail,
	formatDateTime,
} from "../core/utils";

type UsageViewProps = {
	usage: UsageLog[];
	total: number;
	page: number;
	pageSize: number;
	filters: UsageQuery;
	isRefreshing: boolean;
	onRefresh: () => void;
	onPageChange: (next: number) => void;
	onPageSizeChange: (next: number) => void;
	onFiltersChange: (patch: Partial<UsageQuery>) => void;
	onSearch: () => void;
	onClear: () => void;
};

const pageSizeOptions = [50, 100, 200];

const formatTokens = (value: number | null | undefined) =>
	value === null || value === undefined ? "-" : value;

const formatSeconds = (value: number | null | undefined) => {
	if (value === null || value === undefined || Number.isNaN(value)) {
		return "-";
	}
	return `${(value / 1000).toFixed(2)} s`;
};

const formatStream = (value: boolean | number | null | undefined) => {
	if (value === null || value === undefined) {
		return "-";
	}
	if (typeof value === "number") {
		return value > 0 ? "是" : "否";
	}
	return value ? "是" : "否";
};

/**
 * Renders the usage logs view.
 *
 * Args:
 *   props: Usage view props.
 *
 * Returns:
 *   Usage JSX element.
 */
export const UsageView = ({
	usage,
	total,
	page,
	pageSize,
	filters,
	isRefreshing,
	onRefresh,
	onPageChange,
	onPageSizeChange,
	onFiltersChange,
	onSearch,
	onClear,
}: UsageViewProps) => {
	const [activeErrorLog, setActiveErrorLog] = useState<UsageLog | null>(null);
	const totalPages = useMemo(
		() => Math.max(1, Math.ceil(total / pageSize)),
		[total, pageSize],
	);
	const pageItems = useMemo(
		() => buildPageItems(page, totalPages),
		[page, totalPages],
	);
	const closeErrorModal = () => setActiveErrorLog(null);
	const hasFilters =
		filters.channel.trim() ||
		filters.token.trim() ||
		filters.model.trim() ||
		filters.status.trim();

	const handleSearchKey = (event: KeyboardEvent) => {
		if (event.key === "Enter") {
			event.preventDefault();
			onSearch();
		}
	};

	useEffect(() => {
		if (!activeErrorLog) {
			return;
		}
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				closeErrorModal();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [activeErrorLog]);

	return (
		<div class="space-y-4">
			<div class="app-card animate-fade-up p-5">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h3 class="app-title text-lg">使用日志</h3>
						<p class="app-subtitle">追踪每次调用的令牌与关键性能指标。</p>
					</div>
					<div class="flex flex-wrap items-center gap-2">
						<button
							class="app-button app-focus h-9 px-4 text-xs"
							type="button"
							disabled={isRefreshing}
							onClick={onRefresh}
						>
							{isRefreshing ? "刷新中..." : "刷新"}
						</button>
					</div>
				</div>
				<div class="app-card app-card--compact mt-4 flex flex-wrap items-center gap-2 p-3">
					<label class="app-chip app-chip--muted app-filter-group">
						<span class="app-filter-label">渠道</span>
						<input
							class="app-filter-input"
							placeholder="渠道名称"
							value={filters.channel}
							onInput={(event) =>
								onFiltersChange({
									channel: (event.currentTarget as HTMLInputElement).value,
								})
							}
							onKeyDown={handleSearchKey}
						/>
					</label>
					<label class="app-chip app-chip--muted app-filter-group">
						<span class="app-filter-label">令牌</span>
						<input
							class="app-filter-input"
							placeholder="令牌名称"
							value={filters.token}
							onInput={(event) =>
								onFiltersChange({
									token: (event.currentTarget as HTMLInputElement).value,
								})
							}
							onKeyDown={handleSearchKey}
						/>
					</label>
					<label class="app-chip app-chip--muted app-filter-group">
						<span class="app-filter-label">模型</span>
						<input
							class="app-filter-input"
							placeholder="模型名称"
							value={filters.model}
							onInput={(event) =>
								onFiltersChange({
									model: (event.currentTarget as HTMLInputElement).value,
								})
							}
							onKeyDown={handleSearchKey}
						/>
					</label>
					<label class="app-chip app-chip--muted app-filter-group">
						<span class="app-filter-label">状态码</span>
						<input
							class="app-filter-input app-filter-input--tight"
							placeholder="200/503"
							inputMode="numeric"
							value={filters.status}
							onInput={(event) =>
								onFiltersChange({
									status: (event.currentTarget as HTMLInputElement).value,
								})
							}
							onKeyDown={handleSearchKey}
						/>
					</label>
					<div class="flex flex-wrap items-center gap-2">
						<button
							class="app-button app-button-primary app-focus h-8 px-4 text-[11px]"
							type="button"
							disabled={isRefreshing}
							onClick={onSearch}
						>
							搜索
						</button>
						<button
							class="app-button app-button-ghost app-focus h-8 px-4 text-[11px]"
							type="button"
							disabled={isRefreshing || !hasFilters}
							onClick={onClear}
						>
							清空
						</button>
					</div>
				</div>
				<div class="app-surface mt-4 overflow-hidden">
					<div class="h-[420px] overflow-auto sm:h-[520px]">
						<table class="app-table min-w-[960px] w-full text-xs sm:text-sm">
							<thead>
								<tr>
									<th class="sticky top-0 bg-slate-100/90">时间</th>
									<th class="sticky top-0 bg-slate-100/90">模型</th>
									<th class="sticky top-0 bg-slate-100/90">渠道</th>
									<th class="sticky top-0 bg-slate-100/90">令牌</th>
									<th class="sticky top-0 bg-slate-100/90">输入 Tokens</th>
									<th class="sticky top-0 bg-slate-100/90">输出 Tokens</th>
									<th class="sticky top-0 bg-slate-100/90">用时 (s)</th>
									<th class="sticky top-0 bg-slate-100/90">首 token 延迟 (s)</th>
									<th class="sticky top-0 bg-slate-100/90">流式</th>
									<th class="sticky top-0 bg-slate-100/90">推理强度</th>
									<th class="sticky top-0 bg-slate-100/90">状态码</th>
								</tr>
							</thead>
							<tbody>
								{usage.length === 0 ? (
									<tr>
										<td
											class="px-3 py-10 text-center text-sm text-[color:var(--app-ink-muted)]"
											colSpan={11}
										>
											<div class="flex flex-col items-center gap-3">
												<span>暂无日志，先完成一次调用吧。</span>
												<button
													class="app-button app-button-primary app-focus h-8 px-4 text-[11px]"
													type="button"
													onClick={onRefresh}
													disabled={isRefreshing}
												>
													立即刷新
												</button>
											</div>
										</td>
									</tr>
								) : (
									usage.map((log) => {
										const statusDetail = buildUsageStatusDetail(log);
										const hasDetail = Boolean(
											log.error_message || log.error_code,
										);
										return (
											<tr key={log.id}>
												<td class="px-3 py-2.5 text-left text-xs text-[color:var(--app-ink)] sm:text-sm">
													{formatDateTime(log.created_at)}
												</td>
												<td class="px-3 py-2.5 text-left text-xs text-[color:var(--app-ink)] sm:text-sm">
													{log.model ?? "-"}
												</td>
												<td class="px-3 py-2.5 text-left text-xs text-[color:var(--app-ink)] sm:text-sm">
													{log.channel_name ?? log.channel_id ?? "-"}
												</td>
												<td class="px-3 py-2.5 text-left text-xs text-[color:var(--app-ink)] sm:text-sm">
													{log.token_name ?? log.token_id ?? "-"}
												</td>
												<td class="px-3 py-2.5 text-left text-xs text-[color:var(--app-ink)] sm:text-sm">
													{formatTokens(log.prompt_tokens)}
												</td>
												<td class="px-3 py-2.5 text-left text-xs text-[color:var(--app-ink)] sm:text-sm">
													{formatTokens(log.completion_tokens)}
												</td>
												<td class="px-3 py-2.5 text-left text-xs text-[color:var(--app-ink)] sm:text-sm">
													{formatSeconds(log.latency_ms)}
												</td>
												<td class="px-3 py-2.5 text-left text-xs text-[color:var(--app-ink)] sm:text-sm">
													{formatSeconds(log.first_token_latency_ms)}
												</td>
												<td class="px-3 py-2.5 text-left text-xs text-[color:var(--app-ink)] sm:text-sm">
													{formatStream(log.stream)}
												</td>
												<td class="px-3 py-2.5 text-left text-xs text-[color:var(--app-ink)] sm:text-sm">
													{log.reasoning_effort ?? "-"}
												</td>
												<td class="px-3 py-2.5 text-left text-xs text-[color:var(--app-ink)] sm:text-sm">
													<span
														class={`app-chip text-[10px] ${
															statusDetail.tone === "success"
																? "app-chip--success"
																: "app-chip--muted"
														}`}
													>
														{statusDetail.label}
													</span>
													{hasDetail ? (
														<button
															class="app-button app-button-ghost app-focus mt-2 h-7 px-2 text-[10px]"
															type="button"
															onClick={() => setActiveErrorLog(log)}
														>
															查看详情
														</button>
													) : null}
												</td>
											</tr>
										);
									})
								)}
							</tbody>
						</table>
					</div>
				</div>
				<div class="mt-4 flex flex-col gap-3 text-xs text-[color:var(--app-ink-muted)] sm:flex-row sm:items-center sm:justify-between">
					<div class="flex flex-wrap items-center gap-2">
						<span class="text-xs text-[color:var(--app-ink-muted)]">
							共 {totalPages} 页 · {total} 条
						</span>
						<button
							class="app-button app-focus h-8 w-8 text-xs"
							type="button"
							disabled={page <= 1 || isRefreshing}
							onClick={() => onPageChange(Math.max(1, page - 1))}
						>
							&lt;
						</button>
						{pageItems.map((item, index) =>
							item === "ellipsis" ? (
								<span
									class="px-2 text-xs text-[color:var(--app-ink-muted)]"
									key={`e-${index}`}
								>
									...
								</span>
							) : (
								<button
									class={`app-button app-focus h-8 min-w-8 px-3 text-xs ${
										item === page ? "app-button-primary" : ""
									}`}
									type="button"
									key={item}
									disabled={isRefreshing}
									onClick={() => onPageChange(item)}
								>
									{item}
								</button>
							),
						)}
						<button
							class="app-button app-focus h-8 w-8 text-xs"
							type="button"
							disabled={page >= totalPages || isRefreshing}
							onClick={() => onPageChange(Math.min(totalPages, page + 1))}
						>
							&gt;
						</button>
					</div>
					<label class="app-chip app-chip--muted flex items-center gap-2 px-3 py-1 text-xs">
						每页条数
						<select
							class="app-input app-input--pill app-focus w-auto text-xs"
							value={pageSize}
							disabled={isRefreshing}
							onChange={(event) =>
								onPageSizeChange(
									Number((event.currentTarget as HTMLSelectElement).value),
								)
							}
						>
							{pageSizeOptions.map((size) => (
								<option key={size} value={size}>
									{size}
								</option>
							))}
						</select>
					</label>
				</div>
			</div>
			{activeErrorLog ? (
				<div class="fixed inset-0 z-50">
					<button
						aria-label="关闭弹窗"
						class="absolute inset-0 bg-slate-950/60"
						type="button"
						onClick={closeErrorModal}
					/>
					<div class="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">
						<div
							aria-labelledby="usage-error-title"
							aria-modal="true"
							class="app-card w-full max-w-2xl p-6"
							role="dialog"
						>
							<div class="flex items-start justify-between gap-4">
								<div>
									<h3 class="app-title text-lg" id="usage-error-title">
										错误详情
									</h3>
									<p class="mt-2 text-xs text-[color:var(--app-ink-muted)]">
										状态码 {activeErrorLog.upstream_status ?? "-"}
									</p>
									{activeErrorLog.error_code ? (
										<p class="mt-1 text-xs text-[color:var(--app-ink-muted)]">
											错误码: {activeErrorLog.error_code}
										</p>
									) : null}
								</div>
								<button
									class="app-button app-focus h-8 px-3 text-xs"
									type="button"
									onClick={closeErrorModal}
								>
									关闭
								</button>
							</div>
							<div class="app-card app-card--compact mt-4 text-xs text-[color:var(--app-ink)]">
								<div class="grid gap-2">
									<div class="flex items-center justify-between gap-3">
										<span class="text-[color:var(--app-ink-muted)]">时间</span>
										<span>{formatDateTime(activeErrorLog.created_at)}</span>
									</div>
									<div class="flex items-center justify-between gap-3">
										<span class="text-[color:var(--app-ink-muted)]">模型</span>
										<span>{activeErrorLog.model ?? "-"}</span>
									</div>
									<div class="flex items-center justify-between gap-3">
										<span class="text-[color:var(--app-ink-muted)]">渠道</span>
										<span>
											{activeErrorLog.channel_name ??
												activeErrorLog.channel_id ??
												"-"}
										</span>
									</div>
									<div class="flex items-center justify-between gap-3">
										<span class="text-[color:var(--app-ink-muted)]">令牌</span>
										<span>
											{activeErrorLog.token_name ??
												activeErrorLog.token_id ??
												"-"}
										</span>
									</div>
									<div class="flex items-center justify-between gap-3">
										<span class="text-[color:var(--app-ink-muted)]">耗时</span>
										<span>{formatSeconds(activeErrorLog.latency_ms)}</span>
									</div>
								</div>
								<p class="mt-3 text-[11px] text-[color:var(--app-ink-muted)]">
									错误片段已省略，请结合状态码与错误码排查。
								</p>
							</div>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
};
