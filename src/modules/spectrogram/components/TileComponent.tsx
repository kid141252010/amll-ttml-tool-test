import { memo, useEffect, useRef } from "react";
import styles from "./AudioSpectrogram.module.css";

export interface TileComponentProps {
	tileId: string;
	left: number;
	width: number;
	height: number;
	canvasWidth: number;
	bitmap?: ImageBitmap;
}

export const TileComponent = memo(
	({
		tileId,
		left,
		width,
		height,
		canvasWidth,
		bitmap,
	}: TileComponentProps) => {
		const canvasRef = useRef<HTMLCanvasElement>(null);
		const currentBitmapRef = useRef<ImageBitmap | undefined>(undefined);

		useEffect(() => {
			// 注意：bitmap 的生命周期由 LRU 缓存管理，组件只负责绘制，不关闭 bitmap
			if (bitmap && canvasRef.current) {
				const canvas = canvasRef.current;
				if (canvas.width !== bitmap.width) canvas.width = bitmap.width;
				if (canvas.height !== bitmap.height) canvas.height = bitmap.height;
				const ctx = canvas.getContext("2d");
				// 清除画布
				ctx?.clearRect(0, 0, canvas.width, canvas.height);
				// 绘制 bitmap
				try {
					ctx?.drawImage(bitmap, 0, 0);
				} catch (e) {
					// 如果 bitmap 无效，忽略绘制错误
					console.warn("Failed to draw bitmap:", e);
				}
			}
			// 更新当前 bitmap 引用（仅用于追踪，不管理生命周期）
			currentBitmapRef.current = bitmap;
		}, [bitmap]);

		return (
			<canvas
				ref={canvasRef}
				id={tileId}
				width={canvasWidth > 0 ? canvasWidth : 1}
				height={height}
				className={styles.tileCanvas}
				style={{
					left: `${left}px`,
					width: `${width}px`,
					backgroundColor: bitmap ? "transparent" : "var(--gray-3)",
				}}
			/>
		);
	},
);
