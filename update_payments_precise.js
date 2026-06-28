const fs = require('fs');
const file = 'app/(dashboard)/payments/page.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const sharedHistory = lines.slice(777, 885).join('\n'); // Desktop Shared History block

// find </main> in the file. It is the last </main> before the sticky save button.
let mainIdx = -1;
for (let i = lines.length - 1; i >= 0; i--) {
  if (lines[i].includes('</main>')) {
    mainIdx = i;
    break;
  }
}

if (mainIdx !== -1) {
  lines.splice(mainIdx, 0, sharedHistory);
}

fs.writeFileSync(file, lines.join('\n'), 'utf8');
