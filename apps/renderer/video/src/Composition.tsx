import {
	AbsoluteFill,
	Audio,
	Sequence,
	staticFile,
	useVideoConfig,
} from 'remotion';

import {z} from 'zod';
import {Caption} from './Caption';

export const myCompSchema = z.object({
	captions: z.array(
		z.object({text: z.string(), duration: z.number(), filename: z.string()})
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
		totalDuration += caption.duration * fps + fps * 0.5;
		return {...caption, duration: caption.duration * fps, start};
	});

	return (
		<AbsoluteFill className="bg-gray-100 items-center justify-center">
			{calcCaptions.map((caption, i) => {
				const duration = caption.duration;
				return (
					<Sequence from={caption.start} durationInFrames={duration}>
						<Caption text={caption.text} />
						<Audio src={staticFile(caption.filename)} />
					</Sequence>
				);
			})}
		</AbsoluteFill>
	);
};
