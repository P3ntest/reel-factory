import {Composition} from 'remotion';
import {MyComposition, myCompSchema} from './Composition';
import './style.css';

export const RemotionRoot: React.FC = () => {
	return (
		<>
			<Composition
				id="MyComp"
				component={MyComposition}
				durationInFrames={240}
				fps={30}
				width={1080}
				height={1920}
				schema={myCompSchema}
				calculateMetadata={({props}) => {
					const fps = 30;
					const duration = props.captions.reduce(
						(acc, curr) => acc + (curr.duration ?? 0),
						0
					);

					return {
						durationInFrames: Math.ceil(duration * fps),
						width: 1080,
						height: 1920,
						fps,
					};
				}}
				defaultProps={{
					captions: [
						{
							text: 'family had a poop knife',
							duration: 2,
						},
					],
				}}
			/>
		</>
	);
};
