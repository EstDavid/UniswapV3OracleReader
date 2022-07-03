const fs = require('fs');

const tokenListETH = require('./tokensETH.json');
const tokenListBSC = require('./tokensBSC.json');

class Token {
    constructor (name, symbol, address, decimals){
        this.name = name;
        this.symbol = symbol;
        this.address = address;
        this.decimals = decimals;
    }
}

const tokensETH = {};

for(let token in tokenListETH) {
    tokensETH[token] = {
        name: tokenListETH[token][0],
        symbol: tokenListETH[token][1],
        address: tokenListETH[token][2],
        decimals: tokenListETH[token][3],
    };
}

const tokensBSC = {};

for(let token in tokenListBSC) {
    tokensBSC[token] = {
        name: tokenListBSC[token][0],
        symbol: tokenListBSC[token][1],
        address: tokenListBSC[token][2],
        decimals: tokenListBSC[token][3],
    };
}

exports.tokensETH = tokensETH;
exports.tokensBSC = tokensBSC;