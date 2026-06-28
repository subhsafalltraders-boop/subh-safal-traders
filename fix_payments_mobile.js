const fs = require('fs');
const file = 'app/(dashboard)/payments/page.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /(\s*\{\/\* Shared History List \*\/})/g,
  `
              </div>
            </>
          )}
$1`
);

fs.writeFileSync(file, content, 'utf8');
