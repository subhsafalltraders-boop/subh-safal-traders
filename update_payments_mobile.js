const fs = require('fs');
const file = 'app/(dashboard)/payments/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// I will just use the "Previous Payments History" block (the Shared History List)
const sharedHistoryBlock = `
          {/* Shared History List */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden flex flex-col mt-4 animate-fade-in mb-4 border border-outline-variant">
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="px-md py-sm border-b border-outline-variant bg-surface flex justify-between items-center hover:bg-surface-container-low transition-colors w-full text-left"
            >
              <h3 className="font-headline-sm text-on-surface flex items-center gap-2">
                {activeTab === 'regular' ? 'Payment History' : 'Advance History'} <span className="text-sm font-normal text-on-surface-variant">(Past dates)</span>
              </h3>
              <span className="material-symbols-outlined text-on-surface-variant transition-transform duration-300" style={{ transform: showHistory ? 'rotate(180deg)' : '' }}>expand_more</span>
            </button>
            
            {showHistory && activeTab === 'regular' && (
              <div className="flex flex-col p-sm md:p-md gap-sm bg-surface-container-lowest animate-fade-in">
                {historyPayments.map((payment) => (
                  <div key={payment.id} className={\`p-md flex flex-col sm:flex-row sm:items-center justify-between gap-sm border border-outline-variant/50 rounded-2xl hover:border-primary/30 transition-colors \${payment.is_deleted ? 'opacity-50 line-through' : ''}\`}>
                    <div className="flex flex-col sm:w-1/3">
                      <span className="text-xs text-on-surface-variant mb-1">{payment.date}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-primary text-[16px]">{(payment as any).vendors?.name || 'Unknown'}</span>
                        {payment.is_deleted && <span className="bg-error text-white text-[10px] font-bold px-2 py-0.5 rounded-full no-underline uppercase">Void</span>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:flex sm:gap-lg text-sm text-on-surface-variant sm:w-1/3">
                      <div>Cash: ₹{((payment as any).cash_amount || payment.cash)?.toLocaleString('en-IN') || '0'}</div>
                      <div>UPI: ₹{((payment as any).upi_amount || payment.upi)?.toLocaleString('en-IN') || '0'}</div>
                    </div>
                    <div className="flex items-center justify-between sm:w-1/3 sm:justify-end gap-md">
                      <span className="font-bold text-[16px] text-[#166534]">₹{payment.total_received.toLocaleString('en-IN')}</span>
                      {!payment.is_deleted && (
                        <div className="flex gap-xs bg-surface-container-low rounded-full p-1">
                          <button onClick={() => startEdit(payment)} className="p-sm text-primary hover:bg-primary/10 rounded-full transition-colors">
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button onClick={() => handleDeleteRequest(payment.id, 'payment')} className="p-sm text-error hover:bg-error/10 rounded-full transition-colors">
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {historyLoading && <div className="text-center py-md text-on-surface-variant">Loading history...</div>}
                
                {hasMoreHistory && historyPayments.length > 0 && !historyLoading && (
                  <button onClick={loadMoreHistory} className="mt-xs py-sm text-primary font-medium hover:underline text-center w-full">
                    Load More History
                  </button>
                )}
                
                {!historyLoading && historyPayments.length === 0 && (
                  <div className="text-center py-xl text-on-surface-variant">No past payments found.</div>
                )}
              </div>
            )}

            {showHistory && activeTab === 'advance' && (
              <div className="flex flex-col p-sm md:p-md gap-sm bg-surface-container-lowest animate-fade-in">
                {historyAdvances.map((adv) => (
                  <div key={adv.id} className="p-md flex flex-col sm:flex-row sm:items-center justify-between gap-sm border border-outline-variant/50 rounded-2xl hover:border-error/30 transition-colors">
                    <div className="flex flex-col sm:w-1/3">
                      <span className="text-xs text-on-surface-variant mb-1">{adv.date}</span>
                      <span className="font-medium text-error text-[16px]">{(adv as any).vendors?.name || 'Unknown'}</span>
                      {adv.note && <span className="text-xs text-on-surface-variant">{adv.note}</span>}
                    </div>
                    <div className="flex sm:w-1/3 items-center justify-center">
                       <span className={\`text-xs px-2 py-1 rounded-full \${adv.used_in_settlement ? 'bg-primary/10 text-primary' : 'bg-surface-variant/20 text-on-surface-variant'}\`}>
                         {adv.used_in_settlement ? 'Settled' : 'Pending'}
                       </span>
                    </div>
                    <div className="flex items-center justify-between sm:w-1/3 sm:justify-end gap-md">
                      <span className="font-bold text-[16px] text-error">₹{adv.amount.toLocaleString('en-IN')}</span>
                      <div className="flex gap-xs bg-surface-container-low rounded-full p-1">
                        <button onClick={() => handleDeleteRequest(adv.id, 'advance')} disabled={adv.used_in_settlement} className="p-sm text-error hover:bg-error/10 rounded-full transition-colors disabled:opacity-30">
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {historyLoading && <div className="text-center py-md text-on-surface-variant">Loading history...</div>}
                
                {hasMoreAdvanceHistory && historyAdvances.length > 0 && !historyLoading && (
                  <button onClick={loadMoreHistory} className="mt-xs py-sm text-primary font-medium hover:underline text-center w-full">
                    Load More History
                  </button>
                )}
                
                {!historyLoading && historyAdvances.length === 0 && (
                  <div className="text-center py-xl text-on-surface-variant">No past advances found.</div>
                )}
              </div>
            )}
          </div>
`;

content = content.replace(/(<\/div>\n              <\/div>\n            <\/>\n          \)}\n        <\/main>)/, `${sharedHistoryBlock}\n        </main>`);

fs.writeFileSync(file, content, 'utf8');
