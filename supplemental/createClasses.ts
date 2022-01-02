import fs from 'fs';

// constructor(id: string,
//   tokenId: number,
//   level: number,
//   xCoordinate: number,
//   yCoordinate: number,
//   elevation: number,
//   structureSpaceX: number,
//   structureSpaceY: number,
//   structureSpaceZ: number,
//   zoneName: string,
//   zoneColors: string[],
//   characterSet: string[],
//   seed: number) {
//     this.tokenId = tokenId
//     this.level = level
//     this.xCoordinate = xCoordinate
//     this.yCoordinate = yCoordinate
//     this.elevation = elevation
//     this.structureSpaceX = structureSpaceX
//     this.structureSpaceY = structureSpaceY
//     this.structureSpaceZ = structureSpaceZ
//     this.zoneName = zoneName
//     this.zoneColors = zoneColors
//     this.characterSet = characterSet
//     this.seed = seed
// }

(async () => {
  const jsonData = fs.readFileSync('output.json').toString('utf-8');
  const jsonArray = JSON.parse(jsonData);

  const logger = fs.createWriteStream('classes.txt', {
    flags: 'a', // 'a' means appending (old data will be preserved)
  });
  for (let i = 0; i < jsonArray.length; i++) {
    const item = jsonArray[i];
    logger.write(
      `new SupplementalDataItem(${item.tokenId}, ${item.level}, ${
        item.xCoordinate
      }, ${item.yCoordinate}, ${item.elevation}, ${item.structureSpaceY}, ${
        item.structureSpaceX
      }, ${item.structureSpaceZ}, \"${item.zoneName}\", \[${item.zoneColors.map(
        (it) => `\"${it}\"`
      )}\], \[${item.characterSet.map((it) => `\"${it}\"`)}\], ${
        item.seedValue
      }),`
    );
  }
})();
