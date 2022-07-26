const fs = require('fs');

// FETCH
const fetch = require('node-fetch');

const dataETH = {};
const dataBSC = {};

//// LIST ON COINGECKO ////
const coingeckoTokensJSON = require('./tokenLists/coingecko.json');

const coingeckoListArguments= {
    origin: "Coingecko",
    URL: "https://tokens.coingecko.com/uniswap/all.json",
    fileName: "coingecko",
    chainId: 1,
    defaultList: coingeckoTokensJSON
}

const pancakeTop100ListArguments= {
    origin: "PancakeTop100",
    URL: "https://tokens.pancakeswap.finance/pancakeswap-top-100.json",
    fileName: "pancakeTop100",
    chainId: 56,
    defaultList: coingeckoTokensJSON
}


const sushiswap1000PlusList= {
    origin: "Sushiswap1000Plus",
    URL: "https://unpkg.com/@sushiswap/default-token-list@latest/build/sushiswap-default.tokenlist.json",
    fileName: "sushiswap1000PlusTokens",
    chainId: 1,
    defaultList: coingeckoTokensJSON
}

async function getTokens(args) {
    let {origin, URL, fileName, chainId, defaultList} = args;
    let body;
    let data;
    try{
        let webResponse = await fetch(URL);
        if(!webResponse.ok) {
            throw(`HTTP error! status: ${response.status} from ${origin} list. Retrieving token list from file`);
        }
        body = await webResponse.text();
        data = JSON.parse(body);
    }
    catch(error) {
        console.log(error);
        body = JSON.stringify(defaultList);
        data = JSON.parse(body);
    }
    
    fs.writeFile(`./src/tokens/tokenLists/${fileName}.json`, JSON.stringify(data, null, " "), {encoding: 'utf-8'}, function (err) {
        if (err) throw err;
    });

    let tokens = {};

    // data.then(console.log);

    for(let token of data.tokens) {            
        if(token.chainId === chainId) {
            tokens[token.symbol] = [token.name, token.symbol, token.address, token.decimals, token.logoURI];
        }
    }
    return tokens;
}

async function writeFiles() {
    const coingeckoTokens = await getTokens(coingeckoListArguments);

    const pancakeTokens = await getTokens(pancakeTop100ListArguments);
    // await getTokens(sushiswap1000PlusList);

    for(let tokenSymbol in coingeckoTokens) {
        let token = coingeckoTokens[tokenSymbol];
        dataETH[tokenSymbol] = [token[0], token[1], token[2], token[3], token[4]];
    }

    for(let tokenSymbol in pancakeTokens) {
        let token = pancakeTokens[tokenSymbol];
        dataBSC[tokenSymbol] = [token[0], token[1], token[2], token[3], token[4]];
    }

    fs.writeFile('./src/tokens/tokensETH.json', JSON.stringify(dataETH, null, " "), {encoding: 'utf-8'}, function (err) {
        if (err) throw err;
    });

    fs.writeFile('./src/tokens/tokensBSC.json', JSON.stringify(dataBSC, null, " "), {encoding: 'utf-8'}, function (err) {
        if (err) throw err;
    });

}

writeFiles();