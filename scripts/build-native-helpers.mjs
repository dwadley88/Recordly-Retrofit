import { spawnSync } from "node:child_process";
import { chmod, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const projectRoot = process.cwd();
const nativeRoot = path.join(projectRoot, "electron", "native");
const moduleCacheRoot = path.join(os.tmpdir(), "recordly-swift-module-cache");

if (process.platform !== "darwin") {
	console.log("[build-native-helpers] Skipping: host platform is not macOS.");
	process.exit(0);
}

// ScreenCaptureKit is unavailable before macOS 12.3, and the capture helper
// relies on capture APIs that only stabilized in macOS 14 (see mac.ts's
// isNativeMacCaptureAvailable() gate), so it keeps that deployment target.
// Cursor helpers only use AppKit/ApplicationServices, which work all the way
// back to Big Sur (11.0) and earlier, so they get a much lower floor. Big Sur
// is the oldest macOS this project still targets (macOS 11.6.8, the last
// release supported on 2014-era MacBook Pros), so 11.0 is the practical floor
// rather than the true AppKit minimum.
function getTargetConfigs() {
	return [
		{
			archTag: "darwin-arm64",
			swiftTarget: "arm64-apple-macos14.0",
			cursorHelperSwiftTarget: "arm64-apple-macos11.0",
		},
		{
			archTag: "darwin-x64",
			swiftTarget: "x86_64-apple-macos14.0",
			cursorHelperSwiftTarget: "x86_64-apple-macos11.0",
		},
	];
}

const helpers = [
	{
		source: "ScreenCaptureKitRecorder.swift",
		output: "recordly-screencapturekit-helper",
	},
	{
		source: "ScreenCaptureKitWindowList.swift",
		output: "recordly-window-list",
	},
	{
		source: "SystemCursorAssets.swift",
		output: "recordly-system-cursors",
		usesCursorHelperTarget: true,
	},
	{
		source: "NativeCursorMonitor.swift",
		output: "recordly-native-cursor-monitor",
		usesCursorHelperTarget: true,
	},
];

const swiftcCheck = spawnSync("swiftc", ["--version"], { encoding: "utf8" });
if (swiftcCheck.status !== 0) {
	const details = [swiftcCheck.stderr, swiftcCheck.stdout].filter(Boolean).join("\n").trim();
	throw new Error(details || "swiftc is unavailable; install Xcode Command Line Tools.");
}

for (const target of getTargetConfigs()) {
	const outputDir = path.join(nativeRoot, "bin", target.archTag);
	await mkdir(outputDir, { recursive: true });

	for (const helper of helpers) {
		const sourcePath = path.join(nativeRoot, helper.source);
		const outputPath = path.join(outputDir, helper.output);
		const swiftTarget = helper.usesCursorHelperTarget
			? target.cursorHelperSwiftTarget
			: target.swiftTarget;

		const result = spawnSync(
			"swiftc",
			["-O", "-target", swiftTarget, sourcePath, "-o", outputPath],
			{
				encoding: "utf8",
				env: {
					...process.env,
					CLANG_MODULE_CACHE_PATH: path.join(moduleCacheRoot, "clang"),
					SWIFT_MODULECACHE_PATH: path.join(moduleCacheRoot, "swift"),
				},
				timeout: 120000,
			},
		);

		if (result.status !== 0) {
			const details = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
			throw new Error(details || `Failed to compile ${helper.source} for ${target.archTag}`);
		}

		await chmod(outputPath, 0o755);
		console.log(
			`[build-native-helpers] Built ${helper.output} (${target.archTag}) -> ${outputPath}`,
		);
	}
}
