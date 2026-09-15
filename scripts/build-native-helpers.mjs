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
		requiresScreenCaptureKit: true,
	},
	{
		source: "ScreenCaptureKitWindowList.swift",
		output: "recordly-window-list",
		requiresScreenCaptureKit: true,
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

// ScreenCaptureKit doesn't exist in the SDK bundled with the last Xcode that
// runs on Big Sur/Monterey (13.2.1), and the recorder's shorthand optional
// binding (`if let x { }`) needs the Swift 5.7 compiler from Xcode 14+ that
// those older macOS versions can't install either. Probe once so a build on
// such a machine can skip these two helpers instead of failing outright —
// they're gated off at runtime anyway (see mac.ts's isNativeMacCaptureAvailable()).
function hasScreenCaptureKitModule() {
	const probe = spawnSync("swiftc", ["-typecheck", "-"], {
		encoding: "utf8",
		input: "import ScreenCaptureKit\n",
		timeout: 30000,
	});
	return probe.status === 0;
}

const screenCaptureKitAvailable = hasScreenCaptureKitModule();
if (!screenCaptureKitAvailable) {
	console.warn(
		"[build-native-helpers] ScreenCaptureKit is unavailable on this machine's SDK/toolchain " +
			"(expected on Big Sur/Monterey/Ventura). Skipping the native capture and window-list " +
			"helpers; the app already falls back to browser-based capture on macOS below 14.",
	);
}

for (const target of getTargetConfigs()) {
	const outputDir = path.join(nativeRoot, "bin", target.archTag);
	await mkdir(outputDir, { recursive: true });

	for (const helper of helpers) {
		if (helper.requiresScreenCaptureKit && !screenCaptureKitAvailable) {
			console.warn(
				`[build-native-helpers] Skipping ${helper.output} (${target.archTag}): ScreenCaptureKit unavailable.`,
			);
			continue;
		}

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
