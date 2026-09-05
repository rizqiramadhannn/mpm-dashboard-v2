function normalizeAccountLabel(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function isInternalJagoTransfer(
  sourceFund: string,
  destinationAccount: string
) {
  const normalizedSource = normalizeAccountLabel(sourceFund);
  const normalizedDestination = normalizeAccountLabel(destinationAccount);

  return (
    normalizedSource === "BCA MPM" &&
    normalizedDestination.split(" ").includes("JAGO")
  );
}
