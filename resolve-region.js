const https = require('https');

const targetIp = '2406:da12:557:f800:d29a:c9:3268:d804';

function ip6ToBigInt(ip) {
  // Expand :: if present
  let expanded = ip;
  if (ip.includes('::')) {
    const parts = ip.split('::');
    const left = parts[0].split(':').filter(Boolean);
    const right = parts[1].split(':').filter(Boolean);
    const missing = 8 - (left.length + right.length);
    const middle = Array(missing).fill('0');
    expanded = [...left, ...middle, ...right].join(':');
  }
  
  const blocks = expanded.split(':').map(hex => parseInt(hex, 16));
  let result = 0n;
  for (const block of blocks) {
    result = (result << 16n) + BigInt(block);
  }
  return result;
}

function matchCidr(ip, cidr) {
  const [prefix, bitsStr] = cidr.split('/');
  const bits = parseInt(bitsStr, 10);
  
  const ipVal = ip6ToBigInt(ip);
  const prefixVal = ip6ToBigInt(prefix);
  
  const shift = BigInt(128 - bits);
  const ipMasked = ipVal >> shift;
  const prefixMasked = prefixVal >> shift;
  
  return ipMasked === prefixMasked;
}

console.log("Downloading AWS IP Ranges...");
https.get('https://ip-ranges.amazonaws.com/ip-ranges.json', (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      console.log("Searching through AWS IPv6 prefixes...");
      
      let found = false;
      for (const prefixObj of data.ipv6_prefixes) {
        if (matchCidr(targetIp, prefixObj.ipv6_prefix)) {
          console.log(`\nMatch found!`);
          console.log(`CIDR Block: ${prefixObj.ipv6_prefix}`);
          console.log(`Region: ${prefixObj.region}`);
          console.log(`Service: ${prefixObj.service}`);
          found = true;
          break;
        }
      }
      
      if (!found) {
        console.log("No matching CIDR block found in AWS registry.");
      }
    } catch (err) {
      console.error("Failed to parse JSON:", err.message);
    }
  });
}).on('error', (err) => {
  console.error("Request failed:", err.message);
});
