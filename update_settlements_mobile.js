const fs = require('fs');
const file = 'app/(dashboard)/settlements/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const pendingAdvancesBlock = `
          {/* Pending Advances Section */}
          {formData.vendor_id && (
            <div className="bg-surface-container-lowest border border-outline-variant p-md rounded-2xl shadow-sm flex flex-col gap-sm">
              <h3 className="font-headline-sm text-on-surface border-b border-outline-variant pb-xs">Pending Advances</h3>
              {pendingAdvances.length === 0 ? (
                <p className="text-on-surface-variant text-sm py-2">No pending advances for this vendor.</p>
              ) : (
                <div className="flex flex-col gap-sm max-h-[200px] overflow-y-auto pr-2">
                  {pendingAdvances.map(adv => (
                    <label key={adv.id} className="flex items-center gap-md p-sm bg-surface rounded-xl border border-outline-variant/50 cursor-pointer hover:bg-surface-container-low transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedAdvanceIds.has(adv.id)}
                        onChange={(e) => {
                          const newSet = new Set(selectedAdvanceIds);
                          if (e.target.checked) newSet.add(adv.id);
                          else newSet.delete(adv.id);
                          setSelectedAdvanceIds(newSet);
                        }}
                        className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary"
                      />
                      <div className="flex flex-col flex-1">
                        <span className="font-medium text-on-surface">{adv.date}</span>
                        {adv.note && <span className="text-xs text-on-surface-variant">{adv.note}</span>}
                      </div>
                      <span className="font-bold text-error">₹{adv.amount.toLocaleString('en-IN')}</span>
                    </label>
                  ))}
                  <div className="text-right font-bold text-error mt-xs pt-xs border-t border-outline-variant/30">
                    Total Selected Advances: ₹{advanceAmount.toLocaleString('en-IN')}
                  </div>
                </div>
              )}
            </div>
          )}
`;

const finalBalanceBlock = `
          {/* Final Balance */}
          <div className={\`flex flex-col border p-4 rounded-2xl gap-3 shadow-sm transition-colors \${finalBalance > 0 ? 'bg-error/5 border-error/20' : finalBalance < 0 ? 'bg-[#166534]/5 border-[#166534]/20' : 'bg-surface-variant/30 border-outline-variant/50'}\`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="font-label-lg text-on-surface-variant uppercase tracking-wider">Final Balance Result</span>
              {finalBalance > 0 ? (
                <p className="font-headline-md text-error text-[18px]">Vendor pe <span className="font-bold">₹{finalBalance.toLocaleString('en-IN', {minimumFractionDigits: 0})}</span> baaki hai</p>
              ) : finalBalance < 0 ? (
                <p className="font-headline-md text-[#166534] text-[18px]">Aap vendor ko <span className="font-bold">₹{Math.abs(finalBalance).toLocaleString('en-IN', {minimumFractionDigits: 0})}</span> denge</p>
              ) : (
                <p className="font-headline-md text-on-surface text-[18px]">Hisab barabar hai</p>
              )}
            </div>
            {/* Step-wise running total table */}
            <div className="bg-surface rounded-xl border border-outline-variant shadow-sm overflow-hidden">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {/* Row 1: Total Supplied */}
                  <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 500, fontSize: '14px' }}>Total Supplied:</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '14px', color: '#666', width: '100px' }}></td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, fontSize: '14px', width: '110px' }}>
                      ₹{totalSupplied.toLocaleString('en-IN')}
                    </td>
                  </tr>
                  {/* Row 2: Van Stock */}
                  <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <td style={{ padding: '8px 12px', fontSize: '14px' }}>(-) Van Stock:</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', color: '#c62828' }}>
                      ₹{vanStockTotal.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', color: '#666' }}>
                      = ₹{(totalSupplied - vanStockTotal).toLocaleString('en-IN')}
                    </td>
                  </tr>
                  {/* Row 3: GST (only for vendors) */}
                  {isVendorType && (
                    <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                      <td style={{ padding: '8px 12px', fontSize: '14px' }}>(-) GST ({gstRate}%):</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', color: '#c62828' }}>
                        ₹{gstAmount.toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', color: '#666' }}>
                        = ₹{(totalSupplied - vanStockTotal - gstAmount).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  )}
                  {/* Row 4: Received */}
                  <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <td style={{ padding: '8px 12px', fontSize: '14px' }}>(-) Received:</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', color: '#c62828' }}>
                      ₹{totalReceived.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', color: '#666' }}>
                      = ₹{(totalSupplied - vanStockTotal - gstAmount - totalReceived).toLocaleString('en-IN')}
                    </td>
                  </tr>
                  {/* Row 5: Advance */}
                  <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <td style={{ padding: '8px 12px', fontSize: '14px' }}>(+) Advance:</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', color: '#2e7d32' }}>
                      ₹{advanceAmount.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', color: '#666' }}>
                      = ₹{(totalSupplied - vanStockTotal - gstAmount - totalReceived + advanceAmount).toLocaleString('en-IN')}
                    </td>
                  </tr>
                  {/* Row 6: Pichla baaki */}
                  <tr style={{ borderBottom: '2px solid rgba(0,0,0,0.15)' }}>
                    <td style={{ padding: '8px 12px', fontSize: '14px' }}>(+/-) Pichla:</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', color: openingBalance >= 0 ? '#2e7d32' : '#c62828' }}>
                      {openingBalance >= 0 ? '' : '-'}₹{Math.abs(openingBalance).toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '13px', color: '#666' }}>
                      = ₹{(totalSupplied - vanStockTotal - gstAmount - totalReceived + advanceAmount + openingBalance).toLocaleString('en-IN')}
                    </td>
                  </tr>
                  {/* Net Balance row */}
                  <tr style={{ background: finalBalance > 0 ? 'rgba(211,47,47,0.06)' : finalBalance < 0 ? 'rgba(22,101,52,0.06)' : 'rgba(0,0,0,0.03)' }}>
                    <td colSpan={2} style={{ padding: '10px 12px', fontWeight: 700, fontSize: '15px', color: finalBalance > 0 ? '#c62828' : finalBalance < 0 ? '#166534' : '#000' }}>
                      Net Balance:
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: '16px', color: finalBalance > 0 ? '#c62828' : finalBalance < 0 ? '#166534' : '#000' }}>
                      ₹{Math.abs(finalBalance).toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
`;

const customVanStockBlock = `
                  {/* Custom Input */}
                  {customVanStock.map((item, index) => {
                    const rowTotal = (Number(item.price) || 0) * (Number(item.pieces) || 0);
                    return (
                      <div key={item.id} className="flex flex-col items-center justify-center p-2 border border-outline-variant/60 rounded-xl bg-surface-container-low relative group shadow-sm col-span-3">
                        {customVanStock.length > 1 && (
                          <button 
                            onClick={() => setCustomVanStock(customVanStock.filter((_, i) => i !== index))}
                            className="absolute -top-2 -right-2 bg-error text-white rounded-full p-1 z-10"
                          >
                            <span className="material-symbols-outlined text-[14px]">close</span>
                          </button>
                        )}
                        <div className="flex items-center gap-1 w-full justify-center">
                          <span className="font-bold text-primary text-sm">₹</span>
                          <input 
                            type="number" placeholder="Amt" value={item.price} 
                            onChange={(e) => {
                              const newStock = [...customVanStock];
                              newStock[index].price = e.target.value ? Number(e.target.value) : '';
                              setCustomVanStock(newStock);
                            }}
                            className="w-full max-w-[60px] text-center px-1 py-1 bg-surface-container-lowest border border-outline-variant rounded font-body-sm text-[16px]"
                          />
                        </div>
                        <input 
                          type="number" placeholder="Qty" value={item.pieces} 
                          onChange={(e) => {
                            const newStock = [...customVanStock];
                            newStock[index].pieces = e.target.value ? Number(e.target.value) : '';
                            setCustomVanStock(newStock);
                          }}
                          className="w-full max-w-[70px] text-center px-1 py-1 mt-1 bg-surface-container-lowest border border-outline-variant rounded font-body-sm text-[16px]"
                        />
                        <span className="font-body-sm text-on-surface-variant mt-1 text-xs">= ₹{rowTotal}</span>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-center p-2 border border-dashed border-outline-variant rounded-xl hover:bg-surface-container-low cursor-pointer transition-colors col-span-3" onClick={() => setCustomVanStock([...customVanStock, { id: Date.now(), price: '', pieces: '' }])}>
                    <span className="text-primary font-label-md flex flex-col items-center text-center">
                      <span className="material-symbols-outlined mb-1 text-[20px]">add</span> Custom
                    </span>
                  </div>
`;

content = content.replace(/\{(\/\* Final Balance Highlight \*\/)[\s\S]*?(?=\{\/\* Van Stock Section \*\/)/, finalBalanceBlock + '\n\n          ');
content = content.replace(/\{(\/\* Summary Cards \(Bento style\) \*\/)[\s\S]*?(?=\{\/\* Final Balance)/, `$&\n\n${pendingAdvancesBlock}\n\n          `);
content = content.replace(/(<div className="grid grid-cols-3 gap-2 mt-2">[\s\S]*?)(<\/div>)/, `$1\n${customVanStockBlock}\n$2`);

// Add lastSettlementDate info right before Vendor Select in Mobile UI
const lastSettlementBlock = `
          {lastSettlementDate && formData.vendor_id && (
            <div className="bg-primary/10 px-md py-sm rounded-xl inline-flex max-w-fit mb-2">
              <span className="font-label-md text-primary">Last Settlement: <span className="font-bold">{lastSettlementDate}</span></span>
            </div>
          )}
          {/* Vendor Select */}
`;
content = content.replace(/{ \/\* Vendor Select \*\/ }/, lastSettlementBlock);

fs.writeFileSync(file, content, 'utf8');
