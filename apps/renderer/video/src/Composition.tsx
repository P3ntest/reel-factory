import {
	AbsoluteFill,
	Audio,
	OffthreadVideo,
	Sequence,
	Video,
	staticFile,
	useVideoConfig,
} from 'remotion';

import {z} from 'zod';
import {Caption} from './Caption';

export const myCompSchema = z.object({
	captions: z.array(
		z.object({
			text: z.string(),
			duration: z.number(),
			filename: z.string().optional(),
		})
	),
});

export const MyComposition: React.FC<z.infer<typeof myCompSchema>> = ({
	captions,
}) => {
	const {fps} = useVideoConfig();
	// go through captions and add a relative starting time and duration in frames
	let totalDuration = 0;
	const calcCaptions = captions.map((caption) => {
		const start = totalDuration;
		totalDuration += caption.duration * fps;
		return {...caption, duration: caption.duration * fps, start};
	});

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
			<OffthreadVideo
				src={staticFile('minecraft.mp4')}
				startFrom={100}
				muted
				style={{
					zIndex: -1,
				}}
			/>
		</AbsoluteFill>
	);
};
