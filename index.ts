import dotenv from 'dotenv';
import { Contract } from '@ethersproject/contracts';
import Terraforms_ABI from './contracts/Terraforms.json';
import ERC721_METADATA_ABI from './contracts/ERC721Metadata.json';
import {
  asyncForEach,
  delayMS,
  normalizeTokenData,
  parseBigNumber,
  split,
} from './util';
import { JsonRpcProvider } from '@ethersproject/providers';
import fs from 'fs';
import { NormalizedTerraform } from './types';

dotenv.config();

const provider = new JsonRpcProvider(process.env.RPC_ENDPOINT);

let terraforms: Array<NormalizedTerraform> = [];
const failedIndexes: Array<number> = [];

export const TERRAFORMS_ADDRESS = '0x4E1f41613c9084FdB9E34E11fAE9412427480e56';

const write = (terraform: NormalizedTerraform) => {
  const renderData = terraform.renderData;
  if (renderData) {
    delete terraform['renderData'];
    fs.writeFileSync(
      `metadata/tokens/${terraform.tokenId}-render.json`,
      JSON.stringify(renderData)
    );
  }
  fs.writeFileSync(
    `metadata/tokens/${terraform.tokenId}.json`,
    JSON.stringify(terraform)
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
      const results = (await Promise.all(promises)).reduce((arr, item) => {
        if (!item) return arr;
        return arr.concat(item);
      }, []);
      output.push(...results);
      await delayMS(delay);
    });
    resolve(output);
  });
};

const fetchData = async (i: number) => {
  const metadataContract = new Contract(
    TERRAFORMS_ADDRESS,
    ERC721_METADATA_ABI,
    provider
  );
  const contract = new Contract(TERRAFORMS_ADDRESS, Terraforms_ABI, provider);
  const tokenIdBN = await contract.tokenByIndex(i);
  const tokenId = parseInt(parseBigNumber(tokenIdBN, 0, 0));

  const contractCalls = await Promise.all([
    contract.tokenHTML(tokenId),
    metadataContract.tokenURI(tokenId),
  ]);

  const normalizedTokenData = await normalizeTokenData(contractCalls);
  const {
    attributes,
    fontFamily,
    fontString,
    name,
    seedValue,
    tokenHTML,
    tokenSVG,
  } = normalizedTokenData;

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
    name,
    biome,
    mode,
    chroma,
    level: parseBigNumber(level, 0, 0),
    elevation: parseBigNumber(elevation, 0, 0),
    zoneName,
    seedValue,
    xCoordinate: parseBigNumber(xCoordinate, 0, 0),
    yCoordinate: parseBigNumber(yCoordinate, 0, 0),
    questionMarks,
    characterSet: characterSet.join('|-|'),
    zoneColors: zoneColors.join('|-|'),
    renderData: {
      fontFamily: Buffer.from(fontFamily).toString('base64'),
      fontString: Buffer.from(fontString).toString('base64'),
      structureSpaceX: parseBigNumber(structureSpaceX, 0, 0),
      structureSpaceY: parseBigNumber(structureSpaceY, 0, 0),
      structureSpaceZ: parseBigNumber(structureSpaceZ, 0, 0),
      tokenHTML: Buffer.from(tokenHTML).toString('base64'),
      tokenSVG: Buffer.from(tokenSVG).toString('base64'),
    },
  };
};

(async () => {
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
          write(data);
          return data;
        } catch {
          console.log(`Failed to fetch ${i}`);
          failedIndexes.push(i);
        }
      },
      items,
      50,
      50
    );
    // @ts-ignore
    terraforms = terraforms.concat(nextTerraforms);

    while (failedIndexes.length > 0) {
      const terraformIndex = failedIndexes.pop();
      try {
        const terraform = await fetchData(terraformIndex);
        if (!terraform) throw new Error('Must fetch terraform');
        write(terraform);
        terraforms = terraforms.concat(terraform);
      } catch {
        failedIndexes.push(terraformIndex);
      }
    }

    const terraformsIndex = terraforms.reduce((obj, item) => {
      return {
        ...obj,
        [item.tokenId]: {
          token: `tokens/${item.tokenId}.json`,
          renderData: `tokens/${item.tokenId}-render.json`,
        },
      };
    }, {});

    fs.writeFileSync(
      'metadata/index.json',
      JSON.stringify(terraformsIndex, null, 2)
    );

    if (terraforms.length !== totalSupply) {
      console.log('LENGTHS DONT MATCH');
      console.log(`local: ${terraforms.length}`);
      console.log(`supply: ${totalSupply}`);
    }

    console.log('Job complete!');
  } catch (err) {
    console.log(err);
    console.log('Errored out');
  }
  process.exit(0);
})();
