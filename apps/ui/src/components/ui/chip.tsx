import type { JSX } from "hono/jsx";
import { cx } from "./utils";

export type ChipProps = JSX.IntrinsicElements["span"] & {
	variant?: "default" | "accent" | "success" | "muted" | "warning" | "danger";
};

const variantStyles: Record<NonNullable<ChipProps["variant"]>, string> = {
	default: "app-chip",
	accent: "app-chip app-chip--accent",
	success: "app-chip app-chip--success",
	muted: "app-chip app-chip--muted",
	warning: "app-chip app-chip--warning",
	danger: "app-chip app-chip--danger",
};

export const Chip = ({
	variant = "default",
	class: className,
	...props
}: ChipProps) => {
	return <span {...props} class={cx(variantStyles[variant], className)} />;
};
