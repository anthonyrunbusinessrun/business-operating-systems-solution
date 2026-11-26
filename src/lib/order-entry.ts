/** Reject ambiguous comma-formatted quantities instead of silently truncating them. */
export function parseOrderLines(value: string) {
  return value.split(/\r?\n/).filter(line => line.trim()).map((line, index) => {
    const cells = line.split(",").map(cell => cell.trim());
    if (cells.length !== 2 || !cells[0] || !/^[0-9]+$/.test(cells[1] ?? "") || Number(cells[1]) < 1 || Number(cells[1]) > 1000000) {
      throw new Error(`Line ${index + 1}: enter SKU,quantity with a whole quantity from 1 to 1000000; do not use thousands separators.`);
    }
    return { sku: cells[0], qty: Number(cells[1]) };
  });
}
