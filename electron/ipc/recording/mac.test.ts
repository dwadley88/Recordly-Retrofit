import { describe, expect, it, vi } from "vitest";
import { isMacOSVersionSupportedForNativeCapture } from "./mac";

vi.mock("electron", () => ({
	app: {
		getPath: () => "/tmp/RecordlyTest",
	},
	BrowserWindow: {
		getAllWindows: () => [],
	},
}));

describe("isMacOSVersionSupportedForNativeCapture", () => {
	it("rejects macOS versions below the ScreenCaptureKit helper's deployment target", () => {
		expect(isMacOSVersionSupportedForNativeCapture("11.6.8")).toBe(false); // Big Sur
		expect(isMacOSVersionSupportedForNativeCapture("12.7.1")).toBe(false); // Monterey
		expect(isMacOSVersionSupportedForNativeCapture("13.6.1")).toBe(false); // Ventura
	});

	it("treats Big Sur's 10.16 SYSTEM_VERSION_COMPAT quirk as unsupported", () => {
		// Some macOS/Electron combinations report Big Sur as "10.16" instead of
		// "11.x" (see https://github.com/electron/electron/issues/26419). Either
		// way the major version is below 14, so the result must still be false.
		expect(isMacOSVersionSupportedForNativeCapture("10.16")).toBe(false);
	});

	it("accepts macOS 14.0 and newer", () => {
		expect(isMacOSVersionSupportedForNativeCapture("14.0")).toBe(true);
		expect(isMacOSVersionSupportedForNativeCapture("14.5.2")).toBe(true);
		expect(isMacOSVersionSupportedForNativeCapture("15.1")).toBe(true);
	});

	it("handles trailing whitespace from command output", () => {
		expect(isMacOSVersionSupportedForNativeCapture("14.0\n")).toBe(true);
	});
});
