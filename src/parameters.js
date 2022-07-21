// Parameters to retrieve data from the Uniswap v3 Oracle
const oracleParameters = {
    baseTimeframe: 'seconds30', 
    // At what time interval will the observations be extracted
    // Possible values: seconds1, seconds5, ..., seconds30, minutes1, ..., minutes30, ..., hours1, ...
    // For all the values check the 'timeframes: TimeframeCollection' object in 'uniswapV3Oracle.ts'

    minutesAgo: 0, // 60 * (24 * 2 - 12),
    // When initializing the pool object and making the first price data request, how far back
    // in time the request will go

    rangeMinutes: 60 * 8,
    // From the minutesAgo parameter, how many minutes in the future will be sampled

    updateLookbackMinutes: 15,
    // When updating new price data after the pool is initialized, how far back in time does the data go

    maxExtraMinutes: 180 
    // After retrieving the first set of observations, when will earliest observations begin to be flushed
    // in order to free up memory from the 'priceLibrary' object
}

// ETH Tokens
const tokenSelectionETH = [
    'USDC',
    'ETH',
    'DAI',
    'USDT',
    'WBTC',
    'FRAX',
    'USDM',
    'SWYF',
    'SETH2',
    'AGEUR',
    'BUSD',
    'AVINOC',
    'BIT',
    'FUN',
    'USDD',
    'EURS',
    'APE',
    'FEI',
    'MKR',
    'BTT',
    'CVX',
    'XAUT',
    'UNI',
    'WDOGE',
    'HEX',
    'SHIB',
    'HOPR',
    'ADS',
    'COMP',
    'RPL',
    'FTT',
    'PAX',
    'SIFU',
    'GUSD',
    'XMT',
    'MATIC',
    'LOOKS',
    'LINK',
    'GNO',
    'AAVE',
    'TUSD',
    '1INCH',
    'INST',
    'LCX',
    'BADGER',
    'sUSD',
    'UOS',
    'PEOPLE',
    'ENS',
    'QRDO',
    'WETH',
    // 'BNB',
    // 'VEN',
    // 'KNC',
    // 'LRC',
    // 'RPL',
    // 'DYDX',
    // 'NBU',
    // 'GNBU',
    // 'DPI',
    // 'YFI',
    // 'CRV',
    // 'AMP',
    // 'MANA',
    // 'FTM',
    // 'OHM',
    // 'SUSHI',
    // 'SPELL',
    // 'YGG',
    // 'PERP',
    // 'SNX',
];

// Main quote tokens
const quoteTokensETH = [
    'USDC',
    'USDT',
    'ETH',
    'WETH',
    'DAI'
];

exports.tokenSelectionETH = tokenSelectionETH;
exports.quoteTokensETH = quoteTokensETH;
exports.oracleParameters = oracleParameters;