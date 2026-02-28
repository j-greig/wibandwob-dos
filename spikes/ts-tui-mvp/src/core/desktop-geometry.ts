import type blessed from "blessed";

export interface DesktopGeometry {
  width: number;
  height: number;
  cellAspect: number;
}

export class DesktopGeometryService {
  constructor(
    private readonly screen: blessed.Widgets.Screen,
    private readonly cellAspect = Number.parseFloat(process.env.WIBWOB_CELL_ASPECT ?? "2.0") || 2.0
  ) {}

  getGeometry(): DesktopGeometry {
    return {
      width: Number(this.screen.width),
      height: Number(this.screen.height),
      cellAspect: this.cellAspect
    };
  }
}
