import axios from 'axios';
import { bech32 } from '@scure/base';

const MAINNET_URL = 'https://api.thegraph.com/subgraphs/name/opendid-protocol/mainnet';
const TESTNET_URL = 'https://api.thegraph.com/subgraphs/name/opendid-protocol/testnet';
const HEXES = Array.from({ length: 256 }, (v, i) => i.toString(16).padStart(2, '0'));
const CACHE = process.env.CACHE || '3600';
const TESTNET = process.env.TESTNET || 'false';

function bytesToHex(uint8a) {
    // pre-caching improves the speed 6x
    let hex = '';
    for (let i = 0; i < uint8a.length; i++) {
        hex += HEXES[uint8a[i]];
    }
    return hex;
}

function buildResponse(obj) {
    return {
        statusCode: 200,
        headers: {
            'cache-control': 'public, max-age=' + CACHE,
            'content-type': 'application/json'
        },
        body: JSON.stringify(obj)
    };
}

function buildEmptyResponse() {
    return buildResponse({
        names: {}
    });
}

exports.handler = async function (event, context) {
    let name = (event.queryStringParameters.name || '').toLowerCase();
    if (! /^[a-z0-9]{3,50}$/.test(name)) {
        return buildEmptyResponse();
    }
    let
        query = {
            query: `
{
  names(where: { name: "${name}" }) {
    id
    owner
    name
    records {
      label
      content
    }
  }
}
`
        };
    let
        resp = await axios.post(TESTNET === 'true' ? TESTNET_URL : MAINNET_URL, query),
        names = resp.data.data.names;
    if (names.length === 0) {
        return buildEmptyResponse();
    }
    let
        did = names[0],
        nostr,
        records = did.records;
    if (records.length === 0) {
        return buildEmptyResponse();
    }
    for (let record of records) {
        if (record.label === 'nostr') {
            nostr = record.content;
            break;
        }
    }
    if (!nostr || !nostr.startsWith('npub1')) {
        return buildEmptyResponse();
    }
    let npub = null;
    try {
        npub = bech32.fromWords(bech32.decode(nostr).words);
    }
    catch (err) {
        return buildEmptyResponse();
    }

    if (npub && npub.length === 32) {
        let results = {};
        results[name] = bytesToHex(npub);
        return buildResponse({
            names: results
        });
    }

    return buildEmptyResponse();
};