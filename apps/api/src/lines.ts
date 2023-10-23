export function splitLinesold(text: string): string[] {
  let lines = text.split(/\s*[\n.]+\s*/);

  // not more than 30 characters
  lines = lines.flatMap((line) => {
    if (line.length <= 60) {
      return [line];
    }

    const words = line.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if (currentLine.length + word.length + 1 > 60) {
        lines.push(currentLine);
        currentLine = '';
      }

      currentLine += word + ' ';
    }

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    return lines;
  });

  lines = lines.filter((line) => line.length > 0);

  console.log(lines);

  return lines;
}

export function splitLines(text: string): string[] {
  // split just at newlines and full stops and question marks and exclamation marks
  return text.split(/\s*[\n.!?]+\s*/);
}
