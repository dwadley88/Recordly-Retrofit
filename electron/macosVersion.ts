import { execFileSync } from "node:child_process";

export function parseMacOSMajorVersion(productVersion: string): number | null {
	const major = Number(productVersion.trim().split(".")[0]);
	return Number.isFinite(major) ? major : null;
}

/**
 * Synchronous because GPU command-line switches must be set before
 * app.whenReady(), well before any async IPC round-trip could resolve.
 */
export function getMacOSMajorVersionSync(): number | null {
	if (process.platform !== "darwin") return null;

	try {
		const productVersion = execFileSync("sw_vers", ["-productVersion"], { encoding: "utf8" });
		return parseMacOSMajorVersion(productVersion);
	} catch {
		return null;
	}
}
