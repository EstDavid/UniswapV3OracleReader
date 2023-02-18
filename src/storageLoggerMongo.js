const mongoose = require('mongoose')
const Pair = require('./models/pair')

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

const updateObservationsData = (pair, rawObservationsData) => {
    const observationsArray = getObservationsArray(rawObservationsData)

    observationsArray.sort((a, b) => {
        return parseInt(b._id) - parseInt(a._id)
    })

    const data = pair.priceData.observations

    const maxUpdates = 10000
    let counter = 0

    for (let i = 0; i < observationsArray.length; i += 1) {
        const observation = observationsArray[i]
        if (counter > maxUpdates) {
            break
        }
        
        const dataPointExists = (dataPoint) => {
            return dataPoint._id === observation._id
        }
    
        if( data.findIndex(dataPointExists) === -1) {
            console.clear()
            console.log(`Updating observation ${i} of ${observationsArray.length} for ${pair.symbol}`)
            data.push(observation)
            counter += 1
        }
    }
}

async function appendObservations(pairSymbol, data) {
    const timeframe = data.observationTimeframe

    console.log('Appending', data.symbol)

    Pair.findById(data.symbol)
        .then(pair => {
            if (pair !== null && pair !== undefined) {
                updateObservationsData(pair, data.observations)

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
                        priceData: {
                            _id: `${symbol}-${timeframe.seconds}`,
                            timeframe,
                            observations: [],
                        }
                    })

                updateObservationsData(pair, data.observations)

                console.log(pair.priceData.earliestDate)

                pair.save()
                    .then(result => {
                        console.log(`Created new pair for ${data.symbol}`)                   
        
                    })
                    .catch(error => {
                        console.log(`Error creating new pair ${data.symbol}: ${error}`)
                    })
            }

        })
}

exports.appendFile = appendObservations;