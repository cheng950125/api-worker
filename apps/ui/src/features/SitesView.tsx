import { useEffect, useState } from "hono/jsx/dom";
import {
	getSiteCheckinLabel,
	getSiteTypeLabel,
	type SiteSortKey,
	type SiteSortState,
} from "../core/sites";
import type { CheckinSummary, Site, SiteForm } from "../core/types";
import {
	buildPageItems,
	formatDateTime,
	getBeijingDateString,
} from "../core/utils";

type SitesViewProps = {
	siteForm: SiteForm;
	sitePage: number;
	sitePageSize: number;
	siteTotal: number;
	siteTotalPages: number;
	pagedSites: Site[];
	editingSite: Site | null;
	isSiteModalOpen: boolean;
	summary: CheckinSummary | null;
	lastRun: string | null;
	siteSearch: string;
	siteSort: SiteSortState;
	isActionPending: (key: string) => boolean;
	onCreate: () => void;
	onCloseModal: () => void;
	onEdit: (site: Site) => void;
	onSubmit: (event: Event) => void;
	onTest: (id: string) => void;
	onToggle: (id: string, status: string) => void;
	onDelete: (site: Site) => void;
	onPageChange: (next: number) => void;
	onPageSizeChange: (next: number) => void;
	onSearchChange: (next: string) => void;
	onSortChange: (next: SiteSortState) => void;
	onFormChange: (patch: Partial<SiteForm>) => void;
	onRunAll: () => void;
	onTestAll: () => void;
};

const pageSizeOptions = [10, 20, 50];
const sortableColumns: Array<{ key: SiteSortKey; label: string }> = [
	{ key: "name", label: "站点" },
	{ key: "type", label: "类型" },
	{ key: "status", label: "状态" },
	{ key: "weight", label: "权重" },
	{ key: "tokens", label: "令牌" },
	{ key: "checkin_enabled", label: "自动签到" },
	{ key: "checkin", label: "今日签到" },
];

export const SitesView = ({
	siteForm,
	sitePage,
	sitePageSize,
	siteTotal,
	siteTotalPages,
	pagedSites,
	editingSite,
	isSiteModalOpen,
	summary,
	lastRun,
	siteSearch,
	siteSort,
	isActionPending,
	onCreate,
	onCloseModal,
	onEdit,
	onSubmit,
	onTest,
	onToggle,
	onDelete,
	onPageChange,
	onPageSizeChange,
	onSearchChange,
	onSortChange,
	onFormChange,
	onRunAll,
	onTestAll,
}: SitesViewProps) => {
	const isEditing = Boolean(editingSite);
	const pageItems = buildPageItems(sitePage, siteTotalPages);
	const today = getBeijingDateString();
	const isSubmitting = isActionPending("site:submit");
	const isTestingAll = isActionPending("site:testAll");
	const isCheckinAll = isActionPending("site:checkinAll");
	const [localSearch, setLocalSearch] = useState(siteSearch);
	const isOfficialType =
		siteForm.site_type === "openai" ||
		siteForm.site_type === "anthropic" ||
		siteForm.site_type === "gemini";
	const needsSystemToken = !isOfficialType;
	const isNewApi = siteForm.site_type === "new-api";
	const updateCallToken = (
		index: number,
		patch: Partial<SiteForm["call_tokens"][number]>,
	) => {
		const next = siteForm.call_tokens.map((token, idx) =>
			idx === index ? { ...token, ...patch } : token,
		);
		onFormChange({ call_tokens: next });
	};
	const addCallToken = () => {
		const next = [
			...siteForm.call_tokens,
			{
				name: `调用令牌${siteForm.call_tokens.length + 1}`,
				api_key: "",
			},
		];
		onFormChange({ call_tokens: next });
	};
	const removeCallToken = (index: number) => {
		if (siteForm.call_tokens.length <= 1) {
			return;
		}
		const next = siteForm.call_tokens.filter((_, idx) => idx !== index);
		onFormChange({ call_tokens: next });
	};
	const toggleSort = (key: SiteSortKey) => {
		if (siteSort.key === key) {
			onSortChange({
				key,
				direction: siteSort.direction === "asc" ? "desc" : "asc",
			});
			return;
		}
		onSortChange({ key, direction: "asc" });
	};
	const sortIndicator = (key: SiteSortKey) => {
		if (siteSort.key !== key) {
			return "↕";
		}
		return siteSort.direction === "asc" ? "▲" : "▼";
	};
	useEffect(() => {
		if (!isSiteModalOpen) {
			return;
		}
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				onCloseModal();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isSiteModalOpen, onCloseModal]);
	useEffect(() => {
		setLocalSearch(siteSearch);
	}, [siteSearch]);
	useEffect(() => {
		const timer = window.setTimeout(() => {
			if (localSearch !== siteSearch) {
				onSearchChange(localSearch);
			}
		}, 300);
		return () => window.clearTimeout(timer);
	}, [localSearch, onSearchChange, siteSearch]);
	return (
		<div class="space-y-5">
			<div class="app-card animate-fade-up p-5">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h3 class="app-title text-lg">站点管理</h3>
						<p class="app-subtitle">统一维护调用令牌、系统令牌与站点类型。</p>
					</div>
					<div class="flex flex-wrap items-center gap-2">
						{summary && (
							<div class="flex flex-wrap items-center gap-2 text-xs text-[color:var(--app-ink-muted)]">
								<span>总计 {summary.total}</span>
								<span class="text-[color:var(--app-success)]">
									成功 {summary.success}
								</span>
								<span>已签 {summary.skipped}</span>
								<span class="text-[color:var(--app-danger)]">
									失败 {summary.failed}
								</span>
							</div>
						)}
						<button
							class="app-button app-focus h-9 px-4 text-xs"
							type="button"
							disabled={isCheckinAll}
							onClick={onRunAll}
						>
							{isCheckinAll ? "签到中..." : "一键签到"}
						</button>
						<button
							class="app-button app-focus h-9 px-4 text-xs"
							type="button"
							disabled={isTestingAll}
							onClick={onTestAll}
						>
							{isTestingAll ? "测试中..." : "一键测试"}
						</button>
						<button
							class="app-button app-button-primary app-focus h-9 px-4 text-xs"
							type="button"
							onClick={onCreate}
						>
							新增站点
						</button>
					</div>
				</div>
				<div class="mt-4 flex flex-wrap items-center gap-3">
					<label class="app-chip app-chip--muted app-filter-group w-full px-3 py-2 text-xs sm:w-72">
						<span class="app-filter-label">搜索</span>
						<input
							class="app-filter-input"
							placeholder="站点名称或 URL"
							value={localSearch}
							onInput={(event) =>
								setLocalSearch((event.currentTarget as HTMLInputElement).value)
							}
						/>
					</label>
					<div class="flex flex-wrap items-center gap-2 md:hidden">
						{sortableColumns.map((column) => (
							<button
								class={`app-button app-focus h-8 px-3 text-[11px] ${
									siteSort.key === column.key ? "app-button-primary" : ""
								}`}
								key={column.key}
								type="button"
								onClick={() => toggleSort(column.key)}
							>
								{column.label} {sortIndicator(column.key)}
							</button>
						))}
					</div>
				</div>
				<div class="mt-4">
					<div class="space-y-3 md:hidden">
						{pagedSites.length === 0 ? (
							<div class="app-card text-center text-sm text-[color:var(--app-ink-muted)]">
								<p>暂无站点，请先创建。</p>
								<button
									class="app-button app-button-primary app-focus mt-4 h-9 px-4 text-xs"
									type="button"
									onClick={onCreate}
								>
									新增站点
								</button>
							</div>
						) : (
							pagedSites.map((site) => {
								const isActive = site.status === "active";
								const isToday = site.last_checkin_date === today;
								const message = isToday ? site.last_checkin_message : null;
								const systemReady = Boolean(
									site.system_token && site.system_userid,
								);
								const callTokenCount = site.call_tokens?.length ?? 0;
								const testPending = isActionPending(`site:test:${site.id}`);
								const togglePending = isActionPending(`site:toggle:${site.id}`);
								const deletePending = isActionPending(`site:delete:${site.id}`);
								return (
									<div
										class={`app-card p-4 ${
											editingSite?.id === site.id
												? "bg-[rgba(10,132,255,0.08)]"
												: ""
										}`}
										key={site.id}
									>
										<div class="flex items-start justify-between gap-3">
											<div class="min-w-0">
												<p class="truncate text-sm font-semibold text-[color:var(--app-ink)]">
													{site.name}
												</p>
												<p class="truncate text-xs text-[color:var(--app-ink-muted)]">
													{site.base_url}
												</p>
											</div>
											<span
												class={`app-chip text-[10px] uppercase tracking-widest ${
													isActive ? "app-chip--success" : "app-chip--muted"
												}`}
											>
												{isActive ? "启用" : "禁用"}
											</span>
										</div>
										<div class="mt-3 flex items-center justify-between text-xs text-[color:var(--app-ink-muted)]">
											<span>类型</span>
											<span class="font-semibold text-[color:var(--app-ink)]">
												{getSiteTypeLabel(site.site_type)}
											</span>
										</div>
										<div class="mt-3 flex items-center justify-between text-xs text-[color:var(--app-ink-muted)]">
											<span>权重</span>
											<span class="font-semibold text-[color:var(--app-ink)]">
												{site.weight}
											</span>
										</div>
										<div class="mt-3 grid grid-cols-2 gap-2 text-xs text-[color:var(--app-ink-muted)]">
											<div class="app-card app-card--compact">
												<p>系统令牌</p>
												<p class="mt-1 truncate font-semibold text-[color:var(--app-ink)]">
													{systemReady ? "已配置" : "未配置"}
												</p>
											</div>
											<div class="app-card app-card--compact">
												<p>调用令牌</p>
												<p class="mt-1 font-semibold text-[color:var(--app-ink)]">
													{callTokenCount > 0 ? `${callTokenCount} 个` : "-"}
												</p>
											</div>
											{site.site_type === "new-api" && (
												<div class="app-card app-card--compact">
													<p>自动签到</p>
													<p class="mt-1 font-semibold text-[color:var(--app-ink)]">
														{site.checkin_enabled ? "已开启" : "已关闭"}
													</p>
												</div>
											)}
											<div class="app-card app-card--compact">
												<p>今日签到</p>
												<p class="mt-1 font-semibold text-[color:var(--app-ink)]">
													{getSiteCheckinLabel(site, today)}
												</p>
												{message &&
													site.site_type === "new-api" &&
													site.checkin_enabled && (
														<p class="mt-1 truncate text-[11px] text-[color:var(--app-ink-muted)]">
															{message}
														</p>
													)}
											</div>
										</div>
										<div class="mt-3 grid grid-cols-2 gap-2">
											<button
												class="app-button app-focus h-9 w-full px-3 text-xs"
												type="button"
												disabled={testPending}
												onClick={() => onTest(site.id)}
											>
												{testPending ? "测试中..." : "连通测试"}
											</button>
											<button
												class="app-button app-focus h-9 w-full px-3 text-xs"
												type="button"
												disabled={togglePending}
												onClick={() => onToggle(site.id, site.status)}
											>
												{togglePending
													? "处理中..."
													: isActive
														? "禁用"
														: "启用"}
											</button>
											<button
												class="app-button app-focus h-9 w-full px-3 text-xs"
												type="button"
												onClick={() => onEdit(site)}
											>
												编辑
											</button>
											<button
												class="app-button app-button-ghost app-focus h-9 w-full px-3 text-xs"
												type="button"
												disabled={deletePending}
												onClick={() => onDelete(site)}
											>
												{deletePending ? "删除中..." : "删除"}
											</button>
										</div>
									</div>
								);
							})
						)}
					</div>
					<div class="app-surface hidden overflow-hidden md:block">
						<div class="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)_minmax(0,0.6fr)_minmax(0,0.5fr)_minmax(0,0.6fr)_minmax(0,0.6fr)_minmax(0,0.8fr)_minmax(0,1.4fr)] gap-3 bg-white/60 px-4 py-3 text-xs uppercase tracking-widest text-[color:var(--app-ink-muted)]">
							{sortableColumns.map((column) => (
								<div key={column.key}>
									<button
										class="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-[color:var(--app-ink-muted)] hover:text-[color:var(--app-ink)]"
										type="button"
										onClick={() => toggleSort(column.key)}
									>
										{column.label}
										<span class="text-[10px]">{sortIndicator(column.key)}</span>
									</button>
								</div>
							))}
							<div>操作</div>
						</div>
						{pagedSites.length === 0 ? (
							<div class="px-4 py-10 text-center text-sm text-[color:var(--app-ink-muted)]">
								<p>暂无站点，请先创建。</p>
								<button
									class="app-button app-button-primary app-focus mt-4 h-9 px-4 text-xs"
									type="button"
									onClick={onCreate}
								>
									新增站点
								</button>
							</div>
						) : (
							<div class="divide-y divide-white/60">
								{pagedSites.map((site) => {
									const isActive = site.status === "active";
									const callTokenCount = site.call_tokens?.length ?? 0;
									const testPending = isActionPending(`site:test:${site.id}`);
									const togglePending = isActionPending(
										`site:toggle:${site.id}`,
									);
									const deletePending = isActionPending(
										`site:delete:${site.id}`,
									);
									return (
										<div
											class={`grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)_minmax(0,0.6fr)_minmax(0,0.5fr)_minmax(0,0.6fr)_minmax(0,0.6fr)_minmax(0,0.8fr)_minmax(0,1.4fr)] items-center gap-3 px-4 py-4 text-sm ${
												editingSite?.id === site.id
													? "bg-[rgba(10,132,255,0.08)]"
													: ""
											}`}
											key={site.id}
										>
											<div class="flex min-w-0 flex-col">
												<span class="truncate font-semibold text-[color:var(--app-ink)]">
													{site.name}
												</span>
												<span
													class="truncate text-xs text-[color:var(--app-ink-muted)]"
													title={site.base_url}
												>
													{site.base_url}
												</span>
											</div>
											<div class="text-xs font-semibold text-[color:var(--app-ink)]">
												{getSiteTypeLabel(site.site_type)}
											</div>
											<div>
												<span
													class={`app-chip text-xs ${
														isActive ? "app-chip--success" : "app-chip--muted"
													}`}
												>
													{isActive ? "启用" : "禁用"}
												</span>
											</div>
											<div class="text-xs font-semibold text-[color:var(--app-ink)]">
												{site.weight}
											</div>
											<div class="text-xs text-[color:var(--app-ink-muted)]">
												{callTokenCount > 0 ? `${callTokenCount} 个` : "-"}
											</div>
											<div class="text-xs text-[color:var(--app-ink-muted)]">
												{site.site_type === "new-api"
													? site.checkin_enabled
														? "已开启"
														: "已关闭"
													: "-"}
											</div>
											<div class="text-xs text-[color:var(--app-ink-muted)]">
												{getSiteCheckinLabel(site, today)}
											</div>
											<div class="flex flex-wrap gap-2">
												<button
													class="app-button app-focus h-9 px-3 text-xs"
													type="button"
													disabled={testPending}
													onClick={() => onTest(site.id)}
												>
													{testPending ? "测试中..." : "连通测试"}
												</button>
												<button
													class="app-button app-focus h-9 px-3 text-xs"
													type="button"
													disabled={togglePending}
													onClick={() => onToggle(site.id, site.status)}
												>
													{togglePending
														? "处理中..."
														: isActive
															? "禁用"
															: "启用"}
												</button>
												<button
													class="app-button app-focus h-9 px-3 text-xs"
													type="button"
													onClick={() => onEdit(site)}
												>
													编辑
												</button>
												<button
													class="app-button app-button-ghost app-focus h-9 px-3 text-xs"
													type="button"
													disabled={deletePending}
													onClick={() => onDelete(site)}
												>
													{deletePending ? "删除中..." : "删除"}
												</button>
											</div>
										</div>
									);
								})}
							</div>
						)}
					</div>
				</div>
				<div class="mt-4 flex flex-col gap-3 text-xs text-[color:var(--app-ink-muted)] sm:flex-row sm:items-center sm:justify-between">
					<div class="flex flex-wrap items-center gap-2">
						<span class="text-xs text-[color:var(--app-ink-muted)]">
							共 {siteTotal} 条 · {siteTotalPages} 页
						</span>
						<button
							class="app-button app-focus h-8 w-8 text-xs"
							type="button"
							disabled={sitePage <= 1}
							onClick={() => onPageChange(Math.max(1, sitePage - 1))}
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
										item === sitePage ? "app-button-primary" : ""
									}`}
									type="button"
									key={item}
									onClick={() => onPageChange(item)}
								>
									{item}
								</button>
							),
						)}
						<button
							class="app-button app-focus h-8 w-8 text-xs"
							type="button"
							disabled={sitePage >= siteTotalPages}
							onClick={() =>
								onPageChange(Math.min(siteTotalPages, sitePage + 1))
							}
						>
							&gt;
						</button>
					</div>
					<label class="app-chip app-chip--muted flex items-center gap-2 px-3 py-1 text-xs">
						每页条数
						<select
							class="app-input app-input--pill app-focus w-auto text-xs"
							value={sitePageSize}
							onChange={(event) => {
								onPageSizeChange(
									Number((event.currentTarget as HTMLSelectElement).value),
								);
							}}
						>
							{pageSizeOptions.map((size) => (
								<option key={size} value={size}>
									{size}
								</option>
							))}
						</select>
					</label>
				</div>
				{lastRun && (
					<p class="mt-3 text-xs text-[color:var(--app-ink-muted)]">
						最近执行时间：{formatDateTime(lastRun)}
					</p>
				)}
			</div>
			{isSiteModalOpen && (
				<div class="fixed inset-0 z-50">
					<button
						aria-label="关闭弹窗"
						class="absolute inset-0 bg-slate-950/60"
						type="button"
						onClick={onCloseModal}
					/>
					<div class="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">
						<div
							aria-labelledby="site-modal-title"
							aria-modal="true"
							class="app-card flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden p-6"
							role="dialog"
						>
							<div class="flex flex-wrap items-start justify-between gap-3">
								<div>
									<h3 class="app-title mb-1 text-lg" id="site-modal-title">
										{isEditing ? "编辑站点" : "新增站点"}
									</h3>
									<p class="text-xs text-[color:var(--app-ink-muted)]">
										{isEditing
											? `正在编辑：${editingSite?.name ?? ""}`
											: "填写站点信息并保存。"}
									</p>
								</div>
								<button
									class="app-button app-focus h-9 px-3 text-xs"
									type="button"
									onClick={onCloseModal}
								>
									关闭
								</button>
							</div>
							<form
								class="mt-4 grid min-h-0 gap-4 overflow-y-auto pr-1"
								onSubmit={onSubmit}
							>
								<div class="grid gap-4 md:grid-cols-2">
									<div>
										<label
											class="mb-1.5 block text-xs uppercase tracking-widest text-[color:var(--app-ink-muted)]"
											for="site-name"
										>
											名称
										</label>
										<input
											class="app-input app-focus"
											id="site-name"
											name="name"
											value={siteForm.name}
											required
											onInput={(event) =>
												onFormChange({
													name: (event.currentTarget as HTMLInputElement).value,
												})
											}
										/>
									</div>
									<div>
										<label
											class="mb-1.5 block text-xs uppercase tracking-widest text-[color:var(--app-ink-muted)]"
											for="site-type"
										>
											站点类型
										</label>
										<select
											class="app-input app-focus"
											id="site-type"
											name="site_type"
											onChange={(event) =>
												onFormChange({
													site_type: (event.currentTarget as HTMLSelectElement)
														.value as Site["site_type"],
												})
											}
										>
											<option
												value="new-api"
												selected={siteForm.site_type === "new-api"}
											>
												new-api
											</option>
											<option
												value="done-hub"
												selected={siteForm.site_type === "done-hub"}
											>
												done-hub
											</option>
											<option
												value="subapi"
												selected={siteForm.site_type === "subapi"}
											>
												subapi
											</option>
											<option
												value="openai"
												selected={siteForm.site_type === "openai"}
											>
												openai
											</option>
											<option
												value="anthropic"
												selected={siteForm.site_type === "anthropic"}
											>
												Anthropic
											</option>
											<option
												value="gemini"
												selected={siteForm.site_type === "gemini"}
											>
												gemini
											</option>
										</select>
									</div>
								</div>
								<div>
									<label
										class="mb-1.5 block text-xs uppercase tracking-widest text-[color:var(--app-ink-muted)]"
										for="site-base"
									>
										基础 URL{isOfficialType ? "（可留空）" : ""}
									</label>
									<input
										class="app-input app-focus"
										id="site-base"
										name="base_url"
										placeholder="https://api.example.com"
										value={siteForm.base_url}
										required={!isOfficialType}
										onInput={(event) =>
											onFormChange({
												base_url: (event.currentTarget as HTMLInputElement)
													.value,
											})
										}
									/>
								</div>
								<div class="grid gap-4 md:grid-cols-2">
									<div>
										<label
											class="mb-1.5 block text-xs uppercase tracking-widest text-[color:var(--app-ink-muted)]"
											for="site-weight"
										>
											权重
										</label>
										<input
											class="app-input app-focus"
											id="site-weight"
											name="weight"
											type="number"
											min="1"
											value={siteForm.weight}
											onInput={(event) =>
												onFormChange({
													weight: Number(
														(event.currentTarget as HTMLInputElement).value ||
															0,
													),
												})
											}
										/>
									</div>
									<div>
										<label
											class="mb-1.5 block text-xs uppercase tracking-widest text-[color:var(--app-ink-muted)]"
											for="site-status"
										>
											站点状态
										</label>
										<select
											class="app-input app-focus"
											id="site-status"
											name="status"
											onChange={(event) =>
												onFormChange({
													status: (event.currentTarget as HTMLSelectElement)
														.value,
												})
											}
										>
											<option
												value="active"
												selected={siteForm.status === "active"}
											>
												启用
											</option>
											<option
												value="disabled"
												selected={siteForm.status === "disabled"}
											>
												禁用
											</option>
										</select>
									</div>
								</div>
								<div class="app-card p-4">
									<div class="flex flex-wrap items-center justify-between gap-2">
										<p class="text-xs font-semibold uppercase tracking-widest text-[color:var(--app-ink-muted)]">
											调用令牌
										</p>
										<button
											class="app-button app-focus h-8 px-3 text-[11px]"
											type="button"
											onClick={addCallToken}
										>
											新增令牌
										</button>
									</div>
									<p class="mt-2 text-xs text-[color:var(--app-ink-muted)]">
										用于实际调用，系统会按顺序选择可用令牌。
									</p>
									<div class="mt-3 max-h-64 space-y-3 overflow-y-auto pr-1">
										{siteForm.call_tokens.map((token, index) => (
											<div
												class="app-card app-card--compact px-3 py-3"
												key={`${token.id ?? "new"}-${index}`}
											>
												<div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
													<input
														class="app-input app-focus text-xs"
														placeholder="备注名"
														value={token.name}
														onInput={(event) =>
															updateCallToken(index, {
																name: (event.currentTarget as HTMLInputElement)
																	.value,
															})
														}
													/>
													<input
														class="app-input app-focus text-xs"
														placeholder="调用令牌"
														value={token.api_key}
														onInput={(event) =>
															updateCallToken(index, {
																api_key: (
																	event.currentTarget as HTMLInputElement
																).value,
															})
														}
													/>
												</div>
												<div class="mt-2 flex items-center justify-end">
													<button
														class="text-[11px] font-semibold text-[color:var(--app-ink-muted)] transition-colors hover:text-[color:var(--app-danger)] disabled:cursor-not-allowed disabled:opacity-50"
														type="button"
														disabled={siteForm.call_tokens.length <= 1}
														onClick={() => removeCallToken(index)}
													>
														删除此令牌
													</button>
												</div>
											</div>
										))}
									</div>
								</div>
								{needsSystemToken && (
									<div class="app-card p-4">
										<p class="text-xs font-semibold uppercase tracking-widest text-[color:var(--app-ink-muted)]">
											系统令牌与签到
										</p>
										<div class="mt-3 grid gap-3 md:grid-cols-2">
											<input
												class="app-input app-focus"
												placeholder="系统令牌"
												value={siteForm.system_token}
												onInput={(event) =>
													onFormChange({
														system_token: (
															event.currentTarget as HTMLInputElement
														).value,
													})
												}
											/>
											<input
												class="app-input app-focus"
												placeholder="User ID"
												value={siteForm.system_userid}
												onInput={(event) =>
													onFormChange({
														system_userid: (
															event.currentTarget as HTMLInputElement
														).value,
													})
												}
											/>
										</div>
										<div class="mt-3 grid gap-3 md:grid-cols-2">
											{isNewApi && (
												<select
													class="app-input app-focus"
													onChange={(event) =>
														onFormChange({
															checkin_enabled:
																(event.currentTarget as HTMLSelectElement)
																	.value === "enabled",
														})
													}
												>
													<option
														value="disabled"
														selected={!siteForm.checkin_enabled}
													>
														自动签到关闭
													</option>
													<option
														value="enabled"
														selected={siteForm.checkin_enabled}
													>
														自动签到开启
													</option>
												</select>
											)}
											<input
												class="app-input app-focus"
												placeholder={
													isNewApi ? "签到地址（可选）" : "外部签到地址（可选）"
												}
												value={siteForm.checkin_url}
												onInput={(event) =>
													onFormChange({
														checkin_url: (
															event.currentTarget as HTMLInputElement
														).value,
													})
												}
											/>
										</div>
									</div>
								)}
								<div class="flex flex-wrap items-center justify-end gap-2 pt-2">
									<button
										class="app-button app-focus h-10 px-4 text-xs"
										type="button"
										onClick={onCloseModal}
									>
										取消
									</button>
									<button
										class="app-button app-button-primary app-focus h-10 px-5 text-xs"
										type="submit"
										disabled={isSubmitting}
									>
										{isSubmitting
											? "保存中..."
											: isEditing
												? "保存修改"
												: "创建站点"}
									</button>
								</div>
							</form>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};
