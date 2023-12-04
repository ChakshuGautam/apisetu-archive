const fetch = require('node-fetch');
const fs = require('fs');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const HttpsProxyAgent = require('https-proxy-agent').HttpsProxyAgent;


async function downloadProxies() {
    const { stdout, stderr } = await exec('curl -s https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt -o ./proxies/http.txt');


    // if (stderr) {
    //     console.error(`Error: ${stderr}`);
    //     return;
    // }

    const data = fs.readFileSync('./proxies/http.txt', 'utf8');
    const proxies = data.split('\n').filter(Boolean); // filter to remove any empty strings

    proxies.forEach((proxy, index) => {
        proxies[index] = proxy.split(':')[0];
    })

    console.log(`Found ${proxies.length} proxies`);

    const response = await fetch('https://geoip.samagra.io/city/batch', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ips: proxies }),
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const geoipData = await response.json();

    // Get Indian Proxies
    /*
    {
        status: 'success',
        continent: 'North America',
        continentCode: 'NA',
        country: 'United States',
        countryCode: '',
        region: '',
        regionName: '',
        city: '',
        zip: '',
        lat: 37.751,
        lon: -97.822,
        timezone: 'America/Chicago',
        proxy: false,
        hosting: false,
        query: '23.95.186.182'
    }
    */

    const indianProxies = geoipData.filter((proxy) => {
        return proxy.country === 'India';
    })

    console.log(`Found ${indianProxies.length} Indian proxies`);
    // Save them to file - "proxies.txt" in the same directory. The port that was removed earlier also needed to be added.
    // Simple search from http.txt should allow for that

    fs.writeFileSync('./proxies/proxies.txt', indianProxies.map((proxy) => {
        // find line from http.txt that matches the query
        const line = fs.readFileSync('./proxies/http.txt', 'utf8')
            .split('\n')
            .filter(Boolean)
            .find((line) => {
                return line.includes(proxy.query);
            });
        // add line to proxies.txt
        return `${line}`
    }).join('\n'));

    // Find speed of the proxies
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000)
    // Send requests through each proxy parallelly
    // If a proxy fails, remove it from the list
    const fetchWithProxy = async (url, proxy) => {
        try {
            const response = await fetch(url, { agent: new HttpsProxyAgent(`http://${proxy}`), signal: controller.signal });
            if (!response.ok) {
                throw new Error(`Error: ${response.status}`);
            }
            return response;
        } catch (error) {
            console.error(`Failed to fetch URL ${url} with proxy ${proxy}: ${error}`);
            return null;
        }
    };

    const sendRequestsParallelly = async (urls, proxies) => {
        const results = await Promise.all(
            proxies.map(async (proxy) => {
                const responses = await Promise.all(
                    urls.map(async (url) => {
                        const response = await fetchWithProxy(url, proxy);
                        return { url, response };
                    })
                );
                return { proxy, responses };
            })
        );

        const validProxies = results.filter((result) => {
            return result.responses.every((response) => response.response !== null);
        });

        const failedProxies = results.filter((result) => {
            return result.responses.some((response) => response.response === null);
        });

        console.log(`Valid proxies: ${validProxies.length}`);
        console.log(`Failed proxies: ${failedProxies.length}`);

        // Remove failed proxies from the list
        const updatedProxies = proxies.filter((proxy) => {
            return failedProxies.every((failedProxy) => failedProxy.proxy !== proxy);
        });

        console.log(`Updated proxies: ${updatedProxies.length}`);

        return validProxies;
    };

    // Example usage
    const urls = ['https://cf-media.api-setu.in/specfiles/nitk.yaml'];
    const indianProxiesAll = fs.readFileSync('./proxies/http.txt', 'utf8').split('\n').filter(Boolean);

    const validProxiesIndian = await sendRequestsParallelly(urls, indianProxiesAll);
    console.log('Valid proxies:', validProxiesIndian);

    const validProxiesFilePath = './proxies/validProxies.txt';
    const validProxiesString = validProxiesIndian.map((validProxy) => validProxy.proxy).join('\n');
    fs.writeFileSync(validProxiesFilePath, validProxiesString, 'utf8');

    console.log(`Valid proxies saved to file: ${validProxiesFilePath}`);
}

downloadProxies().catch(console.error);