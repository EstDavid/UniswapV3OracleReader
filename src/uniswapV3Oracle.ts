import { ethers } from "ethers";
import { computePoolAddress } from "@uniswap/v3-sdk";
import { Token as UniswapToken } from "@uniswap/sdk-core";
import { abi as IUniswapV3PoolABI } from "@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json";
import { FeeAmount } from "@uniswap/v3-sdk";
import JSBI from "jsbi";

require('dotenv').config();
const tokens = require("../src/tokens/tokensETH.json");
const ERC20TokenABI = require("../src/tokens/ERC20TokenABI.json");

const Q96 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(96));
const Q192 = JSBI.exponentiate(Q96, JSBI.BigInt(2));

const RPC_URL = process.env.RPC_URL;

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

// Factory address
const factoryAddress = "0x1F98431c8aD98523631AE4a59f267346ea31F984";

// Pool interfaces
interface Immutables {
    factory: string;
    token0: string;
    token1: string;
    fee: number;
    tickSpacing: number;
    maxLiquidityPerTick: ethers.BigNumber;
}
interface State {
    liquidity: ethers.BigNumber;
    sqrtPriceX96: ethers.BigNumber;
    tick: number;
    observationIndex: number;
    observationCardinality: number;
    observationCardinalityNext: number;
    feeProtocol: number;
    unlocked: boolean;
}

// Creation of the tokens library
interface TokensCollection {
[index: string]: Token;
};

interface AddressDictionary {
[index: string]: string;
};
const tokensLibrary: TokensCollection = {};

const addressesDictionary: AddressDictionary = {};

// Creating the pools library
interface PoolsCollection {
    [index: string] : {
        pool: ethers.Contract,
        immutables: Immutables,
        liquidity: number
    }
}

// Interface arguments to retrieve a pool
interface PoolArgs {
    tokenA: Token,
    tokenB: Token,
    fee: string
}

// Token class is extended in order to add the logoURI information
 class Token extends UniswapToken {
    logoURI?: string;
    constructor (chainId: number, address: string, decimals: number, symbol?: string, name?: string, logoURI?: string) {
        super(chainId, address, decimals, symbol, name);
        this.logoURI = logoURI;
    };
}

// Interface for price observation
class PriceObservationArray {
    symbol: string;
    baseToken: Token;
    quoteToken: Token;
    poolAddress: string;
    poolFee: string;
    observationTimeframe: Timeframe;
    startTimestamp?: number;
    endTimestamp?: number;
    observations?: {
        [timestamp: number]: number
    };
    maxObservations?: number;
    extraMinutesData: number;
    prices?: {
        [timeframeId: string] : PriceArray;
    };
    arrayTypes: string[];

    constructor (
                    symbol: string,
                    baseToken: Token,
                    quoteToken: Token,
                    poolAddress: string,
                    poolFee: string,
                    observationTimeframe: Timeframe,
                    extraMinutesData: number
                ) {
        this.symbol = symbol;
        this.baseToken = baseToken;
        this.quoteToken = quoteToken;
        this.poolAddress = poolAddress;
        this.poolFee = poolFee;
        this.observationTimeframe = observationTimeframe;
        this.arrayTypes = ['open', 'high', 'low', 'close'];
        this.extraMinutesData = extraMinutesData;
    }

    setPrice(timestamp: number, price: number) {
        if(this.observations === undefined) {
            this.observations = {};
            this.observations[timestamp] = price;
        } 
        else {
            if(this.observations[timestamp] === undefined) {
                this.observations[timestamp] = price;
                this.setTimestamps(timestamp);
            }
        }
    }

    setTimestamps(timestamp: number) {
        if(this.startTimestamp === undefined || timestamp < this.startTimestamp) {
            this.startTimestamp = timestamp;
        }
        if(this.endTimestamp === undefined || timestamp > this.endTimestamp) {
            this.endTimestamp = timestamp;
        }
    }

    flushObservationData() {
        let timestamps;
        if(this.observations !== undefined) {
            timestamps = Object.keys(this.observations);
            if(this.maxObservations === undefined) {
                this.maxObservations = timestamps.length + this.extraMinutesData * 60 / this.observationTimeframe.seconds;
                return;
            }
            if(timestamps.length > this.maxObservations) {
                console.log(`Flushing ${timestamps.length - this.maxObservations} observations for the ${this.symbol} pair`);
                timestamps.sort((a, b) => {return parseInt(a) - parseInt(b)});
                for(let i = 0; i < timestamps.length - this.maxObservations; i += 1) {
                    delete this.observations[parseInt(timestamps[i])];
                    this.startTimestamp = parseInt(timestamps[i + 1]);
                }
            }
        }

    }

    getPriceArray(timeframe: Timeframe) {
        if(this.prices === undefined || this.prices[timeframe.name] === undefined) {
            return this.convertTimeframe(timeframe);
        }
        else {
            return this.prices[timeframe.name];
        }
    }

    convertTimeframe(timeframeTo: Timeframe) {
        let timestamps = [];
        let open = 0;
        let high = 0;
        let low = 0;
        let close = 0;
        let startTimeframe = 0;
        let newCandleTimestamp = 0;
        let priceArray: PriceArray = {};

        if(timeframeTo.seconds % this.observationTimeframe.seconds !== 0) {
            throw('Timeframe to is not a multiple of time framefrom');
        }
        if(this.observations !== undefined) {
            timestamps = Object.keys(this.observations);
            timestamps.sort((a, b) => parseInt(a) - parseInt(b));
        }
        else {
            throw(`No price observation price array has been initialized for the ${this.baseToken.symbol as string + this.quoteToken.symbol as string} pair`);
        }

        // Initializing price array
        if(this.prices === undefined) {
            this.prices = {};
        }        
    
        for(let i = 0; i < timestamps.length; i +=1) {
            let timestamp = parseInt(timestamps[i]);
            let priceObservation = this.observations[timestamp];
            close = priceObservation;
            if(i === 0) { // Opening a new cande at the beginning of the series
                startTimeframe = timestamp - (timestamp % timeframeTo.seconds);
                newCandleTimestamp = startTimeframe + timeframeTo.seconds;
                open = priceObservation;
                high = priceObservation;
                low = priceObservation;
                priceArray[startTimeframe] = {
                    timestamp: startTimeframe,
                    open,
                    high,
                    low,
                    close
                }
            }
            else if(timestamp < newCandleTimestamp) {
                if(priceObservation > high) {
                    high = priceObservation;
                    priceArray[startTimeframe].high = high;
                }
                if(priceObservation < low) {
                    low = priceObservation;
                    priceArray[startTimeframe].low = low;
                }
                priceArray[startTimeframe].close = close;
            }
            else {  // Opening a new candle
                startTimeframe = timestamp - (timestamp % timeframeTo.seconds);
                newCandleTimestamp = startTimeframe + timeframeTo.seconds;
                open = priceObservation;
                high = priceObservation;
                low = priceObservation;
                close = priceObservation;
                priceArray[startTimeframe] = {
                    timestamp: startTimeframe,
                    open,
                    high,
                    low,
                    close
                }
            }
        }
        this.prices[timeframeTo.name] = priceArray;
        return this.prices[timeframeTo.name];
    }

    getArray(timeframe: Timeframe, arrayType: string) {
        if(!this.arrayTypes.includes(arrayType)) {
            throw(`Array ${arrayType} is not supported`);
        }
        let arrayOHLC = this.getPriceArray(timeframe);
        let array : {[timestamp: number]: number} = {};
        for(let timestamp in arrayOHLC) {
            let valuesOHLC = arrayOHLC[timestamp];
            // Brute but effective way of getting the array...
            if(arrayType === 'open') {
                array[timestamp] = valuesOHLC.open;
            }
            if(arrayType === 'high') {
                array[timestamp] = valuesOHLC.high;
            }
            if(arrayType === 'low') {
                array[timestamp] = valuesOHLC.low;
            }
            if(arrayType === 'close') {
                array[timestamp] = valuesOHLC.close;
            }
        }
        return array;
    }

    getSMAFromArray(inputArray: {[timestamp: number]: number}, nPeriods: number) {
        let arraySMA : {[timestamp: number]: number} = {};
        let timestampsArray: number[] = [];
        for(let timestamp in inputArray) {
            timestampsArray.push(parseInt(timestamp));
        }
        timestampsArray.sort((a, b) => a - b);
        let periodArray = [];
        let sum = 0;
        for(let i = 0; i < timestampsArray.length; i += 1) {
            let timestamp = timestampsArray[i];
            periodArray.push(inputArray[timestamp]);
            
            if(periodArray.length > nPeriods) {
                periodArray.shift();
            }

            if(periodArray.length === nPeriods) {
                sum = periodArray.reduce(function (accumVariable, curValue) {
                    return accumVariable + curValue
                }, 0);
                
                arraySMA[timestamp] = sum / nPeriods;
            };
        }
        return arraySMA;
    }

    getEMAFromArray(inputArray: {[timestamp: number]: number}, nPeriods: number) {
        let arrayEMA : {[timestamp: number]: number} = {};
        let k = 2 / (nPeriods + 1);
        let timestampsArray: number[] = [];
        for(let timestamp in inputArray) {
            timestampsArray.push(parseInt(timestamp));
        }
        timestampsArray.sort((a, b) => a - b);
        let sum = 0;
        let ema = 0;
        for(let i = 0; i < timestampsArray.length; i += 1) {
            let timestamp = timestampsArray[i];
            if(i < nPeriods - 1) {
                sum = sum + inputArray[timestamp];
                continue;
            }
            else if(i === nPeriods - 1) {
                sum = sum + inputArray[timestamp];
                ema = sum / nPeriods;
                continue;
            }
            else {
                ema =  inputArray[timestamp] * k + ema * (1 - k);
            }
            arrayEMA[timestamp] = ema;
        }
        return arrayEMA;
    }

    getSMA(timeframe: Timeframe, arrayType: string ,nPeriods: number) {
        let inputArray = this.getArray(timeframe, arrayType);
        return this.getSMAFromArray(inputArray, nPeriods);
    }

    getEMA(timeframe: Timeframe, arrayType: string ,nPeriods: number) {
        let inputArray = this.getArray(timeframe, arrayType);
        return this.getEMAFromArray(inputArray, nPeriods);
    }

    getATR(timeframe: Timeframe, nPeriods: number) {
        // Formula for the ATR obtained from:
        // https://www.investopedia.com/terms/a/atr.asp
        let arrayATR : {[timestamp: number]: number} = {};
        let highArray = this.getArray(timeframe, 'high');
        let lowArray = this.getArray(timeframe, 'low');
        let closeArray = this.getArray(timeframe, 'close');
        let timestampsArray: number[] = [];
        for(let timestamp in closeArray) {
            timestampsArray.push(parseInt(timestamp));
        }
        timestampsArray.sort((a, b) => a - b);
        let previousTrueRange = [];
        let previousATR = 0;
        let trueRange;
        let trueRangeSum;
        for(let i = 0; i < timestampsArray.length; i += 1) {
            let timestamp = timestampsArray[i];
            let high = highArray[timestamp];
            let low = lowArray[timestamp];
            if(i === 0) {
                previousTrueRange.push(high - low);
                trueRangeSum = previousTrueRange.reduce(function (accumVariable, curValue) {
                    return accumVariable + curValue
                }, 0);
                if(nPeriods === 1) {
                    arrayATR[timestamp] = trueRangeSum / nPeriods;
                }
                continue;
            }

            let previousClose = closeArray[timestampsArray[i - 1]];

            trueRange = Math.max(
                                    high - low,
                                    Math.abs(high - previousClose),
                                    Math.abs(low - previousClose)
            );

            if(i < nPeriods) {
                previousTrueRange.push(trueRange);
                if(i === nPeriods - 1) {
                    trueRangeSum = previousTrueRange.reduce(function (accumVariable, curValue) {
                        return accumVariable + curValue
                    }, 0);
                    previousATR = trueRangeSum / nPeriods;
                }
            }
            else {
                arrayATR[timestamp] = (previousATR * (nPeriods - 1) + trueRange) / nPeriods;
                previousATR = arrayATR[timestamp];
            }         
        }
        return arrayATR;
    }

    getVolatility(timeframe: Timeframe, nPeriodsATR: number, nPeriodsSmoothing: number) {
        // Volatility here is defined as the ATR% divided by its own EMA
        // For instance, a value of 1.25  means that the ATR% is above its own EMA by 25%
        let ATRArray = this.getATR(timeframe, nPeriodsATR);
        let ATRPercentageArray : {[timestamp: number]: number} = {};
        let volatilityArray : {[timestamp: number]: number} = {};
        // let volatilityEMAArray = this.;
        let closeArray = this.getArray(timeframe, 'close');
        let timestampsArray: number[] = [];
        for(let timestamp in ATRArray) {
            timestampsArray.push(parseInt(timestamp));
        }
        timestampsArray.sort((a, b) => a - b);

        for(let i = 0; i < timestampsArray.length; i += 1) {
            let timestamp = timestampsArray[i];
            ATRPercentageArray[timestamp] = (ATRArray[timestamp] / closeArray[timestamp]) * 100;
        }

        let ATRPercentageEMA = this.getEMAFromArray(ATRPercentageArray, nPeriodsSmoothing);
        timestampsArray = [];
        for(let timestamp in ATRPercentageEMA) {
            timestampsArray.push(parseInt(timestamp));
        }
        timestampsArray.sort((a, b) => a - b);
        
        for(let i = 0; i < timestampsArray.length; i += 1) {
            let timestamp = timestampsArray[i];
            volatilityArray[timestamp] = ATRPercentageArray[timestamp] / ATRPercentageEMA[timestamp];
        }
        return volatilityArray;
    }
}

//Interface for price array
interface PriceArray {
    [timestamp: number] : {
        timestamp: number,
        open: number,
        high: number,
        low: number,
        close: number
    }
}

interface PriceLibrary {
    [index: string] : PriceObservationArray
}

interface Timeframe {
    name: string,
    seconds: number
}

interface TimeframeCollection {
    [id: string]: Timeframe
}

export const timeframes: TimeframeCollection = {
    seconds1: {
        name: '1 second',
        seconds: 1,
    },
    seconds5: {
        name: '5 seconds',
        seconds: 5,
    },
    seconds10: {
        name: '10 seconds',
        seconds: 10,
    },
    seconds15: {
        name: '15 seconds',
        seconds: 15,
    },
    seconds30: {
        name: '30 seconds',
        seconds: 30,
    },
    minutes1: {
        name: '1 minute',
        seconds: 1 * 60,
    },
    minutes2: {
        name: '2 minutes',
        seconds: 2 * 60,
    },
    minutes3: {
        name: '3 minutes',
        seconds: 3 * 60,
    },
    minutes5: {
        name: '5 minutes',
        seconds: 5 * 60,
    },
    minutes10: {
        name: '10 minutes',
        seconds: 10 * 60,
    },
    minutes15: {
        name: '15 minutes',
        seconds: 15 * 60,
    },
    minutes30: {
        name: '30 minutes',
        seconds: 30 * 60,
    },
    minutes45: {
        name: '45 minutes',
        seconds: 45 * 60,
    },
    hours1: {
        name: '1 hour',
        seconds: 1 * 60 * 60,
    },
    hours2: {
        name: '2 hours',
        seconds: 2 * 60 * 60,
    },
    hours3: {
        name: '3 hours',
        seconds: 3 * 60 * 60,
    },
    hours4: {
        name: '4 hours',
        seconds: 4 * 60 * 60,
    },
    days1: {
        name: '1 day',
        seconds: 1 * 24 * 60 * 60,
    },
    months1: {
        name: '1 month',
        seconds: 30 * 24 * 60 * 60,
    }
}

export const poolsCollection: PoolsCollection = {};

export const priceLibrary: PriceLibrary = {};

// Creating a Tokens Collection from all the tokens found in tokens
for(let token in tokens) {
    const newToken = new Token(
        1,
        tokens[token][2], // address 
        tokens[token][3], // decimals
        tokens[token][1], // symbol
        tokens[token][0],  // name
        tokens[token][4] // logoURI
    );

    tokensLibrary[tokens[token][2].toUpperCase()] = newToken;
    addressesDictionary[tokens[token][1]] = tokens[token][2].toUpperCase();
}

export async function initializePool(addressTokenA: string, addressTokenB: string, fee: string) {
    let tokenA = tokensLibrary[addressTokenA.toUpperCase()];
    let tokenB = tokensLibrary[addressTokenB.toUpperCase()];

    if(poolsCollection[tokenA.symbol as string + tokenB.symbol as string + fee] !== undefined ||
        poolsCollection[tokenB.symbol as string + tokenA.symbol as string + fee] !== undefined) {
            return;
        }

    // Getting the corresponding pool address
    let {poolAddress} = getPoolAddress(tokenA, tokenB, fee);

    // Getting the pool
    let pool = await getPool(poolAddress);

    let liquidity = await pool.liquidity();

    let immutables = await getPoolImmutables(pool);
    let symbol0 = tokensLibrary[immutables.token0.toUpperCase()].symbol;
    let symbol1 = tokensLibrary[immutables.token1.toUpperCase()].symbol;

    if(liquidity.toString() !== undefined && liquidity.toString() !== '0') {
        console.log(`Uniswap V3 Oracle: Initialized pool for pair ${symbol0 as string + symbol1 as string + fee} with ${liquidity} liquidity`);

        poolsCollection[symbol0 as string + symbol1 as string + fee] = {
            pool,
            immutables,
            liquidity
        }
        return {
            poolSymbol: symbol0 as string + symbol1 as string + fee,
            pool: poolsCollection[symbol0 as string + symbol1 as string + fee],
        };        
    } else {
        console.log(`Uniswap V3 Oracle: Pool for pair ${symbol0 as string + symbol1 as string + fee} could not be initialized with ${liquidity} liquidity`);
        return undefined;
    }


}

export async function getReserves(token0Address: string, token1Address: string, fee: string) {
    let token0 = tokensLibrary[token0Address.toUpperCase()];
    let token1 = tokensLibrary[token1Address.toUpperCase()];

    // Getting the corresponding pool address
    let {poolAddress, feeAmount} = getPoolAddress(token0, token1, fee);

    let pool = await getPool(poolAddress);
    let poolLiquidity = await pool.liquidity();

    // console.log(`Uniswap V3 Oracle: Pair ${token0.symbol as string + token1.symbol as string}, ${fee} returns ${poolLiquidity} liquidity() on Uniswap V3`);
    if(poolLiquidity.toString() === '0') {
        return [0, 0];
    }

    // Creating the token contract for each token in order to know the balance of the pool
    let token0Contract = new ethers.Contract(
                                                token0.address,
                                                ERC20TokenABI,
                                                provider
    );

    let token1Contract = new ethers.Contract(
                                                token1.address,
                                                ERC20TokenABI,
                                                provider
    );
    
    // Retrieving the balances
    let balanceToken0 = await token0Contract.balanceOf(poolAddress);
    let balanceToken1 = await token1Contract.balanceOf(poolAddress);

    return [balanceToken0, balanceToken1];
}

export async function getPoolLiquidity(token0Address: string, token1Address: string, fee: string) {
    let token0 = tokensLibrary[token0Address.toUpperCase()];
    let token1 = tokensLibrary[token1Address.toUpperCase()];

    // Getting the corresponding pool address
    let {poolAddress, feeAmount} = getPoolAddress(token0, token1, fee);

    let pool = await getPool(poolAddress);
    let poolLiquidity = await pool.liquidity();
    console.log(token0.symbol, token1.symbol, fee, poolLiquidity.toString())

    return poolLiquidity;
}

export function listPools() {
    console.log('List of oracle pools created');
    for(let poolSymbol in poolsCollection) {
        const poolObject = poolsCollection[poolSymbol];

        console.log(poolSymbol, poolObject.pool.address);
    }
}

export async function updatePrice(
                                    poolSymbol: string,
                                    baseTimeframe: Timeframe,
                                    minutesAgo: number,
                                    rangeMinutes: number,
                                    maxExtraMinutes: number) {
    // console.log(numberObservations, 'number of observations');

    const poolObject = poolsCollection[poolSymbol];

    // Retrieving token0 and token1
    let token0 = tokensLibrary[poolObject.immutables.token0.toUpperCase()];
    let token1 = tokensLibrary[poolObject.immutables.token1.toUpperCase()];

    let poolAddress = poolObject.pool.address;
    let poolFee = poolObject.immutables.fee.toString();
    
    let price0Symbol = token0.symbol as string + token1.symbol as string;
    let price1Symbol = token1.symbol as string + token0.symbol as string;

    let price0Observation;
    let price1Observation;

    if(priceLibrary[price0Symbol] === undefined) {
        price0Observation = new PriceObservationArray (
            price0Symbol,
            token0,
            token1,
            poolAddress,
            poolFee,
            baseTimeframe,
            maxExtraMinutes
        );
        priceLibrary[price0Observation.symbol] = price0Observation;
    }
    else {
        price0Observation = priceLibrary[price0Symbol];
    }

    if(priceLibrary[price1Symbol] === undefined) {
        price1Observation = new PriceObservationArray (
            price1Symbol,
            token1,
            token0,
            poolAddress,
            poolFee,
            baseTimeframe,
            maxExtraMinutes
        );
        priceLibrary[price1Observation.symbol] = price1Observation;
    }
    else {
        price1Observation = priceLibrary[price1Symbol];
    }

    console.log('Retrieving price history for', poolSymbol);

    await getPriceObservations(price0Observation, price1Observation, poolObject, baseTimeframe, 60 * minutesAgo, 60 * rangeMinutes);
}

async function getPriceObservations(
                                            price0Observation: PriceObservationArray,
                                            price1Observation: PriceObservationArray,
                                            poolObject: {pool: ethers.Contract, immutables: Immutables},
                                            baseTimeframe: Timeframe,
                                            secondsToPeriodStart: number,
                                            rangeSeconds: number
                                        ) {
    let samplingInterval = baseTimeframe.seconds;
    let observationArray;
    let amounts;
    
    // Retrieving token0 and token1
    let token0 = tokensLibrary[poolObject.immutables.token0.toUpperCase()];
    let token1 = tokensLibrary[poolObject.immutables.token1.toUpperCase()];

    // The following loop tries to retrieve as many observations possible as in the rangeSeconds parameter
    // If the request is reverted, the lookback period is reduced
    let observationsRetrieved = false;
    let secondsToPeriodEnd = secondsToPeriodStart - rangeSeconds;
    let rangeReduction = 0;
    while(!observationsRetrieved) {
        observationArray = [];
        secondsToPeriodStart = secondsToPeriodStart - rangeReduction;
        // Approaching the starting period to the nearest multiple of the sampling interval
        secondsToPeriodStart -= secondsToPeriodStart % samplingInterval;
        // If the lookback period is reduced to less than the sampling interval, the the loop is finished and no prices are found
        if(secondsToPeriodStart <= secondsToPeriodEnd + samplingInterval) {
            observationsRetrieved = true;
            throw('No prices were returned by the oracle');
        }
        try {
            for(let interval = secondsToPeriodEnd; interval < secondsToPeriodStart; interval += samplingInterval) {
                observationArray.push(interval);
            }

            amounts = await poolObject.pool.observe(observationArray);

            if(amounts.tickCumulatives[0] === undefined) {
                console.log('Empty array was returned');
            } else {
                observationsRetrieved = true;
                if(rangeReduction > 0) {
                    console.log(`The start of the lookback period had to be taken from ${(secondsToPeriodEnd + rangeSeconds)/60} to ${(secondsToPeriodStart)/60} minutes for the ${token0.symbol}${token1.symbol} pair`);
                }
            }

        }
        catch(error: any) {
            if(typeof error === 'object') {
                rangeReduction = (secondsToPeriodStart - secondsToPeriodEnd) / 5; // Each time an OLD error is encountered, the current range is decreased by 1/5
                    // console.log(`Decreasing range to ${rangeSeconds - rangeReduction} seconds`);
            } else {
                console.log(`Pool: ${poolObject.pool.address} (${token0.symbol}-${token1.symbol}) ${"\n"}Error: ${error.reason !== undefined ? error.reason : error}`);
            }
        }
    }

    let timestampMilliSeconds = Date.now();
    // Converting timestamp to seconds from milliseconds

    let timestampSeconds = observationArray !== undefined? timestampMilliSeconds / 1000 - observationArray[observationArray.length - 1] : timestampMilliSeconds / 1000;
    // Normalizing timestamp to the nearest multiple of the sampling interval
    timestampSeconds = timestampSeconds - timestampSeconds % samplingInterval;

    let price0;
    let price1;

    for(let i = 0; i < amounts.tickCumulatives.length; i += 1) {
        timestampSeconds -= samplingInterval;
        if(i > 0) {
            // Calculation from https://docs.uniswap.org/protocol/concepts/V3-overview/oracle
            let exponent = (amounts.tickCumulatives[i].sub(amounts.tickCumulatives[i - 1]))/samplingInterval;
            price1 = (1.0001 ** exponent) * 10 ** (token1.decimals - token0.decimals);

            price0 = 1 / price1;

            let timestamp = parseInt(timestampSeconds.toFixed(0));
            price0Observation.setPrice(timestamp, price0);
            price1Observation.setPrice(timestamp, price1);
        }              
    }
    
    price0Observation.flushObservationData();
    price1Observation.flushObservationData();
}

function getPoolAddress(tokenA: Token, tokenB: Token, fee: string) {
    let feeAmount = FeeAmount.LOW;
    switch(fee) {
        case 'LOW':
            feeAmount = FeeAmount.LOW;
            break;

        case 'MEDIUM':
            feeAmount = FeeAmount.MEDIUM;
            break;
        case 'HIGH':
            feeAmount = FeeAmount.HIGH;
            break;
    }

    const args = {
                    factoryAddress: factoryAddress,
                    tokenA,
                    tokenB,
                    fee: feeAmount
    };

    const poolAddress = computePoolAddress(args);
    return {poolAddress, feeAmount};
}

async function getPool(poolAddress: string) {    
    let poolContract = new ethers.Contract(
                                            poolAddress,
                                            IUniswapV3PoolABI,
                                            provider
    );
    return poolContract;
}

async function getPoolImmutables(poolContract: ethers.Contract) {
    const [factory, token0, token1, fee, tickSpacing, maxLiquidityPerTick] =
      await Promise.all([
        poolContract.factory(),
        poolContract.token0(),
        poolContract.token1(),
        poolContract.fee(),
        poolContract.tickSpacing(),
        poolContract.maxLiquidityPerTick(),
    ]);
  
    const immutables: Immutables = {
        factory,
        token0,
        token1,
        fee,
        tickSpacing,
        maxLiquidityPerTick,
    };

    return immutables;
}

async function getPoolState(poolContract: ethers.Contract) {
    const [liquidity, slot] = await Promise.all([
      poolContract.liquidity(),
      poolContract.slot0(),
    ]);
  
    const PoolState: State = {
      liquidity,
      sqrtPriceX96: slot[0],
      tick: slot[1],
      observationIndex: slot[2],
      observationCardinality: slot[3],
      observationCardinalityNext: slot[4],
      feeProtocol: slot[5],
      unlocked: slot[6],
    };
  
    return PoolState;
}