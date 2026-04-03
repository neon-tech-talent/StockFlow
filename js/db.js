const supabaseUrl = window.SUPABASE_URL || '';
const supabaseKey = window.SUPABASE_KEY || '';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

const DB = {
  /* ── CATEGORIES ── */
  async getCategories() {
    const { data } = await _supabase.from('categories').select('*').order('name');
    return data || [];
  },
  async saveCategory(cat) {
    if (cat.id) await _supabase.from('categories').update({ name: cat.name }).eq('id', cat.id);
    else await _supabase.from('categories').insert({ name: cat.name });
  },
  async deleteCategory(id) {
    // Check if products use it
    const { count } = await _supabase.from('products').select('*', { count: 'exact', head: true }).eq('category_id', id);
    if (count > 0) return false;
    await _supabase.from('categories').delete().eq('id', id);
    return true;
  },

  /* ── PRODUCTS ── */
  async getProducts() {
    const { data } = await _supabase.from('products').select('*').order('name');
    return data || [];
  },
  async saveProduct(p) {
    const obj = { name: p.name, category_id: p.categoryId || null, sell_price: p.sellPrice, cost_price: p.costPrice, stock: p.stock };
    if (p.id) await _supabase.from('products').update(obj).eq('id', p.id);
    else await _supabase.from('products').insert(obj);
  },
  async deleteProduct(id) { await _supabase.from('products').delete().eq('id', id); },
  async adjustStock(id, delta) {
    const { data } = await _supabase.from('products').select('stock').eq('id', id).single();
    if (data) await _supabase.from('products').update({ stock: data.stock + delta }).eq('id', id);
  },

  /* ── CLIENTS ── */
  async getClients() {
    const { data } = await _supabase.from('clients').select('*').order('name');
    return data || [];
  },
  async saveClient(c) {
    const obj = { name: c.name, phone: c.phone, email: c.email, balance: c.balance || 0 };
    if (c.id) await _supabase.from('clients').update(obj).eq('id', c.id);
    else await _supabase.from('clients').insert(obj);
  },
  async updateBalance(id, delta) {
    const { data } = await _supabase.from('clients').select('balance').eq('id', id).single();
    if (data) await _supabase.from('clients').update({ balance: parseFloat(data.balance) + delta }).eq('id', id);
  },

  /* ── SALES ── */
  async getSales() {
    const { data } = await _supabase.from('sales').select('*').order('created_at', { ascending: false });
    return data || [];
  },
  async getSaleItems(saleId) {
    let q = _supabase.from('sale_items').select('*');
    if (saleId) q = q.eq('sale_id', saleId);
    const { data } = await q;
    return data || [];
  },
  async saveSale(sale, items) {
    const { data: sData, error } = await _supabase.from('sales').insert({
      total: sale.total, payment_type: sale.paymentType, client_id: sale.clientId, client_name: sale.clientName
    }).select().single();

    if (error) throw error;
    const saleId = sData.id;

    const itemsToInsert = items.map(it => ({
      sale_id: saleId, product_id: it.productId, product_name: it.productName,
      quantity: it.quantity, unit_price: it.unitPrice
    }));
    await _supabase.from('sale_items').insert(itemsToInsert);

    // Stock & Account & Cash
    for (const it of items) { await this.adjustStock(it.productId, -it.quantity); }
    if (sale.paymentType === 'efectivo') {
      await this.saveCashMovement({ amount: sale.total, type: 'venta', reason: `Venta #${saleId.slice(-4)}` });
    }
    if (sale.paymentType === 'cuenta_corriente' && sale.clientId) {
      await this.addMovement({ client_id: sale.clientId, sale_id: saleId, amount: sale.total, type: 'venta', notes: 'Venta' });
      await this.updateBalance(sale.clientId, sale.total);
    }
    return saleId;
  },
  async voidSale(saleId) {
    const { data: sale } = await _supabase.from('sales').select('*').eq('id', saleId).single();
    if (!sale || sale.voided) return false;

    const items = await this.getSaleItems(saleId);
    for (const it of items) { if (it.product_id) await this.adjustStock(it.product_id, it.quantity); }

    await _supabase.from('sales').update({ voided: true }).eq('id', saleId);

    if (sale.payment_type === 'cuenta_corriente' && sale.client_id) {
      await this.addMovement({ client_id: sale.client_id, sale_id: saleId, amount: -sale.total, type: 'anulacion', notes: 'Anulación' });
      await this.updateBalance(sale.client_id, -sale.total);
    }
    if (sale.payment_type === 'efectivo') {
      await this.saveCashMovement({ amount: -sale.total, type: 'anulacion', reason: `Anulación Venta #${saleId.slice(-4)}` });
    }
    return true;
  },

  /* ── ACCOUNT MOVEMENTS ── */
  async getMovements(clientId) {
    let q = _supabase.from('account_movements').select('*');
    if (clientId) q = q.eq('client_id', clientId);
    const { data } = await q.order('created_at', { ascending: false });
    return data || [];
  },
  async addMovement(mov) { await _supabase.from('account_movements').insert(mov); },
  async registerPayment(clientId, amount, notes, method) {
    await this.addMovement({ client_id: clientId, amount: -amount, type: 'pago', notes: notes || 'Pago CC' });
    if (method === 'efectivo') {
      await this.saveCashMovement({ amount, type: 'cobranza', reason: `Cobranza: ${notes || 'Pago CC'}` });
    }
    await this.updateBalance(clientId, -amount);
  },

  /* ── SUPPLIES ── */
  async getSupplies() {
    const { data } = await _supabase.from('supplies').select('*').order('name');
    return data || [];
  },
  async saveSupply(s) {
    const obj = { name: s.name, stock: s.stock, unit: s.unit };
    if (s.id) await _supabase.from('supplies').update(obj).eq('id', s.id);
    else await _supabase.from('supplies').insert(obj);
  },
  async deleteSupply(id) { await _supabase.from('supplies').delete().eq('id', id); },
  async adjustSupplyStock(id, delta) {
    const { data } = await _supabase.from('supplies').select('stock').eq('id', id).single();
    if (data) await _supabase.from('supplies').update({ stock: (data.stock || 0) + delta }).eq('id', id);
  },
  async getDeductions() {
    const { data } = await _supabase.from('supply_deductions').select('*').order('created_at', { ascending: false });
    return data || [];
  },
  async saveDeduction(ded) {
    await _supabase.from('supply_deductions').insert({
      supply_id: ded.productId, supply_name: ded.productName, quantity: ded.quantity, reason: ded.reason
    });
    await this.adjustSupplyStock(ded.productId, -ded.quantity);
  },

  /* ── EXPENSES ── */
  async getExpenses() {
    const { data } = await _supabase.from('expenses').select('*').order('date', { ascending: false });
    return data || [];
  },
  async saveExpense(e) {
    const obj = { concept: e.concept, amount: e.amount, date: e.date };
    if (e.id) await _supabase.from('expenses').update(obj).eq('id', e.id);
    else await _supabase.from('expenses').insert(obj);
  },
  async deleteExpense(id) { await _supabase.from('expenses').delete().eq('id', id); },

  /* ── CASH MOVEMENTS ── */
  async getCashMovements() {
    const { data } = await _supabase.from('cash_movements').select('*').order('created_at', { ascending: false });
    return data || [];
  },
  async saveCashMovement(mv) { await _supabase.from('cash_movements').insert(mv); },
  async getCashTotal() {
    const { data } = await _supabase.from('cash_movements').select('amount');
    return (data || []).reduce((sum, m) => sum + parseFloat(m.amount), 0);
  },

  /* ── STATISTICS ── */
  async getStats(m, y) {
    const now = new Date();
    const cm = m ?? now.getMonth(), cy = y ?? now.getFullYear();
    
    // For simplicity, we fetch mostly everything needed or do grouped queries
    const { data: sales } = await _supabase.from('sales').select('*').eq('voided', false);
    const { data: items } = await _supabase.from('sale_items').select('*');
    const { data: prods } = await _supabase.from('products').select('*');
    const { data: expenses } = await _supabase.from('expenses').select('*');
    const { data: clients } = await _supabase.from('clients').select('*');

    const monthlySales = (sales || []).filter(s => { const d = new Date(s.created_at); return d.getMonth() === cm && d.getFullYear() === cy; });
    const yearlySales  = (sales || []).filter(s => new Date(s.created_at).getFullYear() === cy);
    const monthlyExpenses = (expenses || []).filter(e => { const d = new Date(e.date); return d.getMonth() === cm && d.getFullYear() === cy; });

    let grossProfit = 0;
    monthlySales.forEach(s => {
      const saleItems = (items || []).filter(i => i.sale_id === s.id);
      saleItems.forEach(it => {
        const p = (prods || []).find(p => p.id === it.product_id);
        const cost = p ? p.cost_price : 0;
        grossProfit += (it.unit_price - cost) * it.quantity;
      });
    });
    const totalExpenses = monthlyExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(cy, cm - (11 - i), 1);
      const total = (sales || []).filter(s => { const sd = new Date(s.created_at); return sd.getMonth() === d.getMonth() && sd.getFullYear() === d.getFullYear(); })
        .reduce((sum, s) => sum + parseFloat(s.total), 0);
      return { label: d.toLocaleString('es', { month: 'short', year: '2-digit' }), total };
    });

    const clientMap = {};
    (sales || []).forEach(s => {
      const k = s.client_id || '__none__';
      if (!clientMap[k]) clientMap[k] = { name: s.client_name || 'Sin cliente', total: 0, count: 0 };
      clientMap[k].total += parseFloat(s.total); clientMap[k].count++;
    });
    const topClients = Object.values(clientMap).sort((a, b) => b.total - a.total).slice(0, 8);

    const prodUnits = {}, prodProfit = {};
    (items || []).forEach(it => {
      const p = (prods || []).find(p => p.id === it.product_id);
      if (!prodUnits[it.product_id]) prodUnits[it.product_id] = { name: it.product_name, units: 0 };
      prodUnits[it.product_id].units += it.quantity;
      if (!prodProfit[it.product_id]) prodProfit[it.product_id] = { name: it.product_name, profit: 0 };
      const margin = p ? (it.unit_price - p.cost_price) : 0;
      prodProfit[it.product_id].profit += margin * it.quantity;
    });

    return {
      monthlyTotal: monthlySales.reduce((s, v) => s + parseFloat(v.total), 0),
      monthlyCount: monthlySales.length,
      yearlyTotal:  yearlySales.reduce((s, v) => s + parseFloat(v.total), 0),
      yearlyCount:  yearlySales.length,
      debtors: (clients || []).filter(c => parseFloat(c.balance) > 0).length,
      grossProfit, totalExpenses, netProfit: grossProfit - totalExpenses,
      monthlyData, topClients,
      topProducts: Object.values(prodUnits).sort((a,b) => b.units - a.units).slice(0,5),
      topProfitable: Object.values(prodProfit).sort((a,b) => b.profit - a.profit).slice(0,5)
    };
  }
};
