import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';

export function Caption({text, length}: {text: string; length: number}) {
	const words = text.split(' ');
	const wordDuration = length / words.length;

	const frame = useCurrentFrame();

	const currentWordIndex = Math.floor(frame / wordDuration);

	return <SingleCaption text={text} highlightIndex={currentWordIndex} />;

	// return words.map((word, i) => (
	// 	<Sequence from={i * wordDuration} durationInFrames={wordDuration}>
	// 		<SingleCaption text={word} highlightIndex={currentWordIndex} />
	// 	</Sequence>
	// ));
}

function SingleCaption({
	text,
	highlightIndex,
}: {
	text: string;
	highlightIndex?: number;
}) {
	return (
		<AbsoluteFill className="flex flex-col items-center justify-center">
			<span className="z-10 text-center leading-none px-10">
				{text.split(' ').map((letter, i) => {
					const isHighlighted = highlightIndex === i;

					const shadow = isHighlighted ? 'yellow' : 'lightblue';

					return (
						<span
							key={i}
							style={{
								fontSize: 120,
								fontWeight: '900',
								fontFamily: 'Comic Sans MS',
								color: isHighlighted ? 'red' : 'white',
								textShadow: `0 1px 0px ${shadow}, 1px 0 0px ${shadow}, 1px 2px 1px ${shadow}, 2px 1px 1px ${shadow}, 2px 3px 2px ${shadow}, 3px 2px 2px ${shadow}, 3px 4px 2px ${shadow}, 4px 3px 3px ${shadow}, 4px 5px 3px ${shadow}, 5px 4px 2px ${shadow}, 5px 6px 2px ${shadow}, 6px 5px 2px ${shadow}, 6px 7px 1px ${shadow}, 7px 6px 1px ${shadow}, 7px 8px 0px ${shadow}, 8px 7px 0px ${shadow}`,
							}}
						>
							{letter}{' '}
						</span>
					);
				})}
			</span>
		</AbsoluteFill>
	);
}
