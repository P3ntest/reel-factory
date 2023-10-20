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
				defaultProps={{
					captions: [
						{
							text: 'Hello',
							duration: 30,
						},
						{
							text: 'World',
							duration: 30,
						},
						{
							text: '!',
							duration: 30,
						},
					],
				}}
			/>
		</>
	);
};
