require('dotenv').config()
const mongoose = require('mongoose')
// const Pair = require('./models/pair')
// const Observation = require('./models/observation')


const { appendFile } = require('./storageLoggerMongo')

const fs = require('fs')

const directory = "./legacyData/30 seconds"

const processFile = async(filename) => {
    if(filename !== 'WETHUSDT.json') {
        try {
            const content = await fs.promises.readFile(directory + '/' + filename)
    
            const data = JSON.parse(content.toString())
    
            await appendFile(data, 30)    
        } catch (error) {
            console.log(error)
        }
    }
}

const updateSymbols = async(directory) => {
    try {
        const files = await fs.promises.readdir(directory)

        console.log(files)

    } catch (error) {
        console.log(error)
    }
}

const transferObservationsToPriceData = async () => {
    const pairSymbols = await Pair.find({}, {symbol: 1})

    for (let pairSymbol of pairSymbols) {
        console.log(`Processing ${pairSymbol.symbol}`)
        const observation = await Observation.findOne({symbol: pairSymbol.symbol})
        const pair = await Pair.findOne({symbol: pairSymbol.symbol})

        const dataPointsBefore = pair.priceData.observations.length

        const timestamps = pair.priceData.observations.map((observationPoint) => {
            return observationPoint._id
        })

        let counter = 1
        let dataUpdated = false
        for (let observationPoint of observation.data) {
            console.clear()
            console.log(`Updating observation ${counter} of ${observation.data.length} for ${pairSymbol.symbol}`)
    
            if( !timestamps.includes(observationPoint._id)) {
                pair.priceData.observations.push(observationPoint)
                dataUpdated = true
            } else {
                console.log(`Data point ${observationPoint._id} already included`)
            }
            counter += 1
        }
        if(dataUpdated) {
            try {
                    const result = await pair.save()
                    console.log(`${result.symbol} was updated from ${dataPointsBefore} to ${result.priceData.observations.length}`)
            } catch (error) {
                console.log(error)
            }
        } else {
            console.log(`${pairSymbol.symbol} was up to date`)
        }
    }

}

// transferObservationsToPriceData()

// downloadFilesAndUploadToMongo(filenameRoot)
// updateSymbols(directory)
setTimeout(processFile, 10000, '1INCHDAI.json')

