import { describe, expect, it } from "vitest";
import {
	getHudOverlayTaskbarOptions,
	supportsHudOverlayMousePassthrough,
} from "./hudOverlayWindowOptions";

describe("getHudOverlayTaskbarOptions", () => {
	it("keeps a focusable HUD in the Windows taskbar", () => {
		expect(getHudOverlayTaskbarOptions("win32")).toEqual({
			skipTaskbar: false,
			focusable: true,
		});
	});

	it.each([
		"darwin",
		"linux",
	] as const)("keeps the HUD non-focusable and out of the taskbar on %s", (platform) => {
		expect(getHudOverlayTaskbarOptions(platform)).toEqual({
			skipTaskbar: true,
			focusable: false,
		});
	});
});

describe("supportsHudOverlayMousePassthrough", () => {
	it("never uses click-through on Linux", () => {
		expect(supportsHudOverlayMousePassthrough("linux", null)).toBe(false);
	});

	it("uses click-through on Windows", () => {
		expect(supportsHudOverlayMousePassthrough("win32", null)).toBe(true);
	});

	it("uses click-through on macOS 14 and newer", () => {
		expect(supportsHudOverlayMousePassthrough("darwin", 14)).toBe(true);
		expect(supportsHudOverlayMousePassthrough("darwin", 15)).toBe(true);
	});

	it("falls back to the always-interactive HUD on macOS older than 14", () => {
		expect(supportsHudOverlayMousePassthrough("darwin", 11)).toBe(false); // Big Sur
		expect(supportsHudOverlayMousePassthrough("darwin", 12)).toBe(false); // Monterey
		expect(supportsHudOverlayMousePassthrough("darwin", 13)).toBe(false); // Ventura
	});

	it("assumes click-through works when the macOS version can't be read", () => {
		expect(supportsHudOverlayMousePassthrough("darwin", null)).toBe(true);
	});
});
