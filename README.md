# Terraforms Full Metadata

Script that pulls metadata and supplemental data for [Terraforms by Mathcastles](https://opensea.io/collection/terraforms).

## I Just Want the Data

Data is provided as part of this repository. Because of the large size of the data collected we index the individual token files.

- `metadata/index.json` <- indexes individual files
- `metadata/tokens/{id}.json`

## To run this script

1. Rename `.env.example` to `.env` and fill out the required values
2. To use multiple wallet addresses, separate them with a `|` character as the deliminator
3. `yarn && yarn start`

## Other examples

- Some examples for other types of queries exist in `supplemental`
