require('dotenv').config();

// Instantiates a client. Explicitly use service account credentials by
// specifying the private key file. All clients in google-cloud-node have this
// helper, see https://github.com/GoogleCloudPlatform/google-cloud-node/blob/master/docs/authentication.md
const projectId = 'deltabotstorage';
const keyFilename = './googlecloud/deltabotstorage-d1ae614436d8.json';

const composedSuffix = 'COMPOSED';

// The ID of your GCS bucket
const bucketName = 'uv3o_5947';

// Imports the Google Cloud client library
var {Storage} =require('@google-cloud/storage');

// Creates a client
const storage = new Storage({projectId, keyFilename});

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

    return root + pairSymbol;
}

// [] Append file
async function appendFile(pairSymbol, data, subfolder) {
    const filename = await getFileName(pairSymbol, subfolder).catch(console.error);
    
    // Initializing the variable that will store the text to be uploaded to storage
    let dataText;

    let { files } = await getSpecificDayFiles(filename);

    if(files.length > 0) {
        // If there is already a file in the cloud storage, upload only the data generated after the last timestamp
        let cloudFileContent = await downloadIntoMemory(filename);
        let content = cloudFileContent[0];  
        let endTimestamp = content.endTimestamp;
        let timestamps = Object.keys(data.observations);
        for(let timestamp of timestamps) {
            let timestampNumber = parseInt(timestamp)
            if(timestampNumber >  endTimestamp) {
                content.observations[timestampNumber] = data.observations[timestampNumber];
                content.endTimestamp = timestampNumber;
            }
        }
        dataText = JSON.stringify(content);
    }
    // If there is no file on the cloud storage, upload all the data
    else {
        dataText = JSON.stringify(data);
    }

    await storage.bucket(bucketName).file(filename).save(dataText);
    console.log(`${filename} uploaded to ${bucketName}`);    
}

// Composing:
// [] Check that it is time to compose files
// [] Compose the files corresponding to the selected time slot
async function composeFiles(filenameRoot) {
    const bucket = storage.bucket(bucketName);
    const files = await getSpecificDayFiles(filenameRoot).catch(console.error);

    const newFilename = filenameRoot + composedSuffix;
    // await bucket.file(newFilename).delete();
    const filenames = files.filenames;
    if (filenames.length > 0) {
        await bucket.combine(filenames, newFilename);
        console.log(`${newFilename} file was composed`);
        await deleteFiles(filenameRoot, newFilename).catch(console.error);
    }
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

async function downloadByRootIntoMemory(filenameRoot) {
    const files = await getSpecificDayFiles(filenameRoot);
    const filenames = files.filenames;
    let rootData = [];

    for(let filename of filenames) {
        let data = await downloadIntoMemory(filename);
        rootData = [...rootData, ...data];
    }
}

exports.appendFile = appendFile;