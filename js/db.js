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
    const { count } = await this.client.from('products').select('*', { count: 'exact', head: true }).eq('category_id', id).eq('admin_id', this._adminId());
    if (count > 0) return false;
    await this.client.from('categories').delete().eq('id', id).eq('admin_id', this._adminId());
    return true;
  },

  /* ── PRODUCTS ── */
  async getProducts() {
    const { data } = await this.client.from('products').select('*').eq('admin_id', this._adminId()).order('name');
    return data || [];
  },
  async saveProduct(p) {
    const obj = { name: p.name, category_id: p.categoryId || null, sell_price: p.sellPrice, cost_price: p.costPrice, stock: p.stock, unit: p.unit };
    if (p.id) await this.client.from('products').update(obj).eq('id', p.id).eq('admin_id', this._adminId());
    else await this.client.from('products').insert({ ...obj, admin_id: this._adminId() });
  },
  async deleteProduct(id) { await this.client.from('products').delete().eq('id', id).eq('admin_id', this._adminId()); },
  async adjustStock(id, delta) {
    const { data } = await this.client.from('products').select('stock').eq('id', id).eq('admin_id', this._adminId()).single();
    if (data) await this.client.from('products').update({ stock: data.stock + delta }).eq('id', id).eq('admin_id', this._adminId());
  },

  /* ── CLIENTS ── */
  async getClients() {
    const { data } = await this.client.from('clients').select('*').eq('admin_id', this._adminId()).order('name');
    return data || [];
  },
  async saveClient(c) {
    const obj = { name: c.name, phone: c.phone, email: c.email, balance: c.balance || 0, dni: c.dni || null, address: c.address || null };
    if (c.id) await this.client.from('clients').update(obj).eq('id', c.id).eq('admin_id', this._adminId());
    else await this.client.from('clients').insert({ ...obj, admin_id: this._adminId() });
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
      sale_id: saleId, product_id: it.productId, product_name: it.productName,
      quantity: it.quantity, unit_price: it.unitPrice, 
      discount_type: it.discountType || 'none', discount_value: it.discountValue || 0,
      admin_id: this._adminId()
    }));
    await this.client.from('sale_items').insert(itemsToInsert);

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
    const { data: sale } = await this.client.from('sales').select('*').eq('id', saleId).eq('admin_id', this._adminId()).single();
    if (!sale || sale.voided) return false;

    const items = await this.getSaleItems(saleId);
    for (const it of items) { if (it.product_id) await this.adjustStock(it.product_id, it.quantity); }

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
    const obj = { name: s.name, stock: s.stock, unit: s.unit };
    if (s.id) await this.client.from('supplies').update(obj).eq('id', s.id).eq('admin_id', this._adminId());
    else await this.client.from('supplies').insert({ ...obj, admin_id: this._adminId() });
  },
  async deleteSupply(id) { await this.client.from('supplies').delete().eq('id', id).eq('admin_id', this._adminId()); },
  async adjustSupplyStock(id, delta) {
    const { data } = await this.client.from('supplies').select('stock').eq('id', id).eq('admin_id', this._adminId()).single();
    if (data) await this.client.from('supplies').update({ stock: (data.stock || 0) + delta }).eq('id', id).eq('admin_id', this._adminId());
  },
  async getDeductions() {
    const { data } = await this.client.from('supply_deductions').select('*').eq('admin_id', this._adminId()).order('created_at', { ascending: false });
    return data || [];
  },
  async saveDeduction(ded) {
    await this.client.from('supply_deductions').insert({
      supply_id: ded.productId, supply_name: ded.productName, quantity: ded.quantity,
      reason: ded.reason, admin_id: this._adminId()
    });
    await this.adjustSupplyStock(ded.productId, -ded.quantity);
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
    const now = new Date();
    const cm = m ?? now.getMonth(), cy = y ?? now.getFullYear();
    const aid = this._adminId();

    const { data: sales }    = await this.client.from('sales').select('*').eq('admin_id', aid).eq('voided', false);
    const { data: items }    = await this.client.from('sale_items').select('*').eq('admin_id', aid);
    const { data: prods }    = await this.client.from('products').select('*').eq('admin_id', aid);
    const { data: expenses } = await this.client.from('expenses').select('*').eq('admin_id', aid);
    const { data: clients }  = await this.client.from('clients').select('*').eq('admin_id', aid);

    const monthlySales    = (sales || []).filter(s => { const d = new Date(s.created_at); return d.getMonth() === cm && d.getFullYear() === cy; });
    const yearlySales     = (sales || []).filter(s => new Date(s.created_at).getFullYear() === cy);
    const monthlyExpenses = (expenses || []).filter(e => { const d = new Date(e.date); return d.getMonth() === cm && d.getFullYear() === cy; });

    let grossProfit = 0;
    monthlySales.forEach(s => {
      const saleItems = (items || []).filter(i => i.sale_id === s.id);
      saleItems.forEach(it => {
        const p = (prods || []).find(p => p.id === it.product_id);
        const cost = p ? p.cost_price : 0;
        
        let subtotal = (parseFloat(it.unit_price) || 0) * it.quantity;
        if (it.discount_type === 'percentage') {
            subtotal -= subtotal * ((parseFloat(it.discount_value) || 0) / 100);
        } else if (it.discount_type === 'amount') {
            subtotal -= (parseFloat(it.discount_value) || 0);
        }
        
        grossProfit += Math.max(0, subtotal) - (cost * it.quantity);
      });
    });
    const totalExpenses = monthlyExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    const invoicedTotal = monthlySales.filter(s => s.invoiced).reduce((sum, s) => sum + parseFloat(s.total), 0);

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
      invoicedTotal,
      yearlyTotal:  yearlySales.reduce((s, v) => s + parseFloat(v.total), 0),
      yearlyCount:  yearlySales.length,
      debtors: (clients || []).filter(c => parseFloat(c.balance) > 0).length,
      grossProfit, totalExpenses, netProfit: grossProfit - totalExpenses,
      monthlyData, topClients,
      topProducts:  Object.values(prodUnits).sort((a,b) => b.units - a.units).slice(0,5),
      topProfitable: Object.values(prodProfit).sort((a,b) => b.profit - a.profit).slice(0,5),
      hourlyData: monthlySales.reduce((acc, s) => {
        const h = new Date(s.created_at).getHours();
        acc[h]++;
        return acc;
      }, Array(24).fill(0))
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
    const obj = { status, updated_at: new Date().toISOString() };
    const { data, error } = await this.client.from('turnos_appointments').update(obj).eq('id', id).eq('admin_id', this._adminId()).select().single();
    if (error) throw error;
    await this.logTurnosAudit('CAMBIO_ESTADO_TURNO', 'turnos_appointments', id, `Estado cambiado a ${status}`);
    return data;
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
  }

};
