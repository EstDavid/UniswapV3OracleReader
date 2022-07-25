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
async function initializeOracle(tokenPairsObject, parameters) {
    const startInitialization = new Date();

    // Checking available data on Uniswap V3
    let feeArray = [
        'LOW',
        'MEDIUM',
        'HIGH'
    ];
    
    for(let tokenPairSymbol in tokenPairsObject) {
        let tokenPair = tokenPairsObject[tokenPairSymbol];
        let token0 = tokenPair.token0;
        let token1 = tokenPair.token1;
        let liquidity;
        let maxLiquidityPool;
        let maxLiquidity = BigNumber.from(0);

        for(let fee of feeArray) {
            try {
                let pool = await uniswapV3Oracle.initializePool(token1.address, token0.address, fee);

                liquidity = pool.pool.liquidity;

                if(liquidity.gt(maxLiquidity)) {
                    maxLiquidity = liquidity;
                    maxLiquidityPool = pool;
                }            
    
                // console.log(`The total liquidity of the ${token1.symbol}-${token0.symbol} (fee:${fee}) on Uniswap Oracle is ${liquidity.decimalPlaces(4)}`);        
            }
            catch(error) {
                // console.log(error);
                // console.log(`No enough liquidity on pair ${token1.symbol}-${token0.symbol} (fee:${fee}) on Uniswap V3 price oracle`);
            }
        }
        if(maxLiquidityPool !== undefined) {
            try {
                let baseTimeframe = uniswapV3Oracle.timeframes[parameters.baseTimeframe];
                let minutesAgo = parameters.minutesAgo;
                let rangeMinutes = parameters.rangeMinutes;
                let maxExtraMinutes = parameters.maxExtraMinutes;
                await uniswapV3Oracle.updatePrice(maxLiquidityPool.poolSymbol, baseTimeframe, minutesAgo, rangeMinutes, maxExtraMinutes);
                if(uniswapV3Oracle.priceLibrary[tokenPairSymbol] !== undefined &&
                    uniswapV3Oracle.priceLibrary[tokenPairSymbol].observations === undefined) {
                        throw (maxLiquidityPool.poolSymbol);
                }
                tokenPair.uniswapV3OracleSymbol = maxLiquidityPool.poolSymbol;
                tokenPair.hasUniswapV3Oracle = true;
                let subfolder = uniswapV3Oracle.priceLibrary[tokenPairSymbol].observationTimeframe.name
                appendFile(tokenPairSymbol, uniswapV3Oracle.priceLibrary[tokenPairSymbol], subfolder);
            }
            catch(error) {
                console.log(`Oracle price array for ${tokenPairSymbol} could not be initialized. Reason: ${error}`);
            }
        }
        else {
            console.log(`No Oracle pool was found for the ${tokenPairSymbol} pair on Uniswap V3`);
        }
    }

    const endInitialization = new Date();

    console.log(`Initialization took ${(endInitialization - startInitialization) / 1000} seconds`);

    uniswapV3Oracle.listPools();
    listPricePools(tokenPairsObject);
}

async function updateOraclePrices(tokenPairsObject, parameters) {
    let baseTimeframe = uniswapV3Oracle.timeframes[parameters.baseTimeframe];
    let minutesAgo = parameters.minutesAgo;
    let rangeMinutes = parameters.rangeMinutes; 
    for(let tokenPairSymbol in tokenPairsObject) {
        let tokenPair = tokenPairsObject[tokenPairSymbol];
        // Call update price function only if:
        // - The token pair has uniswapV3Oracle
        // - The oracle has produced price data
        if(!tokenPair.hasUniswapV3Oracle || 
        uniswapV3Oracle.priceLibrary[tokenPairSymbol] === undefined) {
            continue;
        }
        
        await uniswapV3Oracle.updatePrice(tokenPair.uniswapV3OracleSymbol, baseTimeframe, minutesAgo, rangeMinutes);
        let subfolder = uniswapV3Oracle.priceLibrary[tokenPairSymbol].observationTimeframe.name
        appendFile(tokenPairSymbol, uniswapV3Oracle.priceLibrary[tokenPairSymbol], subfolder);
        tokenPair.latestUpdateTimestamp = Date.now();
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