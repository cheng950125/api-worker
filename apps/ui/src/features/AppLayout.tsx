import type { NoticeMessage, TabId, TabItem } from "../core/types";

type AppLayoutProps = {
	tabs: TabItem[];
	activeTab: TabId;
	activeLabel: string;
	token: string | null;
	notices: NoticeMessage[];
	onDismissNotice: (id: number) => void;
	onTabChange: (tabId: TabId) => void;
	onLogout: () => void;
	children?: unknown;
};

/**
 * Renders the admin app layout.
 *
 * Args:
 *   props: App layout props.
 *
 * Returns:
 *   App shell JSX element.
 */
export const AppLayout = ({
	tabs,
	activeTab,
	activeLabel,
	token,
	notices,
	onDismissNotice,
	onTabChange,
	onLogout,
	children,
}: AppLayoutProps) => {
	const noticeToneStyles: Record<NoticeMessage["tone"], string> = {
		success: "app-notice app-notice--success",
		warning: "app-notice app-notice--warning",
		error: "app-notice app-notice--error",
		info: "app-notice app-notice--info",
	};
	const noticeToneLabel: Record<NoticeMessage["tone"], string> = {
		success: "成功",
		warning: "提示",
		error: "错误",
		info: "信息",
	};
	const closeMobileNav = () => {
		const toggle = document.querySelector<HTMLInputElement>("#app-nav-toggle");
		if (toggle) {
			toggle.checked = false;
		}
	};
	const toggleMobileNav = () => {
		const toggle = document.querySelector<HTMLInputElement>("#app-nav-toggle");
		if (toggle) {
			toggle.checked = !toggle.checked;
		}
	};

	return (
		<div class="relative flex min-h-screen flex-col lg:grid lg:grid-cols-[260px_1fr]">
			<input class="peer hidden" id="app-nav-toggle" type="checkbox" />
			<header class="app-bar flex items-center justify-between px-4 py-4 lg:hidden">
				<div class="flex items-center gap-3">
					<button
						aria-controls="app-nav-toggle"
						aria-label="打开导航"
						class="app-button app-focus inline-flex h-10 items-center gap-2 px-3 text-xs"
						type="button"
						onClick={toggleMobileNav}
					>
						<svg
							aria-hidden="true"
							class="h-4 w-4 text-[color:var(--app-ink-muted)]"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="1.8"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M4 6h16"
							/>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M4 12h16"
							/>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M4 18h16"
							/>
						</svg>
						菜单
					</button>
					<div class="flex flex-col">
						<span class="text-sm font-semibold text-[color:var(--app-ink)]">
							api-workers
						</span>
						<span class="text-xs text-[color:var(--app-ink-muted)]">
							{activeLabel}
						</span>
					</div>
				</div>
				<div class="flex items-center gap-2">
					<span class="app-badge text-[10px] uppercase tracking-widest">
						{token ? "已登录" : "未登录"}
					</span>
					<button
						class="app-button app-button-ghost app-focus h-9 px-3 text-xs"
						type="button"
						onClick={onLogout}
					>
						退出
					</button>
				</div>
			</header>
			<aside class="app-sidebar fixed inset-y-0 left-0 z-40 flex w-72 -translate-x-full flex-col overflow-y-auto px-5 py-8 shadow-xl transition-transform duration-300 ease-in-out peer-checked:translate-x-0 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-auto lg:translate-x-0 lg:shadow-none">
				<div class="mb-8 flex flex-col gap-1.5">
					<h2 class="app-title text-lg">api-workers</h2>
					<span class="text-xs uppercase tracking-widest text-[color:var(--app-ink-muted)]">
						console
					</span>
				</div>
				<nav class="flex flex-col gap-2.5">
					{tabs.map((tab) => (
						<button
							class={`app-nav-button app-focus h-11 w-full text-left text-sm ${
								activeTab === tab.id ? "app-nav-button--active" : ""
							}`}
							type="button"
							onClick={() => {
								onTabChange(tab.id);
								closeMobileNav();
							}}
						>
							{tab.label}
						</button>
					))}
				</nav>
			</aside>
			<main class="px-4 pt-5 pb-16 sm:px-10 sm:pt-8">
				<div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 class="app-title text-2xl">{activeLabel}</h1>
						<p class="text-sm text-[color:var(--app-ink-muted)]">
							集中管理渠道、模型、令牌与使用情况。
						</p>
					</div>
					<div class="hidden items-center gap-3 lg:flex">
						<span class="app-badge text-xs">{token ? "已登录" : "未登录"}</span>
						<button
							class="app-button app-button-ghost app-focus h-11 px-4 text-sm"
							type="button"
							onClick={onLogout}
						>
							退出
						</button>
					</div>
				</div>
				{children}
			</main>
			{notices.length > 0 && (
				<output aria-live="polite" class="app-toast">
					{notices.map((notice) => (
						<div
							class={`app-toast-card ${noticeToneStyles[notice.tone]}`}
							key={notice.id}
							style={`--toast-duration: ${notice.durationMs ?? 4500}ms`}
						>
							<div class="flex items-start justify-between gap-3">
								<div>
									<span class="app-chip text-[10px]">
										{noticeToneLabel[notice.tone]}
									</span>
									<div class="mt-1 text-sm font-semibold text-[color:var(--app-ink)]">
										{notice.message}
									</div>
								</div>
								<button
									class="app-button app-focus h-8 px-3 text-[11px]"
									type="button"
									onClick={() => onDismissNotice(notice.id)}
								>
									关闭
								</button>
							</div>
							<span aria-hidden="true" class="app-toast-progress" />
						</div>
					))}
				</output>
			)}
			<button
				aria-label="关闭导航"
				class="fixed inset-0 z-30 bg-slate-950/40 opacity-0 transition-opacity duration-300 ease-in-out peer-checked:pointer-events-auto peer-checked:opacity-100 lg:hidden pointer-events-none"
				type="button"
				onClick={closeMobileNav}
			/>
		</div>
	);
};
