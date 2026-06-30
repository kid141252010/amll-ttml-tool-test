import { BackgroundRender as BackgroundRender$1, BaseRenderer, LyricPlayer as LyricPlayer$1, MaskObsceneWordsMode, MeshGradientRenderer, MeshGradientRenderer as MeshGradientRenderer$1, PixiRenderer } from "@applemusic-like-lyrics/core";
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { createPortal } from "react-dom";
//#region src/bg-render.tsx
/**
* 流体背景渲染组件，通过提供图片链接可以显示出酷似 Apple Music 的流体背景效果
*/
const BackgroundRender = forwardRef(({ album, albumIsVideo, fps, playing, flowSpeed, renderScale, staticMode, lowFreqVolume, hasLyric, renderer, style, ...props }, ref) => {
	const coreBGRenderRef = useRef(null);
	const wrapperRef = useRef(null);
	const lastRendererRef = useRef(null);
	const curRenderer = renderer ?? MeshGradientRenderer$1;
	useEffect(() => {
		if (lastRendererRef.current !== curRenderer || coreBGRenderRef.current === void 0) {
			lastRendererRef.current = curRenderer;
			coreBGRenderRef.current?.dispose();
			coreBGRenderRef.current = BackgroundRender$1.new(curRenderer);
		}
	}, [curRenderer]);
	useEffect(() => {
		if (curRenderer && album) coreBGRenderRef.current?.setAlbum(album, albumIsVideo);
	}, [
		curRenderer,
		album,
		albumIsVideo
	]);
	useEffect(() => {
		if (curRenderer && fps) coreBGRenderRef.current?.setFPS(fps);
	}, [curRenderer, fps]);
	useEffect(() => {
		if (!curRenderer) return;
		if (playing === void 0) coreBGRenderRef.current?.resume();
		else if (playing) coreBGRenderRef.current?.resume();
		else coreBGRenderRef.current?.pause();
	}, [curRenderer, playing]);
	useEffect(() => {
		if (!curRenderer) return;
		if (flowSpeed) coreBGRenderRef.current?.setFlowSpeed(flowSpeed);
	}, [curRenderer, flowSpeed]);
	useEffect(() => {
		if (!curRenderer) return;
		coreBGRenderRef.current?.setStaticMode(staticMode ?? false);
	}, [curRenderer, staticMode]);
	useEffect(() => {
		if (curRenderer && renderScale) coreBGRenderRef.current?.setRenderScale(renderScale ?? .5);
	}, [curRenderer, renderScale]);
	useEffect(() => {
		if (curRenderer && lowFreqVolume) coreBGRenderRef.current?.setLowFreqVolume(lowFreqVolume ?? 1);
	}, [curRenderer, lowFreqVolume]);
	useEffect(() => {
		if (curRenderer && hasLyric !== void 0) coreBGRenderRef.current?.setHasLyric(hasLyric ?? true);
	}, [curRenderer, hasLyric]);
	useEffect(() => {
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
	useImperativeHandle(ref, () => ({
		wrapperEl: wrapperRef.current,
		bgRender: coreBGRenderRef.current
	}), [wrapperRef.current, coreBGRenderRef.current]);
	return /* @__PURE__ */ jsx("div", {
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
const LyricPlayer = forwardRef(({ disabled, playing, alignAnchor, alignPosition, enableSpring, enableBlur, enableScale, maskObsceneWordsMode, maskObsceneWordChar, hidePassedLines, optimizeOptions, lyricLines, currentTime, isSeeking, wordFadeWidth, linePosXSpringParams, linePosYSpringParams, lineScaleSpringParams, bottomLine, lyricPlayer, onLyricLineClick, onLyricLineContextMenu, ...props }, ref) => {
	const [corePlayer, setCorePlayer] = useState();
	const wrapperRef = useRef(null);
	const currentTimeRef = useRef(currentTime);
	useLayoutEffect(() => {
		const newPlayer = new (lyricPlayer ?? LyricPlayer$1)();
		setCorePlayer(newPlayer);
		wrapperRef.current?.appendChild(newPlayer.getElement());
		return () => {
			newPlayer?.dispose();
			setCorePlayer(void 0);
		};
	}, [lyricPlayer]);
	useLayoutEffect(() => {
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
	useEffect(() => {
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
	useEffect(() => {
		if (playing !== void 0) if (playing) corePlayer?.resume();
		else corePlayer?.pause();
		else corePlayer?.resume();
	}, [corePlayer, playing]);
	useEffect(() => {
		if (alignAnchor !== void 0) corePlayer?.setAlignAnchor(alignAnchor);
	}, [corePlayer, alignAnchor]);
	useEffect(() => {
		if (hidePassedLines !== void 0) corePlayer?.setHidePassedLines(hidePassedLines);
	}, [corePlayer, hidePassedLines]);
	useEffect(() => {
		if (alignPosition !== void 0) corePlayer?.setAlignPosition(alignPosition);
	}, [corePlayer, alignPosition]);
	useEffect(() => {
		if (enableSpring !== void 0) corePlayer?.setEnableSpring(enableSpring);
		else corePlayer?.setEnableSpring(true);
	}, [corePlayer, enableSpring]);
	useEffect(() => {
		if (enableScale !== void 0) corePlayer?.setEnableScale(enableScale);
		else corePlayer?.setEnableScale(true);
	}, [corePlayer, enableScale]);
	useEffect(() => {
		corePlayer?.setEnableBlur(enableBlur ?? true);
	}, [corePlayer, enableBlur]);
	useLayoutEffect(() => {
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
	useEffect(() => {
		corePlayer?.setIsSeeking(!!isSeeking);
	}, [corePlayer, isSeeking]);
	useEffect(() => {
		corePlayer?.setWordFadeWidth(wordFadeWidth);
	}, [corePlayer, wordFadeWidth]);
	useEffect(() => {
		if (linePosXSpringParams !== void 0) corePlayer?.setLinePosXSpringParams(linePosXSpringParams);
	}, [corePlayer, linePosXSpringParams]);
	useEffect(() => {
		if (linePosYSpringParams !== void 0) corePlayer?.setLinePosYSpringParams(linePosYSpringParams);
	}, [corePlayer, linePosYSpringParams]);
	useEffect(() => {
		if (lineScaleSpringParams !== void 0) corePlayer?.setLineScaleSpringParams(lineScaleSpringParams);
	}, [corePlayer, lineScaleSpringParams]);
	useEffect(() => {
		if (maskObsceneWordsMode !== void 0) corePlayer?.setMaskObsceneWords(maskObsceneWordsMode);
		else corePlayer?.setMaskObsceneWords(MaskObsceneWordsMode.Disabled);
	}, [corePlayer, maskObsceneWordsMode]);
	useEffect(() => {
		if (maskObsceneWordChar !== void 0) corePlayer?.setMaskObsceneWordChar(maskObsceneWordChar);
	}, [corePlayer, maskObsceneWordChar]);
	useEffect(() => {
		if (onLyricLineClick) {
			const handler = (e) => onLyricLineClick(e);
			corePlayer?.addEventListener("line-click", handler);
			return () => corePlayer?.removeEventListener("line-click", handler);
		}
	}, [corePlayer, onLyricLineClick]);
	useEffect(() => {
		if (onLyricLineContextMenu) {
			const handler = (e) => onLyricLineContextMenu(e);
			corePlayer?.addEventListener("line-contextmenu", handler);
			return () => corePlayer?.removeEventListener("line-contextmenu", handler);
		}
	}, [corePlayer, onLyricLineContextMenu]);
	useImperativeHandle(ref, () => ({
		wrapperEl: wrapperRef.current,
		lyricPlayer: corePlayer
	}), [corePlayer]);
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("div", {
		...props,
		ref: wrapperRef
	}), corePlayer?.getBottomLineElement() && bottomLine ? createPortal(bottomLine, corePlayer?.getBottomLineElement()) : null] });
});
//#endregion
export { BackgroundRender, BaseRenderer, LyricPlayer, MeshGradientRenderer, PixiRenderer };

//# sourceMappingURL=amll-react.mjs.map