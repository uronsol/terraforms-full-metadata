import dotenv from 'dotenv';
import { Contract } from '@ethersproject/contracts';
import Terraforms_ABI from './contracts/Terraforms.json';
import ERC721_METADATA_ABI from './contracts/ERC721Metadata.json';
import ERC20_ABI from './contracts/ERC20.json';
import { asyncForEach, delayMS, parseBigNumber, split } from './util';
import { Parser } from 'json2csv';
import { JsonRpcProvider } from '@ethersproject/providers';
import fs from 'fs';

dotenv.config();

const provider = new JsonRpcProvider(process.env.RPC_ENDPOINT);

let terraforms: Array<NormalizedTerraform> = [];
const failedIndexes: Array<number> = [];

export const TERRAFORMS_ADDRESS = '0x4E1f41613c9084FdB9E34E11fAE9412427480e56';

const write = (terraforms: NormalizedTerraform[]) => {
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

  fs.writeFileSync('output.json', JSON.stringify(terraforms, null, 2));

  const keyedTerraforms = terraforms.reduce((obj, item) => {
    obj[item.tokenId] = item;
    return obj;
  }, {});

  fs.writeFileSync(
    'outputKeyed.json',
    JSON.stringify(keyedTerraforms, null, 2)
  );

  fs.writeFileSync(
    'outputKeyedMinimized.json',
    JSON.stringify(keyedTerraforms)
  );
};

const throttledPromises = (
  asyncFunction,
  items = [],
  batchSize = 1,
  delay = 0
) => {
  return new Promise(async (resolve, reject) => {
    const output = [];
    const batches = split(items, batchSize);
    await asyncForEach(batches, async (batch) => {
      const promises = batch.map(asyncFunction).map((p) => p.catch(reject));
      const results = await Promise.all(promises);
      output.push(...results);
      write(terraforms.concat(output).concat(results));
      await delayMS(delay);
    });
    resolve(output);
  });
};

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

const fetchData = async (i: number) => {
  const metadataContract = new Contract(
    TERRAFORMS_ADDRESS,
    ERC721_METADATA_ABI,
    provider
  );
  const contract = new Contract(TERRAFORMS_ADDRESS, Terraforms_ABI, provider);
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

  console.log(`Processed Terraform #${tokenId}`);

  return {
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
  };
};

(async () => {
  try {
    const savedForms = fs.readFileSync('output.json').toString('utf-8');
    const terraformsJson = JSON.parse(savedForms);
    console.log(terraformsJson);
    console.log(`Found ${terraformsJson.length} saved!`);
    terraforms = terraformsJson as unknown as Array<NormalizedTerraform>;
  } catch (err) {
    console.log('Did not find existing terraforms');
  }
  try {
    const contract = new Contract(TERRAFORMS_ADDRESS, Terraforms_ABI, provider);

    const totalSupplyBN = await contract.totalSupply();
    const totalSupply = parseInt(parseBigNumber(totalSupplyBN, 0, 0));

    const items: number[] = [];
    for (let i = terraforms.length; i < totalSupply; i++) {
      items.push(i);
    }

    // @ts-ignore
    const nextTerraforms = await throttledPromises(
      async (i: number) => {
        try {
          const data = await fetchData(i);
          return data;
        } catch {
          failedIndexes.push(i);
        }
      },
      items,
      5,
      1000
    );
    // @ts-ignore
    terraforms = terraforms.concat(nextTerraforms);

    while (failedIndexes.length > 0) {
      const terraformIndex = failedIndexes.pop();
      try {
        const terraform = await fetchData(terraformIndex);
        if (!terraform) throw new Error('Must fetch terraform');
        terraforms = terraforms.concat();
      } catch {
        failedIndexes.push(terraformIndex);
      }
    }

    if (terraforms.length !== totalSupply) {
      console.log('LENGTHS DONT MATCH');
      console.log(`local: ${terraforms.length}`);
      console.log(`supply: ${totalSupply}`);
    }
    write(terraforms);
    console.log('Job complete!');
  } catch (err) {
    console.log(err);
    console.log('Errored out');
  }
  process.exit(0);
})();
