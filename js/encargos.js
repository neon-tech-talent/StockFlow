const EncargosModule = {
    _activeFilter: 'todos',
    _searchQuery: '',
    _orders: [],
    _cart: [],
    _selectedClientId: null,
    _selectedClientName: null,
    _allProducts: [],
    _selectedProduct: null,
    _filteredProducts: [],
    _highlightedIndex: -1,

    async render(el) {
        this._orders = await DB.getCustomOrders();
        
        el.innerHTML = `
      <div class="module-header" style="margin-bottom:1.25rem;">
        <div>
          <h2 class="card-title" style="margin:0; font-size:1.1rem;">📦 Gestión de Encargos / Pedidos Programados</h2>
          <small class="text-muted">Toma de pedidos por adelantado, preparación y despacho en 1 clic</small>
        </div>
        <div class="btn-row">
          <button class="btn btn-outline" onclick="EncargosModule.render(document.getElementById('content'))">🔄 Actualizar</button>
          <button class="btn btn-primary" onclick="EncargosModule.openNewOrderModal()">➕ Nuevo Encargo</button>
        </div>
      </div>

      <!-- Métricas / Semáforo Header -->
      <div class="kpi-row" style="margin-bottom:1.25rem;">
        <div class="kpi-card" style="border-left: 4px solid var(--accent); cursor:pointer;" onclick="EncargosModule.setFilter('hoy')">
          <div class="kpi-header">
            <span class="kpi-label">Para Hoy</span>
            <span class="kpi-icon">⚡</span>
          </div>
          <div class="kpi-body">
            <div class="kpi-value" id="kpi-hoy">0</div>
          </div>
        </div>
        <div class="kpi-card" style="border-left: 4px solid var(--amber); cursor:pointer;" onclick="EncargosModule.setFilter('alerta')">
          <div class="kpi-header">
            <span class="kpi-label">En Alerta / Próximos</span>
            <span class="kpi-icon">🟡</span>
          </div>
          <div class="kpi-body">
            <div class="kpi-value" id="kpi-alerta">0</div>
          </div>
        </div>
        <div class="kpi-card" style="border-left: 4px solid var(--red); cursor:pointer;" onclick="EncargosModule.setFilter('demorado')">
          <div class="kpi-header">
            <span class="kpi-label">Demorados / Vencidos</span>
            <span class="kpi-icon">🔴</span>
          </div>
          <div class="kpi-body">
            <div class="kpi-value" id="kpi-demorados">0</div>
          </div>
        </div>
        <div class="kpi-card" style="border-left: 4px solid var(--green); cursor:pointer;" onclick="EncargosModule.setFilter('completado')">
          <div class="kpi-header">
            <span class="kpi-label">Completados</span>
            <span class="kpi-icon">✅</span>
          </div>
          <div class="kpi-body">
            <div class="kpi-value" id="kpi-completados">0</div>
          </div>
        </div>
      </div>

      <!-- Filtros y Buscador -->
      <div class="card" style="margin-bottom:1.25rem; padding:1.1rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; flex-wrap:wrap;">
          <div class="tabs-header" style="margin:0; padding:0; border:none; gap:0.4rem;">
            <button class="tab-btn ${this._activeFilter === 'todos' ? 'active' : ''}" onclick="EncargosModule.setFilter('todos')">Todos</button>
            <button class="tab-btn ${this._activeFilter === 'hoy' ? 'active' : ''}" onclick="EncargosModule.setFilter('hoy')">⚡ Para Hoy</button>
            <button class="tab-btn ${this._activeFilter === 'alerta' ? 'active' : ''}" onclick="EncargosModule.setFilter('alerta')">🟡 En Alerta</button>
            <button class="tab-btn ${this._activeFilter === 'demorado' ? 'active' : ''}" onclick="EncargosModule.setFilter('demorado')">🔴 Demorados</button>
            <button class="tab-btn ${this._activeFilter === 'pendiente' ? 'active' : ''}" onclick="EncargosModule.setFilter('pendiente')">⏳ Pendientes</button>
            <button class="tab-btn ${this._activeFilter === 'completado' ? 'active' : ''}" onclick="EncargosModule.setFilter('completado')">✅ Entregados</button>
            <button class="tab-btn ${this._activeFilter === 'cancelado' ? 'active' : ''}" onclick="EncargosModule.setFilter('cancelado')">❌ Cancelados</button>
          </div>
          <div style="flex:1; min-width:240px;">
            <input id="enc-search" type="text" placeholder="Buscar por cliente, teléfono o producto..." class="form-input" style="padding:0.55rem 0.85rem;" value="${Utils.escHtml(this._searchQuery)}">
          </div>
        </div>
      </div>

      <!-- Contenedor del Tablero / Lista de Encargos -->
      <div id="encargos-grid" class="encargos-grid"></div>`;

        this._updateKpis();
        this._renderGrid();

        document.getElementById('enc-search').oninput = (e) => {
            this._searchQuery = e.target.value.toLowerCase();
            this._renderGrid();
        };

        if (typeof Utils !== 'undefined' && typeof Utils.animateStagger === 'function') {
            Utils.animateStagger('.encargo-card', 35);
        }
    },

    setFilter(filter) {
        this._activeFilter = filter;
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('onclick')?.includes(`'${filter}'`));
        });
        this._renderGrid();
    },

    _updateKpis() {
        const now = Date.now();
        const todayStr = Utils.todayStr();

        let hoyCount = 0;
        let alertaCount = 0;
        let demoradosCount = 0;
        let completadosCount = 0;

        this._orders.forEach(o => {
            if (o.status === 'completado') {
                completadosCount++;
                return;
            }
            if (o.status === 'cancelado') return;

            const dTime = new Date(o.delivery_datetime).getTime();
            const dDateStr = Utils.toArgentinaDateStr(o.delivery_datetime);
            const alertThreshold = dTime - (o.alert_lead_minutes * 60 * 1000);

            if (dDateStr === todayStr) hoyCount++;
            if (now > dTime) demoradosCount++;
            else if (now >= alertThreshold) alertaCount++;
        });

        const elHoy = document.getElementById('kpi-hoy');
        const elAlerta = document.getElementById('kpi-alerta');
        const elDemorados = document.getElementById('kpi-demorados');
        const elCompletados = document.getElementById('kpi-completados');

        if (elHoy) elHoy.textContent = hoyCount;
        if (elAlerta) elAlerta.textContent = alertaCount;
        if (elDemorados) elDemorados.textContent = demoradosCount;
        if (elCompletados) elCompletados.textContent = completadosCount;
    },

    _renderGrid() {
        const grid = document.getElementById('encargos-grid');
        if (!grid) return;

        const now = Date.now();
        const todayStr = Utils.todayStr();

        let filtered = this._orders.filter(o => {
            const dTime = new Date(o.delivery_datetime).getTime();
            const dDateStr = Utils.toArgentinaDateStr(o.delivery_datetime);
            const alertThreshold = dTime - (o.alert_lead_minutes * 60 * 1000);

            // Filtro por Tab
            if (this._activeFilter === 'hoy' && (dDateStr !== todayStr || o.status === 'cancelado')) return false;
            if (this._activeFilter === 'alerta' && (now < alertThreshold || now > dTime || o.status !== 'pendiente' && o.status !== 'en_preparacion')) return false;
            if (this._activeFilter === 'demorado' && (now <= dTime || o.status !== 'pendiente' && o.status !== 'en_preparacion')) return false;
            if (this._activeFilter === 'pendiente' && (o.status !== 'pendiente' && o.status !== 'en_preparacion')) return false;
            if (this._activeFilter === 'completado' && o.status !== 'completado') return false;
            if (this._activeFilter === 'cancelado' && o.status !== 'cancelado') return false;

            // Filtro por Buscador
            if (this._searchQuery) {
                const matchClient = (o.client_name || '').toLowerCase().includes(this._searchQuery);
                const matchPhone = (o.client_phone || '').toLowerCase().includes(this._searchQuery);
                const matchAddress = (o.client_address || '').toLowerCase().includes(this._searchQuery);
                const matchItems = (o.custom_order_items || []).some(it => it.product_name.toLowerCase().includes(this._searchQuery));
                if (!matchClient && !matchPhone && !matchAddress && !matchItems) return false;
            }

            return true;
        });

        if (!filtered.length) {
            grid.innerHTML = Utils.emptyState('📦', 'No hay encargos en esta categoría', 'Puedes crear un nuevo encargo con el botón superior');
            return;
        }

        grid.innerHTML = `<div class="orders-cards-container">${filtered.map(o => this._renderOrderCard(o, now)).join('')}</div>`;
    },

    _renderOrderCard(o, now) {
        const dTime = new Date(o.delivery_datetime).getTime();
        const alertThreshold = dTime - (o.alert_lead_minutes * 60 * 1000);
        const isCompleted = o.status === 'completado';
        const isCancelled = o.status === 'cancelado';

        let badgeClass = 'badge-ontime';
        let badgeLabel = '🟢 A Tiempo';
        let borderClass = 'order-ontime';

        if (isCompleted) {
            badgeClass = 'badge-success';
            badgeLabel = '✅ Entregado';
            borderClass = 'order-completed';
        } else if (isCancelled) {
            badgeClass = 'badge-danger';
            badgeLabel = '❌ Cancelado';
            borderClass = 'order-cancelled';
        } else if (now > dTime) {
            badgeClass = 'badge-danger';
            badgeLabel = '🔴 Demorado';
            borderClass = 'order-overdue';
        } else if (now >= alertThreshold) {
            badgeClass = 'badge-warning';
            badgeLabel = '🟡 Próximo / En Alerta';
            borderClass = 'order-warning';
        }

        const dateFormatted = new Date(o.delivery_datetime).toLocaleString('es-AR', {
            weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        });

        const items = o.custom_order_items || [];
        const itemsHtml = items.map(it => `
          <div class="order-item-row">
            <span><strong>${it.quantity}x</strong> ${Utils.escHtml(it.product_name)}</span>
            <span style="color:var(--text-muted); font-size:0.85rem;">${Utils.currency(it.subtotal)}</span>
          </div>
        `).join('');

        const deposit = parseFloat(o.deposit_amount) || 0;
        const remaining = parseFloat(o.remaining_amount) || 0;
        const total = parseFloat(o.total_amount) || 0;

        const phoneClean = (o.client_phone || '').replace(/\D/g, '');
        const waLink = phoneClean ? `https://wa.me/${phoneClean.startsWith('54') ? phoneClean : '54' + phoneClean}?text=${encodeURIComponent(`¡Hola ${o.client_name}! Te escribimos de FlowStock por tu encargo #${o.order_number || ''}.`)}` : null;

        return `
      <div class="card encargo-card ${borderClass}">
        <!-- Cabecera de Tarjeta -->
        <div class="encargo-card-header">
          <div>
            <span class="badge ${badgeClass}" style="margin-bottom:0.35rem;">${badgeLabel}</span>
            <h3 style="font-size:1.15rem; color:var(--text-main); font-weight:700; margin:0;">
              Encargo #${o.order_number || ''} — ${Utils.escHtml(o.client_name)}
            </h3>
          </div>
          <div style="text-align:right;">
            <div style="font-size:0.95rem; font-weight:700; color:var(--accent);">${dateFormatted}</div>
            <small class="text-muted" style="font-size:0.75rem;">Aviso: ${o.alert_lead_minutes} min antes</small>
          </div>
        </div>

        <!-- Contacto & Entrega -->
        <div class="encargo-meta-row">
          ${o.client_phone ? `
            <div style="display:flex; align-items:center; gap:0.4rem;">
              <span>📞 ${Utils.escHtml(o.client_phone)}</span>
              ${waLink ? `<a href="${waLink}" target="_blank" class="btn-sm btn-outline" style="padding:2px 6px; font-size:0.75rem; text-decoration:none; color:#25d366; border-color:rgba(37,211,102,0.3);">💬 WhatsApp</a>` : ''}
            </div>` : ''}
          ${o.client_address ? `<div>📍 <span>${Utils.escHtml(o.client_address)}</span></div>` : '<div>🏪 <span>Retiro en local</span></div>'}
        </div>

        <!-- Detalle de Productos -->
        <div class="encargo-items-box">
          <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); margin-bottom:0.4rem; letter-spacing:0.05em;">
            Productos Encargados (${items.length}):
          </div>
          ${itemsHtml || '<span class="text-muted" style="font-size:0.85rem;">Sin productos especificados</span>'}
        </div>

        <!-- Notas del Cliente -->
        ${o.notes ? `
          <div class="encargo-notes-box">
            <span>💬 <strong>Nota:</strong> ${Utils.escHtml(o.notes)}</span>
          </div>` : ''}

        <!-- Resumen Financiero -->
        <div class="encargo-finance-row">
          <div>Total: <strong style="color:var(--text-main); font-size:1.05rem;">${Utils.currency(total)}</strong></div>
          ${deposit > 0 ? `<div>Seña: <span class="text-success">${Utils.currency(deposit)} (${Utils.escHtml(o.deposit_payment_type)})</span></div>` : ''}
          <div>Saldo: <strong style="color:${remaining > 0 ? 'var(--accent)' : 'var(--green)'}; font-size:1.1rem;">${Utils.currency(remaining)}</strong></div>
        </div>

        <!-- Barra de Acciones -->
        <div class="encargo-actions-bar">
          <button class="btn btn-sm btn-outline" onclick="EncargosModule.openPreparationSheetModal('${o.id}')" title="Ver e imprimir comanda de armado">📄 Comanda</button>
          ${!isCompleted && !isCancelled ? `
            <button class="btn btn-sm btn-outline" onclick="EncargosModule.openNewOrderModal('${o.id}')" title="Editar pedido">✏️</button>
            <button class="btn btn-sm btn-outline" style="color:var(--red); border-color:rgba(244,63,94,0.3);" onclick="EncargosModule.confirmCancelOrder('${o.id}')" title="Cancelar encargo">✕</button>
            <button class="btn btn-primary" style="flex:1; justify-content:center;" onclick="EncargosModule.openDeliverModal('${o.id}')">
              🚀 ENTREGAR Y COBRAR
            </button>
          ` : ''}
        </div>
      </div>`;
    },

    /* ── MODAL: NUEVO / EDITAR ENCARGO ── */
    async openNewOrderModal(orderId = null) {
        this._cart = [];
        this._selectedClientId = null;
        this._selectedClientName = null;
        this._selectedProduct = null;
        this._highlightedIndex = -1;

        const allProducts = await DB.getProducts();
        this._allProducts = allProducts || [];
        this._filteredProducts = [...this._allProducts];
        const clients = await DB.getClients();
        let existingOrder = null;

        if (orderId) {
            existingOrder = await DB.getCustomOrderById(orderId);
            if (existingOrder) {
                this._selectedClientId = existingOrder.client_id;
                this._selectedClientName = existingOrder.client_name;
                this._cart = (existingOrder.custom_order_items || []).map(it => ({
                    productId: it.product_id,
                    productName: it.product_name,
                    unitPrice: it.unit_price,
                    quantity: it.quantity,
                    subtotal: it.subtotal
                }));
            }
        }

        // Fecha por defecto: Hoy + 2 horas
        const defaultDate = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16);
        const orderDate = existingOrder ? new Date(existingOrder.delivery_datetime).toISOString().slice(0, 16) : defaultDate;

        Modal.open(`
      <h2 class="modal-title">${orderId ? '✏️ Editar Encargo' : '➕ Nuevo Encargo Programado'}</h2>
      <form onsubmit="EncargosModule.saveOrder(event, '${orderId || ''}')">
        
        <!-- Sección 1: Cliente -->
        <div class="card" style="margin-bottom:1.1rem; padding:1.1rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
            <h4 class="card-title" style="margin:0;">👤 Datos del Cliente</h4>
            <button type="button" class="btn btn-sm btn-outline" onclick="EncargosModule.prepareNewClientFields()" style="font-size:0.75rem; padding:0.2rem 0.55rem; color:var(--accent); border-color:var(--accent);">➕ + Cargar Nuevo Cliente</button>
          </div>

          <div class="form-group" style="margin-bottom:0.75rem;">
            <label style="font-size:0.8rem; font-weight:700;">Buscar / Seleccionar Cliente Existente</label>
            <select id="no-client-select" class="form-input" style="font-size:0.9rem;" onchange="EncargosModule.onClientSelect(this)">
              <option value="">-- Seleccionar de la lista de Clientes o completar abajo --</option>
              <option value="__new__" style="color:var(--accent); font-weight:700;">➕ + Cargar Nuevo Cliente (Escribir datos abajo)</option>
              ${clients.map(c => `
                <option value="${c.id}" 
                        data-name="${Utils.escHtml(c.name)}" 
                        data-phone="${Utils.escHtml(c.phone || '')}" 
                        data-notes="${Utils.escHtml(c.notes || '')}"
                        ${existingOrder?.client_id === c.id ? 'selected' : ''}>
                  ${Utils.escHtml(c.name)} ${c.phone ? `(${Utils.escHtml(c.phone)})` : ''}
                </option>`).join('')}
            </select>
          </div>

          <div class="form-row">
            <div class="form-group" style="margin:0;">
              <label>Nombre del Cliente *</label>
              <input id="no-client-name" name="client_name" class="form-input" required value="${Utils.escHtml(existingOrder?.client_name || '')}" placeholder="Nombre completo" oninput="this.value = this.value.replace(/[0-9]/g, ''); EncargosModule.onClientTyped()">
            </div>
            <div class="form-group" style="margin:0;">
              <label>Teléfono / WhatsApp</label>
              <input id="no-client-phone" name="client_phone" class="form-input" value="${Utils.escHtml(existingOrder?.client_phone || '')}" placeholder="Ej: 11 2345-6789" oninput="this.value = this.value.replace(/[^0-9+\-\s()]/g, '')">
            </div>
          </div>
          <div class="form-group" style="margin-top:0.75rem; margin-bottom:0.5rem;">
            <label>Dirección de Entrega (Opcional si es retiro)</label>
            <input id="no-client-address" name="client_address" class="form-input" value="${Utils.escHtml(existingOrder?.client_address || '')}" placeholder="Ej: Av. San Martín 1234, Dpto 2B">
          </div>
          <div style="display:flex; align-items:center; gap:0.4rem; font-size:0.78rem; color:var(--text-muted); padding-top:0.25rem;">
            <span>💡</span>
            <span>Si ingresas un cliente nuevo, se registrará automáticamente en tu base de datos de Clientes.</span>
          </div>
        </div>

        <!-- Sección 2: Productos Encargados con Buscador -->
        <div class="card" style="margin-bottom:1.1rem; padding:1.1rem; overflow:visible;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
            <h4 class="card-title" style="margin:0;">📦 Productos del Encargo</h4>
            <span class="text-muted" style="font-size:0.78rem;">${allProducts.length} productos en catálogo</span>
          </div>

          <div style="display:flex; gap:0.5rem; margin-bottom:0.85rem; align-items:flex-start; flex-wrap:wrap;">
            <!-- Buscador de Producto -->
            <div class="encargo-prod-search-wrapper">
              <div class="encargo-prod-search-input-box">
                <span class="encargo-prod-search-icon">🔍</span>
                <input id="no-prod-search" 
                       type="text" 
                       class="form-input" 
                       placeholder="Buscar producto por nombre..." 
                       autocomplete="off" 
                       oninput="EncargosModule.onProductSearch(this.value)" 
                       onfocus="EncargosModule.onProductSearchFocus()" 
                       onkeydown="EncargosModule.onProductSearchKeydown(event)">
                <button id="no-prod-clear-btn" 
                        type="button" 
                        class="encargo-prod-clear-btn" 
                        style="display:none;" 
                        onclick="EncargosModule.clearSelectedProduct()" 
                        title="Limpiar búsqueda">✕</button>
              </div>
              <div id="no-prod-dropdown" class="encargo-prod-dropdown"></div>
              <div id="no-prod-selected-preview"></div>
            </div>

            <!-- Cantidad con Unidad -->
            <div style="display:flex; gap:0.35rem; align-items:center;">
              <input id="no-prod-qty" 
                     type="number" 
                     step="any" 
                     min="0.001" 
                     value="1" 
                     class="form-input" 
                     style="width:75px; text-align:center;" 
                     placeholder="Cant."
                     onkeydown="if(event.key==='Enter'){event.preventDefault(); EncargosModule.addItemToCart();}">
              <span id="no-prod-unit-label" style="font-size:0.75rem; color:var(--text-muted); min-width:18px;">u.</span>
            </div>

            <!-- Botón Agregar -->
            <button type="button" class="btn btn-outline" onclick="EncargosModule.addItemToCart()" style="white-space:nowrap; padding:0.55rem 0.95rem;">
              ➕ Agregar
            </button>
          </div>

          <!-- Lista de Carrito del Encargo -->
          <div id="no-cart-list" style="display:flex; flex-direction:column; gap:0.4rem; max-height:160px; overflow-y:auto;"></div>
        </div>

        <!-- Sección 3: Fecha, Hora y Alerta -->
        <div class="card" style="margin-bottom:1.1rem; padding:1.1rem;">
          <h4 class="card-title" style="margin-bottom:0.75rem;">⏰ Programación de Entrega & Alerta</h4>
          <div class="form-row">
            <div class="form-group" style="margin:0;">
              <label>Fecha y Hora de Entrega *</label>
              <input id="no-delivery-time" name="delivery_datetime" type="datetime-local" class="form-input" required value="${orderDate}">
            </div>
            <div class="form-group" style="margin:0;">
              <label>Anticipación de Alerta</label>
              <select id="no-alert-lead" name="alert_lead_minutes" class="form-input">
                <option value="30" ${existingOrder?.alert_lead_minutes === 30 ? 'selected' : ''}>30 minutos antes</option>
                <option value="60" ${!existingOrder || existingOrder?.alert_lead_minutes === 60 ? 'selected' : ''}>1 hora antes (Recomendado)</option>
                <option value="120" ${existingOrder?.alert_lead_minutes === 120 ? 'selected' : ''}>2 horas antes</option>
                <option value="240" ${existingOrder?.alert_lead_minutes === 240 ? 'selected' : ''}>4 horas antes</option>
                <option value="1440" ${existingOrder?.alert_lead_minutes === 1440 ? 'selected' : ''}>24 horas antes (1 día)</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Sección 4: Seña y Notas -->
        <div class="card" style="margin-bottom:1.1rem; padding:1.1rem;">
          <h4 class="card-title" style="margin-bottom:0.75rem;">💰 Seña y Aclaraciones</h4>
          <div class="form-row">
            <div class="form-group" style="margin:0;">
              <label>Seña Dejada ($)</label>
              <input id="no-deposit" name="deposit_amount" type="number" step="0.01" min="0" value="${existingOrder?.deposit_amount || 0}" class="form-input" oninput="EncargosModule.updateCartTotals()">
            </div>
            <div class="form-group" style="margin:0;">
              <label>Medio de Pago de Seña</label>
              <select id="no-deposit-pay" name="deposit_payment_type" class="form-input">
                <option value="efectivo">💵 Efectivo</option>
                <option value="transferencia">📱 Transferencia</option>
                <option value="qr">🔳 MercadoPago / QR</option>
                <option value="debito">💳 Débito</option>
                <option value="credito">💳 Crédito</option>
              </select>
            </div>
          </div>
          <div class="form-group" style="margin-top:0.75rem; margin-bottom:0;">
            <label>Notas de Preparación / Aclaraciones</label>
            <textarea id="no-notes" name="notes" class="form-input" placeholder="Ej: Sin cebolla, envolver para regalo, timbre que no anda...">${Utils.escHtml(existingOrder?.notes || '')}</textarea>
          </div>
        </div>

        <!-- Totales Card -->
        <div class="total-card" style="margin-bottom:1.25rem; padding:1rem 1.25rem;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <span class="text-muted" style="font-size:0.8rem; font-weight:700;">TOTAL PEDIDO:</span>
              <div id="no-total-display" style="font-size:1.4rem; font-weight:800; color:var(--accent);">$0,00</div>
            </div>
            <div style="text-align:right;">
              <span class="text-muted" style="font-size:0.8rem; font-weight:700;">SALDO RESTANTE:</span>
              <div id="no-remaining-display" style="font-size:1.4rem; font-weight:800; color:var(--accent-light);">$0,00</div>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary">💾 Guardar Encargo</button>
        </div>
      </form>`);

        // Cerrar dropdown al hacer click fuera del buscador
        setTimeout(() => {
            const dropdown = document.getElementById('no-prod-dropdown');
            const wrapper = document.querySelector('.encargo-prod-search-wrapper');
            if (dropdown && wrapper) {
                const outsideClickListener = (evt) => {
                    if (!wrapper.contains(evt.target)) {
                        dropdown.classList.remove('active');
                    }
                };
                document.addEventListener('click', outsideClickListener);
            }
        }, 100);

        this._renderCartList();
        this.updateCartTotals();
    },

    /* ── MÉTODOS DEL BUSCADOR DE PRODUCTOS ── */
    onProductSearch(val) {
        const q = (val || '').trim().toLowerCase();
        const clearBtn = document.getElementById('no-prod-clear-btn');
        if (clearBtn) clearBtn.style.display = q ? 'flex' : 'none';

        if (!q) {
            this._filteredProducts = [...this._allProducts];
        } else {
            this._filteredProducts = this._allProducts.filter(p => 
                (p.name && p.name.toLowerCase().includes(q)) ||
                (p.category && p.category.toLowerCase().includes(q))
            );
        }

        if (this._selectedProduct && this._selectedProduct.name.toLowerCase() !== q) {
            this._selectedProduct = null;
            this._updateSelectedPreview();
        }

        this._highlightedIndex = this._filteredProducts.length > 0 ? 0 : -1;
        this._renderProductDropdown(q);
    },

    onProductSearchFocus() {
        const searchInput = document.getElementById('no-prod-search');
        const q = (searchInput?.value || '').trim().toLowerCase();
        if (!q) {
            this._filteredProducts = [...this._allProducts];
        } else {
            this._filteredProducts = this._allProducts.filter(p => 
                (p.name && p.name.toLowerCase().includes(q)) ||
                (p.category && p.category.toLowerCase().includes(q))
            );
        }
        this._highlightedIndex = this._filteredProducts.length > 0 ? 0 : -1;
        this._renderProductDropdown(q);
    },

    _renderProductDropdown(q = '') {
        const dropdown = document.getElementById('no-prod-dropdown');
        if (!dropdown) return;

        if (!this._filteredProducts.length) {
            dropdown.innerHTML = `
                <div style="padding:0.75rem 1rem; text-align:center; color:var(--text-muted); font-size:0.85rem;">
                  🔍 Sin resultados${q ? ` para "<strong>${Utils.escHtml(q)}</strong>"` : ''}
                </div>`;
            dropdown.classList.add('active');
            return;
        }

        dropdown.innerHTML = this._filteredProducts.slice(0, 30).map((p, idx) => {
            const isHighlighted = idx === this._highlightedIndex;
            const unitAbbr = Utils.unitAbbr ? Utils.unitAbbr(p.unit) : (p.unit || 'u.');
            return `
              <div class="encargo-prod-item ${isHighlighted ? 'focused' : ''}" 
                   id="prod-item-${idx}"
                   onmousedown="event.preventDefault(); EncargosModule.selectProduct('${p.id}')">
                <div>
                  <div class="encargo-prod-item-name">${Utils.escHtml(p.name)}</div>
                  <div class="encargo-prod-item-stock">Stock: <strong>${p.stock ?? 0}</strong> ${Utils.escHtml(unitAbbr)}</div>
                </div>
                <div class="encargo-prod-item-meta">
                  <span class="encargo-prod-item-price">${Utils.currency(p.sell_price)}</span>
                </div>
              </div>`;
        }).join('');

        dropdown.classList.add('active');
    },

    onProductSearchKeydown(e) {
        const dropdown = document.getElementById('no-prod-dropdown');
        const isActive = dropdown && dropdown.classList.contains('active');

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!isActive) {
                this.onProductSearchFocus();
                return;
            }
            if (this._filteredProducts.length > 0) {
                this._highlightedIndex = (this._highlightedIndex + 1) % Math.min(this._filteredProducts.length, 30);
                this._updateDropdownHighlight();
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (!isActive) return;
            if (this._filteredProducts.length > 0) {
                this._highlightedIndex = (this._highlightedIndex - 1 + Math.min(this._filteredProducts.length, 30)) % Math.min(this._filteredProducts.length, 30);
                this._updateDropdownHighlight();
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (isActive && this._highlightedIndex >= 0 && this._filteredProducts[this._highlightedIndex]) {
                this.selectProduct(this._filteredProducts[this._highlightedIndex].id);
            } else if (this._selectedProduct) {
                this.addItemToCart();
            } else if (this._filteredProducts.length === 1) {
                this.selectProduct(this._filteredProducts[0].id);
            }
        } else if (e.key === 'Escape') {
            if (dropdown) dropdown.classList.remove('active');
        }
    },

    _updateDropdownHighlight() {
        document.querySelectorAll('.encargo-prod-item').forEach((el, idx) => {
            el.classList.toggle('focused', idx === this._highlightedIndex);
            if (idx === this._highlightedIndex) {
                el.scrollIntoView({ block: 'nearest' });
            }
        });
    },

    selectProduct(prodId) {
        const prod = this._allProducts.find(p => p.id === prodId);
        if (!prod) return;

        this._selectedProduct = prod;

        const searchInput = document.getElementById('no-prod-search');
        const clearBtn = document.getElementById('no-prod-clear-btn');
        const dropdown = document.getElementById('no-prod-dropdown');
        const unitLabel = document.getElementById('no-prod-unit-label');
        const qtyInput = document.getElementById('no-prod-qty');

        if (searchInput) searchInput.value = prod.name;
        if (clearBtn) clearBtn.style.display = 'flex';
        if (dropdown) dropdown.classList.remove('active');
        const unitAbbr = Utils.unitAbbr ? Utils.unitAbbr(prod.unit) : (prod.unit || 'u.');
        if (unitLabel) unitLabel.textContent = unitAbbr;

        this._updateSelectedPreview();

        if (qtyInput) {
            qtyInput.focus();
            qtyInput.select();
        }
    },

    _updateSelectedPreview() {
        const preview = document.getElementById('no-prod-selected-preview');
        if (!preview) return;

        if (!this._selectedProduct) {
            preview.innerHTML = '';
            return;
        }

        const p = this._selectedProduct;
        const unitAbbr = Utils.unitAbbr ? Utils.unitAbbr(p.unit) : (p.unit || 'u.');
        preview.innerHTML = `
          <div class="encargo-selected-badge">
            <span>✅ <strong>${Utils.escHtml(p.name)}</strong> (${Utils.currency(p.sell_price)}) • Stock: ${p.stock ?? 0} ${Utils.escHtml(unitAbbr)}</span>
            <button type="button" onclick="EncargosModule.clearSelectedProduct()" style="background:none; border:none; color:inherit; cursor:pointer; font-size:0.8rem; padding:0 0.2rem;" title="Quitar selección">✕</button>
          </div>`;
    },

    clearSelectedProduct() {
        this._selectedProduct = null;
        this._highlightedIndex = -1;
        const searchInput = document.getElementById('no-prod-search');
        const clearBtn = document.getElementById('no-prod-clear-btn');
        const dropdown = document.getElementById('no-prod-dropdown');
        const unitLabel = document.getElementById('no-prod-unit-label');

        if (searchInput) {
            searchInput.value = '';
            searchInput.focus();
        }
        if (clearBtn) clearBtn.style.display = 'none';
        if (dropdown) dropdown.classList.remove('active');
        if (unitLabel) unitLabel.textContent = 'u.';
        this._updateSelectedPreview();
    },

    addItemToCart() {
        const qtyInput = document.getElementById('no-prod-qty');
        const qty = parseFloat(qtyInput?.value) || 1;

        if (qty <= 0) {
            if (typeof Toast !== 'undefined') Toast.show('La cantidad debe ser mayor a 0', 'warning');
            return;
        }

        let prod = this._selectedProduct;
        if (!prod) {
            const searchVal = (document.getElementById('no-prod-search')?.value || '').trim().toLowerCase();
            if (searchVal) {
                prod = this._allProducts.find(p => p.name.toLowerCase() === searchVal);
                if (!prod && this._filteredProducts.length === 1) {
                    prod = this._filteredProducts[0];
                }
            }
        }

        if (!prod) {
            if (typeof Toast !== 'undefined') Toast.show('Selecciona un producto del buscador', 'warning');
            const searchInput = document.getElementById('no-prod-search');
            if (searchInput) searchInput.focus();
            return;
        }

        const prodId = prod.id;
        const name = prod.name;
        const price = parseFloat(prod.sell_price) || 0;
        const unit = prod.unit || 'Unidades';

        const exist = this._cart.find(x => x.productId === prodId);
        if (exist) {
            exist.quantity = Math.round((exist.quantity + qty) * 1000) / 1000;
            exist.subtotal = Math.round(exist.quantity * exist.unitPrice * 100) / 100;
        } else {
            this._cart.push({
                productId: prodId,
                productName: name,
                unitPrice: price,
                quantity: qty,
                unit: unit,
                subtotal: Math.round(price * qty * 100) / 100
            });
        }

        const unitAbbr = Utils.unitAbbr ? Utils.unitAbbr(unit) : 'u.';
        if (typeof Toast !== 'undefined') Toast.show(`Agregado: ${qty} ${unitAbbr} de ${name}`, 'info', 1200);

        this.clearSelectedProduct();
        if (qtyInput) qtyInput.value = '1';

        this._renderCartList();
        this.updateCartTotals();

        const searchInput = document.getElementById('no-prod-search');
        if (searchInput) searchInput.focus();
    },

    removeItemFromCart(idx) {
        this._cart.splice(idx, 1);
        this._renderCartList();
        this.updateCartTotals();
    },

    _renderCartList() {
        const box = document.getElementById('no-cart-list');
        if (!box) return;

        if (!this._cart.length) {
            box.innerHTML = `<span class="text-muted" style="font-size:0.85rem; font-style:italic;">No hay productos agregados aún.</span>`;
            return;
        }

        box.innerHTML = this._cart.map((it, i) => {
          const unitAbbr = Utils.unitAbbr ? Utils.unitAbbr(it.unit) : (it.unit || 'u.');
          return `
          <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-main); padding:0.45rem 0.75rem; border-radius:var(--radius-xs); border:1px solid var(--border-subtle);">
            <div>
              <strong>${it.quantity} ${Utils.escHtml(unitAbbr)}</strong> ${Utils.escHtml(it.productName)} 
              <small class="text-muted">(${Utils.currency(it.unitPrice)} c/u)</small>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <strong style="color:var(--accent); font-size:0.95rem;">${Utils.currency(it.subtotal)}</strong>
              <button type="button" class="btn-icon danger" style="min-width:26px; min-height:26px; font-size:0.75rem;" onclick="EncargosModule.removeItemFromCart(${i})">✕</button>
            </div>
          </div>`;
        }).join('');
    },

    updateCartTotals() {
        const total = this._cart.reduce((s, it) => s + (it.subtotal || 0), 0);
        const deposit = parseFloat(document.getElementById('no-deposit')?.value || 0);
        const remaining = Math.max(0, total - deposit);

        const totalEl = document.getElementById('no-total-display');
        const remEl = document.getElementById('no-remaining-display');
        if (totalEl) totalEl.textContent = Utils.currency(total);
        if (remEl) remEl.textContent = Utils.currency(remaining);
    },

    async saveOrder(e, orderId) {
        e.preventDefault();
        const f = e.target;

        if (!this._cart.length) {
            if (typeof Toast !== 'undefined') Toast.show('Agrega al menos un producto al encargo', 'warning');
            return;
        }

        const clientName = f.client_name.value.trim();
        const clientPhone = f.client_phone.value.trim();
        const clientAddress = f.client_address.value.trim();

        const nameVal = Utils.validatePersonName(clientName, 'nombre del cliente');
        if (!nameVal.valid) {
            if (typeof Toast !== 'undefined') Toast.show(nameVal.message, 'warning');
            else alert(nameVal.message);
            return;
        }

        const phoneVal = Utils.validatePhone(clientPhone);
        if (!phoneVal.valid) {
            if (typeof Toast !== 'undefined') Toast.show(phoneVal.message, 'warning');
            else alert(phoneVal.message);
            return;
        }

        const deliveryDatetime = f.delivery_datetime.value;
        const alertLeadMinutes = parseInt(f.alert_lead_minutes.value) || 60;
        const depositAmount = parseFloat(f.deposit_amount.value) || 0;
        const depositPaymentType = f.deposit_payment_type.value;
        const notes = f.notes.value.trim();

        try {
            let finalClientId = this._selectedClientId || null;

            // Si es un cliente nuevo escrito a mano, guardarlo automáticamente en la tabla de clientes
            if (!finalClientId && clientName) {
                try {
                    const existingClients = await DB.getClients();
                    const matched = existingClients.find(c => c.name.trim().toLowerCase() === clientName.toLowerCase());
                    if (matched) {
                        finalClientId = matched.id;
                    } else {
                        const newClient = await DB.saveClient({
                            name: clientName,
                            phone: clientPhone,
                            address: clientAddress
                        });
                        if (newClient?.id) finalClientId = newClient.id;
                    }
                } catch (errClient) {
                    console.warn("No se pudo registrar automáticamente en la tabla clients:", errClient);
                }
            }

            await DB.saveCustomOrder({
                id: orderId || null,
                clientId: finalClientId,
                clientName,
                clientPhone,
                clientAddress,
                deliveryDatetime: new Date(deliveryDatetime).toISOString(),
                alertLeadMinutes,
                depositAmount,
                depositPaymentType,
                notes,
                status: 'pendiente'
            }, this._cart);

            Modal.close();
            if (typeof Toast !== 'undefined') Toast.show('¡Encargo guardado exitosamente!', 'success');
            await this.render(document.getElementById('content'));
        } catch (err) {
            console.error("Error al guardar encargo:", err);
            if (typeof Toast !== 'undefined') Toast.show('Error al guardar el encargo', 'danger');
        }
    },

    onClientSelect(sel) {
        if (!sel) return;
        if (sel.value === '__new__') {
            this.prepareNewClientFields();
            return;
        }
        if (!sel.value) {
            this._selectedClientId = null;
            this._selectedClientName = null;
            return;
        }
        const opt = sel.selectedOptions[0];
        const nameInput = document.getElementById('no-client-name');
        const phoneInput = document.getElementById('no-client-phone');
        const addressInput = document.getElementById('no-client-address');
        if (nameInput) nameInput.value = opt.dataset.name || '';
        if (phoneInput) phoneInput.value = opt.dataset.phone || '';
        if (addressInput && opt.dataset.notes && !addressInput.value) {
            addressInput.value = opt.dataset.notes;
        }
        this._selectedClientId = sel.value;
        this._selectedClientName = opt.dataset.name;
    },

    prepareNewClientFields() {
        const sel = document.getElementById('no-client-select');
        const nameInput = document.getElementById('no-client-name');
        const phoneInput = document.getElementById('no-client-phone');
        const addressInput = document.getElementById('no-client-address');
        if (sel) sel.value = '__new__';
        if (nameInput) {
            nameInput.value = '';
            nameInput.focus();
        }
        if (phoneInput) phoneInput.value = '';
        if (addressInput) addressInput.value = '';
        this._selectedClientId = null;
        this._selectedClientName = null;
        if (typeof Toast !== 'undefined') Toast.show('Completa los datos del nuevo cliente', 'info', 1500);
    },

    onClientTyped() {
        const sel = document.getElementById('no-client-select');
        if (sel && sel.value && sel.value !== '__new__') {
            sel.value = '';
            this._selectedClientId = null;
            this._selectedClientName = null;
        }
    },

    /* ── MODAL: HOJA DE PREPARACIÓN / COMANDA ── */
    async openPreparationSheetModal(orderId) {
        const o = await DB.getCustomOrderById(orderId);
        if (!o) return;

        const dateStr = new Date(o.delivery_datetime).toLocaleString('es-AR', {
            weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const items = o.custom_order_items || [];

        Modal.open(`
      <div id="printable-comanda">
        <div style="text-align:center; border-bottom:2px dashed var(--border); padding-bottom:1rem; margin-bottom:1.25rem;">
          <h2 style="font-family:'Playfair Display', serif; color:var(--accent); font-size:1.4rem; margin:0;">📄 HOJA DE PREPARACIÓN</h2>
          <div style="font-size:1.1rem; font-weight:800; margin-top:0.35rem; color:var(--text-main);">ENCARGO #${o.order_number || ''}</div>
          <div style="color:var(--accent-light); font-size:0.95rem; font-weight:700; margin-top:0.25rem;">⏰ ENTREGA: ${dateStr}</div>
        </div>

        <div style="background:var(--bg-main); padding:0.85rem 1rem; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); margin-bottom:1.25rem;">
          <div>👤 <strong>Cliente:</strong> ${Utils.escHtml(o.client_name)}</div>
          ${o.client_phone ? `<div>📞 <strong>Tel:</strong> ${Utils.escHtml(o.client_phone)}</div>` : ''}
          <div>📍 <strong>Destino:</strong> ${Utils.escHtml(o.client_address || 'Retiro por mostrador')}</div>
        </div>

        <h4 style="font-size:0.85rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); margin-bottom:0.75rem; letter-spacing:0.06em;">
          Ítems a Preparar / Empacar:
        </h4>

        <div style="display:flex; flex-direction:column; gap:0.6rem; margin-bottom:1.25rem;">
          ${items.map(it => `
            <div style="display:flex; align-items:center; gap:0.75rem; background:var(--bg-card); padding:0.65rem 0.85rem; border-radius:var(--radius-xs); border:1px solid var(--border-subtle);">
              <input type="checkbox" style="width:1.25rem; height:1.25rem; cursor:pointer;">
              <span style="font-size:1.05rem; font-weight:700; color:var(--text-main); flex:1;">
                ${it.quantity}x ${Utils.escHtml(it.product_name)}
              </span>
            </div>
          `).join('')}
        </div>

        ${o.notes ? `
          <div style="background:rgba(212,175,55,0.08); border:1px solid var(--accent); padding:0.85rem 1rem; border-radius:var(--radius-sm); margin-bottom:1.25rem;">
            ⚠️ <strong>Notas de Preparación:</strong>
            <p style="margin-top:0.25rem; font-size:0.95rem; color:var(--text-main);">${Utils.escHtml(o.notes)}</p>
          </div>` : ''}

        <div class="modal-actions" style="margin-top:1rem;">
          <button type="button" class="btn btn-outline" onclick="window.print()">🖨️ Imprimir Comanda</button>
          <button type="button" class="btn btn-primary" onclick="Modal.close()">Listo</button>
        </div>
      </div>`);
    },

    /* ── MODAL: ENTREGAR Y COBRAR EN 1 CLIC ── */
    async openDeliverModal(orderId) {
        const o = await DB.getCustomOrderById(orderId);
        if (!o) return;

        const remaining = parseFloat(o.remaining_amount) || 0;
        const products = await DB.getProducts();
        const items = o.custom_order_items || [];
        const stockIssues = [];

        items.forEach(it => {
            if (it.product_id) {
                const prod = products.find(p => p.id === it.product_id);
                const neededQty = parseFloat(it.quantity) || 0;
                const currentStock = prod ? (parseFloat(prod.stock) || 0) : 0;
                const unitAbbr = (typeof Utils !== 'undefined' && Utils.unitAbbr) ? Utils.unitAbbr(prod?.unit || it.unit) : (prod?.unit || 'u.');

                if (!prod) {
                    stockIssues.push({
                        name: it.product_name,
                        needed: neededQty,
                        available: 0,
                        unit: unitAbbr,
                        reason: 'Producto eliminado del catálogo'
                    });
                } else if (currentStock < neededQty) {
                    stockIssues.push({
                        name: prod.name,
                        needed: neededQty,
                        available: currentStock,
                        unit: unitAbbr,
                        reason: 'Stock insuficiente'
                    });
                }
            }
        });

        const hasStockIssue = stockIssues.length > 0;
        if (hasStockIssue && typeof Toast !== 'undefined') {
            Toast.show(`⚠️ Stock insuficiente para entregar el encargo #${o.order_number || ''}`, 'warning', 5000);
        }

        Modal.open(`
      <h2 class="modal-title">🚀 Entregar y Finalizar Encargo #${o.order_number || ''}</h2>
      <p class="text-muted" style="margin-top:-0.8rem; margin-bottom:1.25rem; font-size:0.9rem;">
        Al confirmar, se descontará el stock físico automáticamente y se creará el comprobante de venta oficial.
      </p>

      ${hasStockIssue ? `
        <div style="background:rgba(244,63,94,0.12); border:1px solid rgba(244,63,94,0.45); border-radius:var(--radius-sm); padding:0.9rem 1rem; margin-bottom:1.25rem;">
          <div style="display:flex; align-items:center; gap:0.5rem; color:var(--red); font-weight:700; font-size:0.95rem; margin-bottom:0.4rem;">
            <span style="font-size:1.15rem;">🚫</span>
            <span>No se puede entregar: Stock Físico Insuficiente</span>
          </div>
          <p style="font-size:0.85rem; color:var(--text-main); margin-bottom:0.5rem;">
            No tienes suficiente inventario para los siguientes productos de este encargo:
          </p>
          <div style="display:flex; flex-direction:column; gap:0.35rem; background:rgba(0,0,0,0.25); border-radius:var(--radius-xs); padding:0.6rem 0.85rem; margin-bottom:0.6rem;">
            ${stockIssues.map(si => `
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem;">
                <span>📦 <strong>${Utils.escHtml(si.name)}</strong></span>
                <span>Requiere: <strong>${si.needed} ${si.unit}</strong> | Stock: <span style="color:var(--red); font-weight:700;">${si.available} ${si.unit}</span></span>
              </div>
            `).join('')}
          </div>
          <p style="font-size:0.8rem; color:var(--text-muted); margin:0;">
            💡 <em>Ingresa o ajusta el stock en la sección <strong>Stock</strong> antes de poder entregar este encargo.</em>
          </p>
        </div>
      ` : ''}

      <form onsubmit="EncargosModule.confirmDelivery(event, '${o.id}')">
        <div class="card" style="margin-bottom:1.25rem; padding:1.1rem; background:var(--bg-main);">
          <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem;">
            <span>Cliente:</span>
            <strong>${Utils.escHtml(o.client_name)}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem;">
            <span>Total del Encargo:</span>
            <strong>${Utils.currency(o.total_amount)}</strong>
          </div>
          ${o.deposit_amount > 0 ? `
          <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem; color:var(--green);">
            <span>Seña ya cobrada:</span>
            <strong>-${Utils.currency(o.deposit_amount)}</strong>
          </div>` : ''}
          <div style="display:flex; justify-content:space-between; margin-top:0.6rem; padding-top:0.6rem; border-top:1px solid var(--border); font-size:1.15rem;">
            <span style="font-weight:700;">SALDO A COBRAR AHORA:</span>
            <strong style="color:var(--accent);">${Utils.currency(remaining)}</strong>
          </div>
        </div>

        ${remaining > 0 ? `
          <div class="form-group" style="margin-bottom:1.25rem;">
            <label>Medio de Pago del Saldo Restante *</label>
            <select id="del-payment-type" name="payment_type" class="form-input" style="font-size:0.95rem;">
              <option value="efectivo" selected>💵 Efectivo (Suma a Caja)</option>
              <option value="transferencia">📱 Transferencia Bancaria</option>
              <option value="qr">🔳 MercadoPago / QR</option>
              <option value="debito">💳 Tarjeta de Débito</option>
              <option value="credito">💳 Tarjeta de Crédito</option>
              <option value="cuenta_corriente">📒 Cuenta Corriente (Cliente)</option>
            </select>
          </div>
        ` : ''}

        <div class="modal-actions">
          <button type="button" class="btn btn-outline" onclick="Modal.close()">Cancelar</button>
          <button type="submit" class="btn btn-primary" ${hasStockIssue ? 'disabled style="opacity:0.5; cursor:not-allowed; background:var(--bg-tertiary); color:var(--text-muted);"' : 'style="background:linear-gradient(135deg, var(--green) 0%, #059669 100%);"'}>
            ${hasStockIssue ? '🚫 Stock Insuficiente para Entregar' : '✅ Confirmar Entrega y Descontar Stock'}
          </button>
        </div>
      </form>`);
    },

    async confirmDelivery(e, orderId) {
        e.preventDefault();
        const f = e.target;
        const paymentType = f.payment_type ? f.payment_type.value : 'efectivo';

        try {
            await DB.completeCustomOrder(orderId, paymentType);
            Modal.close();
            if (typeof Toast !== 'undefined') Toast.show('¡Encargo completado y venta registrada exitosamente!', 'success');
            await this.render(document.getElementById('content'));
        } catch (err) {
            console.error("Error al completar encargo:", err);
            if (typeof Toast !== 'undefined') Toast.show(err.message || 'Error al completar el encargo', 'danger');
        }
    },

    async confirmCancelOrder(orderId) {
        if (!confirm('¿Estás seguro de cancelar este encargo? No afectará el stock ni las ventas.')) return;
        try {
            await DB.cancelCustomOrder(orderId);
            if (typeof Toast !== 'undefined') Toast.show('Encargo cancelado', 'info');
            await this.render(document.getElementById('content'));
        } catch (err) {
            console.error("Error al cancelar encargo:", err);
            if (typeof Toast !== 'undefined') Toast.show('Error al cancelar', 'danger');
        }
    }
};
