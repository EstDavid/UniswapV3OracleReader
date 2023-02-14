const mongoose = require('mongoose')
const Pair = require('./models/pair')
const Observation = require('./models/observation')

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

const getObservationId = (pair, timeframe) => {
    return `${pair.symbol}-${timeframe.seconds}`
}


const updateObservationsData = (pair, timeframe, rawObservationsData) => {
    const id = getObservationId(pair, timeframe)

    const observationsArray = getObservationsArray(rawObservationsData)

    observationsArray.sort((a, b) => {
        return parseInt(b._id) - parseInt(a._id)
    })

    const maxUpdates = 10000
    let counter = 0

    Observation.findById(id)
        .then(observation => {
            if (observation !== null && observation !== undefined) {
                const data = observation.data
                const earliestObservation = observation.earliest
                const latestObservation = observation.latest
                console.log(`Earliest: ${earliestObservation.toDateString()} ${earliestObservation.toTimeString()}`)
                console.log(`Latest: ${latestObservation.toDateString()} ${latestObservation.toTimeString()}`)
        
                for (let i = 0; i < observationsArray.length; i += 1) {
                    const observation = observationsArray[i]
                    const timestamp = new Date(parseInt(observation._id) * 1000)
                    if (counter > maxUpdates) {
                        break
                    }
        
                    if ( 
                        timestamp > latestObservation ||
                        timestamp < earliestObservation || 
                        ( latestObservation === undefined && earliestObservation === undefined) 
                        ) {
                        const currentTimestamp = new Date(parseInt(observation._id) * 1000)
                        console.clear()
                        console.log(`Updating observation ${i} of ${observationsArray.length} for ${pair.symbol}`)
                        console.log(`Earliest: ${earliestObservation.toDateString()} ${earliestObservation.toTimeString()}`)
                        console.log(`Latest: ${latestObservation.toDateString()} ${latestObservation.toTimeString()}`)
                        console.log(`Current: ${currentTimestamp.toDateString()} ${currentTimestamp.toTimeString()}`)                
                
                        data.push(observation)
                        counter += 1
                    }
                }

                observation.save()
                    .then(console.log(`Added new observations (${observation.data.length}) to ${observation.id} observation`))
                    .catch(error => {
                        console.log(error)
                        console.log(`Error adding new observations to ${observation.id} observation`)
                    })  
            } else {
                const newObservation = {
                    _id: id,
                    symbol: pair.symbol,
                    timeframe: {
                        name: timeframe.name,
                        seconds: timeframe.seconds,
                    },
                    data: [],
                }

                observation = new Observation(newObservation)
                
                for (let i = 0; i < observationsArray.length; i += 1) {
                    const observationPoint = observationsArray[i]
                    if (counter > maxUpdates) {
                        break
                    }
        
                    observation.data.push(observationPoint)
                    counter += 1   
                }

                observation.save()
                    .then(result => {
                        console.log(`Added observation ${observation.id} with (${observation.data.length}) observations`)
                    })
                    .catch(error => {
                        console.log(error)
                        console.log(`Error creating observation ${observation.id}`)
                    })  
            }
        })
}

async function appendObservations(pairSymbol, data) {
    const timeframe = data.observationTimeframe

    console.log('Appending', data.symbol)

    Pair.findById(data.symbol)
        .then(pair => {
            if (pair !== null && pair !== undefined) {
                updateObservationsData(pair, timeframe, data.observations)

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