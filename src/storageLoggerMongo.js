require('dotenv').config()
const mongoose = require('mongoose')
const Pair = require('./models/pair')
const Price = require('./models/price')

mongoose.set('strictQuery', false)

const url = process.env.MONGODB_URI

console.log('connecting to', url)

mongoose.connect(url)
    .then(result => {
        console.log('connected to MongoDB')
    })
    .catch((error) => {
        console.log('error connecting to MongoDB', error.message)
    })

const getObservationsArray = (observationsObject) => {
    const observationsArray = []
    for (let timestamp in observationsObject) {
        const observation = {
            _id: timestamp,
            price: observationsObject[timestamp]
        }
        observationsArray.push(observation)
    }
    return observationsArray
}

const getExistingObservations = async (symbol, seconds) => {
    console.log(`Getting existing observations for ${symbol}-${seconds}`)
    const priceTimestamps =  await Price.find({
        "metadata.symbol" : symbol,
        "metadata.seconds": seconds,
        timestamp: { $gt: new Date("2020-02-02")}
    }, {timestamp: 1, _id: 0})

    const existingTimestamps = priceTimestamps.map( timestampObject => {
        return timestampObject.timestamp
    })

    return existingTimestamps
}

const updateTimeseries = async (pair, rawObservationsData, seconds) => {
    console.log('Updating time series')
    const beforeGettingTimestamps = new Date()
    // const existingTimestamps = await getExistingObservations(pair.symbol, seconds)
    // const afterGettingTimestamps = new Date()
    // console.log(`Getting timestamps took ${afterGettingTimestamps - beforeGettingTimestamps}`)
    // console.log(existingTimestamps)
    const priceCollectionArray = []

    // const duplicatedTimestamps = []

    for (let timestamp in rawObservationsData) {

        // if ( existingTimestamps.includes(new Date(parseInt(timestamp) * 1000))) {
        //     duplicatedTimestamps.push(timestamp)
        //     continue
        // }
        const observation = {
            timestamp: new Date(parseInt(timestamp) * 1000),
            price: parseFloat(rawObservationsData[timestamp].toPrecision(8)),
            metadata: {
                symbol: pair.symbol,
                seconds: seconds
            }
        }
        priceCollectionArray.push(observation)
    }

    // console.log(duplicatedTimestamps.length, Object.keys(rawObservationsData).length)

    Price.collection.insertMany(priceCollectionArray).then(() => {
        const afterInserting = new Date()
        console.log(`${priceCollectionArray.length} series updated for ${pair.symbol}`)
        console.log(`The update took ${(afterInserting - beforeGettingTimestamps) / 1000} seconds`)
    })
}

const updateObservationsData = async (pair, rawObservationsData) => {
    const observationsArray = getObservationsArray(rawObservationsData)

    observationsArray.sort((a, b) => {
        return parseInt(b._id) - parseInt(a._id)
    })

    const maxUpdates = 100
    let total = 1
    let counter = 0

    const existingTimestamps = pair.priceData.observations.map(dataPoint => {
        return dataPoint._id
    })
    
    for(let newObservation of observationsArray) {
        if(!existingTimestamps.includes(newObservation._id)) {
            pair.priceData.observations.push(newObservation)
            console.clear()
            console.log(`Adding observation ${total} of ${observationsArray.length}`)
            counter += 1

            if (counter >= maxUpdates) {
                counter = 0

                const sortedArray = pair.priceData.observations.sort((a, b) => {
                    return new Date(parseInt(a._id) * 1000) - new Date(parseInt(b._id) * 1000) 
                })

                pair.priceData.observations = [...sortedArray]

                console.log(`Saving ${total} of ${observationsArray.length} in ${pair.symbol}`)

                try {
                    await pair.save()
                    console.log(`Updated/saved ${pair.symbol}`)                   
                } catch (error) {
                    console.log(`Error updating pair ${pair.symbol}: ${error}`)
                }
            }
            total += 1
        }
    }
}

async function appendObservations(data, seconds) {
    console.log('Appending...', data.symbol)

    Pair.findById(data.symbol)
        .then(pair => {
            console.log(pair.symbol)
            if (pair !== null && pair !== undefined) {
                // updateObservationsData(pair, data.observations)
                updateTimeseries(pair, data.observations, seconds)

            } else {
                    const {
                        symbol,
                        baseToken,
                        quoteToken,
                        poolAddress,
                        poolFee,
                        arrayTypes,
                        extraMinutesData,
                    } = data

                    pair = new Pair({
                        _id: symbol,
                        symbol,
                        baseToken,
                        quoteToken,
                        poolAddress,
                        poolFee,
                        arrayTypes,
                        extraMinutesData,
                    })

                updateTimeseries(pair, data.observations, seconds)
            }

        })
        .catch(error => {
            console.log(error)
        })
}

exports.appendFile = appendObservations;