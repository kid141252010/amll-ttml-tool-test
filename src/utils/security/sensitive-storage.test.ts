import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createExpiringSessionStorage } from "./sensitive-storage";

class MemoryStorage implements Storage {
	private readonly values = new Map<string, string>();

	get length() {
		return this.values.size;
	}

	clear(): void {
		this.values.clear();
	}

	getItem(key: string): string | null {
		return this.values.get(key) ?? null;
	}

	key(index: number): string | null {
		return Array.from(this.values.keys())[index] ?? null;
	}

	removeItem(key: string): void {
		this.values.delete(key);
	}

	setItem(key: string, value: string): void {
		this.values.set(key, value);
	}
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-07-07T00:00:00.000Z"));
	vi.stubGlobal("sessionStorage", new MemoryStorage());
	vi.stubGlobal("localStorage", new MemoryStorage());
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("sensitive expiring session storage", () => {
	test("stores values in sessionStorage and clears legacy localStorage copies", () => {
		localStorage.setItem("githubPat", JSON.stringify("legacy-token"));
		const storage = createExpiringSessionStorage<string>({ ttlMs: 1000 });

		storage.setItem("githubPat", "session-token");

		expect(localStorage.getItem("githubPat")).toBeNull();
		expect(sessionStorage.getItem("githubPat")).toContain("session-token");
		expect(storage.getItem("githubPat", "")).toBe("session-token");
	});

	test("expires stale sensitive values", () => {
		const storage = createExpiringSessionStorage<string>({ ttlMs: 1000 });
		storage.setItem("lyricsSiteToken", "token");

		vi.setSystemTime(new Date("2026-07-07T00:00:01.001Z"));

		expect(storage.getItem("lyricsSiteToken", "")).toBe("");
		expect(sessionStorage.getItem("lyricsSiteToken")).toBeNull();
	});
});
