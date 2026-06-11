const fs = require('fs');
const file = 'components/PrintBill.tsx';
let code = fs.readFileSync(file, 'utf8');

// replace margin 6mm to 3mm
code = code.replace(/margin: \$\{isLandscape \? '6mm' : '8mm'\};/g, "margin: ${isLandscape ? '3mm' : '8mm'};");
code = code.replace(/padding: isLandscape \? '6mm' : '8mm',/g, "padding: isLandscape ? '3mm' : '8mm',");

// reduce marginBottom from 4px to 2px for landscape
code = code.replace(/marginBottom: '4px'/g, "marginBottom: isLandscape ? '2px' : '4px'");

// reduce table cell padding from 2px to 1px for landscape
code = code.replace(/padding: '2px'/g, "padding: isLandscape ? '1px' : '2px'");

// reduce margin on company name
code = code.replace(/margin: '4px 0'/g, "margin: isLandscape ? '2px 0' : '4px 0'");

// reduce padding on M/S row
code = code.replace(/padding: '4px 0'/g, "padding: isLandscape ? '2px 0' : '4px 0'");

fs.writeFileSync(file, code);
console.log('Done');
