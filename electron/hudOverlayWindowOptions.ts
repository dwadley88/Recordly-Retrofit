export interface HudOverlayTaskbarOptions {
	skipTaskbar: boolean;
	focusable: boolean;
}

export function getHudOverlayTaskbarOptions(platform: NodeJS.Platform): HudOverlayTaskbarOptions {
	const showInWindowsTaskbar = platform === "win32";
	return {
		skipTaskbar: !showInWindowsTaskbar,
		focusable: showInWindowsTaskbar,
	};
}

/**
 * Click-through mode keeps the HUD as a full-screen transparent window that ignores
 * the mouse, relying on `setIgnoreMouseEvents(true, { forward: true })` to keep
 * delivering mouse-move events so the renderer can detect hover and make the window
 * interactive again. On macOS below 14 that forwarding never arrives, so the first
 * time the HUD goes click-through it can never recover and the UI stays dead until
 * relaunch. Those versions use the always-interactive compact HUD that Linux uses.
 */
export function supportsHudOverlayMousePassthrough(
	platform: NodeJS.Platform,
	macOSMajorVersion: number | null,
): boolean {
	if (platform === "linux") {
		return false;
	}

	if (platform === "darwin" && macOSMajorVersion !== null && macOSMajorVersion < 14) {
		return false;
	}

	return true;
}
