export function parseAge(creationTimestamp: string | Date): string {
  if (!creationTimestamp) {
    return "";
  }

  const created = typeof creationTimestamp === "string" 
    ? new Date(creationTimestamp) 
    : creationTimestamp;

  let totalSeconds = Math.floor((Date.now() - created.getTime()) / 1000);

  if (totalSeconds < 1) {
    return "0s";
  }

  // Define units in seconds, from largest to smallest
  const units: [string, number][] = [
    ["y", 365 * 24 * 60 * 60],
    ["mo", 30 * 24 * 60 * 60],
    ["d", 24 * 60 * 60],
    ["h", 60 * 60],
    ["m", 60],
    ["s", 1],
  ];

  const parts: string[] = [];

  // Iterate through units to build the output string
  for (const [label, unitInSeconds] of units) {
    if (parts.length >= 2) {
      break; // Stop after we have two parts
    }

    const value = Math.floor(totalSeconds / unitInSeconds);
    
    if (value > 0) {
      parts.push(`${value}${label}`);
      totalSeconds %= unitInSeconds; // Update totalSeconds to the remainder
    }
  }

  return parts.join("");
}
