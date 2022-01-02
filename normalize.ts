import fs from 'fs';

(async () => {
  const jsonData = fs.readFileSync('output.json').toString('utf-8');
  const jsonArray = JSON.parse(jsonData);

  const keyedData = jsonArray.reduce((obj, item) => {
    obj[item.tokenId] = item;
    return obj;
  }, {});

  fs.writeFileSync('outputKeyed.json', JSON.stringify(keyedData, null, 2));
})();
