import dotenv from 'dotenv';
import { Contract } from '@ethersproject/contracts';
import Terraforms_ABI from './contracts/Terraforms.json';
import ERC721_METADATA_ABI from './contracts/ERC721Metadata.json';
import ERC20_ABI from './contracts/ERC20.json';
import { parseBigNumber } from './util';
import { Parser } from 'json2csv';
import { JsonRpcProvider } from '@ethersproject/providers';
import fs from 'fs';

dotenv.config();

const provider = new JsonRpcProvider(process.env.RPC_ENDPOINT);

export const TERRAFORMS_ADDRESS = '0x4E1f41613c9084FdB9E34E11fAE9412427480e56';

export interface NormalizedTerraform {
  biome: string;
  chroma: string;
  elevation: string;
  level: string;
  mode: string;
  questionMarks: string;
  seedValue: string;
  structureSpaceX: string;
  structureSpaceY: string;
  structureSpaceZ: string;
  tokenId: number;
  xCoordinate: string;
  yCoordinate: string;
  zoneName: string;
  zoneColors: string[];
  characterSet: string[];
}

(async () => {
  const tokenContract = new Contract(TERRAFORMS_ADDRESS, ERC20_ABI, provider);
  const metadataContract = new Contract(
    TERRAFORMS_ADDRESS,
    ERC721_METADATA_ABI,
    provider
  );
  const contract = new Contract(TERRAFORMS_ADDRESS, Terraforms_ABI, provider);
  const terraforms: Array<NormalizedTerraform> = [];

  const totalSupplyBN = await contract.totalSupply();
  const totalSupply = parseInt(parseBigNumber(totalSupplyBN, 0, 0));

  for (let i = 1967; i < totalSupply; i++) {
    const tokenIdBN = await contract.tokenByIndex(i);
    const tokenId = parseInt(parseBigNumber(tokenIdBN, 0, 0));

    const tokenHTML = await contract.tokenHTML(tokenId);
    const seedMatches = tokenHTML.match(/SEED=(.*?);/);
    const seedValue = seedMatches[1];

    const metadata64 = (await metadataContract.tokenURI(tokenId)).replace(
      'data:application/json;base64,',
      ''
    );
    const metadataBuffer = Buffer.from(metadata64, 'base64');
    const { attributes } = JSON.parse(metadataBuffer.toString('utf-8'));
    const { mode, biome, chroma, questionMarks } = attributes.reduce(
      (attrs, attr) => {
        if (attr.trait_type === 'Mode') {
          attrs['mode'] = attr.value;
        }
        if (attr.trait_type === 'Biome') {
          attrs['biome'] = attr.value;
        }
        if (attr.trait_type === 'Chroma') {
          attrs['chroma'] = attr.value;
        }
        if (attr.trait_type === '???') {
          attrs['questionMarks'] = attr.value;
        }
        return attrs;
      },
      {}
    );

    const supplementalData = await contract.tokenSupplementalData(tokenId);

    if (!supplementalData) return;

    const {
      elevation,
      level,
      structureSpaceX,
      structureSpaceY,
      structureSpaceZ,
      xCoordinate,
      yCoordinate,
      zoneName,
      zoneColors,
      characterSet,
    } = supplementalData;

    terraforms.push({
      tokenId,
      level: parseBigNumber(level, 0, 0),
      elevation: parseBigNumber(elevation, 0, 0),
      zoneName,
      seedValue,
      structureSpaceX: parseBigNumber(structureSpaceX, 0, 0),
      structureSpaceY: parseBigNumber(structureSpaceY, 0, 0),
      structureSpaceZ: parseBigNumber(structureSpaceZ, 0, 0),
      xCoordinate: parseBigNumber(xCoordinate, 0, 0),
      yCoordinate: parseBigNumber(yCoordinate, 0, 0),
      biome,
      mode,
      chroma,
      questionMarks,
      zoneColors,
      characterSet,
    });
    console.log(`Processed Terraform #${tokenId}`);

    const fields = [
      'tokenId',
      'level',
      'biome',
      'elevation',
      'zoneName',
      'xCoordinate',
      'yCoordinate',
      'seedValue',
      'structureSpaceX',
      'structureSpaceY',
      'structureSpaceZ',
      'chroma',
      'mode',
      'questionMarks',
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(terraforms);
    fs.writeFileSync('output.csv', csv);
    console.log('Job complete!');
  }
})();
