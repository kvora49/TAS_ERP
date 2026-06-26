const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\Krish\\.gemini\\antigravity-ide\\brain\\9703ce35-96a6-436d-a22a-579b497523cf\\.system_generated\\logs\\transcript_full.jsonl';
const outputPath = path.join(__dirname, 'user_request_phase3.md');

try {
  const fileContent = fs.readFileSync(logPath, 'utf8');
  const lines = fileContent.split('\n');
  let found = false;
  for (const line of lines) {
    if (!line.trim()) continue;
    const parsed = JSON.parse(line);
    if (parsed && parsed.step_index === 13) {
      fs.writeFileSync(outputPath, parsed.content, 'utf8');
      console.log("Success! Full request written to user_request_phase3.md");
      found = true;
      break;
    }
  }
  if (!found) {
    console.log("Error: step_index 13 not found");
  }
} catch (err) {
  console.error("Error:", err.message);
}
