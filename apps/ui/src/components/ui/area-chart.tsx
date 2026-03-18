import { useEffect, useMemo, useRef, useState } from "hono/jsx/dom";
import { cx, type ClassName } from "./utils";

export type AreaChartPoint = {
	label: string;
	value: number;
	secondary?: number;
};

export type AreaChartProps = {
	data: AreaChartPoint[];
	height?: number;
	valueLabel?: string;
	secondaryLabel?: string;
	class?: ClassName;
};

type PositionedPoint = AreaChartPoint & {
	x: number;
	y: number;
};

const buildNaturalPath = (points: PositionedPoint[]) => {
	if (points.length === 0) {
		return "";
	}
	if (points.length === 1) {
		return `M ${points[0].x} ${points[0].y}`;
	}
	if (points.length === 2) {
		return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
	}
	const clamp = (value: number, min: number, max: number) =>
		Math.max(min, Math.min(max, value));
	const minY = Math.min(...points.map((point) => point.y));
	const maxY = Math.max(...points.map((point) => point.y));
	const tension = 0.78;
	let path = `M ${points[0].x} ${points[0].y}`;
	for (let index = 0; index < points.length - 1; index += 1) {
		const previous = points[index - 1] ?? points[index];
		const current = points[index];
		const next = points[index + 1];
		const nextAfter = points[index + 2] ?? next;
		const cp1x = current.x + ((next.x - previous.x) * tension) / 6;
		const cp1y = clamp(
			current.y + ((next.y - previous.y) * tension) / 6,
			minY,
			maxY,
		);
		const cp2x = next.x - ((nextAfter.x - current.x) * tension) / 6;
		const cp2y = clamp(
			next.y - ((nextAfter.y - current.y) * tension) / 6,
			minY,
			maxY,
		);
		path += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${next.x} ${next.y}`;
	}
	return path;
};

export const AreaChart = ({
	data,
	height = 180,
	valueLabel = "请求",
	secondaryLabel = "Tokens",
	class: className,
}: AreaChartProps) => {
	const [activeIndex, setActiveIndex] = useState<number | null>(null);
	const chartContainerRef = useRef<HTMLDivElement | null>(null);
	const [viewportRatio, setViewportRatio] = useState(2.4);
	const viewBoxHeight = 100;
	const viewBoxWidth = Math.max(
		100,
		Math.round(viewBoxHeight * Math.max(1, viewportRatio)),
	);
	const paddingX = 6;
	const paddingTop = 7;
	const paddingBottom = 8;
	const areaBaselineY = viewBoxHeight - paddingBottom;

	useEffect(() => {
		const node = chartContainerRef.current;
		if (!node) {
			return;
		}
		const updateRatio = () => {
			const rect = node.getBoundingClientRect();
			if (rect.width <= 0 || rect.height <= 0) {
				return;
			}
			const nextRatio = rect.width / rect.height;
			setViewportRatio((prev) =>
				Math.abs(prev - nextRatio) < 0.01 ? prev : nextRatio,
			);
		};
		updateRatio();
		if (typeof ResizeObserver === "undefined") {
			window.addEventListener("resize", updateRatio);
			return () => {
				window.removeEventListener("resize", updateRatio);
			};
		}
		const observer = new ResizeObserver(() => updateRatio());
		observer.observe(node);
		return () => observer.disconnect();
	}, [height]);

	const points = useMemo(() => {
		if (data.length === 0) {
			return [];
		}
		const maxValue = Math.max(...data.map((item) => item.value), 1);
		const drawableWidth = Math.max(1, viewBoxWidth - paddingX * 2);
		const drawableHeight = Math.max(1, viewBoxHeight - paddingTop - paddingBottom);
		return data.map((item, index) => {
			const x =
				data.length === 1
					? viewBoxWidth / 2
					: paddingX + (index / (data.length - 1)) * drawableWidth;
			const y = areaBaselineY - (item.value / maxValue) * drawableHeight;
			return { ...item, x, y };
		});
	}, [
		areaBaselineY,
		data,
		paddingBottom,
		paddingTop,
		paddingX,
		viewBoxHeight,
		viewBoxWidth,
	]);
	const linePath = useMemo(() => {
		return buildNaturalPath(points);
	}, [points]);
	const areaPath = useMemo(() => {
		if (!linePath || points.length === 0) {
			return "";
		}
		const start = points[0];
		const end = points[points.length - 1];
		return `${linePath} L ${end.x} ${areaBaselineY} L ${start.x} ${areaBaselineY} Z`;
	}, [areaBaselineY, linePath, points]);
	const horizontalGridLines = useMemo(
		() =>
			[0.2, 0.4, 0.6, 0.8].map(
				(step) => paddingTop + step * (viewBoxHeight - paddingTop - paddingBottom),
			),
		[paddingBottom, paddingTop, viewBoxHeight],
	);
	const activePoint =
		activeIndex !== null && points[activeIndex] ? points[activeIndex] : null;

	const handleMouseMove = (event: MouseEvent) => {
		if (points.length === 0) {
			return;
		}
		const target = event.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		const ratio = rect.width ? (event.clientX - rect.left) / rect.width : 0;
		const index = Math.min(
			points.length - 1,
			Math.max(0, Math.round(ratio * (points.length - 1))),
		);
		setActiveIndex(index);
	};

	return (
		<div class={cx("relative", className)}>
			{points.length === 0 ? (
				<div class="flex h-full items-center justify-center text-sm text-[color:var(--app-ink-muted)]">
					暂无趋势数据
				</div>
			) : (
				<div
					ref={chartContainerRef}
					class="relative w-full"
					style={`height:${height}px`}
				>
					<svg
						viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
						class="h-full w-full"
						role="img"
						aria-label={`${valueLabel}趋势`}
						onMouseLeave={() => setActiveIndex(null)}
						onMouseMove={handleMouseMove}
					>
						<defs>
							<linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
								<stop
									offset="5%"
									stopColor="var(--app-accent, #0a84ff)"
									stopOpacity="0.55"
								/>
								<stop
									offset="95%"
									stopColor="var(--app-accent, #0a84ff)"
									stopOpacity="0.08"
								/>
							</linearGradient>
						</defs>
						{horizontalGridLines.map((lineY) => (
							<line
								key={`grid-${lineY}`}
								x1={0}
								y1={lineY}
								x2={viewBoxWidth}
								y2={lineY}
								stroke="rgba(148, 163, 184, 0.28)"
								strokeWidth="1"
								strokeDasharray="3 3"
								vectorEffect="non-scaling-stroke"
							/>
						))}
						<path d={areaPath} fill="url(#areaGradient)" />
						<path
							d={linePath}
							fill="none"
							stroke="var(--app-accent, #0a84ff)"
							strokeWidth="1.35"
							strokeLinecap="round"
							strokeLinejoin="round"
							vectorEffect="non-scaling-stroke"
						/>
						{activePoint ? (
							<circle
								cx={activePoint.x}
								cy={activePoint.y}
								r="3.4"
								fill="var(--app-accent, #0a84ff)"
								stroke="#ffffff"
								strokeWidth="1.4"
								vectorEffect="non-scaling-stroke"
							/>
						) : null}
					</svg>
					{activePoint ? (
						<div
							class="pointer-events-none absolute top-2 rounded-xl border border-white/80 bg-white/90 px-3 py-2 text-xs text-[color:var(--app-ink)] shadow-[0_12px_30px_rgba(15,23,42,0.12)]"
							style={`left: ${(activePoint.x / viewBoxWidth) * 100}%; transform: translateX(-50%);`}
						>
							<div class="text-[11px] text-[color:var(--app-ink-muted)]">
								{activePoint.label}
							</div>
							<div class="mt-1 font-semibold">
								{valueLabel}: {activePoint.value}
							</div>
							{activePoint.secondary !== undefined ? (
								<div class="text-[11px] text-[color:var(--app-ink-muted)]">
									{secondaryLabel}: {activePoint.secondary}
								</div>
							) : null}
						</div>
					) : null}
				</div>
			)}
		</div>
	);
};
