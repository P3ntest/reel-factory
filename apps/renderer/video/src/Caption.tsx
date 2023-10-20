import {AbsoluteFill} from 'remotion';

export function Caption({text}: {text: string}) {
	return (
		<AbsoluteFill className="flex flex-col items-center justify-center">
			<span
				className="text-8xl font-bold"
				style={{
					fontFamily: 'sans-serif',
					color: 'black',
					textShadow: '2px 20px 100px yellow',
				}}
			>
				{text}
			</span>
		</AbsoluteFill>
	);
}
