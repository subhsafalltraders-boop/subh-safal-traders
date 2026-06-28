const fs = require('fs');
const file = 'app/(dashboard)/payments/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// The block starts at `      {/* Shared History List - Keep for backward compatibility when in Record Payment mode */}`
// and ends with `      )}` just before `{/* Password Modal */}`

const startIndex = content.indexOf('{/* Shared History List - Keep for backward compatibility when in Record Payment mode */}');
const endIndex = content.indexOf('{/* Password Modal */}');

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find blocks");
  process.exit(1);
}

let historyBlockRaw = content.substring(startIndex, endIndex);
// Remove the outer `{paymentsTab === 'record' && (` and `)}` wrapper so we can just use the inner block 
historyBlockRaw = historyBlockRaw.replace(/\{paymentsTab === 'record' && \(\s*/, '');
// Find the last `)}` and remove it
const lastBraceIdx = historyBlockRaw.lastIndexOf(')}');
if (lastBraceIdx !== -1) {
  historyBlockRaw = historyBlockRaw.substring(0, lastBraceIdx);
}

const targetReplacementStr = `
              </div>
            </>
          )}
`;

content = content.replace(targetReplacementStr, `${targetReplacementStr}\n          {/* Mobile Previous Payments History */}\n          ${historyBlockRaw}\n`);

fs.writeFileSync(file, content, 'utf8');
