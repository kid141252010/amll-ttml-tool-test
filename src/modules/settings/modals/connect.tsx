import {
	Flex,
	Heading,
	Card,
	Text,
	Button,
	Avatar,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { GithubLoginCard } from "$/modules/github/modals/GithubLoginCard";
import { NeteaseLoginCard } from "$/modules/ncm/modals/NeteaseLoginCard";
import {
	appleMusicBearerTokenAtom,
	githubLoginAtom,
	metadataProxyUrlAtom,
	spotifyClientIdAtom,
	spotifyClientSecretAtom,
} from "$/modules/settings/states";
import {
	useLyricsSiteAuth,
	lyricsSiteUserAtom,
} from "$/modules/review/services/remote-service";

const LyricsSiteLoginCard = () => {
	const { t } = useTranslation();
	const user = useAtomValue(lyricsSiteUserAtom);
	const { isLoggedIn, hasReviewPermission, initiateLogin, logout } =
		useLyricsSiteAuth();

	if (isLoggedIn && user) {
		return (
			<Card>
				<Flex direction="column" gap="3">
					<Flex align="center" gap="3">
						<Avatar
							size="3"
							src={user.avatarUrl}
							fallback={user.displayName?.[0] || "U"}
							radius="full"
						/>
						<Flex direction="column">
							<Text weight="medium">{user.displayName}</Text>
							<Text size="2" color="gray">
								@{user.username}
								<span
									style={{
										color: hasReviewPermission
											? "var(--green-9)"
											: "var(--gray-9)",
										marginLeft: "8px",
									}}
								>
									{hasReviewPermission ? "审核员" : "普通用户"}
								</span>
							</Text>
						</Flex>
					</Flex>
					<Button variant="soft" color="gray" onClick={logout}>
						{t("common.logout", "登出")}
					</Button>
				</Flex>
			</Card>
		);
	}

	return (
		<Card>
			<Flex direction="column" gap="3">
				<Text weight="medium">
					{t("settings.connect.lyricsSite", "歌词站")}
				</Text>
				<Text size="2" color="gray">
					{t(
						"settings.connect.lyricsSiteDesc",
						"登录歌词站以使用歌词站相关功能",
					)}
				</Text>
				<Button variant="soft" onClick={initiateLogin}>
					{t("settings.connect.loginLyricsSite", "登录歌词站")}
				</Button>
			</Flex>
		</Card>
	);
};

const SpotifyCredentialsCard = () => {
	const { t } = useTranslation();
	const [clientId, setClientId] = useAtom(spotifyClientIdAtom);
	const [clientSecret, setClientSecret] = useAtom(spotifyClientSecretAtom);

	return (
		<Card>
			<Flex direction="column" gap="3">
				<Flex direction="column" gap="1">
					<Text weight="medium">
						{t("settings.connect.spotify.title", "Spotify")}
					</Text>
					<Text size="2" color="gray">
						{t(
							"settings.connect.spotify.desc",
							"用于元数据自动搜索。凭据仅保存在本机浏览器存储中。",
						)}
					</Text>
				</Flex>
				<TextField.Root
					value={clientId}
					onChange={(event) => setClientId(event.currentTarget.value)}
					placeholder={t(
						"settings.connect.spotify.clientId",
						"Client ID",
					)}
				/>
				<TextField.Root
					type="password"
					value={clientSecret}
					onChange={(event) => setClientSecret(event.currentTarget.value)}
					placeholder={t(
						"settings.connect.spotify.clientSecret",
						"Client Secret",
					)}
				/>
			</Flex>
		</Card>
	);
};

const AppleMusicTokenCard = () => {
	const { t } = useTranslation();
	const [token, setToken] = useAtom(appleMusicBearerTokenAtom);

	return (
		<Card>
			<Flex direction="column" gap="3">
				<Flex direction="column" gap="1">
					<Text weight="medium">
						{t("settings.connect.appleMusic.title", "Apple Music")}
					</Text>
					<Text size="2" color="gray">
						{t(
							"settings.connect.appleMusic.desc",
							"用于元数据自动搜索。Bearer Token 仅保存在本机浏览器存储中。",
						)}
					</Text>
				</Flex>
				<TextField.Root
					type="password"
					value={token}
					onChange={(event) => setToken(event.currentTarget.value)}
					placeholder={t(
						"settings.connect.appleMusic.bearerToken",
						"Bearer Token",
					)}
				/>
			</Flex>
		</Card>
	);
};

const MetadataProxyCard = () => {
	const { t } = useTranslation();
	const [proxyUrl, setProxyUrl] = useAtom(metadataProxyUrlAtom);

	return (
		<Card>
			<Flex direction="column" gap="3">
				<Flex direction="column" gap="1">
					<Text weight="medium">
						{t("settings.connect.metadataProxy.title", "元数据代理")}
					</Text>
					<Text size="2" color="gray">
						{t(
							"settings.connect.metadataProxy.desc",
							"用于纯静态部署的元数据自动搜索。留空时使用当前站点的 /api/metadata-network。",
						)}
					</Text>
				</Flex>
				<TextField.Root
					value={proxyUrl}
					onChange={(event) => setProxyUrl(event.currentTarget.value)}
					placeholder={t(
						"settings.connect.metadataProxy.placeholder",
						"https://example.com/api/metadata-network",
					)}
				/>
			</Flex>
		</Card>
	);
};

export const SettingsConnectTab = () => {
	const { t } = useTranslation();
	const githubLogin = useAtomValue(githubLoginAtom);
	const lyricsSiteUser = useAtomValue(lyricsSiteUserAtom);
	const shouldShowNetease =
		Boolean(githubLogin.trim()) || Boolean(lyricsSiteUser);

	return (
		<Flex direction="column" gap="4">
			<Flex direction="column" gap="1">
				<Heading size="4">{t("settings.connect.title", "连接")}</Heading>
			</Flex>

			<GithubLoginCard />

			<LyricsSiteLoginCard />

			{shouldShowNetease && <NeteaseLoginCard />}

			<AppleMusicTokenCard />

			<SpotifyCredentialsCard />

			<MetadataProxyCard />
		</Flex>
	);
};
