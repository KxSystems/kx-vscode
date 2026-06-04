const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, 'resources/q/vscode.q');
const outputPath = path.join(__dirname, 'out/vscode.q');

// Ensure directory exists
if (!fs.existsSync(path.dirname(outputPath))) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
}

let template = fs.readFileSync(templatePath, 'utf8');

// Regex to find all //{{path/to/file.q}}
const placeholderRegex = /\/\/\{\{(.*?)\}\}/g;

const result = template.replace(placeholderRegex, (match, filePath) => {
    const fullPath = path.resolve(__dirname, filePath.trim());
    
    if (fs.existsSync(fullPath)) {
        console.log(`Inlining: ${filePath}`);
        // Read the file and return it to replace the match
        return fs.readFileSync(fullPath, 'utf8').trim();
    } else {
        console.error(`Error: File not found - ${fullPath}`);
        process.exit(1);
    }
});

fs.writeFileSync(outputPath, result);
console.log(`Successfully built: ${outputPath}`);