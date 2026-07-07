import { stringify } from "./matching";

const METADATA_PROXY_UNAVAILABLE_ERROR = "元数据代理暂不可用";

export const formatMetadataSearchError = (
	error: unknown,
	fallback = "元数据搜索失败",
): string => {
	const message =
		error instanceof Error ? error.message : (stringify(error) ?? fallback);
	if (isMetadataProxyUnavailableError(message)) {
		return METADATA_PROXY_UNAVAILABLE_ERROR;
	}
	if (isRawJsonParseError(message)) {
		return "元数据服务返回了非 JSON 响应";
	}
	return message || fallback;
};

export const isMetadataProxyUnavailable = (error: unknown): boolean => {
	const message =
		error instanceof Error ? error.message : (stringify(error) ?? "");
	return isMetadataProxyUnavailableError(message);
};

const isRawJsonParseError = (message: string): boolean =>
	/Unexpected token .* is not valid JSON/i.test(message) ||
	/Unexpected end of JSON input/i.test(message);

const isMetadataProxyUnavailableError = (message: string): boolean =>
	/\bFUNCTION_INVOCATION_FAILED\b/i.test(message);
