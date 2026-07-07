const BLOCKED_HOSTS = new Set([
	"localhost",
	"localhost.localdomain",
	"0.0.0.0",
	"::",
	"::1",
]);

type RemoteUrlOptions = {
	requireTtml?: boolean;
};

const normalizeHostname = (hostname: string) =>
	hostname
		.trim()
		.toLowerCase()
		.replace(/^\[(.*)]$/, "$1")
		.replace(/\.$/, "");

const parseIpv4 = (hostname: string): number[] | null => {
	const parts = hostname.split(".");
	if (parts.length !== 4) return null;
	const bytes = parts.map((part) => {
		if (!/^\d{1,3}$/.test(part)) return Number.NaN;
		return Number.parseInt(part, 10);
	});
	if (bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) {
		return null;
	}
	return bytes;
};

const isPrivateIpv4 = (hostname: string) => {
	const bytes = parseIpv4(hostname);
	if (!bytes) return false;
	const [first, second] = bytes;
	return (
		first === 0 ||
		first === 10 ||
		first === 127 ||
		(first === 100 && second >= 64 && second <= 127) ||
		(first === 169 && second === 254) ||
		(first === 172 && second >= 16 && second <= 31) ||
		(first === 192 && second === 168) ||
		first >= 224
	);
};

const isPrivateIpv6 = (hostname: string) => {
	const normalized = hostname.toLowerCase();
	return (
		normalized === "::" ||
		normalized === "::1" ||
		normalized.startsWith("fc") ||
		normalized.startsWith("fd") ||
		normalized.startsWith("fe8") ||
		normalized.startsWith("fe9") ||
		normalized.startsWith("fea") ||
		normalized.startsWith("feb")
	);
};

const isBlockedHostname = (hostname: string) => {
	const normalized = normalizeHostname(hostname);
	return (
		BLOCKED_HOSTS.has(normalized) ||
		normalized.endsWith(".localhost") ||
		isPrivateIpv4(normalized) ||
		isPrivateIpv6(normalized)
	);
};

export const getSafeRemoteUrl = (
	input: string,
	options: RemoteUrlOptions = {},
) => {
	if (!input || /\s/.test(input)) return null;
	try {
		const url = new URL(input);
		if (url.protocol !== "https:") return null;
		if (url.username || url.password) return null;
		if (isBlockedHostname(url.hostname)) return null;
		if (options.requireTtml && !url.pathname.toLowerCase().endsWith(".ttml")) {
			return null;
		}
		return url;
	} catch {
		return null;
	}
};
