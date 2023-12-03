const fetch = require('node-fetch');
const fs = require('fs');

const HttpsProxyAgent = require('https-proxy-agent').HttpsProxyAgent;

const resultsFilePath = 'results.json';

// Initialize the results file with an empty array if it doesn't exist
if (!fs.existsSync(resultsFilePath)) {
    fs.writeFileSync(resultsFilePath, JSON.stringify([]));
}


async function getProxy() {
    const proxyUrl = 'https://gimmeproxy.com/api/getProxy?country=IN';
    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) {
            throw new Error(`Error fetching proxy: ${response.status}`);
        }
        const data = await response.json();
        return new HttpsProxyAgent(data.curl);
    } catch (error) {
        console.error(`Failed to get proxy: ${error}`);
        return null;
    }
}


async function fetchWithRetry(url, options, maxRetries = 5, attempt = 1) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response;
    } catch (error) {
        if (attempt <= maxRetries) {
            const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
            console.log(`Request failed with error: ${error.message}. Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry(url, options, maxRetries, attempt + 1);
        } else {
            throw error;
        }
    }
}

async function fetchAllPages() {
    const baseUrl = "https://api.apisetu.gov.in/directory/search/v1/apislist";
    let currentPage = 0;
    let totalPages = 1; // Default to 1 to start the loop

    const agent = await getProxy();
    console.log(`Using proxy: ${agent ? agent.proxy.href : 'none'}`);

    const headers = {
        'authority': 'api.apisetu.gov.in',
        'accept': '*/*',
        'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
        'authorization': 'Bearer a6071d626e133fa7658a2621f306d6de0a3cae8b1d80110aa9600f95a93cee3d',
        'cache-control': 'no-cache',
        'origin': 'https://directory.apisetu.gov.in',
        'pragma': 'no-cache',
        'referer': 'https://directory.apisetu.gov.in/',
        'sec-ch-ua': '"Google Chrome";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        'ts': '1701624941',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    }

    while (currentPage < totalPages) {
        const queryParams = encodeURIComponent(JSON.stringify({
            "facetFilters": [[], [], [], [], []],
            "facets": ["total_api", "authority", "orgState", "categories", "centralMinistry", "apiType"],
            "hitsPerPage": 21,
            "maxValuesPerFacet": 50,
            "page": currentPage.toString(),
            "query": ""
        }));

        try {
            const response = await fetchWithRetry(`${baseUrl}?q=${queryParams}&sort=`, {
                method: 'GET',
                headers: headers,
                agent: agent
            });

            if (!response.ok) {
                throw new Error(`Error: ${response.status}`);
            }

            const data = await response.json();

            // Read existing data from the file
            let existingData = JSON.parse(fs.readFileSync(resultsFilePath));
            let newData = data.result.hits;
            let updated = false;

            for (let newItem of newData) {
                let index = existingData.findIndex(item => item.objectID === newItem.objectID);
                if (index !== -1) {
                    // Check if the existing item needs to be updated
                    if (new Date(newItem.modified_on) > new Date(existingData[index].modified_on)) {
                        existingData[index] = newItem; // Update in place
                        updated = true;
                    }
                } else {
                    // Add new item if it doesn't exist
                    existingData.push(newItem);
                    updated = true;
                }
            }

            if (updated) {
                // Write updated data back to the file only if there were updates
                fs.writeFileSync(resultsFilePath, JSON.stringify(existingData, null, 2));
            }

            totalPages = data.result.nbPages;
            currentPage++;
            console.log(`Processed page ${currentPage} of ${totalPages}`);
        } catch (error) {
            console.error(`Failed to fetch page ${currentPage}: ${error.message}`);
            break; // Exit the loop on persistent failure
        }
    }
}

fetchAllPages().catch(console.error);
