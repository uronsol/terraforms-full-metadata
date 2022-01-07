import dotenv from 'dotenv';
import fs from 'fs';
import { create } from 'ipfs-http-client';
import { throttledPromises } from './util';

dotenv.config();

const projectId = process.env.IPFS_PROJECT_ID;
const projectSecret = process.env.IPFS_PROJECT_SECRET;
const auth =
  'Basic ' + Buffer.from(projectId + ':' + projectSecret).toString('base64');

const ipfs = create({
  host: 'ipfs.infura.io',
  port: 5001,
  protocol: 'https',
  headers: {
    authorization: auth,
  },
});

interface RootIPFS {
  tokensByIndex?: string;
  renderDataByIndex?: string;
  tokensAsArray?: string;
  renderDataAsArray?: string;
}

(async () => {
  const tokens = fs
    .readdirSync('./metadata/tokens')
    .filter((i) => i.indexOf('render') === -1);
  const uploadedTokens: Record<string, string> = {};
  const uploadedRenderData: Record<string, string> = {};
  const failedTokens: Array<string> = [];
  const failedRenderData: Array<string> = [];

  await throttledPromises(
    async (fileId: string) => {
      const path = fileId.split('.');
      const tokenFile = fs
        .readFileSync(`./metadata/tokens/${path[0]}.json`)
        .toString();
      const renderDataFile = fs
        .readFileSync(`./metadata/tokens/${path[0]}-render.json`)
        .toString();
      const token = JSON.parse(tokenFile);
      const tokenId = token.tokenId;
      try {
        const added = await ipfs.add(renderDataFile);
        console.log(`Added renderData ${tokenId}`);
        await ipfs.pin.add(added.cid);
        console.log(`Pinned renderData ${tokenId}`);
        uploadedRenderData[tokenId] = added.path;
        console.log(`Uploaded renderData ${tokenId}`);
      } catch {
        failedRenderData.push(tokenId);
        console.log(`Failed to upload render data ${tokenId}`);
      }
      try {
        const added = await ipfs.add(tokenFile);
        console.log(`Added token ${tokenId}`);
        await ipfs.pin.add(added.cid);
        console.log(`Pinned token ${tokenId}`);
        uploadedTokens[tokenId] = added.path;
        console.log(`Uploaded token ${tokenId}`);
      } catch {
        failedTokens.push(tokenId);
        console.log(`Failed to upload token ${tokenId}`);
      }
    },
    tokens,
    50,
    50
  );

  while (failedTokens.length > 0) {
    const fail = failedTokens.pop();
    const file = fs.readFileSync(`./metadata/tokens/${fail}.json`).toString();
    const fileJson = JSON.parse(file);
    const tokenId = fileJson.tokenId;
    try {
      const added = await ipfs.add(file);
      await ipfs.pin.add(added.cid);
      uploadedTokens[tokenId] = added.path;
      console.log(`Uploaded token ${tokenId}`);
    } catch {
      failedTokens.push(tokenId);
      console.log(`Failed to upload token ${tokenId}`);
    }
  }

  while (failedRenderData.length > 0) {
    const fail = failedRenderData.pop();
    const file = fs
      .readFileSync(`./metadata/tokens/${fail}-render.json`)
      .toString();
    const fileJson = JSON.parse(file);
    const tokenId = fileJson.tokenId;
    try {
      const added = await ipfs.add(file);
      await ipfs.pin.add(added.cid);
      uploadedRenderData[tokenId] = added.path;
      console.log(`Uploaded renderData ${tokenId}`);
    } catch {
      failedRenderData.push(tokenId);
      console.log(`Failed to upload render data ${tokenId}`);
    }
  }

  fs.writeFileSync(
    'metadata/ipfs/tokensByIndex.json',
    JSON.stringify(uploadedTokens, null, 2)
  );

  fs.writeFileSync(
    'metadata/ipfs/renderDataByIndex.json',
    JSON.stringify(uploadedRenderData, null, 2)
  );

  const tokenHashArray: string[] = [];
  const renderDataArray: string[] = [];

  for (let i = 0; i < Object.keys(uploadedTokens).length; i++) {
    const index = `${i + 1}`;
    const token = uploadedTokens[index];
    const renderData = uploadedRenderData[index];
    tokenHashArray.push(token);
    renderDataArray.push(renderData);
  }

  fs.writeFileSync(
    'metadata/ipfs/tokensAsArray.json',
    JSON.stringify(tokenHashArray)
  );
  fs.writeFileSync(
    'metadata/ipfs/renderDataAsArray.json',
    JSON.stringify(renderDataArray)
  );

  const tokensByIndexFile = fs.readFileSync('metadata/ipfs/tokensByIndex.json');
  const renderDataByIndexFile = fs.readFileSync(
    'metadata/ipfs/renderDataByIndex.json'
  );
  const tokensAsArrayFile = fs.readFileSync('metadata/ipfs/tokensAsArray.json');
  const renderDataAsArrayFile = fs.readFileSync(
    'metadata/ipfs/renderDataAsArray.json'
  );
  const rootFiles: RootIPFS = {};
  while (!rootFiles.tokensByIndex) {
    try {
      const added = await ipfs.add(tokensByIndexFile);
      await ipfs.pin.add(added.cid);
      rootFiles['tokensByIndex'] = added.path;
      console.log(`Uploaded tokensByIndex`);
    } catch (err) {
      console.log('Failed to upload tokensByIndex');
    }
  }
  while (!rootFiles.renderDataByIndex) {
    try {
      const added = await ipfs.add(renderDataByIndexFile);
      await ipfs.pin.add(added.cid);
      rootFiles['renderDataByIndex'] = added.path;
      console.log(`Uploaded renderDataByIndex`);
    } catch (err) {
      console.log('Failed to upload renderDataByIndex');
    }
  }
  while (!rootFiles.tokensAsArray) {
    try {
      const added = await ipfs.add(tokensAsArrayFile);
      await ipfs.pin.add(added.cid);
      rootFiles['tokensAsArray'] = added.path;
      console.log(`Uploaded tokensAsArray`);
    } catch (err) {
      console.log('Failed to upload tokensAsArray');
    }
  }
  while (!rootFiles.renderDataAsArray) {
    try {
      const added = await ipfs.add(renderDataAsArrayFile);
      await ipfs.pin.add(added.cid);
      rootFiles['renderDataAsArray'] = added.path;
      console.log(`Uploaded renderDataAsArray`);
    } catch (err) {
      console.log('Failed to upload renderDataAsArray');
    }
  }
  fs.writeFileSync(
    'metadata/ipfs/index.json',
    JSON.stringify(rootFiles, null, 2)
  );
})();
