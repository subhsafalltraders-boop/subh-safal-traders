'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import type { Bill, BillItem, AppSetting, Vendor, Product } from '@/lib/types';
import { generateBillHTML, printBill } from '@/lib/printUtils';

type Tab = 'new' | 'previous';
type ScanStage = 'idle' | 'scanning' | 'results' | 'error';

type ScannedItem = {
  product_name_raw: string;
  product_name_matched: string;
  product_id: string | null;
  box_qty: number;
  piece_qty: number;
  confidence: 'high' | 'medium' | 'low';
  price_per_box: number;
  price_per_piece: number;
};

type ScanResult = {
  vendor_name: string;
  date: string | null;
  items: ScannedItem[];
};

export default function BillingPage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<Tab>('new');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [appSetting, setAppSetting] = useState<AppSetting | null>(null);
  const [masterPassword, setMasterPassword] = useState('1234');

  // Previous Bills State
  const [bills, setBills] = useState<(Bill & { is_deleted?: boolean })[]>([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMoreBills, setHasMoreBills] = useState(true);
  const [historyFilterVendor, setHistoryFilterVendor] = useState<string>('all');
  const [historyFilterBillType, setHistoryFilterBillType] = useState<'all' | 'simple' | 'gst'>('all');
  const ITEMS_PER_PAGE = 20;

  // Form State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit State
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [existingBillNumber, setExistingBillNumber] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    vendor_id: '',
    date: new Date().toISOString().split('T')[0],
  });

  const [billType, setBillType] = useState<'simple' | 'gst'>('simple');

  const [items, setItems] = useState<{ ui_id: number; product_id: string; product_name: string; box_quantity: number; piece_quantity: number; price_per_box: number; price_per_piece: number; pieces_per_box?: number; total: number; hsn_code?: string; checked?: boolean }[]>([]);

  const [discountType, setDiscountType] = useState('None');
  const [customDiscount, setCustomDiscount] = useState<number>(0);
  const [gstType, setGstType] = useState('0%');
  const [customGst, setCustomGst] = useState<number>(0);

  const [productSearch, setProductSearch] = useState('');
  const [showProductList, setShowProductList] = useState(false);

  // Modals
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordStep, setPasswordStep] = useState<1 | 2>(1);
  const [passwordError, setPasswordError] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [previewBill, setPreviewBill] = useState<Bill | null>(null);

  // Scan State
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanStage, setScanStage] = useState<ScanStage>('idle');
  const [scanImage, setScanImage] = useState<File | null>(null);
  const [scanImagePreview, setScanImagePreview] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSaving, setScanSaving] = useState(false);
  const [scanGstType, setScanGstType] = useState('0%');
  const [scanDiscount, setScanDiscount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.product-search-wrapper')) {
        setShowProductList(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, []);

  useEffect(() => {
    if (activeTab === 'previous') {
      setPage(0);
      fetchBills(0, true, historyFilterVendor);
    }
  }, [activeTab, historyFilterVendor, historyFilterBillType]);

  const fetchInitialData = async () => {
    setLoading(true);
    const [vendorsRes, productsRes, settingsRes] = await Promise.all([
      supabase.from('vendors').select('id, name, type').eq('active', true),
      supabase.from('products').select('id, name, price_per_box, price_per_piece, stock_boxes, stock_pieces, pieces_per_box, hsn_code'),
      supabase.from('app_settings').select('key, value')
    ]);

    if ((vendorsRes as any).error && (vendorsRes as any).error.message.includes('active')) {
      const fallbackRes = await supabase.from('vendors').select('id, name, type').eq('is_active', true);
      if (fallbackRes.data) setVendors(fallbackRes.data as Vendor[]);
    } else if ((vendorsRes as any).data) {
      setVendors((vendorsRes as any).data as Vendor[]);
    }

    if ((productsRes as any).data) setProducts((productsRes as any).data as Product[]);

    let pwd = '1234';
    if ((settingsRes as any).data) {
      const allSettings = (settingsRes as any).data;
      const pwdSetting = allSettings.find((s: any) => s.key === 'app_password');
      if (pwdSetting) pwd = pwdSetting.value;

      const compName = allSettings.find((s: any) => s.key === 'company_name')?.value;
      const gstNum = allSettings.find((s: any) => s.key === 'gst_number')?.value;
      setAppSetting({ id: '1', created_at: '', company_name: compName, gst_number: gstNum });
    }
    setMasterPassword(pwd);
    setLoading(false);
  };

  const handlePrint = () => {
    if (!previewBill) return;
    const html = generateBillHTML(
      previewBill,
      appSetting,
      vendors.find(v => v.id === previewBill.vendor_id)?.type
    );
    printBill(html);
  };

  const fetchBills = async (pageIndex: number, reset: boolean = false, vendorFilter: string = historyFilterVendor) => {
    setBillsLoading(true);
    const from = pageIndex * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    let query = supabase
      .from('bills')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (vendorFilter && vendorFilter !== 'all') {
      query = query.eq('vendor_id', vendorFilter);
    }

    if (historyFilterBillType !== 'all') {
      query = query.eq('bill_type', historyFilterBillType);
    }

    const { data, count } = await query;

    if (data) {
      if (reset) {
        setBills(data);
      } else {
        setBills(prev => {
          const existingIds = new Set(prev.map(b => b.id));
          const newBills = data.filter((b: any) => !existingIds.has(b.id));
          return [...prev, ...newBills];
        });
      }
      setHasMoreBills(data.length === ITEMS_PER_PAGE);
    }
    setBillsLoading(false);
  };

  const loadMoreBills = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchBills(nextPage, false, historyFilterVendor);
  };

  const groupedBills = useMemo(() => {
    return bills.reduce((acc, bill) => {
      if (!acc[bill.date]) acc[bill.date] = [];
      acc[bill.date].push(bill);
      return acc;
    }, {} as Record<string, (Bill & { is_deleted?: boolean })[]>);
  }, [bills]);

  const groupedProducts = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    products.forEach(p => {
      const price = p.price_per_piece || 0;
      const nameLower = p.name.toLowerCase();
      const isPartyPack = p.is_party_pack || price > 60 || nameLower.includes('pp') || nameLower.includes('fp') || nameLower.includes('party') || nameLower.includes('family');

      const groupName = isPartyPack ? 'Party Pack / Family Pack' : price.toString();

      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(p);
    });
    return groups;
  }, [products]);

  // Form Handlers
  const handleProductSelect = (productId: string) => {
    if (!productId) return;
    const product = products.find(p => p.id === productId);
    if (!product) return;

    if ((product.stock_boxes || 0) === 0 && (product.stock_pieces || 0) === 0) {
      toast("⚠️ Stock nahi hai — manually check karo", {
        style: {
          background: '#FF9800',
          color: '#fff',
        },
      });
    }

    setItems([...items, {
      ui_id: Date.now(),
      product_id: product.id,
      product_name: product.name,
      box_quantity: 0,
      piece_quantity: 0,
      price_per_box: product.price_per_box || 0,
      price_per_piece: product.price_per_piece || 0,
      pieces_per_box: product.pieces_per_box || 0,
      total: 0,
      hsn_code: product.hsn_code || '',
      checked: false
    }]);
  };

  const removeItemRow = (ui_id: number) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.ui_id !== ui_id));
    }
  };

  const handleItemChange = (ui_id: number, field: string, value: any) => {
    setItems(items.map(item => {
      if (item.ui_id !== ui_id) return item;

      const updatedItem = { ...item, [field]: value };

      // Recalculate total
      const boxTotal = (Number(updatedItem.box_quantity) || 0) * updatedItem.price_per_box;
      const pieceTotal = (Number(updatedItem.piece_quantity) || 0) * updatedItem.price_per_piece;
      updatedItem.total = boxTotal + pieceTotal;

      return updatedItem;
    }));
  };

  // Calculations
  const selectedVendor = useMemo(() => vendors.find(v => v.id === formData.vendor_id), [vendors, formData.vendor_id]);
  const isShopkeeper = selectedVendor?.type === 'shopkeeper';

  useEffect(() => {
    if (billType === 'simple') {
      setGstType('0%');
      setCustomGst(0);
      setDiscountType('None');
      setCustomDiscount(0);
    }
  }, [billType]);

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.total, 0), [items]);

  let discountAmount = 0;
  if (discountType === '5%') discountAmount = subtotal * 0.05;
  else if (discountType === '10%') discountAmount = subtotal * 0.10;
  else if (discountType === '15%') discountAmount = subtotal * 0.15;
  else if (discountType === 'Custom') discountAmount = Number(customDiscount) || 0;

  const afterDiscount = subtotal - discountAmount;

  let gstAmount = 0;
  const gstRate = gstType === '5%' ? 5 : gstType === '12%' ? 12 : gstType === '18%' ? 18 : gstType === 'Custom' ? (Number(customGst) || 0) : 0;
  gstAmount = Math.round(afterDiscount * (gstRate / 100));

  const grandTotal = afterDiscount - gstAmount;

  const handleSave = async (printAfter: boolean) => {
    if (!formData.vendor_id) return toast.error("Please select a vendor.");
    if (items.some(i => !i.product_id)) return toast.error("Please select products for all rows.");
    if (items.some(i => i.box_quantity === 0 && i.piece_quantity === 0)) return toast.error("Please enter quantity (boxes or pieces) for all items.");
    if (items.some(i => !i.checked)) return toast.error("Please tick all items to confirm they are given.");

    setSaving(true);

    // STEP 1: Validate stock BEFORE saving bill (only for new bills, not edits)
    // Removed because stock checking is now handled after bill save and allows negative.

    const vendor = vendors.find(v => v.id === formData.vendor_id);

    let billNumber = existingBillNumber;
    if (!billNumber) {
      if (billType === 'simple') {
        const { data } = (await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'last_simple_bill_number')
          .single()) as any
        
        const lastNum = parseInt(data?.value || '0')
        const newNum = lastNum + 1
        billNumber = `S-${newNum}`
        
        // Update counter
        await (supabase.from('app_settings') as any)
          .upsert({ 
            key: 'last_simple_bill_number', 
            value: String(newNum) 
          })
      } else {
        const { data } = (await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'last_gst_bill_number')
          .single()) as any
        
        const lastNum = parseInt(data?.value || '0')
        const newNum = lastNum + 1
        billNumber = `G-${newNum}`
        
        // Update counter
        await (supabase.from('app_settings') as any)
          .upsert({ 
            key: 'last_gst_bill_number', 
            value: String(newNum) 
          })
      }
    }

    const cleanItems = items.map(({ ui_id, ...rest }) => ({
      ...rest,
      box_qty: rest.box_quantity,
      piece_qty: rest.piece_quantity,
      rate: `Box: ₹${rest.price_per_box} | Piece: ₹${rest.price_per_piece}`,
      amount: rest.total
    }));

    const payload = {
      vendor_id: formData.vendor_id,
      vendor_name: vendor?.name || '',
      bill_number: billNumber,
      date: formData.date,
      subtotal: Math.round(subtotal),
      discount_type: discountType,
      discount_amount: Math.round(discountAmount),
      gst_type: gstType,
      gst_amount: Math.round(gstAmount),
      grand_total: Math.round(grandTotal),
      bill_type: billType,
      items: cleanItems as any
    };

    // STEP 2: Save bill to database
    let error;
    let savedBillId = editingBillId;
    if (editingBillId) {
      const res = await (supabase as any).from('bills').update(payload).eq('id', editingBillId);
      error = res.error;
    } else {
      const res = await (supabase as any).from('bills').insert([payload]).select();
      error = res.error;
      if (res.data && res.data.length > 0) {
        savedBillId = res.data[0].id;
      }
    }

    if (error) {
      setSaving(false);
      return toast.error("Error saving bill: " + error.message);
    }

    // STEP 3: Stock deduction with pieces_per_box conversion (only for new bills)
    if (!editingBillId) {
      try {
        let hasNegativeStock = false;

        const deductStock = async (item: any) => {
          const { data: rawProduct } = await (supabase as any)
            .from('products')
            .select('stock_boxes, stock_pieces, pieces_per_box')
            .eq('id', item.product_id)
            .single();

          const product = rawProduct as { stock_boxes: number; stock_pieces: number; pieces_per_box: number } | null;
          if (!product) throw new Error(`Product not found`);

          const ppb = product.pieces_per_box || 1; // Default to 1 to avoid division by zero

          const currentTotalPieces = (Number(product.stock_boxes || 0) * ppb) + Number(product.stock_pieces || 0);
          const deductPieces = (Number(item.box_quantity || 0) * ppb) + Number(item.piece_quantity || 0);
          const newTotalPieces = currentTotalPieces - deductPieces;

          if (newTotalPieces < 0) {
            hasNegativeStock = true;
          }

          // Use Math.trunc to correctly handle negative numbers (-15 / 10 = -1 box, -5 pieces)
          const newBoxes = Math.trunc(newTotalPieces / ppb);
          const newPieces = newTotalPieces % ppb;

          const { error } = await (supabase as any)
            .from('products')
            .update({ stock_boxes: newBoxes, stock_pieces: newPieces })
            .eq('id', item.product_id);

          if (error) {
            throw new Error(`Failed to update stock for ${item.product_name}`);
          }
        };

        await Promise.all(items.map(deductStock));

        // Update local products state
        const { data: updatedProducts } = await supabase
          .from('products')
          .select('id, name, price_per_box, price_per_piece, stock_boxes, stock_pieces, pieces_per_box, hsn_code');
        if (updatedProducts) setProducts(updatedProducts as Product[]);

        if (hasNegativeStock) {
          toast("Stock is now negative — please check", {
            style: { background: '#FF9800', color: '#fff' },
            duration: 5000,
          });
        }
        
      } catch (stockError: any) {
        console.error("Stock update failed:", stockError);
        toast.error("Bill saved, but stock update failed: " + (stockError.message || "Unknown error"));
      }
      
      setSaving(false);
      toast.success("Bill saved successfully!");

    } else {
      setSaving(false);
      toast.success("Bill updated successfully!");
    }

    const savedBill = { ...payload, id: savedBillId || 'temp-id', created_at: new Date().toISOString() } as unknown as Bill;

    if (printAfter) {
      setPreviewBill(savedBill);
    }

    handleClear();

    if (activeTab === 'previous') {
      fetchBills(0, true, historyFilterVendor);
      setPage(0);
    } else {
      setActiveTab('previous');
    }
  };

  const handleClear = () => {
    setFormData({ vendor_id: '', date: new Date().toISOString().split('T')[0] });
    setBillType('simple');
    setItems([]);
    setDiscountType('None');
    setCustomDiscount(0);
    setGstType('0%');
    setCustomGst(0);
    setEditingBillId(null);
    setExistingBillNumber(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ──────────── SCAN HANDLERS ────────────
  const openScanModal = () => {
    setShowScanModal(true);
    setScanStage('idle');
    setScanImage(null);
    setScanImagePreview(null);
    setScanResult(null);
    setScanError(null);
    setScanGstType('0%');
    setScanDiscount(0);
  };

  const handleScanImageSelect = (file: File) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPG, PNG, and WebP images allowed');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image too large. Max 10MB allowed');
      return;
    }
    setScanImage(file);
    setScanImagePreview(URL.createObjectURL(file));
  };

  const handleScanNow = async () => {
    if (!scanImage) return;
    setScanStage('scanning');
    setScanError(null);

    try {
      const fd = new FormData();
      fd.append('image', scanImage);
      fd.append('products', JSON.stringify(
        products.map(p => ({
          id: p.id,
          name: p.name,
          price_per_box: p.price_per_box,
          price_per_piece: p.price_per_piece,
        }))
      ));

      const res = await fetch('/api/scan-bill', { method: 'POST', body: fd });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Scan failed');
      }

      setScanResult(json.data);
      setScanStage('results');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to scan bill';
      setScanError(message);
      setScanStage('error');
    }
  };

  const handleScanItemChange = (index: number, field: string, value: unknown) => {
    if (!scanResult) return;
    const newItems = [...scanResult.items];
    (newItems[index] as Record<string, unknown>)[field] = value;
    setScanResult({ ...scanResult, items: newItems });
  };

  const handleScanItemProductChange = (index: number, productId: string) => {
    if (!scanResult) return;
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const newItems = [...scanResult.items];
    newItems[index] = {
      ...newItems[index],
      product_id: product.id,
      product_name_matched: product.name,
      price_per_box: product.price_per_box || 0,
      price_per_piece: product.price_per_piece || 0,
      confidence: 'high',
    };
    setScanResult({ ...scanResult, items: newItems });
  };

  const getScanSubtotal = () => {
    if (!scanResult) return 0;
    return scanResult.items.reduce((sum, item) => {
      return sum + ((item.box_qty || 0) * (item.price_per_box || 0)) + ((item.piece_qty || 0) * (item.price_per_piece || 0));
    }, 0);
  };

  const getScanGrandTotal = () => {
    const sub = getScanSubtotal();
    const afterDiscount = sub - (Number(scanDiscount) || 0);
    const gstRate = scanGstType === '5%' ? 5 : scanGstType === '12%' ? 12 : scanGstType === '18%' ? 18 : 0;
    const gstAmt = Math.round(afterDiscount * (gstRate / 100));
    return afterDiscount - gstAmt;
  };

  const handleEditInForm = () => {
    if (!scanResult) return;

    // Fuzzy match vendor
    const matchedVendor = vendors.find(v =>
      v.name.toLowerCase().includes(scanResult.vendor_name?.toLowerCase() || '') ||
      (scanResult.vendor_name || '').toLowerCase().includes(v.name.toLowerCase())
    );

    setFormData({
      vendor_id: matchedVendor?.id || '',
      date: scanResult.date || new Date().toISOString().split('T')[0],
    });

    setBillType('simple');
    setGstType(scanGstType);
    setDiscountType(scanDiscount > 0 ? 'Custom' : 'None');
    setCustomDiscount(scanDiscount);

    const newItems = scanResult.items
      .filter(item => item.product_id)
      .map((item, idx) => {
        const product = products.find(p => p.id === item.product_id);
        return {
          ui_id: Date.now() + idx,
          product_id: item.product_id!,
          product_name: item.product_name_matched,
          box_quantity: item.box_qty || 0,
          piece_quantity: item.piece_qty || 0,
          price_per_box: item.price_per_box || product?.price_per_box || 0,
          price_per_piece: item.price_per_piece || product?.price_per_piece || 0,
          pieces_per_box: product?.pieces_per_box || 0,
          total: ((item.box_qty || 0) * (item.price_per_box || 0)) + ((item.piece_qty || 0) * (item.price_per_piece || 0)),
          hsn_code: product?.hsn_code || '',
          checked: false,
        };
      });

    setItems(newItems);
    setShowScanModal(false);
    setActiveTab('new');
    toast.success('Bill scanned! Please verify the details before saving.');
  };

  const handleScanSaveAndPrint = async () => {
    if (!scanResult) return;

    // Validate vendor match
    const matchedVendor = vendors.find(v =>
      v.name.toLowerCase().includes(scanResult.vendor_name?.toLowerCase() || '') ||
      (scanResult.vendor_name || '').toLowerCase().includes(v.name.toLowerCase())
    );
    if (!matchedVendor) {
      toast.error('Vendor not found — please use "Edit in Form" and select manually.');
      return;
    }

    const validItems = scanResult.items.filter(item => item.product_id);
    if (validItems.length === 0) {
      toast.error('No matched products. Please fix items before saving.');
      return;
    }

    setScanSaving(true);

    try {
      const scanBillType = 'simple';
      const scanDate = scanResult.date || new Date().toISOString().split('T')[0];

      // Generate bill number
      const { data: lastNumData } = (await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'last_simple_bill_number')
        .single()) as { data: { value: string } | null };

      const lastNum = parseInt(lastNumData?.value || '0');
      const newNum = lastNum + 1;
      const billNumber = `S-${newNum}`;

      await (supabase.from('app_settings') as unknown as { upsert: (data: Record<string, string>) => Promise<unknown> })
        .upsert({ key: 'last_simple_bill_number', value: String(newNum) });

      // Calculate totals
      const scanSub = getScanSubtotal();
      const discAmt = Number(scanDiscount) || 0;
      const afterDisc = scanSub - discAmt;
      const gstRate = scanGstType === '5%' ? 5 : scanGstType === '12%' ? 12 : scanGstType === '18%' ? 18 : 0;
      const gstAmt = Math.round(afterDisc * (gstRate / 100));
      const total = afterDisc - gstAmt;

      const cleanItems = validItems.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name_matched,
        box_qty: item.box_qty || 0,
        piece_qty: item.piece_qty || 0,
        price_per_box: item.price_per_box || 0,
        price_per_piece: item.price_per_piece || 0,
        rate: `Box: ₹${item.price_per_box || 0} | Piece: ₹${item.price_per_piece || 0}`,
        amount: ((item.box_qty || 0) * (item.price_per_box || 0)) + ((item.piece_qty || 0) * (item.price_per_piece || 0)),
        total: ((item.box_qty || 0) * (item.price_per_box || 0)) + ((item.piece_qty || 0) * (item.price_per_piece || 0)),
      }));

      const payload = {
        vendor_id: matchedVendor.id,
        vendor_name: matchedVendor.name,
        bill_number: billNumber,
        date: scanDate,
        subtotal: Math.round(scanSub),
        discount_type: discAmt > 0 ? 'Custom' : 'None',
        discount_amount: Math.round(discAmt),
        gst_type: scanGstType,
        gst_amount: Math.round(gstAmt),
        grand_total: Math.round(total),
        bill_type: scanBillType,
        items: cleanItems as unknown,
      };

      const res = await (supabase as unknown as { from: (table: string) => { insert: (data: unknown[]) => { select: () => Promise<{ data: { id: string }[] | null; error: { message: string } | null }> } } })
        .from('bills').insert([payload]).select();

      if (res.error) throw new Error(res.error.message);

      // Stock deduction
      for (const item of validItems) {
        const { data: rawProduct } = await (supabase as unknown as { from: (t: string) => { select: (s: string) => { eq: (k: string, v: string) => { single: () => Promise<{ data: { stock_boxes: number; stock_pieces: number; pieces_per_box: number } | null }> } } } })
          .from('products')
          .select('stock_boxes, stock_pieces, pieces_per_box')
          .eq('id', item.product_id!)
          .single();

        if (rawProduct) {
          const ppb = rawProduct.pieces_per_box || 1;
          const currentTotal = (Number(rawProduct.stock_boxes || 0) * ppb) + Number(rawProduct.stock_pieces || 0);
          const deduct = ((item.box_qty || 0) * ppb) + (item.piece_qty || 0);
          const newTotal = currentTotal - deduct;
          const newBoxes = Math.trunc(newTotal / ppb);
          const newPieces = newTotal % ppb;

          await (supabase as unknown as { from: (t: string) => { update: (d: Record<string, number>) => { eq: (k: string, v: string) => Promise<unknown> } } })
            .from('products')
            .update({ stock_boxes: newBoxes, stock_pieces: newPieces })
            .eq('id', item.product_id!);
        }
      }

      // Print
      const savedBill = {
        ...payload,
        id: res.data?.[0]?.id || 'temp-id',
        created_at: new Date().toISOString(),
        items: cleanItems,
      } as unknown as Bill;

      const html = generateBillHTML(savedBill, appSetting, matchedVendor.type);
      printBill(html);

      toast.success(`Bill saved! Number: ${billNumber}`);
      setShowScanModal(false);

      // Refresh products
      const { data: updatedProducts } = await supabase
        .from('products')
        .select('id, name, price_per_box, price_per_piece, stock_boxes, stock_pieces, pieces_per_box, hsn_code');
      if (updatedProducts) setProducts(updatedProducts as Product[]);

      if (activeTab === 'previous') {
        fetchBills(0, true, historyFilterVendor);
        setPage(0);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Failed to save bill: ' + message);
    } finally {
      setScanSaving(false);
    }
  };

  const handleEditBill = (bill: Bill) => {
    setEditingBillId(bill.id);
    setExistingBillNumber(bill.bill_number);
    setFormData({
      vendor_id: bill.vendor_id,
      date: bill.date
    });
    setBillType(bill.bill_type || 'simple');
    setGstType(bill.gst_type);
    setDiscountType(bill.discount_type);
    if (bill.discount_type === 'Custom') setCustomDiscount(bill.discount_amount);
    if (bill.gst_type === 'Custom') setCustomGst((bill.gst_amount / (bill.subtotal - bill.discount_amount)) * 100);

    setItems(bill.items.map((item, index) => {
      const product = products.find(p => p.id === item.product_id);
      return {
        ui_id: Date.now() + index,
        product_id: item.product_id,
        product_name: item.product_name,
        box_quantity: (item as any).box_qty || 0,
        piece_quantity: (item as any).piece_qty || 0,
        price_per_box: product?.price_per_box || 0,
        price_per_piece: product?.price_per_piece || 0,
        total: item.total,
        hsn_code: (item as any).hsn_code || '',
        checked: false
      };
    }));
    setActiveTab('new');
    toast('Editing Bill: ' + bill.bill_number, { icon: '✏️' });
  };

  const handleDeleteRequest = (id: string) => {
    setPendingDeleteId(id);
    setPasswordInput('');
    setPasswordStep(1);
    setPasswordError('');
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = () => {
    if (passwordInput !== masterPassword) {
      setPasswordError("Incorrect password");
      setPasswordInput('');
    } else {
      setPasswordError('');
      setPasswordStep(2);
    }
  };

  const confirmDelete = async () => {
    setShowPasswordModal(false);

    if (pendingDeleteId) {
      const { error } = await (supabase as any).from('bills').update({ is_deleted: true }).eq('id', pendingDeleteId);
      if (error) {
        toast.error('Failed to delete bill');
      } else {
        toast.success('Bill deleted successfully');
        fetchBills(0, true, historyFilterVendor);
        setPage(0);
      }
      setPendingDeleteId(null);
    }
  };

  return (
    <>
      <div className="p-md md:p-container-padding flex-1 flex flex-col gap-lg print:hidden h-full overflow-y-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md border-b border-outline-variant/30 pb-md sticky top-16 md:top-0 bg-surface-container-lowest z-20">
          <h2 className="font-headline-lg text-headline-lg text-on-surface">Billing</h2>

          <div className="flex bg-surface-variant/30 p-xs rounded-xl w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('new')}
              className={`flex-1 sm:flex-none px-lg py-sm rounded-lg font-label-md transition-colors ${activeTab === 'new' ? 'bg-surface shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              New Bill
            </button>
            <button
              onClick={() => setActiveTab('previous')}
              className={`flex-1 sm:flex-none px-lg py-sm rounded-lg font-label-md transition-colors ${activeTab === 'previous' ? 'bg-surface shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              Previous Bills
            </button>
          </div>
        </div>

        {activeTab === 'new' && (
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-md sm:p-xl flex flex-col gap-lg animate-fade-in">
            {/* Bill Type Toggle + Scan Button */}
            <div className="flex flex-col gap-md items-center mb-lg">
              <div className="flex gap-md justify-center">
                <button
                  onClick={() => setBillType('simple')}
                  className={`px-xl py-md rounded-xl font-semibold text-lg transition-all ${billType === 'simple'
                    ? 'bg-[#1565C0] text-white shadow-md'
                    : 'bg-white text-[#1a1a1a] border-2 border-[#1a1a1a] hover:bg-gray-50'
                    }`}
                >
                  📄 Simple Bill
                </button>
                <button
                  onClick={() => setBillType('gst')}
                  className={`px-xl py-md rounded-xl font-semibold text-lg transition-all ${billType === 'gst'
                    ? 'bg-[#1565C0] text-white shadow-md'
                    : 'bg-white text-[#1a1a1a] border-2 border-[#1a1a1a] hover:bg-gray-50'
                    }`}
                >
                  🧾 GST Bill
                </button>
              </div>
              <button
                onClick={openScanModal}
                className="flex items-center gap-2 px-lg py-sm bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white rounded-xl font-semibold text-sm hover:from-[#6D28D9] hover:to-[#5B21B6] transition-all shadow-md active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-[20px]">document_scanner</span>
                📷 Scan Handwritten Bill
              </button>
            </div>

            {editingBillId && (
              <div className="bg-primary/10 text-primary p-sm rounded-xl font-medium flex items-center justify-between">
                <span>Editing Bill: {existingBillNumber}</span>
                <button onClick={handleClear} className="text-primary hover:underline text-sm">Cancel Edit</button>
              </div>
            )}

            {loading ? (
              <div className="h-40 flex items-center justify-center text-on-surface-variant animate-pulse">Loading data...</div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Vendor / Shopkeeper *</label>
                    <select
                      value={formData.vendor_id}
                      onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                      className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    >
                      <option value="">-- Select Vendor --</option>
                      {vendors.map(v => (
                        <option key={v.id} value={v.id}>{v.name} ({v.type})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Date *</label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    />
                  </div>
                </div>



                {items.length > 0 && (
                  <div className="overflow-x-auto border border-outline-variant rounded-2xl mt-sm shadow-sm">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                      <thead className="bg-surface-container-low border-b border-outline-variant">
                        <tr>
                          <th className="px-md py-sm font-label-md text-on-surface-variant w-[5%] text-center">✓</th>
                          <th className="px-md py-sm font-label-md text-on-surface-variant w-[5%]">Sl.</th>
                          <th className="px-md py-sm font-label-md text-on-surface-variant w-[22%]">Product Description</th>
                          <th className="px-md py-sm font-label-md text-on-surface-variant w-[12%]">📦 Boxes</th>
                          <th className="px-md py-sm font-label-md text-on-surface-variant w-[12%]">🔢 Pieces</th>
                          <th className="px-md py-sm font-label-md text-on-surface-variant w-[10%]">Pcs/Box</th>
                          <th className="px-md py-sm font-label-md text-on-surface-variant w-[15%]">Rate</th>
                          <th className="px-md py-sm font-label-md text-on-surface-variant w-[14%] text-right">Amount</th>
                          <th className="px-md py-sm w-[10%] text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/50 bg-surface">
                        {items.map((item) => {
                          const product = products.find(p => p.id === item.product_id);
                          const boxWarning = false; // Temporarily disabled
                          const pieceWarning = false; // Temporarily disabled
                          return (
                            <tr key={item.ui_id} className="hover:bg-surface-container-low transition-colors">
                              <td className="px-md py-sm text-center">
                                <input
                                  type="checkbox"
                                  checked={item.checked || false}
                                  onChange={(e) => handleItemChange(item.ui_id, 'checked', e.target.checked)}
                                  className="w-5 h-5 cursor-pointer accent-primary"
                                />
                              </td>
                              <td className="px-md py-sm text-on-surface-variant">{items.findIndex(i => i.ui_id === item.ui_id) + 1}</td>
                              <td className="px-md py-sm">
                                <div className="font-body-md text-on-surface font-medium">{item.product_name}</div>
                                {product && (
                                  <div className={`text-[11px] mt-1 ${(boxWarning || pieceWarning) ? 'text-error font-medium' : 'text-on-surface-variant'}`}>
                                    {(boxWarning || pieceWarning) ? `⚠️ Stock: ${product.stock_boxes || 0}B, ${product.stock_pieces || 0}P` : `Stock: ${product.stock_boxes || 0}B ${product.stock_pieces || 0}P`}
                                  </div>
                                )}
                              </td>
                              <td className="px-md py-sm">
                                <input
                                  type="text" inputMode="numeric" pattern="[0-9]*" value={item.box_quantity === 0 ? '' : String(item.box_quantity)}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || /^\d+$/.test(val)) {
                                      handleItemChange(item.ui_id, 'box_quantity', val === '' ? 0 : parseInt(val, 10));
                                    }
                                  }}
                                  onBlur={(e) => {
                                    if (e.target.value === '') handleItemChange(item.ui_id, 'box_quantity', 0);
                                  }}
                                  className={`w-full px-sm py-xs bg-surface border rounded-xl font-body-md text-[16px] outline-none ${boxWarning ? 'border-error text-error' : 'border-outline-variant'}`}
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-md py-sm">
                                <input
                                  type="text" inputMode="numeric" pattern="[0-9]*" value={item.piece_quantity === 0 ? '' : String(item.piece_quantity)}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || /^\d+$/.test(val)) {
                                      handleItemChange(item.ui_id, 'piece_quantity', val === '' ? 0 : parseInt(val, 10));
                                    }
                                  }}
                                  onBlur={(e) => {
                                    if (e.target.value === '') handleItemChange(item.ui_id, 'piece_quantity', 0);
                                  }}
                                  className={`w-full px-sm py-xs bg-surface border rounded-xl font-body-md text-[16px] outline-none ${pieceWarning ? 'border-error text-error' : 'border-outline-variant'}`}
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-md py-sm text-center">
                                <span className="font-body-md text-on-surface">{item.pieces_per_box || product?.pieces_per_box || '-'}</span>
                              </td>
                              <td className="px-md py-sm text-on-surface-variant text-sm">
                                ₹{item.price_per_piece.toLocaleString('en-IN')}
                              </td>
                              <td className="px-md py-sm text-on-surface text-right font-medium text-lg text-primary">₹{item.total.toLocaleString('en-IN')}</td>
                              <td className="px-md py-sm text-center">
                                <button onClick={() => removeItemRow(item.ui_id)} className="text-error hover:text-error-container p-2 rounded-full hover:bg-error/10 transition-colors">
                                  <span className="material-symbols-outlined text-[20px]">delete</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-md mb-xs product-search-wrapper" style={{ position: 'relative' }}>
                  <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Add Product to Bill</label>
                  <input
                    type="text"
                    placeholder="🔍 Product dhundho..."
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value)
                      setShowProductList(true)
                    }}
                    onFocus={() => setShowProductList(true)}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      fontSize: '16px',
                      border: '2px solid #1565C0',
                      borderRadius: '12px',
                    }}
                  />

                  {showProductList && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'white',
                      border: '1.5px solid #ddd',
                      borderRadius: '12px',
                      maxHeight: '400px',
                      overflowY: 'auto',
                      zIndex: 1000,
                      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                      marginTop: '4px',
                    }}>
                      {Object.entries(groupedProducts).sort((a, b) => {
                        if (a[0] === 'Party Pack / Family Pack') return 1;
                        if (b[0] === 'Party Pack / Family Pack') return -1;
                        return Number(a[0]) - Number(b[0]);
                      }).map(([groupName, prods]) => {
                        const filteredProds = prods
                          .filter(p => productSearch === '' || p.name.toLowerCase().includes(productSearch.toLowerCase()));

                        if (filteredProds.length === 0) return null;

                        return (
                          <div key={groupName}>
                            <div style={{
                              padding: '6px 16px',
                              background: '#f5f5f5',
                              fontWeight: 700,
                              fontSize: '13px',
                              color: '#333',
                              borderTop: '1px solid #eee',
                              letterSpacing: '1px',
                            }}>
                              ──── {groupName.includes('Party') ? groupName : `₹${groupName} Items`} ────
                            </div>

                            {filteredProds.map(product => (
                              <div
                                key={product.id}
                                onClick={() => {
                                  handleProductSelect(product.id)
                                  setProductSearch('')
                                  setShowProductList(false)
                                }}
                                style={{
                                  padding: '12px 16px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  borderBottom: '1px solid #f0f0f0',
                                  fontSize: '15px',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#E3F2FD'}
                                onMouseLeave={e => e.currentTarget.style.background = 'white'}
                              >
                                <div>
                                  <div style={{ fontWeight: 500 }}>
                                    {product.name}
                                    {(product.stock_boxes || 0) === 0 && (product.stock_pieces || 0) === 0 && (
                                      <span style={{
                                        marginLeft: '8px',
                                        fontSize: '11px',
                                        color: '#D32F2F',
                                        fontWeight: 600,
                                      }}>
                                        (Out of Stock)
                                      </span>
                                    )}
                                  </div>
                                  <div style={{
                                    fontSize: '12px',
                                    color: '#666',
                                    marginTop: '2px',
                                  }}>
                                    Stock: {product.stock_boxes || 0} boxes, {product.stock_pieces || 0} pieces
                                  </div>
                                </div>
                                <div style={{
                                  fontSize: '13px',
                                  color: '#1565C0',
                                  fontWeight: 600,
                                }}>
                                  ₹{product.price_per_piece || 0}/pc
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-sm mt-md pt-md border-t border-outline-variant w-full">
                  <div className="flex justify-between w-full sm:w-1/3 items-center">
                    <span className="font-body-md text-on-surface-variant">Subtotal:</span>
                    <span className="font-body-md text-on-surface">₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>

                  <div className="flex justify-between w-full sm:w-1/3 items-center">
                    <span className="font-body-md text-on-surface-variant flex items-center gap-2">
                      Discount:
                      <select value={discountType} onChange={e => setDiscountType(e.target.value)} className="px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-sm w-24">
                        <option value="None">None</option>
                        <option value="5%">5%</option>
                        <option value="10%">10%</option>
                        <option value="15%">15%</option>
                        <option value="Custom">Custom</option>
                      </select>
                    </span>
                    {discountType === 'Custom' ? (
                      <input type="number" value={customDiscount} onChange={e => setCustomDiscount(Number(e.target.value))} className="w-24 px-sm py-xs bg-surface border border-outline-variant rounded-xl text-[16px] text-right text-error" />
                    ) : (
                      <span className="font-body-md text-error">-₹{discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    )}
                  </div>

                  <div className="flex justify-between w-full sm:w-1/3 items-center">
                    <span className="font-body-md text-on-surface-variant">Taxable:</span>
                    <span className="font-body-md text-on-surface">₹{afterDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>

                  <div className="flex justify-between w-full sm:w-1/3 items-center">
                    <span className="font-body-md text-on-surface-variant flex items-center gap-2">
                      GST:
                      <select value={gstType} onChange={e => setGstType(e.target.value)} className="px-sm py-xs bg-surface border border-outline-variant rounded-xl font-body-sm w-24">
                        <option value="0%">0%</option>
                        <option value="5%">5%</option>
                        <option value="12%">12%</option>
                        <option value="18%">18%</option>
                        <option value="Custom">Manual</option>
                      </select>
                    </span>
                    {gstType === 'Custom' ? (
                      <input type="number" value={customGst} onChange={e => setCustomGst(Number(e.target.value))} className="w-24 px-sm py-xs bg-surface border border-outline-variant rounded-xl text-[16px] text-right" placeholder="%" />
                    ) : (
                      <span className="font-body-md text-error">-₹{gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    )}
                  </div>

                  <div className="flex justify-between w-full sm:w-1/3 items-center pt-sm mt-sm border-t border-outline-variant">
                    <span className="font-headline-sm text-on-surface font-bold">Grand Total:</span>
                    <span className="font-headline-sm text-primary font-bold">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-md mt-md w-full sm:w-auto">
                    <button onClick={handleClear} disabled={saving} className="flex-1 sm:flex-none flex items-center justify-center gap-xs px-lg py-sm border border-error text-error rounded-xl hover:bg-error/10 transition-colors disabled:opacity-50">
                      Clear
                    </button>
                    <button onClick={() => handleSave(false)} disabled={saving} className="flex-1 sm:flex-none flex items-center justify-center gap-xs px-lg py-sm border border-primary text-primary rounded-xl hover:bg-primary-container transition-colors disabled:opacity-50">
                      {saving ? 'Saving...' : 'Save Bill'}
                    </button>
                    <button onClick={() => handleSave(true)} disabled={saving} className="flex-1 sm:flex-none flex items-center justify-center gap-xs px-lg py-sm bg-primary text-on-primary rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50">
                      {saving ? 'Saving...' : 'Save & Print'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'previous' && (
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-md flex flex-col gap-md animate-fade-in min-h-[400px]">
            <div className="flex flex-col gap-md mb-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
                <h3 className="font-headline-sm text-on-surface">Previous Bills History</h3>
                <div className="w-full sm:w-64">
                  <select
                    value={historyFilterVendor}
                    onChange={(e) => setHistoryFilterVendor(e.target.value)}
                    className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl font-body-md text-[16px] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  >
                    <option value="all">All Vendors & Shopkeepers</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name} ({v.type})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bill Type Filter Tabs */}
              <div className="flex gap-2 border-b border-outline-variant">
                <button
                  onClick={() => setHistoryFilterBillType('all')}
                  className={`px-lg py-sm font-label-md transition-colors border-b-2 ${historyFilterBillType === 'all' ? 'border-primary text-primary font-bold' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
                >
                  All
                </button>
                <button
                  onClick={() => setHistoryFilterBillType('simple')}
                  className={`px-lg py-sm font-label-md transition-colors border-b-2 ${historyFilterBillType === 'simple' ? 'border-primary text-primary font-bold' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
                >
                  Simple Bills
                </button>
                <button
                  onClick={() => setHistoryFilterBillType('gst')}
                  className={`px-lg py-sm font-label-md transition-colors border-b-2 ${historyFilterBillType === 'gst' ? 'border-primary text-primary font-bold' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
                >
                  GST Bills
                </button>
              </div>
            </div>

            {Object.keys(groupedBills).length === 0 && !billsLoading ? (
              <div className="text-center text-on-surface-variant py-xl">No previous bills found.</div>
            ) : (
              Object.entries(groupedBills).map(([date, dateBills]) => (
                <div key={date} className="mb-md">
                  <h3 className="font-label-lg text-on-surface-variant mb-sm sticky top-0 bg-surface-container-lowest py-2 border-b border-outline-variant/30 z-10">{new Date(date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
                  <div className="flex flex-col gap-sm">
                    {dateBills.map(bill => (
                      <div key={bill.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-md bg-surface border border-outline-variant rounded-2xl hover:border-primary/30 transition-colors cursor-pointer gap-sm ${bill.is_deleted ? 'opacity-50 line-through' : ''}`} onClick={() => setPreviewBill(bill as any)}>
                        <div className="flex items-center gap-md">
                          <span className="font-medium text-primary w-32">{bill.bill_number}</span>
                          <span className="font-body-md text-on-surface truncate max-w-[200px]">{bill.vendor_name}</span>
                          {bill.is_deleted && <span className="bg-error text-white text-[10px] font-bold px-2 py-0.5 rounded-full no-underline uppercase">Void</span>}
                          {bill.bill_type === 'gst' && <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full no-underline uppercase">GST</span>}
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-md w-full sm:w-auto">
                          <span className="font-bold text-on-surface table-lining-figures">₹{bill.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          <div className="flex gap-xs bg-surface-container-low rounded-full p-1" onClick={e => e.stopPropagation()}>
                            <button onClick={() => setPreviewBill(bill as any)} className="p-sm text-secondary hover:bg-secondary/10 rounded-full transition-colors flex">
                              <span className="material-symbols-outlined text-[18px]">visibility</span>
                            </button>
                            {!bill.is_deleted && (
                              <>
                                <button onClick={() => handleEditBill(bill)} className="p-sm text-primary hover:bg-primary/10 rounded-full transition-colors" title="Edit Bill">
                                  <span className="material-symbols-outlined text-[18px]">edit</span>
                                </button>
                                <button onClick={() => handleDeleteRequest(bill.id)} className="p-sm text-error hover:bg-error/10 rounded-full transition-colors">
                                  <span className="material-symbols-outlined text-[18px]">delete</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}

            {billsLoading && <div className="text-center py-sm text-on-surface-variant">Loading bills...</div>}

            {hasMoreBills && !billsLoading && (
              <button onClick={loadMoreBills} className="mt-md py-sm text-primary font-medium hover:underline text-center w-full">
                Load More Bills
              </button>
            )}
          </div>
        )}
      </div>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="password-modal-overlay">
          <div className="password-modal-box">
            {passwordStep === 1 ? (
              <>
                <h3 className="font-headline-sm text-error flex items-center gap-2">
                  <span className="material-symbols-outlined">lock</span> Password Required
                </h3>
                <p className="text-on-surface-variant text-sm">Enter master password to delete this item.</p>
                <input
                  type="password"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  data-lpignore="true"
                  data-form-type="other"
                  name="action-password"
                  value={passwordInput}
                  onChange={e => setPasswordInput(e.target.value)}
                  className="w-full px-md py-sm bg-surface border border-outline-variant rounded-xl text-[16px] outline-none focus:border-error focus:ring-1 focus:ring-error"
                  placeholder="Enter password"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
                />
                {passwordError && <p className="text-error text-xs">{passwordError}</p>}
                <div className="password-modal-buttons">
                  <button onClick={() => setShowPasswordModal(false)} className="bg-surface-variant text-on-surface-variant">Cancel</button>
                  <button onClick={handlePasswordSubmit} className="bg-error text-white">Confirm</button>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-headline-sm text-error flex items-center gap-2">
                  <span className="material-symbols-outlined">warning</span> Are you sure?
                </h3>
                <p className="text-on-surface-variant text-sm">This action will void the record. Are you sure you want to delete?</p>
                <div className="password-modal-buttons">
                  <button onClick={() => setShowPasswordModal(false)} className="bg-surface-variant text-on-surface-variant">Cancel</button>
                  <button onClick={confirmDelete} className="bg-error text-white">Delete</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-md backdrop-blur-sm print:hidden">
          <div className="bg-surface-container-lowest rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-lg overflow-hidden animate-fade-in">
            <div className="p-md border-b border-outline-variant flex justify-between items-center bg-surface">
              <h3 className="font-headline-sm text-on-surface">Bill Preview</h3>
              <div className="flex gap-sm">
                <button onClick={() => setPreviewBill(null)} className="px-lg py-sm border border-outline-variant rounded-xl font-medium text-on-surface hover:bg-surface-variant transition-colors">Close</button>
                <button onClick={handlePrint} className="px-lg py-sm bg-primary text-on-primary rounded-xl font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors">
                  <span className="material-symbols-outlined text-[18px]">print</span> Print
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-md sm:p-xl bg-surface-variant/50 flex justify-center items-start print:p-0 print:bg-transparent print:overflow-visible">
              <div
                className="shadow-2xl print:shadow-none bg-white w-full max-w-[800px] overflow-hidden"
                style={{ minHeight: '400px' }}
                dangerouslySetInnerHTML={{
                  __html: generateBillHTML(
                    previewBill,
                    appSetting,
                    vendors.find(v => v.id === previewBill.vendor_id)?.type
                  )
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ════════ SCAN BILL MODAL ════════ */}
      {showScanModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm print:hidden">
          <div className="bg-surface-container-lowest w-full md:max-w-2xl md:rounded-2xl rounded-t-3xl max-h-[95vh] md:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
            {/* Modal Header */}
            <div className="p-md border-b border-outline-variant flex justify-between items-center bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined">document_scanner</span>
                <h3 className="font-headline-sm font-bold">Smart Bill Scan</h3>
              </div>
              <button
                onClick={() => setShowScanModal(false)}
                className="p-2 rounded-full hover:bg-white/20 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-md">

              {/* ──── STAGE: IDLE ──── */}
              {scanStage === 'idle' && (
                <div className="flex flex-col gap-lg items-center">
                  {!scanImagePreview ? (
                    <>
                      <div className="text-center py-lg">
                        <span className="material-symbols-outlined text-[64px] text-[#7C3AED] mb-md block">photo_camera</span>
                        <p className="text-on-surface-variant text-lg">Take a photo or upload a handwritten bill</p>
                        <p className="text-on-surface-variant text-sm mt-xs">Supports JPG, PNG, WebP (max 10MB)</p>
                      </div>
                      <div className="flex gap-md w-full max-w-sm">
                        <button
                          onClick={() => cameraInputRef.current?.click()}
                          className="flex-1 flex flex-col items-center gap-2 p-lg bg-[#7C3AED]/10 border-2 border-dashed border-[#7C3AED] rounded-2xl hover:bg-[#7C3AED]/20 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[32px] text-[#7C3AED]">photo_camera</span>
                          <span className="text-[#7C3AED] font-medium">Camera</span>
                        </button>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="flex-1 flex flex-col items-center gap-2 p-lg bg-primary/10 border-2 border-dashed border-primary rounded-2xl hover:bg-primary/20 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[32px] text-primary">upload_file</span>
                          <span className="text-primary font-medium">Upload</span>
                        </button>
                      </div>
                      <input
                        ref={cameraInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleScanImageSelect(e.target.files[0])}
                      />
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleScanImageSelect(e.target.files[0])}
                      />
                    </>
                  ) : (
                    <>
                      <div className="w-full max-w-md rounded-2xl overflow-hidden border border-outline-variant shadow-sm">
                        <img src={scanImagePreview} alt="Bill preview" className="w-full h-auto max-h-[50vh] object-contain bg-gray-50" />
                      </div>
                      <div className="flex gap-md w-full max-w-sm">
                        <button
                          onClick={() => { setScanImage(null); setScanImagePreview(null); }}
                          className="flex-1 px-lg py-sm border border-outline-variant text-on-surface-variant rounded-xl hover:bg-surface-variant transition-colors"
                        >
                          Change Image
                        </button>
                        <button
                          onClick={handleScanNow}
                          className="flex-1 px-lg py-sm bg-[#7C3AED] text-white rounded-xl font-bold hover:bg-[#6D28D9] transition-colors shadow-md flex items-center justify-center gap-2"
                        >
                          <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                          Scan Now
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ──── STAGE: SCANNING ──── */}
              {scanStage === 'scanning' && (
                <div className="flex flex-col items-center gap-lg py-xl">
                  {scanImagePreview && (
                    <div className="w-full max-w-xs rounded-2xl overflow-hidden border border-outline-variant shadow-sm relative">
                      <img src={scanImagePreview} alt="Scanning..." className="w-full h-auto opacity-50" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"></div>
                      </div>
                    </div>
                  )}
                  <div className="text-center">
                    <p className="text-on-surface font-bold text-lg animate-pulse">Reading handwritten bill...</p>
                    <p className="text-on-surface-variant text-sm mt-xs">AI is analyzing the image</p>
                  </div>
                </div>
              )}

              {/* ──── STAGE: ERROR ──── */}
              {scanStage === 'error' && (
                <div className="flex flex-col items-center gap-lg py-xl text-center">
                  <span className="material-symbols-outlined text-[64px] text-error">error</span>
                  <p className="text-error font-bold text-lg">Scan Failed</p>
                  <p className="text-on-surface-variant">{scanError}</p>
                  <div className="flex gap-md">
                    <button
                      onClick={() => setScanStage('idle')}
                      className="px-lg py-sm border border-outline-variant rounded-xl hover:bg-surface-variant transition-colors"
                    >
                      Try Again
                    </button>
                    <button
                      onClick={() => setShowScanModal(false)}
                      className="px-lg py-sm bg-error text-white rounded-xl hover:bg-error/90 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}

              {/* ──── STAGE: RESULTS ──── */}
              {scanStage === 'results' && scanResult && (
                <div className="flex flex-col gap-md">
                  {/* Vendor & Date */}
                  <div className="bg-[#7C3AED]/5 border border-[#7C3AED]/20 rounded-2xl p-md">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs text-on-surface-variant uppercase tracking-wider">Vendor Found</span>
                        <p className="text-lg font-bold text-on-surface">{scanResult.vendor_name || 'Not detected'}</p>
                        <p className="text-xs text-on-surface-variant mt-1">⚠️ Please verify</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-on-surface-variant uppercase tracking-wider">Date</span>
                        <p className="text-lg font-bold text-on-surface">{scanResult.date || 'Today'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="border border-outline-variant rounded-2xl overflow-hidden">
                    <div className="bg-surface-container-low px-md py-sm border-b border-outline-variant">
                      <h4 className="font-label-lg font-bold text-on-surface">Scanned Items ({scanResult.items.length})</h4>
                    </div>
                    <div className="divide-y divide-outline-variant/50">
                      {scanResult.items.map((item, idx) => {
                        const itemAmount = ((item.box_qty || 0) * (item.price_per_box || 0)) + ((item.piece_qty || 0) * (item.price_per_piece || 0));
                        const badgeColor = item.confidence === 'high' ? 'bg-[#166534] text-white' : item.confidence === 'medium' ? 'bg-[#F59E0B] text-white' : 'bg-error text-white';
                        const rowBg = item.confidence === 'low' ? 'bg-[#FEF3C7]' : item.confidence === 'medium' ? 'bg-[#FFFBEB]' : 'bg-surface';
                        return (
                          <div key={idx} className={`p-md ${rowBg}`}>
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2 flex-1">
                                {item.confidence === 'low' ? (
                                  <span className="text-error text-sm">❌</span>
                                ) : item.confidence === 'medium' ? (
                                  <span className="text-[#F59E0B] text-sm">⚠️</span>
                                ) : (
                                  <span className="text-[#166534] text-sm">✅</span>
                                )}
                                {item.confidence === 'low' ? (
                                  <select
                                    value={item.product_id || ''}
                                    onChange={(e) => handleScanItemProductChange(idx, e.target.value)}
                                    className="flex-1 px-2 py-1 border border-error rounded-lg text-sm bg-white focus:border-primary outline-none"
                                  >
                                    <option value="">Select correct product...</option>
                                    {products.map(p => (
                                      <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="font-medium text-on-surface">{item.product_name_matched}</span>
                                )}
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${badgeColor}`}>
                                  {item.confidence.toUpperCase()}
                                </span>
                              </div>
                              <span className="font-bold text-primary ml-2">₹{itemAmount.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="text-xs text-on-surface-variant mb-2">Raw: "{item.product_name_raw}"</div>
                            <div className="flex gap-md items-center">
                              <div className="flex items-center gap-1">
                                <label className="text-xs text-on-surface-variant">Boxes:</label>
                                <input
                                  type="number" min="0"
                                  value={item.box_qty === 0 ? '' : item.box_qty}
                                  onChange={(e) => handleScanItemChange(idx, 'box_qty', parseInt(e.target.value) || 0)}
                                  className="w-16 px-2 py-1 border border-outline-variant rounded-lg text-sm text-center outline-none focus:border-primary text-base"
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <label className="text-xs text-on-surface-variant">Pieces:</label>
                                <input
                                  type="number" min="0"
                                  value={item.piece_qty === 0 ? '' : item.piece_qty}
                                  onChange={(e) => handleScanItemChange(idx, 'piece_qty', parseInt(e.target.value) || 0)}
                                  className="w-16 px-2 py-1 border border-outline-variant rounded-lg text-sm text-center outline-none focus:border-primary text-base"
                                />
                              </div>
                              <span className="text-xs text-on-surface-variant ml-auto">₹{item.price_per_piece || 0}/pc</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="bg-surface-container-low rounded-2xl p-md border border-outline-variant">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-on-surface-variant">Subtotal</span>
                      <span className="font-medium">₹{getScanSubtotal().toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-on-surface-variant flex items-center gap-2">
                        GST:
                        <select
                          value={scanGstType}
                          onChange={e => setScanGstType(e.target.value)}
                          className="px-2 py-1 bg-surface border border-outline-variant rounded-lg text-sm"
                        >
                          <option value="0%">0%</option>
                          <option value="5%">5%</option>
                          <option value="12%">12%</option>
                          <option value="18%">18%</option>
                        </select>
                      </span>
                      <span className="text-error">-₹{(() => {
                        const sub = getScanSubtotal();
                        const afterDisc = sub - (Number(scanDiscount) || 0);
                        const gstRate = scanGstType === '5%' ? 5 : scanGstType === '12%' ? 12 : scanGstType === '18%' ? 18 : 0;
                        return Math.round(afterDisc * (gstRate / 100)).toLocaleString('en-IN');
                      })()}</span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-on-surface-variant flex items-center gap-2">
                        Discount:
                        <input
                          type="number" min="0"
                          value={scanDiscount === 0 ? '' : scanDiscount}
                          onChange={e => setScanDiscount(Number(e.target.value) || 0)}
                          placeholder="₹0"
                          className="w-20 px-2 py-1 bg-surface border border-outline-variant rounded-lg text-sm text-right text-base"
                        />
                      </span>
                      <span className="text-error">-₹{(Number(scanDiscount) || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-outline-variant">
                      <span className="font-headline-sm font-bold text-on-surface">Grand Total</span>
                      <span className="font-headline-sm font-bold text-primary">₹{getScanGrandTotal().toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-md mt-sm">
                    <button
                      onClick={() => { setScanStage('idle'); setScanImage(null); setScanImagePreview(null); }}
                      className="flex-1 px-lg py-sm border border-outline-variant rounded-xl text-on-surface-variant hover:bg-surface-variant transition-colors flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[18px]">refresh</span>
                      Scan Again
                    </button>
                    <button
                      onClick={handleEditInForm}
                      className="flex-1 px-lg py-sm border border-primary text-primary rounded-xl hover:bg-primary-container transition-colors flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                      Edit in Form
                    </button>
                    <button
                      onClick={handleScanSaveAndPrint}
                      disabled={scanSaving}
                      className="flex-1 px-lg py-sm bg-primary text-on-primary rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-[18px]">print</span>
                      {scanSaving ? 'Saving...' : 'Save & Print'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
