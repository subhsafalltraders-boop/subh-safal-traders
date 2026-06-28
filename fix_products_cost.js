const fs = require('fs');
const file = 'app/(dashboard)/products/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Update select query
content = content.replace(
  'select(\'id, created_at, name, price_per_box, price_per_piece, stock_boxes, stock_pieces, boxes_per_tray, pieces_per_box, is_active, is_party_pack, aliases\')',
  'select(\'id, created_at, name, price_per_box, price_per_piece, cost_price, stock_boxes, stock_pieces, boxes_per_tray, pieces_per_box, is_active, is_party_pack, aliases\')'
);

// Update formData initial state
content = content.replace(
  /price_per_box: '',\s+price_per_piece: '',/,
  'price_per_box: \'\',\n    price_per_piece: \'\',\n    cost_price: \'\','
);
content = content.replace(
  /price_per_box: '',\s+price_per_piece: '',/g,
  'price_per_box: \'\',\n      price_per_piece: \'\',\n      cost_price: \'\','
);

// Update payload
content = content.replace(
  /price_per_box: Number\(formData\.price_per_box \|\| 0\),\s+price_per_piece: Number\(formData\.price_per_piece \|\| 0\),/,
  'price_per_box: Number(formData.price_per_box || 0),\n        price_per_piece: Number(formData.price_per_piece || 0),\n        cost_price: Number(formData.cost_price || 0),'
);

// Update handleEdit
content = content.replace(
  /price_per_box: product\.price_per_box \? product\.price_per_box\.toString\(\) : '',\s+price_per_piece: product\.price_per_piece \? product\.price_per_piece\.toString\(\) : '',/,
  'price_per_box: product.price_per_box ? product.price_per_box.toString() : \'\',\n      price_per_piece: product.price_per_piece ? product.price_per_piece.toString() : \'\',\n      cost_price: product.cost_price ? product.cost_price.toString() : \'\','
);

// Inject form input for Desktop
const desktopInputStr = `              <div>
                <label className="block text-[12px] font-medium text-on-surface-variant mb-1 uppercase tracking-wider">Price (Box) *</label>
                <input type="text" inputMode="numeric" pattern="[0-9]*" value={formData.price_per_box} onChange={e => {
                  const val = e.target.value;
                  if (val === '' || /^\\d+$/.test(val)) setFormData({...formData, price_per_box: val});
                }} className="w-full h-12 bg-surface border border-outline-variant rounded-xl px-4 text-[16px] text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-on-surface-variant/50" placeholder="₹ 0" />
              </div>`;

const desktopCostInput = `              <div>
                <label className="block text-[12px] font-medium text-on-surface-variant mb-1 uppercase tracking-wider">Cost Price (Box) *</label>
                <input type="text" inputMode="numeric" pattern="[0-9]*" value={formData.cost_price} onChange={e => {
                  const val = e.target.value;
                  if (val === '' || /^\\d+$/.test(val)) setFormData({...formData, cost_price: val});
                }} className="w-full h-12 bg-surface border border-outline-variant rounded-xl px-4 text-[16px] text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-on-surface-variant/50" placeholder="₹ 0" />
              </div>`;

content = content.replace(desktopInputStr, desktopInputStr + '\n' + desktopCostInput);

// Inject form input for Mobile
const mobileInputStr = `                <div>
                  <label className="block font-label-caption text-[12px] text-on-surface-variant mb-1 uppercase tracking-wider">Price (Box) *</label>
                  <input type="text" inputMode="numeric" pattern="[0-9]*" value={formData.price_per_box} onChange={e => {
                    const val = e.target.value;
                    if (val === '' || /^\\d+$/.test(val)) setFormData({...formData, price_per_box: val});
                  }} className="w-full h-[48px] bg-surface-container-lowest border border-outline-variant rounded-lg px-3 text-[16px] font-medium text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" placeholder="₹" />
                </div>`;

const mobileCostInput = `                <div>
                  <label className="block font-label-caption text-[12px] text-on-surface-variant mb-1 uppercase tracking-wider">Cost Price (Box)</label>
                  <input type="text" inputMode="numeric" pattern="[0-9]*" value={formData.cost_price} onChange={e => {
                    const val = e.target.value;
                    if (val === '' || /^\\d+$/.test(val)) setFormData({...formData, cost_price: val});
                  }} className="w-full h-[48px] bg-surface-container-lowest border border-outline-variant rounded-lg px-3 text-[16px] font-medium text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" placeholder="₹" />
                </div>`;

content = content.replace(mobileInputStr, mobileInputStr + '\n' + mobileCostInput);

fs.writeFileSync(file, content, 'utf8');
