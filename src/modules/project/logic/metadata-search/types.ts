export type MetadataSource =
	| "appleMusic"
	| "qqMusic"
	| "ncmMusic"
	| "spotify";

export type MetadataValueKey =
	| "musicName"
	| "artists"
	| "album"
	| "qqMusicId"
	| "ncmMusicId"
	| "spotifyId"
	| "appleMusicId"
	| "isrc";

export type MetadataValues = Partial<Record<MetadataValueKey, string[]>>;

export interface MetadataSearchInput {
	title?: string;
	artists: string[];
	album?: string;
	ids: {
		ncmMusicId: string[];
		qqMusicId: string[];
		spotifyId: string[];
		appleMusicId: string[];
		isrc: string[];
	};
}

export interface MetadataCandidate {
	source: MetadataSource;
	id: string;
	altIds?: string[];
	title?: string;
	artists: string[];
	album?: string;
	region?: string;
	isrc?: string;
	durationMs?: number;
	releaseDate?: string;
	score: number;
	values: MetadataValues;
	selectedByDefault: boolean;
	matchSource?: string;
	sourceIndex?: number;
}

export interface MetadataSourceResult {
	candidates: MetadataCandidate[];
	errors: string[];
}

export interface MetadataSearchResult {
	sources: Partial<Record<MetadataSource, MetadataSourceResult>>;
	recommendedCandidateIds: string[];
	errors: string[];
	warnings: string[];
}

export interface MetadataNetworkRequest {
	url: string;
	method?: "GET" | "POST" | string;
	headers?: Record<string, string>;
	body?: string;
}

export interface MetadataNetworkClient {
	requestJson<T = unknown>(request: MetadataNetworkRequest): Promise<T>;
	requestText(request: MetadataNetworkRequest): Promise<string>;
}

export interface SpotifyCredentials {
	clientId: string;
	clientSecret: string;
}

export interface SearchMetadataOptions {
	client?: MetadataNetworkClient;
	spotifyCredentials?: SpotifyCredentials | null;
	appleMusicToken?: string | null;
	includeSources?: MetadataSource[];
}
