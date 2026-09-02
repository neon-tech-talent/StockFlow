const supabaseUrl = window.SUPABASE_URL || '';
const supabaseKey = window.SUPABASE_KEY || '';

let _supabase = null;
try {
  if (supabaseUrl && supabaseKey) {
    _supabase = supabase.createClient(supabaseUrl, supabaseKey);
  }
} catch(e) { console.error("Error init Supabase:", e); }

const DB = {
  get client() {
    if (!_supabase) alert("Error: Base de datos no configurada en Vercel.");
    return _supabase;
  },

  // Devuelve el admin_id de la sesión activa
  _adminId() {
    return Auth.getAdminId();
  },

  /* ── CATEGORIES ── */
  async getCategories() {
    const { data } = await this.client.from('categories').select('*').eq('admin_id', this._adminId()).order('name');
    return data || [];
  },
  async saveCategory(cat) {
    if (cat.id) await this.client.from('categories').update({ name: cat.name }).eq('id', cat.id).eq('admin_id', this._adminId());
    else await this.client.from('categories').insert({ name: cat.name, admin_id: this._adminId() });
  },
  async deleteCategory(id) {
    // Por regla de negocio, las categorías no pueden eliminarse
    return false;
  },

  /* ── PRODUCTS ── */
  async getProducts() {
    const { data } = await this.client.from('products').select('*').eq('admin_id', this._adminId()).order('name');
    return data || [];
  },
  async saveProduct(p) {
    const obj = { 
      name: p.name, 
      category_id: p.categoryId || null, 
      sell_price: parseFloat(p.sellPrice) || 0, 
      cost_price: parseFloat(p.costPrice) || 0, 
      stock: parseFloat(p.stock) || 0, 
      unit: p.unit || 'Unidades' 
    };
    if (p.id) {
      const { data } = await this.client.from('products').update(obj).eq('id', p.id).eq('admin_id', this._adminId()).select().single();
      return data;
    } else {
      const { data } = await this.client.from('products').insert({ ...obj, admin_id: this._adminId() }).select().single();
      return data;
    }
  },
  async deleteProduct(id) { await this.client.from('products').delete().eq('id', id).eq('admin_id', this._adminId()); },
  async adjustStock(id, delta) {
    if (!id) return null;
    const { data } = await this.client.from('products').select('stock').eq('id', id).eq('admin_id', this._adminId()).single();
    if (data) {
      const newStock = Math.max(0, Math.round(((parseFloat(data.stock) || 0) + parseFloat(delta)) * 1000) / 1000);
      const { data: updated } = await this.client.from('products').update({ stock: newStock }).eq('id', id).eq('admin_id', this._adminId()).select().single();
      return updated;
    }
    return null;
  },

  /* ── CLIENTS ── */
  async getClients() {
    const { data } = await this.client.from('clients').select('*').eq('admin_id', this._adminId()).order('name');
    return data || [];
  },
  async saveClient(c) {
    const obj = { name: c.name, phone: c.phone, email: c.email, balance: c.balance || 0, dni: c.dni || null, address: c.address || null };
    if (c.id) {
      const { data } = await this.client.from('clients').update(obj).eq('id', c.id).eq('admin_id', this._adminId()).select().single();
      return data;
    } else {
      const { data } = await this.client.from('clients').insert({ ...obj, admin_id: this._adminId() }).select().single();
      return data;
    }
  },
  async updateBalance(id, delta) {
    const { data } = await this.client.from('clients').select('balance').eq('id', id).eq('admin_id', this._adminId()).single();
    if (data) await this.client.from('clients').update({ balance: parseFloat(data.balance) + delta }).eq('id', id).eq('admin_id', this._adminId());
  },

  /* ── SALES ── */
  async getSales() {
    const { data } = await this.client.from('sales').select('*').eq('admin_id', this._adminId()).order('created_at', { ascending: false });
    return data || [];
  },
  async getSaleItems(saleId) {
    let q = this.client.from('sale_items').select('*').eq('admin_id', this._adminId());
    if (saleId) q = q.eq('sale_id', saleId);
    const { data } = await q;
    return data || [];
  },
  async saveSale(sale, items) {
    const { data: sData, error } = await this.client.from('sales').insert({
      total: sale.total, payment_type: sale.paymentType, client_id: sale.clientId,
      client_name: sale.clientName, invoiced: sale.invoiced || false, admin_id: this._adminId()
    }).select().single();

    if (error) throw error;
    const saleId = sData.id;

    const itemsToInsert = items.map(it => ({
      sale_id: saleId, product_id: it.productId || null, product_name: it.productName,
      quantity: parseFloat(it.quantity) || 0, unit_price: parseFloat(it.unitPrice) || 0, 
      discount_type: it.discountType || 'none', discount_value: parseFloat(it.discountValue) || 0,
      admin_id: this._adminId()
    }));
    const { error: insError } = await this.client.from('sale_items').insert(itemsToInsert);
    if (insError) {
      console.warn("Fallo inserción primaria de sale_items con decimales, aplicando fallback:", insError);
      const fallbackItems = items.map(it => {
        const qty = parseFloat(it.quantity) || 1;
        const isDecimal = !Number.isInteger(qty);
        const unitAbbr = (typeof Utils !== 'undefined' && Utils.unitAbbr) ? Utils.unitAbbr(it.unit) : (it.unit || '');
        return {
          sale_id: saleId,
          product_id: it.productId || null,
          product_name: isDecimal ? `${it.productName} (${qty} ${unitAbbr})` : it.productName,
          quantity: isDecimal ? 1 : Math.round(qty),
          unit_price: isDecimal ? Math.round((parseFloat(it.unitPrice || 0) * qty) * 100) / 100 : parseFloat(it.unitPrice) || 0,
          discount_type: it.discountType || 'none',
          discount_value: parseFloat(it.discountValue) || 0,
          admin_id: this._adminId()
        };
      });
      await this.client.from('sale_items').insert(fallbackItems);
    }

    for (const it of items) { 
      if (it.productId) {
        await this.adjustStock(it.productId, -(parseFloat(it.quantity) || 0)); 
      }
    }
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
    const { data: sale } = await this.client.from('sales').select('*').eq('id', saleId).eq('admin_id', this._adminId()).single();
    if (!sale || sale.voided) return false;

    const items = await this.getSaleItems(saleId);
    for (const it of items) { 
      if (it.product_id) {
        await this.adjustStock(it.product_id, parseFloat(it.quantity) || 0); 
      }
    }

    await this.client.from('sales').update({ voided: true }).eq('id', saleId).eq('admin_id', this._adminId());

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
    let q = this.client.from('account_movements').select('*').eq('admin_id', this._adminId());
    if (clientId) q = q.eq('client_id', clientId);
    const { data } = await q.order('created_at', { ascending: false });
    return data || [];
  },
  async addMovement(mov) { await this.client.from('account_movements').insert({ ...mov, admin_id: this._adminId() }); },
  async registerPayment(clientId, amount, notes, method) {
    await this.addMovement({ client_id: clientId, amount: -amount, type: 'pago', notes: notes || 'Pago CC' });
    if (method === 'efectivo') {
      await this.saveCashMovement({ amount, type: 'cobranza', reason: `Cobranza: ${notes || 'Pago CC'}` });
    }
    await this.updateBalance(clientId, -amount);
  },

  /* ── SUPPLIES ── */
  async getSupplies() {
    const { data } = await this.client.from('supplies').select('*').eq('admin_id', this._adminId()).order('name');
    return data || [];
  },
  async saveSupply(s) {
    const obj = { name: s.name, stock: parseFloat(s.stock) || 0, unit: s.unit };
    if (s.id) await this.client.from('supplies').update(obj).eq('id', s.id).eq('admin_id', this._adminId());
    else await this.client.from('supplies').insert({ ...obj, admin_id: this._adminId() });
  },
  async deleteSupply(id) { await this.client.from('supplies').delete().eq('id', id).eq('admin_id', this._adminId()); },
  async adjustSupplyStock(id, delta) {
    const { data } = await this.client.from('supplies').select('stock').eq('id', id).eq('admin_id', this._adminId()).single();
    if (data) {
      const newStock = Math.max(0, Math.round(((parseFloat(data.stock) || 0) + parseFloat(delta)) * 1000) / 1000);
      await this.client.from('supplies').update({ stock: newStock }).eq('id', id).eq('admin_id', this._adminId());
    }
  },
  async getDeductions() {
    const { data } = await this.client.from('supply_deductions').select('*').eq('admin_id', this._adminId()).order('created_at', { ascending: false });
    return data || [];
  },
  async saveDeduction(ded) {
    const qty = parseFloat(ded.quantity) || 0;
    const { error } = await this.client.from('supply_deductions').insert({
      supply_id: ded.productId, supply_name: ded.productName, quantity: qty,
      reason: ded.reason, admin_id: this._adminId()
    });
    if (error) {
      console.warn("Fallo inserción primaria de supply_deductions con decimales, aplicando fallback:", error);
      await this.client.from('supply_deductions').insert({
        supply_id: ded.productId, supply_name: ded.productName, quantity: Math.max(1, Math.round(qty)),
        reason: `${ded.reason} (${qty})`, admin_id: this._adminId()
      });
    }
    await this.adjustSupplyStock(ded.productId, -qty);
  },

  /* ── EXPENSES ── */
  async getExpenses() {
    const { data } = await this.client.from('expenses').select('*').eq('admin_id', this._adminId()).order('date', { ascending: false });
    return data || [];
  },
  async saveExpense(e) {
    const obj = { concept: e.concept, amount: e.amount, date: e.date };
    if (e.id) await this.client.from('expenses').update(obj).eq('id', e.id).eq('admin_id', this._adminId());
    else await this.client.from('expenses').insert({ ...obj, admin_id: this._adminId() });
  },
  async deleteExpense(id) { await this.client.from('expenses').delete().eq('id', id).eq('admin_id', this._adminId()); },

  /* ── CASH MOVEMENTS ── */
  async getCashMovements() {
    const { data } = await this.client.from('cash_movements').select('*').eq('admin_id', this._adminId()).order('created_at', { ascending: false });
    return data || [];
  },
  async saveCashMovement(mv) { await this.client.from('cash_movements').insert({ ...mv, admin_id: this._adminId() }); },
  async getCashTotal() {
    const { data } = await this.client.from('cash_movements').select('amount').eq('admin_id', this._adminId());
    return (data || []).reduce((sum, m) => sum + parseFloat(m.amount), 0);
  },

  /* ── STATISTICS ── */
  async getStats(m, y) {
    try {
      const now = new Date();
      const cm = (m !== undefined && m !== null && !isNaN(m)) ? parseInt(m) : now.getMonth();
      const cy = (y !== undefined && y !== null && !isNaN(y)) ? parseInt(y) : now.getFullYear();
      const aid = this._adminId();

      if (!aid || !this.client) {
        return this._getEmptyStats(cm, cy);
      }

      const [salesRes, itemsRes, prodsRes, expRes, clientsRes, servicesRes] = await Promise.allSettled([
        this.client.from('sales').select('*').eq('admin_id', aid).eq('voided', false),
        this.client.from('sale_items').select('*').eq('admin_id', aid),
        this.client.from('products').select('*').eq('admin_id', aid),
        this.client.from('expenses').select('*').eq('admin_id', aid),
        this.client.from('clients').select('*').eq('admin_id', aid),
        this.client.from('turnos_services').select('*').eq('admin_id', aid)
      ]);

      const sales   = (salesRes.status === 'fulfilled' && Array.isArray(salesRes.value?.data)) ? salesRes.value.data : [];
      const items   = (itemsRes.status === 'fulfilled' && Array.isArray(itemsRes.value?.data)) ? itemsRes.value.data : [];
      const prods   = (prodsRes.status === 'fulfilled' && Array.isArray(prodsRes.value?.data)) ? prodsRes.value.data : [];
      const expenses= (expRes.status === 'fulfilled' && Array.isArray(expRes.value?.data)) ? expRes.value.data : [];
      const clients = (clientsRes.status === 'fulfilled' && Array.isArray(clientsRes.value?.data)) ? clientsRes.value.data : [];
      const turnosServices = (servicesRes.status === 'fulfilled' && Array.isArray(servicesRes.value?.data)) ? servicesRes.value.data : [];
      const serviceNames = new Set(turnosServices.map(ts => (ts.name || '').toLowerCase().trim()));

      const parseDate = (dStr) => {
        if (!dStr) return null;
        if (typeof dStr === 'string' && !dStr.includes('T') && dStr.includes('-')) {
          const parts = dStr.split('-').map(Number);
          if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            return new Date(parts[0], parts[1] - 1, parts[2] || 1);
          }
        }
        const d = new Date(dStr);
        return isNaN(d.getTime()) ? null : d;
      };

      const validSales = sales.filter(s => s && !s.voided);

      const monthlySales = validSales.filter(s => {
        const d = parseDate(s.created_at);
        return d && d.getMonth() === cm && d.getFullYear() === cy;
      });

      const yearlySales = validSales.filter(s => {
        const d = parseDate(s.created_at);
        return d && d.getFullYear() === cy;
      });

      const monthlyExpenses = (expenses || []).filter(e => {
        const d = parseDate(e.date || e.created_at);
        return d && d.getMonth() === cm && d.getFullYear() === cy;
      });

      const monthlySaleIds = new Set(monthlySales.map(s => s.id));
      const monthlyItems = (items || []).filter(it => it && monthlySaleIds.has(it.sale_id));

      let grossProfit = 0;
      monthlySales.forEach(s => {
        const saleItems = monthlyItems.filter(i => i.sale_id === s.id);
        saleItems.forEach(it => {
          const p = prods.find(pr => pr.id === it.product_id);
          const cost = parseFloat(p?.cost_price) || 0;
          const qty = parseFloat(it.quantity) || 0;
          let unitPrice = parseFloat(it.unit_price) || 0;
          let subtotal = unitPrice * qty;

          const discVal = parseFloat(it.discount_value) || 0;
          if (it.discount_type === 'percentage') {
            subtotal -= subtotal * (discVal / 100);
          } else if (it.discount_type === 'amount') {
            subtotal -= discVal;
          }
          
          grossProfit += Math.max(0, subtotal) - (cost * qty);
        });
      });

      const totalExpenses = monthlyExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
      const monthlyTotal = monthlySales.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
      const invoicedTotal = monthlySales.filter(s => s.invoiced).reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
      const yearlyTotal = yearlySales.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);

      // Evolución 12 meses
      const monthlyData = Array.from({ length: 12 }, (_, i) => {
        const targetDate = new Date(cy, cm - (11 - i), 1);
        const tMonth = targetDate.getMonth();
        const tYear = targetDate.getFullYear();
        const total = validSales.filter(s => {
          const sd = parseDate(s.created_at);
          return sd && sd.getMonth() === tMonth && sd.getFullYear() === tYear;
        }).reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);

        const rawLabel = targetDate.toLocaleString('es', { month: 'short', year: '2-digit' });
        return {
          label: rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1),
          total: Math.round(total * 100) / 100
        };
      });

      // Top Clientes
      const clientMap = {};
      const salesForClients = monthlySales.length > 0 ? monthlySales : validSales;
      salesForClients.forEach(s => {
        const k = s.client_id || s.client_name || '__none__';
        const name = s.client_name || 'Consumidor Final';
        if (!clientMap[k]) clientMap[k] = { name, total: 0, count: 0 };
        clientMap[k].total += (parseFloat(s.total) || 0);
        clientMap[k].count++;
      });
      const topClients = Object.values(clientMap)
        .filter(c => c.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 8);

      // Top Productos y Rentables (excluyendo servicios de turnos)
      const itemsForStats = monthlyItems.length > 0 ? monthlyItems : (items || []).filter(it => {
        const parentSale = validSales.find(s => s.id === it.sale_id);
        return !!parentSale;
      });

      const prodUnits = {}, prodProfit = {};
      itemsForStats.forEach(it => {
        // Encontrar producto actual si existe en catálogo para obtener su costo
        const p = prods.find(pr => pr.id === it.product_id);
        
        let rawName = (it.product_name || p?.name || 'Producto').trim();
        const lowerRaw = rawName.toLowerCase();

        // Identificar y excluir servicios generados desde el módulo de Turnos
        const isTurnoService = (it.unit === 'Servicio') || 
                               lowerRaw.includes('(turno') || 
                               lowerRaw.endsWith('(turno)') ||
                               (!it.product_id && (serviceNames.has(lowerRaw) || serviceNames.has(rawName.replace(/\s*\([^)]*\)$/, '').toLowerCase().trim())));

        // Los turnos/servicios no deben figurar en los rankings de productos físicos
        if (isTurnoService) return;

        // Limpiar sufijos fraccionados como "(0.1 kg)" o "(0.25 L)" si vinieron del fallback
        let cleanName = rawName;
        const matchDecimal = rawName.match(/^(.*?)\s*\(\d+(\.\d+)?\s*(kg|l|u\.|porc\.|m)?\)$/i);
        if (matchDecimal && matchDecimal[1]) {
          cleanName = matchDecimal[1].trim();
        }

        const prodKey = cleanName.toLowerCase();
        const prodDisplayName = p?.name || cleanName;
        const qty = parseFloat(it.quantity) || 0;
        const unitPrice = parseFloat(it.unit_price) || 0;
        const costPrice = parseFloat(p?.cost_price) || 0;

        if (!prodUnits[prodKey]) prodUnits[prodKey] = { name: prodDisplayName, units: 0 };
        prodUnits[prodKey].units = Math.round((prodUnits[prodKey].units + qty) * 1000) / 1000;

        if (!prodProfit[prodKey]) prodProfit[prodKey] = { name: prodDisplayName, profit: 0 };
        let itemRevenue = unitPrice * qty;
        const discVal = parseFloat(it.discount_value) || 0;
        if (it.discount_type === 'percentage') {
          itemRevenue -= itemRevenue * (discVal / 100);
        } else if (it.discount_type === 'amount') {
          itemRevenue -= discVal;
        }
        const profit = Math.max(0, itemRevenue) - (costPrice * qty);
        prodProfit[prodKey].profit = Math.round((prodProfit[prodKey].profit + profit) * 100) / 100;
      });

      const topProducts = Object.values(prodUnits)
        .filter(p => p.units > 0)
        .sort((a, b) => b.units - a.units)
        .slice(0, 5);

      const topProfitable = Object.values(prodProfit)
        .filter(p => p.profit > 0)
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 5);

      // Ventas por Horario (0 a 23 hs)
      const hourlyData = Array(24).fill(0);
      monthlySales.forEach(s => {
        const d = parseDate(s.created_at);
        if (d) {
          const h = d.getHours();
          if (h >= 0 && h < 24) {
            hourlyData[h]++;
          }
        }
      });

      const debtors = (clients || []).filter(c => (parseFloat(c.balance) || 0) > 0).length;

      return {
        monthlyTotal: Math.round(monthlyTotal * 100) / 100,
        monthlyCount: monthlySales.length,
        invoicedTotal: Math.round(invoicedTotal * 100) / 100,
        yearlyTotal: Math.round(yearlyTotal * 100) / 100,
        yearlyCount: yearlySales.length,
        debtors,
        grossProfit: Math.round(grossProfit * 100) / 100,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        netProfit: Math.round((grossProfit - totalExpenses) * 100) / 100,
        monthlyData,
        topClients,
        topProducts,
        topProfitable,
        hourlyData
      };
    } catch (err) {
      console.error("Error in DB.getStats:", err);
      return this._getEmptyStats(m, y);
    }
  },

  _getEmptyStats(m, y) {
    const now = new Date();
    const cm = (m !== undefined && m !== null && !isNaN(m)) ? parseInt(m) : now.getMonth();
    const cy = (y !== undefined && y !== null && !isNaN(y)) ? parseInt(y) : now.getFullYear();
    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(cy, cm - (11 - i), 1);
      const rawLabel = d.toLocaleString('es', { month: 'short', year: '2-digit' });
      return { label: rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1), total: 0 };
    });
    return {
      monthlyTotal: 0,
      monthlyCount: 0,
      invoicedTotal: 0,
      yearlyTotal: 0,
      yearlyCount: 0,
      debtors: 0,
      grossProfit: 0,
      totalExpenses: 0,
      netProfit: 0,
      monthlyData,
      topClients: [],
      topProducts: [],
      topProfitable: [],
      hourlyData: Array(24).fill(0)
    };
  },

  /* ── ADMIN MODULES (TENANT ENABLEMENT) ── */
  async isModuleEnabled(moduleKey = 'turnos') {
    const adminId = this._adminId();
    if (!adminId) return true;
    try {
      const { data, error } = await this.client.from('admin_modules').select('enabled').eq('admin_id', adminId).eq('module_key', moduleKey).maybeSingle();
      if (error || !data) return true;
      return data.enabled;
    } catch(e) { return true; }
  },

  async setModuleEnabled(adminId, moduleKey, enabled) {
    if (!adminId) return;
    await this.client.from('admin_modules').upsert({ admin_id: adminId, module_key: moduleKey, enabled, updated_at: new Date().toISOString() }, { onConflict: 'admin_id,module_key' });
  },

  /* ── TURNOS SERVICES ── */
  async getTurnosServices() {
    const { data } = await this.client.from('turnos_services').select('*').eq('admin_id', this._adminId()).order('name');
    return data || [];
  },
  async saveTurnosService(s) {
    const obj = { name: s.name, description: s.description || '', duration_minutes: parseInt(s.duration_minutes) || 30, price: parseFloat(s.price) || 0, active: s.active !== false };
    if (s.id) await this.client.from('turnos_services').update(obj).eq('id', s.id).eq('admin_id', this._adminId());
    else await this.client.from('turnos_services').insert({ ...obj, admin_id: this._adminId() });
  },
  async deleteTurnosService(id) {
    await this.client.from('turnos_services').delete().eq('id', id).eq('admin_id', this._adminId());
  },

  /* ── TURNOS PROFESSIONALS ── */
  async getTurnosProfessionals() {
    const { data } = await this.client.from('turnos_professionals').select('*').eq('admin_id', this._adminId()).order('first_name');
    return data || [];
  },
  async saveTurnosProfessional(p) {
    const obj = { first_name: p.first_name, last_name: p.last_name || '', phone: p.phone || '', email: p.email || '', active: p.active !== false };
    let profId = p.id;
    if (p.id) {
      await this.client.from('turnos_professionals').update(obj).eq('id', p.id).eq('admin_id', this._adminId());
    } else {
      const { data } = await this.client.from('turnos_professionals').insert({ ...obj, admin_id: this._adminId() }).select().single();
      if (data) profId = data.id;
    }
    if (profId && Array.isArray(p.service_ids)) {
      await this.saveTurnosProfessionalServices(profId, p.service_ids);
    }
    return profId;
  },
  async deleteTurnosProfessional(id) {
    await this.client.from('turnos_professionals').delete().eq('id', id).eq('admin_id', this._adminId());
  },

  /* ── PROFESSIONAL SERVICES (M:N) ── */
  async getTurnosProfessionalServices(profId) {
    let q = this.client.from('turnos_professional_services').select('*').eq('admin_id', this._adminId());
    if (profId) q = q.eq('professional_id', profId);
    const { data } = await q;
    return data || [];
  },
  async saveTurnosProfessionalServices(profId, serviceIds) {
    await this.client.from('turnos_professional_services').delete().eq('professional_id', profId).eq('admin_id', this._adminId());
    if (serviceIds.length) {
      const rows = serviceIds.map(sId => ({ admin_id: this._adminId(), professional_id: profId, service_id: sId }));
      await this.client.from('turnos_professional_services').insert(rows);
    }
  },

  /* ── TURNOS AVAILABILITY ── */
  async getTurnosAvailability(profId) {
    let q = this.client.from('turnos_availability').select('*').eq('admin_id', this._adminId());
    if (profId) q = q.eq('professional_id', profId);
    const { data } = await q;
    return data || [];
  },
  async saveTurnosAvailability(profId, list) {
    await this.client.from('turnos_availability').delete().eq('professional_id', profId).eq('admin_id', this._adminId());
    if (list.length) {
      const rows = list.map(item => ({
        admin_id: this._adminId(),
        professional_id: profId,
        day_of_week: parseInt(item.day_of_week),
        start_time: item.start_time,
        end_time: item.end_time
      }));
      await this.client.from('turnos_availability').insert(rows);
    }
  },

  /* ── TURNOS LOCKS ── */
  async getTurnosLocks(profId) {
    let q = this.client.from('turnos_locks').select('*').eq('admin_id', this._adminId()).order('start_datetime', { ascending: true });
    if (profId) q = q.eq('professional_id', profId);
    const { data } = await q;
    return data || [];
  },
  async saveTurnosLock(l) {
    const obj = {
      professional_id: l.professional_id || null,
      start_datetime: l.start_datetime,
      end_datetime: l.end_datetime,
      reason: l.reason || 'Bloqueo / Ausencia',
      admin_id: this._adminId()
    };
    if (l.id) await this.client.from('turnos_locks').update(obj).eq('id', l.id).eq('admin_id', this._adminId());
    else await this.client.from('turnos_locks').insert(obj);
  },
  async deleteTurnosLock(id) {
    await this.client.from('turnos_locks').delete().eq('id', id).eq('admin_id', this._adminId());
  },

  /* ── TURNOS SETTINGS ── */
  async getTurnosSettings() {
    const { data } = await this.client.from('turnos_settings').select('*').eq('admin_id', this._adminId()).maybeSingle();
    return data || {
      buffer_minutes: 10,
      min_lead_hours: 2,
      max_advance_days: 30,
      cancellation_policy: 'Cancelación permitida hasta 2 horas antes.'
    };
  },
  async saveTurnosSettings(s) {
    const obj = {
      admin_id: this._adminId(),
      buffer_minutes: parseInt(s.buffer_minutes) || 10,
      min_lead_hours: parseInt(s.min_lead_hours) || 2,
      max_advance_days: parseInt(s.max_advance_days) || 30,
      cancellation_policy: s.cancellation_policy || '',
      updated_at: new Date().toISOString()
    };
    await this.client.from('turnos_settings').upsert(obj, { onConflict: 'admin_id' });
  },

  /* ── TURNOS APPOINTMENTS ── */
  async getAppointments(filters = {}) {
    let q = this.client.from('turnos_appointments').select('*').eq('admin_id', this._adminId()).order('start_datetime', { ascending: true });
    if (filters.client_id) q = q.eq('client_id', filters.client_id);
    if (filters.professional_id) q = q.eq('professional_id', filters.professional_id);
    if (filters.service_id) q = q.eq('service_id', filters.service_id);
    if (filters.status) q = q.eq('status', filters.status);
    if (filters.start_date) q = q.gte('start_datetime', filters.start_date);
    if (filters.end_date) q = q.lte('start_datetime', filters.end_date);
    const { data } = await q;
    return data || [];
  },

  async saveAppointment(appt) {
    const enabled = await this.isModuleEnabled('turnos');
    if (!enabled) throw new Error("El módulo de turnos no está habilitado para su cuenta.");

    const obj = {
      admin_id: this._adminId(),
      client_id: appt.client_id || null,
      client_name: appt.client_name,
      client_phone: appt.client_phone || '',
      service_id: appt.service_id || null,
      service_name: appt.service_name,
      professional_id: appt.professional_id || null,
      professional_name: appt.professional_name,
      start_datetime: appt.start_datetime,
      end_datetime: appt.end_datetime,
      duration_minutes: parseInt(appt.duration_minutes) || 30,
      price: parseFloat(appt.price) || 0,
      status: appt.status || 'pendiente',
      notes: appt.notes || '',
      updated_at: new Date().toISOString()
    };

    let result;
    if (appt.id) {
      const { data, error } = await this.client.from('turnos_appointments').update(obj).eq('id', appt.id).eq('admin_id', this._adminId()).select().single();
      if (error) throw error;
      result = data;
      await this.logTurnosAudit('EDITAR_TURNO', 'turnos_appointments', result.id, `Turno actualizado para ${result.client_name}`);
    } else {
      const { data, error } = await this.client.from('turnos_appointments').insert(obj).select().single();
      if (error) throw error;
      result = data;
      await this.logTurnosAudit('CREAR_TURNO', 'turnos_appointments', result.id, `Turno creado para ${result.client_name}`);
      await this._createReminderStub(result.id, result.start_datetime);
    }
    return result;
  },

  async rescheduleAppointment(id, newStartIso, newEndIso, newProfId, newProfName, notes = '') {
    const oldAppt = (await this.getAppointments()).find(a => a.id === id);
    if (!oldAppt) throw new Error("Turno no encontrado");

    const updateObj = {
      start_datetime: newStartIso,
      end_datetime: newEndIso,
      status: 'reprogramado',
      notes: notes ? `${oldAppt.notes || ''}\n[Reprogramado: ${notes}]` : oldAppt.notes,
      updated_at: new Date().toISOString()
    };
    if (newProfId) {
      updateObj.professional_id = newProfId;
      updateObj.professional_name = newProfName || oldAppt.professional_name;
    }

    const { data, error } = await this.client.from('turnos_appointments').update(updateObj).eq('id', id).eq('admin_id', this._adminId()).select().single();
    if (error) throw error;

    await this.logTurnosAudit('REPROGRAMAR_TURNO', 'turnos_appointments', id, `Turno reprogramado a ${newStartIso}`);
    return data;
  },

  async cancelAppointment(id, reason, cancelledBy = 'admin') {
    const obj = {
      status: 'cancelado',
      cancellation_reason: reason || 'Sin motivo especificado',
      cancelled_at: new Date().toISOString(),
      cancelled_by: cancelledBy,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await this.client.from('turnos_appointments').update(obj).eq('id', id).eq('admin_id', this._adminId()).select().single();
    if (error) throw error;
    await this.logTurnosAudit('CANCELAR_TURNO', 'turnos_appointments', id, `Turno cancelado por ${cancelledBy}: ${reason}`);
    return data;
  },

  async updateAppointmentStatus(id, status) {
    // Normalizar status para respetar la restricción CHECK de la base de datos ('atendido' en lugar de 'completado')
    const dbStatus = (status === 'completado') ? 'atendido' : status;
    const obj = { status: dbStatus, updated_at: new Date().toISOString() };
    const { data, error } = await this.client.from('turnos_appointments').update(obj).eq('id', id).eq('admin_id', this._adminId()).select().single();
    if (error) throw error;
    await this.logTurnosAudit('CAMBIO_ESTADO_TURNO', 'turnos_appointments', id, `Estado cambiado a ${dbStatus}`);
    return data;
  },

  async completeAppointmentAndCreateSale(id, paymentType = 'efectivo') {
    const appts = await this.getAppointments();
    const appt = appts.find(a => a.id === id);
    if (!appt) throw new Error("Turno no encontrado");

    // 1. Actualizar estado a 'atendido'
    const updatedAppt = await this.updateAppointmentStatus(id, 'atendido');

    // 2. Registrar venta oficial si el precio es mayor a 0
    const price = parseFloat(appt.price) || 0;
    let saleId = null;
    if (price > 0) {
      const saleCart = [{
        productId: null, // Es un servicio, no descuenta stock físico
        productName: `${appt.service_name || 'Servicio'} (${appt.professional_name || 'Turno'})`,
        unitPrice: price,
        quantity: 1,
        unit: 'Servicio',
        discountType: 'none',
        discountValue: 0
      }];

      saleId = await this.saveSale({
        total: price,
        paymentType: paymentType,
        clientId: appt.client_id || null,
        clientName: appt.client_name || 'Cliente Turno',
        invoiced: false
      }, saleCart);
    }

    await this.logTurnosAudit('COMPLETAR_TURNO', 'turnos_appointments', id, `Turno completado y venta registrada ($${price})`);
    return { appointment: updatedAppt, saleId };
  },

  /* ── AUDIT LOGS & REMINDERS ── */
  async logTurnosAudit(action, entityName, entityId, details) {
    try {
      await this.client.from('turnos_audit').insert({
        admin_id: this._adminId(),
        user_name: Auth.getSession()?.user || 'admin',
        action, entity_name: entityName, entity_id: entityId, details,
        created_at: new Date().toISOString()
      });
    } catch(e) {}
  },

  async getTurnosAudit() {
    const { data } = await this.client.from('turnos_audit').select('*').eq('admin_id', this._adminId()).order('created_at', { ascending: false }).limit(100);
    return data || [];
  },

  async _createReminderStub(apptId, startIso) {
    try {
      const scheduledAt = new Date(new Date(startIso).getTime() - 24 * 60 * 60 * 1000).toISOString();
      await this.client.from('appointment_reminders').insert({
        admin_id: this._adminId(),
        appointment_id: apptId,
        channel: 'whatsapp',
        scheduled_at: scheduledAt,
        status: 'pending'
      });
    } catch(e) {}
  },

  /* ── MÓDULO DE ENCARGOS / PEDIDOS PROGRAMADOS ── */
  async getCustomOrders(statusFilter = '') {
    try {
      let q = this.client
        .from('custom_orders')
        .select(`
          *,
          custom_order_items (*)
        `)
        .eq('admin_id', this._adminId())
        .order('delivery_datetime', { ascending: true });

      if (statusFilter && statusFilter !== 'todos') {
        if (statusFilter === 'activos') {
          q = q.in('status', ['pendiente', 'en_preparacion']);
        } else {
          q = q.eq('status', statusFilter);
        }
      }

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("Error al obtener encargos:", err);
      return [];
    }
  },

  async getCustomOrderById(id) {
    try {
      const { data, error } = await this.client
        .from('custom_orders')
        .select(`
          *,
          custom_order_items (*)
        `)
        .eq('id', id)
        .eq('admin_id', this._adminId())
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      console.error("Error al obtener detalle del encargo:", err);
      return null;
    }
  },

  async saveCustomOrder(orderData, items = []) {
    const isNew = !orderData.id;
    const totalAmount = items.reduce((sum, it) => sum + (parseFloat(it.unit_price || it.unitPrice || 0) * parseFloat(it.quantity || 1)), 0);
    const depositAmount = parseFloat(orderData.deposit_amount || orderData.depositAmount || 0);
    const remainingAmount = Math.max(0, totalAmount - depositAmount);

    const payload = {
      admin_id: this._adminId(),
      client_id: orderData.client_id || orderData.clientId || null,
      client_name: orderData.client_name || orderData.clientName,
      client_phone: orderData.client_phone || orderData.clientPhone || '',
      client_address: orderData.client_address || orderData.clientAddress || '',
      delivery_datetime: orderData.delivery_datetime || orderData.deliveryDatetime,
      alert_lead_minutes: parseInt(orderData.alert_lead_minutes || orderData.alertLeadMinutes || 60),
      status: orderData.status || 'pendiente',
      total_amount: totalAmount,
      deposit_amount: depositAmount,
      deposit_payment_type: orderData.deposit_payment_type || orderData.depositPaymentType || 'efectivo',
      remaining_amount: remainingAmount,
      notes: orderData.notes || ''
    };

    let savedOrder;
    if (isNew) {
      const { data, error } = await this.client.from('custom_orders').insert(payload).select().single();
      if (error) throw error;
      savedOrder = data;

      // Si hubo seña en efectivo, registrar ingreso en caja
      if (depositAmount > 0 && payload.deposit_payment_type === 'efectivo') {
        await this.saveCashMovement({
          amount: depositAmount,
          type: 'venta',
          reason: `Seña Encargo #${savedOrder.order_number || ''} (${savedOrder.client_name})`
        });
      }
    } else {
      const { data, error } = await this.client.from('custom_orders').update(payload).eq('id', orderData.id).eq('admin_id', this._adminId()).select().single();
      if (error) throw error;
      savedOrder = data;

      // Eliminar ítems previos para reinsertar
      await this.client.from('custom_order_items').delete().eq('order_id', orderData.id).eq('admin_id', this._adminId());
    }

    // Insertar ítems del encargo
    if (items.length > 0) {
      const itemsPayload = items.map(it => ({
        admin_id: this._adminId(),
        order_id: savedOrder.id,
        product_id: it.product_id || it.productId || null,
        product_name: it.product_name || it.productName || it.name,
        unit_price: parseFloat(it.unit_price || it.unitPrice || 0),
        quantity: parseFloat(it.quantity || 1),
        subtotal: parseFloat(it.unit_price || it.unitPrice || 0) * parseFloat(it.quantity || 1)
      }));
      const { error: itemsErr } = await this.client.from('custom_order_items').insert(itemsPayload);
      if (itemsErr) console.error("Error al insertar ítems de encargo:", itemsErr);
    }

    return savedOrder;
  },

  async completeCustomOrder(orderId, remainingPaymentType = 'efectivo') {
    const order = await this.getCustomOrderById(orderId);
    if (!order) throw new Error("El encargo no existe.");
    if (order.status === 'completado') throw new Error("El encargo ya fue completado.");

    const items = order.custom_order_items || [];

    // Formatear ítems para saveSale (saveSale descuenta el stock automáticamente y registra la venta)
    const saleCart = items.map(it => ({
      productId: it.product_id,
      productName: it.product_name,
      unitPrice: parseFloat(it.unit_price) || 0,
      quantity: parseFloat(it.quantity) || 1,
      unit: 'Unidades',
      discountType: 'none',
      discountValue: 0
    }));

    // Registrar venta oficial en 'sales' y descontar inventario
    const saleId = await this.saveSale({
      total: parseFloat(order.total_amount) || 0,
      paymentType: remainingPaymentType,
      clientId: order.client_id,
      clientName: order.client_name,
      invoiced: false
    }, saleCart);

    // Marcar encargo como completado
    const { data: completedOrder, error } = await this.client
      .from('custom_orders')
      .update({
        status: 'completado',
        completed_at: new Date().toISOString(),
        sale_id: saleId || null
      })
      .eq('id', orderId)
      .eq('admin_id', this._adminId())
      .select()
      .single();

    if (error) throw error;
    return completedOrder;
  },

  async cancelCustomOrder(orderId) {
    const { data, error } = await this.client
      .from('custom_orders')
      .update({ status: 'cancelado' })
      .eq('id', orderId)
      .eq('admin_id', this._adminId())
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getCustomOrderAlerts() {
    try {
      const orders = await this.getCustomOrders('activos');
      const now = Date.now();
      return orders.filter(o => {
        const deliveryTime = new Date(o.delivery_datetime).getTime();
        const alertThreshold = deliveryTime - (o.alert_lead_minutes * 60 * 1000);
        return now >= alertThreshold;
      });
    } catch(e) {
      return [];
    }
  }

};
