import { afterEach, describe, expect, it, vi } from "vitest";

const execFileSyncMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
	execFileSync: execFileSyncMock,
}));

import { getMacOSMajorVersionSync, parseMacOSMajorVersion } from "./macosVersion";

describe("parseMacOSMajorVersion", () => {
	it("parses a well-formed version string", () => {
		expect(parseMacOSMajorVersion("11.6.8")).toBe(11);
		expect(parseMacOSMajorVersion("14.5")).toBe(14);
	});

	it("returns null for non-numeric input", () => {
		expect(parseMacOSMajorVersion("not-a-version")).toBeNull();
	});

	it("trims surrounding whitespace", () => {
		expect(parseMacOSMajorVersion(" 12.7.1\n")).toBe(12);
	});
});

describe("getMacOSMajorVersionSync", () => {
	const originalPlatform = process.platform;

	afterEach(() => {
		Object.defineProperty(process, "platform", { value: originalPlatform });
		execFileSyncMock.mockReset();
	});

	it("returns null off-darwin without shelling out", () => {
		Object.defineProperty(process, "platform", { value: "linux" });
		expect(getMacOSMajorVersionSync()).toBeNull();
		expect(execFileSyncMock).not.toHaveBeenCalled();
	});

	it("parses sw_vers output on darwin", () => {
		Object.defineProperty(process, "platform", { value: "darwin" });
		execFileSyncMock.mockReturnValue("11.6.8\n");
		expect(getMacOSMajorVersionSync()).toBe(11);
		expect(execFileSyncMock).toHaveBeenCalledWith(
			"sw_vers",
			["-productVersion"],
			expect.objectContaining({ encoding: "utf8" }),
		);
	});

	it("returns null when sw_vers fails", () => {
		Object.defineProperty(process, "platform", { value: "darwin" });
		execFileSyncMock.mockImplementation(() => {
			throw new Error("not found");
		});
		expect(getMacOSMajorVersionSync()).toBeNull();
	});
});
