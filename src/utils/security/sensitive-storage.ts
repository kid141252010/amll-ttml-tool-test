import type { SyncStorage } from "jotai/vanilla/utils/atomWithStorage";

const fallbackStorage = new Map<string, string>();

type ExpiringValue<Value> = {
	value: Value;
	expiresAt: number;
};

type ExpiringStorageOptions = {
	ttlMs: number;
};

const getSessionStorage = (): Storage | null => {
	try {
		return typeof sessionStorage === "undefined" ? null : sessionStorage;
	} catch {
		return null;
	}
};

const removeLegacyLocalStorageValue = (key: string) => {
	try {
		if (typeof localStorage !== "undefined") {
			localStorage.removeItem(key);
		}
	} catch {}
};

const readRawValue = (key: string) => {
	const storage = getSessionStorage();
	if (storage) return storage.getItem(key);
	return fallbackStorage.get(key) ?? null;
};

const writeRawValue = (key: string, value: string) => {
	const storage = getSessionStorage();
	if (storage) {
		storage.setItem(key, value);
		return;
	}
	fallbackStorage.set(key, value);
};

const removeRawValue = (key: string) => {
	const storage = getSessionStorage();
	if (storage) {
		storage.removeItem(key);
		return;
	}
	fallbackStorage.delete(key);
};

export const createExpiringSessionStorage = <Value>({
	ttlMs,
}: ExpiringStorageOptions): SyncStorage<Value> => ({
	getItem: (key, initialValue) => {
		removeLegacyLocalStorageValue(key);
		const raw = readRawValue(key);
		if (!raw) return initialValue;
		try {
			const parsed = JSON.parse(raw) as Partial<ExpiringValue<Value>>;
			if (
				typeof parsed !== "object" ||
				parsed === null ||
				typeof parsed.expiresAt !== "number" ||
				Date.now() > parsed.expiresAt
			) {
				removeRawValue(key);
				return initialValue;
			}
			return parsed.value as Value;
		} catch {
			removeRawValue(key);
			return initialValue;
		}
	},
	setItem: (key, newValue) => {
		removeLegacyLocalStorageValue(key);
		const payload: ExpiringValue<Value> = {
			value: newValue,
			expiresAt: Date.now() + ttlMs,
		};
		writeRawValue(key, JSON.stringify(payload));
	},
	removeItem: (key) => {
		removeLegacyLocalStorageValue(key);
		removeRawValue(key);
	},
});
