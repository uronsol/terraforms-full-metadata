import fs from 'fs';
import { createClient } from 'urql';
import 'cross-fetch/polyfill';
import { NormalizedTerraform } from '..';

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

function split(arr, n) {
  const res = [];
  while (arr.length) {
    res.push(arr.splice(0, n));
  }
  return res;
}

const delayMS = (t = 200) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(t);
    }, t);
  });
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
      await delayMS(delay);
    });
    resolve(output);
  });
};

const delay = (delay: number) =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve({});
    }, delay);
  });

(async () => {
  const client = createClient({
    url: 'https://api.studio.thegraph.com/query/17746/terraforms/0.0.21',
  });

  const query = `
    query Token($id: ID!) {
      token(id: $id) {
        id
        supplementalData {
          id
        }
      }
    }
  `;

  const savedForms = fs.readFileSync('output.json').toString('utf-8');
  const terraformsJson = JSON.parse(savedForms);
  const terraforms = terraformsJson as unknown as Array<NormalizedTerraform>;

  const getData = async (item: NormalizedTerraform) => {
    const data = await client
      .query(query, {
        id: item.tokenId,
      })
      .toPromise();
    console.log(JSON.stringify(data.data, null, 2));
    if (
      !data.data ||
      !data.data.token ||
      data.data.token.supplementalData === null
    ) {
      return item;
    }
    return null;
  };

  const neededTerraforms = (await throttledPromises(getData, terraforms, 5, 50))
    // @ts-ignore
    .reduce((arr, item) => {
      if (item === null) return arr;
      return arr.concat(item);
    }, []);

  const keyedTerraforms = neededTerraforms.reduce((obj, item) => {
    obj[item.tokenId] = item;
    return obj;
  }, {});

  // @ts-ignore
  fs.writeFileSync(
    'subgraphClasses.json',
    JSON.stringify(keyedTerraforms, null, 2)
  );

  const logger = fs.createWriteStream('subgraphClasses.txt', {
    flags: 'a', // 'a' means appending (old data will be preserved)
  });

  // @ts-ignore
  for (let i = 0; i < neededTerraforms.length; i++) {
    const item = neededTerraforms[i];

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
