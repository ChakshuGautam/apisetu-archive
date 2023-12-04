const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const resultsFilePath = 'results.json';
const yamlDirectory = 'yaml_files';
const progressFilePath = 'progress.json';

const HttpsProxyAgent = require('https-proxy-agent').HttpsProxyAgent;

// Ensure the directory for YAML files exists
if (!fs.existsSync(yamlDirectory)) {
    fs.mkdirSync(yamlDirectory);
}

// async function getProxy() {
//     const proxyUrl = 'https://gimmeproxy.com/api/getProxy?get=true&protocol=http&country=IN';
//     try {
//         const response = await fetch(proxyUrl);
//         if (!response.ok) {
//             throw new Error(`Error fetching proxy: ${response.status}`);
//         }
//         const data = await response.json();
//         return new HttpsProxyAgent(data.curl);
//     } catch (error) {
//         console.error(`Failed to get proxy: ${error}`);
//         return null;
//     }
// }

async function getProxy() {
    const proxies = fs.readFileSync('./proxies/validProxies.txt', 'utf8').split('\n').filter(Boolean);
    const proxy = proxies[Math.floor(Math.random() * proxies.length)];
    return new HttpsProxyAgent(`http://${proxy}`);
}

// Initialize or read the progress file
let progress = {};
if (fs.existsSync(progressFilePath)) {
    progress = JSON.parse(fs.readFileSync(progressFilePath));
} else {
    fs.writeFileSync(progressFilePath, JSON.stringify({}));
}

async function fetchYamlFiles() {
    const results = JSON.parse(fs.readFileSync(resultsFilePath));
    for (const result of results) {
        if (result.Collections) {
            for (const collection of result.Collections) {
                const collFileName = collection.coll_file_name;
                const modifiedOn = new Date(collection.modified_on);
                const yamlFilePath = path.join(yamlDirectory, `${collFileName}.yaml`);

                if (fs.existsSync(yamlFilePath)) {
                    const fileStats = fs.statSync(yamlFilePath);
                    const fileModifiedDate = new Date(fileStats.mtime);

                    if (fileModifiedDate >= modifiedOn && progress[collFileName]) {
                        console.log(`Skipping ${collFileName}, no updates.`);
                        continue;
                    }
                }

                await downloadWithExponentialBackoff(`https://cf-media.api-setu.in/specfiles/${collFileName}.yaml`, collFileName, 1, modifiedOn);
            }
        }
    }
}

async function downloadWithExponentialBackoff(url, fileName, attempt, modifiedOn) {
    try {
        const agent = await getProxy();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000)
        console.log(`Using proxy: ${agent ? agent.proxy.href : 'none'}`);
        const response = await fetch(url, { agent: agent, signal: controller.signal });
        if (response.ok) {
            const yamlContent = await response.text();
            fs.writeFileSync(path.join(yamlDirectory, `${fileName}.yaml`), yamlContent);
            progress[fileName] = { downloaded: true, modifiedOn: modifiedOn.toISOString() };
            fs.writeFileSync(progressFilePath, JSON.stringify(progress));
            console.log(`Saved YAML for ${fileName}`);
        } else if (response.status === 429 && attempt <= 5) { // Retry up to 5 times
            const retryAfter = Math.pow(2, attempt) * 1000; // Exponential backoff
            console.log(`Retrying ${fileName} after ${retryAfter} ms (Attempt ${attempt})`);
            setTimeout(() => downloadWithExponentialBackoff(url, fileName, attempt + 1, modifiedOn), retryAfter);
        } else {
            console.error(`Failed to fetch YAML for ${fileName}: ${response.status}`);
        }
    } catch (error) {
        console.error(`Error fetching YAML for ${fileName}: ${error}`);
    }
}

fetchYamlFiles().catch(console.error);
