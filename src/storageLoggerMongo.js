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

const getEarliest = (earliest, observation) => {
    const current = observation.timestamp
    return current <= earliest ? current : earliest
}

const getLatest = (latest, observation) => {
    const current = observation.timestamp
    return current >= latest ? current : latest
}

const getObservationsArray = (observationsObject) => {
    const observationsArray = []
    for (let timestamp in observationsObject) {
        const observation = {
            timestamp: new Date(parseInt(timestamp) * 1000),
            price: observationsObject[timestamp]
        }
        observationsArray.push(observation)
    }
    return observationsArray
}


const updateObservationsData = (pair, timeframe, rawObservationsData) => {
    const observationsArray = getObservationsArray(rawObservationsData)

    observationsArray.sort((a, b) => {
        return b.timestamp - a.timestamp
    })

    const observationsIndex = pair.observations.findIndex(observation => {
        return observation.name === timeframe.name
    })

    const maxUpdates = 10000
    let counter = 0

    if (observationsIndex !== -1) {
        const observationsData = pair.observations[observationsIndex].observationsData
        const earliestObservation = observationsData.reduce(getEarliest, observationsData[0].timestamp)
        const latestObservation = observationsData.reduce(getLatest, observationsData[0].timestamp)
        console.log(`Earliest: ${earliestObservation.toDateString()} ${earliestObservation.toTimeString()}`)
        console.log(`Latest: ${latestObservation.toDateString()} ${latestObservation.toTimeString()}`)

        for (let i = 0; i < observationsArray.length; i += 1) {
            const observation = observationsArray[i]
            if (counter > maxUpdates) {
                break
            }

            if ( 
                observation.timestamp > latestObservation ||
                observation.timestamp < earliestObservation || 
                ( latestObservation === undefined && earliestObservation === undefined) 
                ) {
                console.clear()
                console.log(`Updating observation ${i} of ${observationsArray.length} for ${pair.symbol}`)
                console.log(`Earliest: ${earliestObservation.toDateString()} ${earliestObservation.toTimeString()}`)
                console.log(`Latest: ${latestObservation.toDateString()} ${latestObservation.toTimeString()}`)
                console.log(`Current: ${observation.timestamp.toDateString()} ${observation.timestamp.toTimeString()}`)                
        
                observationsData.push(observation)
                counter += 1
            }
        }

    } else {
        const newObservations = {
            name: timeframe.name,
            seconds: timeframe.seconds,
            observationsData: [],
        }

        pair.observations.push(newObservations)

        for (let i = 0; i < observationsArray.length; i += 1) {
            const observation = observationsArray[i]
            if (counter > maxUpdates) {
                break
            }

            pair.observations[pair.observations.length - 1].observationsData.push(observation)
            counter += 1   
        }
    }
}

async function appendObservations(pairSymbol, data) {
    const timeframe = data.observationTimeframe

    console.log('Appending', data.symbol)

    Pair.find({symbol: data.symbol})
        .then(result => {
            let [pair] = result
            if (pair !== undefined) {
                updateObservationsData(pair, timeframe, data.observations)

                pair.save()
                    .then(console.log(`Added new observations (${pair.observations[0].observationsData.length}) to ${data.symbol} pair`))
                    .catch(error => {
                        console.log(error)
                        console.log(`Error adding new observations to ${data.symbol} pair`)
                    })
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
                        symbol,
                        baseToken,
                        quoteToken,
                        poolAddress,
                        poolFee,
                        arrayTypes,
                        extraMinutesData,
                        observations: []
                    })

                updateObservationsData(pair, timeframe, data.observations)

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