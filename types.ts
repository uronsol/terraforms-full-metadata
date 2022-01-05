export interface RenderData {
  fontFamily: string;
  fontString: string;
  structureSpaceX: string;
  structureSpaceY: string;
  structureSpaceZ: string;
  tokenHTML: string;
  tokenSVG: string;
}

export interface NormalizedTerraform {
  tokenId: number;
  level: string;
  zoneName: string;
  biome: string;
  chroma: string;
  mode: string;
  elevation: string;
  seedValue: string;
  xCoordinate: string;
  yCoordinate: string;
  characterSet: string;
  zoneColors: string;
  questionMarks: string;
  renderData?: RenderData;
}
