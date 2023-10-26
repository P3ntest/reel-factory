import {
	AbsoluteFill,
	Audio,
	Loop,
	OffthreadVideo,
	Sequence,
	Video,
	staticFile,
	useVideoConfig,
} from 'remotion';

import {z} from 'zod';
import {Caption} from './Caption';
import {useMemo, useState} from 'react';

export const myCompSchema = z.object({
	captions: z.array(
		z.object({
			text: z.string(),
			duration: z.number(),
			filename: z.string().optional(),
		})
	),
	stockI: z.number().optional(),
});

const stocks = [
	{
		filename: 'minecraft.mp4',
		durationInSeconds: 86,
	},
	{
		filename: 'subway.mp4',
		durationInSeconds: 3 * 60,
		style: {
			transform: 'scale(1.2)',
		},
	},
	{
		filename: 'asmr.mp4',
		durationInSeconds: 3 * 60,
		style: {
			transform: 'scale(3.2)',
		},
	},
];

export const MyComposition: React.FC<z.infer<typeof myCompSchema>> = ({
	captions,
	stockI,
}) => {
	const {fps} = useVideoConfig();
	// go through captions and add a relative starting time and duration in frames
	let totalDuration = 0;
	const calcCaptions = captions.map((caption) => {
		const start = totalDuration;
		totalDuration += caption.duration * fps;
		return {...caption, duration: caption.duration * fps, start};
	});

	const stock = useMemo(() => {
		return stocks[stockI ?? Math.floor(Math.random() * stocks.length)];
	}, [stockI]);

	return (
		<AbsoluteFill className="">
			{calcCaptions.map((caption, i) => {
				const duration = caption.duration;
				return (
					<Sequence from={caption.start} durationInFrames={duration}>
						<Caption text={caption.text} length={duration} />
						{caption.filename && (
							<Audio src={staticFile('temp/' + caption.filename)} />
						)}
					</Sequence>
				);
			})}
			<div className="w-screen h-full flex items-stretch justify-stretch">
				<Loop durationInFrames={stock.durationInSeconds * fps - 100}>
					<OffthreadVideo
						src={staticFile(stock.filename)}
						startFrom={100}
						muted
						style={{
							zIndex: -1,
							width: '100%',
							...(stock.style ?? {}),
						}}
					/>
				</Loop>
			</div>
		</AbsoluteFill>
	);
};
