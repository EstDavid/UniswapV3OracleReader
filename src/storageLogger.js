require('dotenv').config();

// Instantiates a client. Explicitly use service account credentials by
// specifying the private key file. All clients in google-cloud-node have this
// helper, see https://github.com/GoogleCloudPlatform/google-cloud-node/blob/master/docs/authentication.md

// The ID of your GCS bucket
const bucketName = process.env.BUCKET_NAME;

// Imports the Google Cloud client library
var {Storage} =require('@google-cloud/storage');

// Creates a client
const storage = new Storage();

// TODO
// Basic operations:
// [] Get filename root
function getFilenameRoot(subfolder) {

    return  `${subfolder !== undefined ? subfolder + '/': ''}`;
}

// [] Check if there is a filename with the same root
async function getSpecificDayFiles(filenameRoot) {
    // From https://cloud.google.com/storage/docs/samples/storage-list-files-with-prefix
    const options = {
        prefix: filenameRoot,
    }
    const [files] = await storage.bucket(bucketName).getFiles(options);
    const filenames = [];
    files.map(file => filenames.push(file.name));
    return {
        files: files,
        filenames: filenames
    };
}

// [] Get the new number and create the new filename
async function getFileName(pairSymbol, subfolder) {
    const root = getFilenameRoot(subfolder);

    return root + pairSymbol + '.json';
}

// [] Append file
async function appendFile(pairSymbol, data, subfolder) {

    const filename = await getFileName(pairSymbol, subfolder).catch(console.error);
    
    // Initializing the variable that will store the text to be uploaded to storage
    let dataText;

    let { files } = await getSpecificDayFiles(filename);

    const currentTime = new Date();
    const currentTimeSeconds = currentTime.getTime() / 1000;
    const minimumTimestamp = currentTimeSeconds - 60 * 60 * 24 * 365 * 3;

    // console.log(minimumTimestamp)

    if(files.length > 0) {
         // If there is already a file in the cloud storage, upload only the data generated after the last timestamp
         let cloudFileContent = await downloadIntoMemory(filename);
         let content = cloudFileContent[0];  
         let endTimestamp = content.endTimestamp;
         let timestamps = Object.keys(data.observations);
         for(let timestamp of timestamps) {
             let timestampNumber = parseInt(timestamp);
           
            //  if(timestampNumber >  endTimestamp) {
                 content.observations[timestampNumber] = data.observations[timestampNumber];
                //  content.endTimestamp = timestampNumber;
            //  }
         }

         let timestampsContent = Object.keys(content.observations);

         for(let timestamp of timestampsContent) {
            let timestampNumber = parseInt(timestamp);
          
            if(timestampNumber < minimumTimestamp) {
                // console.log(content.observations[timestampNumber], timestampNumber)
                const {[timestampNumber.toString()]: value, ...newContent } = content.observations;
                content.observations = newContent;
                // console.log(content.observations[timestampNumber], timestampNumber)
             }
        }

        const newTimestamps = Object.keys(content.observations);


        content.startTimestamp = Math.min(...newTimestamps);
        content.endTimestamp = Math.max(...newTimestamps);

         dataText = JSON.stringify(content);       
    }
    // If there is no file on the cloud storage, upload all the data
    else {
        dataText = JSON.stringify(data);
    }

    await storage.bucket(bucketName).file(filename).save(dataText);
    console.log(`${filename} uploaded to ${bucketName}`);
}

// [] Delete old files
async function deleteFiles(filenameRoot, exception) {
    const bucket = storage.bucket(bucketName);
    const files = await getSpecificDayFiles(filenameRoot).catch(console.error);

    for(let filename of files.filenames) {
        if(filename !== exception) {
            try {
                await bucket.file(filename).delete().catch(error => console('Deletion error', error));
            } catch (error) {
                console.log(error)
            }
        }
    };

    console.log('Files deleted!');
}

// From https://cloud.google.com/storage/docs/samples/storage-file-download-into-memory
async function downloadIntoMemory(filename) {
    const contentTxt = await storage.bucket(bucketName).file(filename).download();
    let content = contentTxt.toString().split("\n");
    // Filtering out any row with an empty string value, such as the last one in the file
    content = content.filter((row) => {return row !== ""});
    
    for(let i = 0; i < content.length; i += 1) {
        if (content)
        content[i] = JSON.parse(content[i]);
    }
    
    return content;
}

exports.appendFile = appendFile;