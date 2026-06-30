Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
let _applemusic_like_lyrics_core = require("@applemusic-like-lyrics/core");
let react = require("react");
let react_jsx_runtime = require("react/jsx-runtime");
let react_dom = require("react-dom");
//#region src/bg-render.tsx
/**
* 流体背景渲染组件，通过提供图片链接可以显示出酷似 Apple Music 的流体背景效果
*/
const BackgroundRender = (0, react.forwardRef)(({ album, albumIsVideo, fps, playing, flowSpeed, renderScale, staticMode, lowFreqVolume, hasLyric, renderer, style, ...props }, ref) => {
	const coreBGRenderRef = (0, react.useRef)(null);
	const wrapperRef = (0, react.useRef)(null);
	const lastRendererRef = (0, react.useRef)(null);
	const curRenderer = renderer ?? _applemusic_like_lyrics_core.MeshGradientRenderer;
	(0, react.useEffect)(() => {
		if (lastRendererRef.current !== curRenderer || coreBGRenderRef.current === void 0) {
			lastRendererRef.current = curRenderer;
			coreBGRenderRef.current?.dispose();
			coreBGRenderRef.current = _applemusic_like_lyrics_core.BackgroundRender.new(curRenderer);
		}
	}, [curRenderer]);
	(0, react.useEffect)(() => {
		if (curRenderer && album) coreBGRenderRef.current?.setAlbum(album, albumIsVideo);
	}, [
		curRenderer,
		album,
		albumIsVideo
	]);
	(0, react.useEffect)(() => {
		if (curRenderer && fps) coreBGRenderRef.current?.setFPS(fps);
	}, [curRenderer, fps]);
	(0, react.useEffect)(() => {
		if (!curRenderer) return;
		if (playing === void 0) coreBGRenderRef.current?.resume();
		else if (playing) coreBGRenderRef.current?.resume();
		else coreBGRenderRef.current?.pause();
	}, [curRenderer, playing]);
	(0, react.useEffect)(() => {
		if (!curRenderer) return;
		if (flowSpeed) coreBGRenderRef.current?.setFlowSpeed(flowSpeed);
	}, [curRenderer, flowSpeed]);
	(0, react.useEffect)(() => {
		if (!curRenderer) return;
		coreBGRenderRef.current?.setStaticMode(staticMode ?? false);
	}, [curRenderer, staticMode]);
	(0, react.useEffect)(() => {
		if (curRenderer && renderScale) coreBGRenderRef.current?.setRenderScale(renderScale ?? .5);
	}, [curRenderer, renderScale]);
	(0, react.useEffect)(() => {
		if (curRenderer && lowFreqVolume) coreBGRenderRef.current?.setLowFreqVolume(lowFreqVolume ?? 1);
	}, [curRenderer, lowFreqVolume]);
	(0, react.useEffect)(() => {
		if (curRenderer && hasLyric !== void 0) coreBGRenderRef.current?.setHasLyric(hasLyric ?? true);
	}, [curRenderer, hasLyric]);
	(0, react.useEffect)(() => {
		if (coreBGRenderRef.current) {
			const el = coreBGRenderRef.current.getElement();
			el.style.width = "100%";
			el.style.height = "100%";
			el.style.minHeight = "0";
			el.style.minWidth = "0";
			el.style.overflow = "hidden";
			wrapperRef.current?.appendChild(el);
		}
	}, [coreBGRenderRef.current]);
	(0, react.useImperativeHandle)(ref, () => ({
		wrapperEl: wrapperRef.current,
		bgRender: coreBGRenderRef.current
	}), [wrapperRef.current, coreBGRenderRef.current]);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		style: {
			display: "contents",
			...style
		},
		...props,
		ref: wrapperRef
	});
});
//#endregion
//#region src/lyric-player.tsx
/**
* 歌词播放组件，本框架的核心组件
*
* 尽可能贴切 Apple Music for iPad 的歌词效果设计，且做了力所能及的优化措施
*/
const LyricPlayer = (0, react.forwardRef)(({ disabled, playing, alignAnchor, alignPosition, enableSpring, enableBlur, enableScale, maskObsceneWordsMode, maskObsceneWordChar, hidePassedLines, optimizeOptions, lyricLines, currentTime, isSeeking, wordFadeWidth, linePosXSpringParams, linePosYSpringParams, lineScaleSpringParams, bottomLine, lyricPlayer, onLyricLineClick, onLyricLineContextMenu, ...props }, ref) => {
	const [corePlayer, setCorePlayer] = (0, react.useState)();
	const wrapperRef = (0, react.useRef)(null);
	const currentTimeRef = (0, react.useRef)(currentTime);
	(0, react.useLayoutEffect)(() => {
		const newPlayer = new (lyricPlayer ?? _applemusic_like_lyrics_core.LyricPlayer)();
		setCorePlayer(newPlayer);
		wrapperRef.current?.appendChild(newPlayer.getElement());
		return () => {
			newPlayer?.dispose();
			setCorePlayer(void 0);
		};
	}, [lyricPlayer]);
	(0, react.useLayoutEffect)(() => {
		if (optimizeOptions !== void 0) corePlayer?.setOptimizeOptions(optimizeOptions);
		if (lyricLines !== void 0) {
			corePlayer?.setLyricLines(lyricLines, currentTimeRef.current);
			if (currentTimeRef.current !== void 0) corePlayer?.setCurrentTime(currentTimeRef.current, true);
			corePlayer?.update();
		} else {
			corePlayer?.setLyricLines([]);
			corePlayer?.update();
		}
	}, [
		corePlayer,
		lyricLines,
		optimizeOptions
	]);
	(0, react.useEffect)(() => {
		if (!disabled) {
			let canceled = false;
			let lastTime = -1;
			const onFrame = (time) => {
				if (canceled) return;
				if (lastTime === -1) lastTime = time;
				corePlayer?.update(time - lastTime);
				lastTime = time;
				requestAnimationFrame(onFrame);
			};
			corePlayer?.calcLayout();
			requestAnimationFrame(onFrame);
			return () => {
				canceled = true;
			};
		}
	}, [corePlayer, disabled]);
	(0, react.useEffect)(() => {
		if (playing !== void 0) if (playing) corePlayer?.resume();
		else corePlayer?.pause();
		else corePlayer?.resume();
	}, [corePlayer, playing]);
	(0, react.useEffect)(() => {
		if (alignAnchor !== void 0) corePlayer?.setAlignAnchor(alignAnchor);
	}, [corePlayer, alignAnchor]);
	(0, react.useEffect)(() => {
		if (hidePassedLines !== void 0) corePlayer?.setHidePassedLines(hidePassedLines);
	}, [corePlayer, hidePassedLines]);
	(0, react.useEffect)(() => {
		if (alignPosition !== void 0) corePlayer?.setAlignPosition(alignPosition);
	}, [corePlayer, alignPosition]);
	(0, react.useEffect)(() => {
		if (enableSpring !== void 0) corePlayer?.setEnableSpring(enableSpring);
		else corePlayer?.setEnableSpring(true);
	}, [corePlayer, enableSpring]);
	(0, react.useEffect)(() => {
		if (enableScale !== void 0) corePlayer?.setEnableScale(enableScale);
		else corePlayer?.setEnableScale(true);
	}, [corePlayer, enableScale]);
	(0, react.useEffect)(() => {
		corePlayer?.setEnableBlur(enableBlur ?? true);
	}, [corePlayer, enableBlur]);
	(0, react.useLayoutEffect)(() => {
		if (currentTime !== void 0) {
			corePlayer?.setCurrentTime(currentTime, isSeeking);
			currentTimeRef.current = currentTime;
		} else {
			corePlayer?.setCurrentTime(0);
			currentTimeRef.current = 0;
		}
	}, [
		corePlayer,
		currentTime,
		isSeeking
	]);
	(0, react.useEffect)(() => {
		corePlayer?.setIsSeeking(!!isSeeking);
	}, [corePlayer, isSeeking]);
	(0, react.useEffect)(() => {
		corePlayer?.setWordFadeWidth(wordFadeWidth);
	}, [corePlayer, wordFadeWidth]);
	(0, react.useEffect)(() => {
		if (linePosXSpringParams !== void 0) corePlayer?.setLinePosXSpringParams(linePosXSpringParams);
	}, [corePlayer, linePosXSpringParams]);
	(0, react.useEffect)(() => {
		if (linePosYSpringParams !== void 0) corePlayer?.setLinePosYSpringParams(linePosYSpringParams);
	}, [corePlayer, linePosYSpringParams]);
	(0, react.useEffect)(() => {
		if (lineScaleSpringParams !== void 0) corePlayer?.setLineScaleSpringParams(lineScaleSpringParams);
	}, [corePlayer, lineScaleSpringParams]);
	(0, react.useEffect)(() => {
		if (maskObsceneWordsMode !== void 0) corePlayer?.setMaskObsceneWords(maskObsceneWordsMode);
		else corePlayer?.setMaskObsceneWords(_applemusic_like_lyrics_core.MaskObsceneWordsMode.Disabled);
	}, [corePlayer, maskObsceneWordsMode]);
	(0, react.useEffect)(() => {
		if (maskObsceneWordChar !== void 0) corePlayer?.setMaskObsceneWordChar(maskObsceneWordChar);
	}, [corePlayer, maskObsceneWordChar]);
	(0, react.useEffect)(() => {
		if (onLyricLineClick) {
			const handler = (e) => onLyricLineClick(e);
			corePlayer?.addEventListener("line-click", handler);
			return () => corePlayer?.removeEventListener("line-click", handler);
		}
	}, [corePlayer, onLyricLineClick]);
	(0, react.useEffect)(() => {
		if (onLyricLineContextMenu) {
			const handler = (e) => onLyricLineContextMenu(e);
			corePlayer?.addEventListener("line-contextmenu", handler);
			return () => corePlayer?.removeEventListener("line-contextmenu", handler);
		}
	}, [corePlayer, onLyricLineContextMenu]);
	(0, react.useImperativeHandle)(ref, () => ({
		wrapperEl: wrapperRef.current,
		lyricPlayer: corePlayer
	}), [corePlayer]);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		...props,
		ref: wrapperRef
	}), corePlayer?.getBottomLineElement() && bottomLine ? (0, react_dom.createPortal)(bottomLine, corePlayer?.getBottomLineElement()) : null] });
});
//#endregion
exports.BackgroundRender = BackgroundRender;
Object.defineProperty(exports, "BaseRenderer", {
	enumerable: true,
	get: function() {
		return _applemusic_like_lyrics_core.BaseRenderer;
	}
});
exports.LyricPlayer = LyricPlayer;
Object.defineProperty(exports, "MeshGradientRenderer", {
	enumerable: true,
	get: function() {
		return _applemusic_like_lyrics_core.MeshGradientRenderer;
	}
});
Object.defineProperty(exports, "PixiRenderer", {
	enumerable: true,
	get: function() {
		return _applemusic_like_lyrics_core.PixiRenderer;
	}
});

//# sourceMappingURL=amll-react.cjs.map