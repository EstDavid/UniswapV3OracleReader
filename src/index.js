var {tokenSelectionETH, oracleParameters, quoteTokensETH} = require('./parameters')

var {initializeOracle, updateOraclePrices, poolsInitialized} = require('./oracle');

// Retrieving tokens
var {tokensETH} = require('./tokens/tokenData.js');

// [] Delete the explicit use of bucket name
// [] Extract raw output data for the WETHUSDC pair
// [] Change all the file names to .json
// [] Check rules for new data inclusion/exclusion


function getTokenPairsObject(tokensList, quoteTokens) {
    let tokenPairsObject = {};
    let unknownTokens = [];
    for(let i = 0; i < tokensList.length; i += 1) {
        for(let j = 0; j < tokensList.length; j += 1) {
            // Only one TokenPair is created for a pair of tokens, regardless 
            // of the token order
            if(i >= j) {
                continue;
            }

            // If any of the tokens is undefined, continue
            if(tokensETH[tokensList[i]] === undefined) {
                if(!unknownTokens.includes(tokensList[i])) {
                  unknownTokens.push(tokensList[i]);
                }
                continue;
            } 
            
            if (tokensETH[tokensList[j]] === undefined) {
                if(!unknownTokens.includes(tokensList[j])) {
                    unknownTokens.push(tokensList[j]);
                  }
                continue;
            }

            let token0 = tokensETH[tokensList[i]];
            let token1 = tokensETH[tokensList[j]];

            
            let indexToken0 = quoteTokens.indexOf(token0.symbol);
            let indexToken1 = quoteTokens.indexOf(token1.symbol)

            // Determining the order of the tokens, the one included in the quote array will be the quote token
            // If both are quote tokens, the one with the lower index will be the quote token
            let token0IsQuoteToken = indexToken0 >= 0 && indexToken0 < indexToken1 || indexToken0 >= 0 && indexToken1 === -1;

            let tokenPair = new TokenPair (
                token0IsQuoteToken ? token1 : token0,
                token0IsQuoteToken ? token0 : token1,
            );
            tokenPairsObject[ tokenPair.name ] = tokenPair;
        }
    }
    if(unknownTokens.length > 0) {
        console.log('These tokens were not found in the database' + '\n' + unknownTokens.join('\n'));
    }
    return tokenPairsObject;
}

class TokenPair {
    constructor(token0, token1) {
        this.name = token0.symbol + token1.symbol;
        this.token0 = token0;
        this.token1 = token1;
        this.hasUniswapV3Oracle = false;
        this.uniswapV3OracleSymbol = undefined;
        this.latestUpdateTimestamp = undefined;
        this.sequences = {
            [token0.symbol + token1.symbol]: {
                name: token0.symbol + token1.symbol,
                srcToken: token1,
                destToken: token0, 
                inputQty:token1.refQty,
                quoteList:{},
                oraclePrice: undefined,
                oracleVolatility: undefined,
                highestQuote: [,],
                lowestQuote:[,],
                priceDelta:undefined,
                priceDeltaPercentage: undefined
            },
            [token1.symbol + token0.symbol]: {
                name: token1.symbol + token0.symbol,
                srcToken: token0,
                destToken: token1, 
                inputQty:token0.refQty,
                quoteList:{},
                oraclePrice: undefined,
                oracleVolatility: undefined,
                highestQuote: [,],
                lowestQuote:[,],
                priceDelta:undefined,
                priceDeltaPercentage: undefined
            }
        }
        this.poolReserves = {}
    }

    setQuote(sequenceSymbol, outputQty, exchange) {
        let quote = new BigNumber(this.sequences[sequenceSymbol].inputQty).dividedBy(new BigNumber(outputQty));
        this.sequences[sequenceSymbol].quoteList[exchange.name] = quote;
        if(Object.keys(this.sequences[sequenceSymbol].quoteList).length > 1) {
            if(quote > this.sequences[sequenceSymbol].highestQuote[1]) {
                this.sequences[sequenceSymbol].highestQuote = [exchange.name, quote];
            }
            if(quote < this.sequences[sequenceSymbol].lowestQuote[1]) {
                this.sequences[sequenceSymbol].lowestQuote = [exchange.name, quote];
            }
        } else {
            this.sequences[sequenceSymbol].highestQuote = [exchange.name, quote];
            this.sequences[sequenceSymbol].lowestQuote = [exchange.name, quote];
        }
        this.sequences[sequenceSymbol].priceDelta = this.sequences[sequenceSymbol].highestQuote[1]
                                                    .minus(this.sequences[sequenceSymbol].lowestQuote[1]);
        this.sequences[sequenceSymbol].priceDeltaPercentage = this.sequences[sequenceSymbol].priceDelta
                                                                .dividedBy(this.sequences[sequenceSymbol].highestQuote[1]);
    }
}

const tokenPairsObject = getTokenPairsObject(tokenSelectionETH, quoteTokensETH);

initializeOracle(tokenPairsObject);

const updateInterval = (oracleParameters.updateLookbackMinutes - 3) * 60 * 1000;

setInterval(updateOraclePrices, updateInterval, tokenPairsObject);