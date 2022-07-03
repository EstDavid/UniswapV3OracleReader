// CONVERTER
var {convertFromWei, convertToWei, isCorrectNumber} = require('./converter.js');

// PARAMETERS
var {oracleParameters} = require('./parameters');

// LOGGER
var {appendFile} = require('./storageLogger');

// BIG NUMBER
const { BigNumber } = require("ethers");

// ORACLE
var uniswapV3Oracle = require('./uniswapV3Oracle.js');

//###################################//
//########## Oracle methods #########//
//###################################//
async function initializeOracle(tokenPairsObject) {
    const startInitialization = new Date();

    // Checking available data on Uniswap V3
    let feeArray = [
        'LOW',
        'MEDIUM',
        'HIGH'
    ];
    
    for(let tokenPairSymbol in tokenPairsObject) {
        let tokenPair = tokenPairsObject[tokenPairSymbol];
        let sequence = tokenPair.sequences[tokenPairSymbol];
        let srcToken = sequence.srcToken;
        let destToken = sequence.destToken;
        let liquidity;
        let maxLiquidityPool;
        let maxLiquidity = BigNumber.from(0);

        for(let fee of feeArray) {
            try {
                let pool = await uniswapV3Oracle.initializePool(srcToken.address, destToken.address, fee);

                liquidity = pool.pool.liquidity;

                if(liquidity.gt(maxLiquidity)) {
                    maxLiquidity = liquidity;
                    maxLiquidityPool = pool;
                }            
    
                // console.log(`The total liquidity of the ${srcToken.symbol}-${destToken.symbol} (fee:${fee}) on Uniswap Oracle is ${liquidity.decimalPlaces(4)}`);        
            }
            catch(error) {
                // console.log(error);
                // console.log(`No enough liquidity on pair ${srcToken.symbol}-${destToken.symbol} (fee:${fee}) on Uniswap V3 price oracle`);
            }
        }
        if(maxLiquidityPool !== undefined) {
            try {
                let baseTimeframe = uniswapV3Oracle.timeframes[oracleParameters.baseTimeframe];
                let minutesHistory = oracleParameters.initialLookbackMinutes;
                let maxExtraMinutes = oracleParameters.maxExtraMinutes;
                await uniswapV3Oracle.updatePrice(maxLiquidityPool.poolSymbol, baseTimeframe, minutesHistory, maxExtraMinutes);
                if(uniswapV3Oracle.priceLibrary[tokenPairSymbol] !== undefined &&
                    uniswapV3Oracle.priceLibrary[tokenPairSymbol].observations === undefined) {
                        throw (maxLiquidityPool.poolSymbol);
                }
                tokenPair.uniswapV3OracleSymbol = maxLiquidityPool.poolSymbol;
                tokenPair.hasUniswapV3Oracle = true;
                let subfolder = uniswapV3Oracle.priceLibrary[tokenPairSymbol].observationTimeframe.name
                appendFile(tokenPairSymbol, uniswapV3Oracle.priceLibrary[tokenPairSymbol], subfolder);
            }
            catch(symbol) {
                console.log(`Oracle price array for ${symbol} could not be initialized`);
            }
        }
        else {
            console.log(`No Oracle pool was found for the ${srcToken.symbol + destToken.symbol} pair on Uniswap V3`);
        }
    }

    const endInitialization = new Date();

    console.log(`Initialization took ${(endInitialization - startInitialization) / 1000} seconds`);

    uniswapV3Oracle.listPools();
    listPricePools(tokenPairsObject);
}

async function updateOraclePrices(tokenPairsObject) {
    let baseTimeframe = uniswapV3Oracle.timeframes[oracleParameters.baseTimeframe];
    let minutesHistory = oracleParameters.updateLookbackMinutes;  
    for(let tokenPairSymbol in tokenPairsObject) {
        let tokenPair = tokenPairsObject[tokenPairSymbol];
        if(!tokenPair.hasUniswapV3Oracle || 
        uniswapV3Oracle.priceLibrary[tokenPairSymbol] === undefined) {
            continue;
        }
        let timestamp = Date.now();
        let minTimeInterval = (minutesHistory - 2) * 60 * 1000;
        let latestTimestamp = tokenPair.latestUpdateTimestamp;
        // Call update price function only if:
        // - The token pair has uniswapV3Oracle
        // - The oracle has produced price data
        // - There has elapsed enough time since the last check
        if(latestTimestamp === undefined || timestamp > latestTimestamp + minTimeInterval) {
            await uniswapV3Oracle.updatePrice(tokenPair.uniswapV3OracleSymbol, baseTimeframe, minutesHistory);
            let subfolder = uniswapV3Oracle.priceLibrary[tokenPairSymbol].observationTimeframe.name
            appendFile(tokenPairSymbol, uniswapV3Oracle.priceLibrary[tokenPairSymbol], subfolder);
            tokenPair.latestUpdateTimestamp = Date.now();
        }
    }
}

async function getOracleData (tokenPairsObject) {
    await getUniswapV3Data(tokenPairsObject);
}

async function getUniswapV3Data(tokenPairsObject) {
    for(let tokenPairSymbol in tokenPairsObject) {
        let tokenPair = tokenPairsObject[tokenPairSymbol];
        if(!tokenPair.hasUniswapV3Oracle) {
            continue;
        }
        try {
            for(let sequenceSymbol in tokenPair.sequences) {
                if(uniswapV3Oracle.priceLibrary[sequenceSymbol] === undefined) {
                    continue;
                }
                if(uniswapV3Oracle.priceLibrary[sequenceSymbol] !== undefined &&
                    uniswapV3Oracle.priceLibrary[sequenceSymbol].observations === undefined) {
                    console.log(`No price data found for pair ${sequenceSymbol} on Uniswap V3 Oracle`);
                    continue;
                }
                let timeframe = uniswapV3Oracle.timeframes[oracleParameters.analysisTimeframe];
                let nPeriodsATR = oracleParameters.nPeriodsATR;
                let nPeriodsSmoothing = oracleParameters.nPeriodsSmoothing;
                let sequence = tokenPair.sequences[sequenceSymbol];
                let priceArray = uniswapV3Oracle.priceLibrary[sequenceSymbol].getArray(timeframe, 'close');
                let volatilityArray = uniswapV3Oracle.priceLibrary[sequenceSymbol].getVolatility(timeframe, nPeriodsATR, nPeriodsSmoothing);
                let timestampsArray = Object.keys(priceArray);
                let latestTimestamp = Math.max.apply(null, timestampsArray);
                sequence.oraclePrice = new BigNumber(priceArray[latestTimestamp]);
                sequence.oracleVolatility = new BigNumber(volatilityArray[latestTimestamp]);
            }
        }
        catch(error) {
            console.log(error);
        }
    }
}

function listPricePools(tokenPairsObject) {
    let logColumns = [];
    let logTable = [];
    
    let tableColumns = [
        'Pair Symbol',
        'Uniswap V3 Symbol'
    ];
    let tableData = [];

    for(let tokenPairSymbol in tokenPairsObject) {
        let tokenPair = tokenPairsObject[tokenPairSymbol];
        if(!tokenPair.hasUniswapV3Oracle) {
            continue;
        }

        let rowData = {};

        rowData[tableColumns[0]] = tokenPairSymbol;
        rowData[tableColumns[1]] = tokenPair.uniswapV3OracleSymbol;

        tableData.push(rowData);
        logTable.push(rowData);
    }
    if(logColumns.length === 0) {
        logColumns.push(tableColumns);
    }
    console.log('List of oracle price pools created');
    console.table(tableData, tableColumns);
    // if(localStorage) {
    //     logOracles(logColumns, logTable);
    // }
}

exports.initializeOracle = initializeOracle;
exports.updateOraclePrices = updateOraclePrices;