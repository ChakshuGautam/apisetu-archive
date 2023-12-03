const fetch = require('node-fetch');
const fs = require('fs');

const resultsFilePath = 'results.json';

// Initialize the results file with an empty array if it doesn't exist
if (!fs.existsSync(resultsFilePath)) {
    fs.writeFileSync(resultsFilePath, JSON.stringify([]));
}

async function fetchAllPages() {
    const baseUrl = "https://api.apisetu.gov.in/directory/search/v1/apislist";
    let currentPage = 0;
    let totalPages = 1; // Default to 1 to start the loop

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

        console.log(queryParams)

        const response = await fetch(`${baseUrl}?q=${queryParams}&sort=`, {
            method: 'GET',
            headers: headers
        });

        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }

        const data = await response.json();

        // Read existing data from the file
        const existingData = JSON.parse(fs.readFileSync(resultsFilePath));

        // Append new data
        existingData.push(...data.result.hits);

        // Write updated data back to the file
        fs.writeFileSync(resultsFilePath, JSON.stringify(existingData, null, 2));

        // Update the total pages and increment current page
        totalPages = data.result.nbPages;
        currentPage++;
    }
}

fetchAllPages().catch(console.error);
