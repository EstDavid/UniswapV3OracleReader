const { getSpecificDayFiles } = require('./storageLogger')
const { appendFile } = require('./storageLoggerMongo')

const filenameRoot = '30 seconds/'

const downloadFilesAndUploadToMongo = async (filenameRoot) => {
    const {files} = await getSpecificDayFiles(filenameRoot)

    let counter = 0
    for (let file of files) {
        // if (counter > 3) {
        //     break
        // }
        counter += 1
        console.log('downloading', file.name)

        const contentTxt = await file.download();
        let content = contentTxt.toString().split("\n");
        // Filtering out any row with an empty string value, such as the last one in the file
        content = content.filter((row) => {return row !== ""});
        
        for(let i = 0; i < content.length; i += 1) {
            if (content)
            content[i] = JSON.parse(content[i]);
        }
        
        const [data] = content

        console.log(`Downloading file ${counter} of ${files.length}`)

        await appendFile(data.symbol, data)
    }
}

downloadFilesAndUploadToMongo(filenameRoot)

