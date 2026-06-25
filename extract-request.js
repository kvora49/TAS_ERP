const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\Krish\\.gemini\\antigravity-ide\\brain\\1a68a754-6845-4710-ace2-23f90bbfad3d\\.system_generated\\logs\\transcript_full.jsonl';
const outputPath = path.join(__dirname, 'user_request_full.md');

try {
  const fileContent = fs.readFileSync(logPath, 'utf8');
  // Read first line
  const firstLine = fileContent.split('\n')[0];
  const parsed = JSON.parse(firstLine);
  if (parsed && parsed.content) {
    fs.writeFileSync(outputPath, parsed.content, 'utf8');
    console.log("Success! Full request written to user_request_full.md");
  } else {
    console.log("Error: content field not found in first line");
  }
} catch (err) {
  console.error("Error:", err.message);
}
