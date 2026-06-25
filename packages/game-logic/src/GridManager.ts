export class GridManager {
  private freeCellsArray: number[];
  private cellToIndexMap: Map<number, number>;
  private cellOccupancyCount: Map<number, number>;
  public readonly width: number;
  public readonly height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    const totalCells = width * height;
    
    this.freeCellsArray = new Array(totalCells);
    this.cellToIndexMap = new Map();
    this.cellOccupancyCount = new Map();
    
    for (let i = 0; i < totalCells; i++) {
      this.freeCellsArray[i] = i;
      this.cellToIndexMap.set(i, i);
    }
  }

  getIndex(x: number, y: number): number {
    return y * this.width + x;
  }

  getCoords(index: number): { x: number, y: number } {
    return { x: index % this.width, y: Math.floor(index / this.width) };
  }

  isOccupied(x: number, y: number): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return true;
    return !this.cellToIndexMap.has(this.getIndex(x, y));
  }

  occupy(x: number, y: number) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const cellIndex = this.getIndex(x, y);
    
    const count = this.cellOccupancyCount.get(cellIndex) || 0;
    this.cellOccupancyCount.set(cellIndex, count + 1);
    
    if (count > 0) return; // Already occupied, just incremented ref count

    const arrayIndex = this.cellToIndexMap.get(cellIndex);
    if (arrayIndex === undefined) return;

    const lastArrayIndex = this.freeCellsArray.length - 1;
    const lastCellIndex = this.freeCellsArray[lastArrayIndex];

    // Swap with last
    this.freeCellsArray[arrayIndex] = lastCellIndex;
    this.cellToIndexMap.set(lastCellIndex, arrayIndex);

    // Remove last
    this.freeCellsArray.pop();
    this.cellToIndexMap.delete(cellIndex);
  }

  free(x: number, y: number) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const cellIndex = this.getIndex(x, y);
    
    const count = this.cellOccupancyCount.get(cellIndex) || 0;
    if (count === 0) return; // Already completely free
    
    if (count > 1) {
      this.cellOccupancyCount.set(cellIndex, count - 1);
      return; // Still occupied by something else
    }
    
    this.cellOccupancyCount.delete(cellIndex);
    
    if (this.cellToIndexMap.has(cellIndex)) return;

    const newArrayIndex = this.freeCellsArray.length;
    this.freeCellsArray.push(cellIndex);
    this.cellToIndexMap.set(cellIndex, newArrayIndex);
  }

  getRandomFreeCell(): { x: number, y: number } | null {
    if (this.freeCellsArray.length === 0) return null;
    const randomArrayIndex = Math.floor(Math.random() * this.freeCellsArray.length);
    const cellIndex = this.freeCellsArray[randomArrayIndex];
    return this.getCoords(cellIndex);
  }
}
