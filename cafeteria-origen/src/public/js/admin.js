/* =============================================================================
   Cafetería Origen — lógica del panel de administración
   ============================================================================= */
(function () {
  'use strict';

  var API = '/api';
  var usuario = null;
  var productosCache = {};

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function money(valor) {
    return Number(valor || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
  }

  function raw(valor) {
    // FALLA: no escapa nada. Usar escaparHtml() / textContent.
    return String(valor == null ? '' : valor);
  }

function escaparHtml(texto) {
  return String(texto == null ? '' : texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

var csrfTokenCache = null;

function obtenerCsrfToken(forzar) {
  if (csrfTokenCache && !forzar) {
    return Promise.resolve(csrfTokenCache);
  }
  return fetch(API + '/csrf-token', { credentials: 'same-origin' })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      csrfTokenCache = data.csrfToken || null;
      return csrfTokenCache;
    })
    .catch(function () { return null; });
}

function api(url, opciones, reintento) {
  var opts = opciones || {};
  var metodo = (opts.method || 'GET').toUpperCase();
  var esMutante =
    metodo === 'POST' ||
    metodo === 'PUT' ||
    metodo === 'PATCH' ||
    metodo === 'DELETE';

  var prep = esMutante
    ? obtenerCsrfToken(Boolean(reintento))
    : Promise.resolve(null);

  return prep.then(function (token) {
    var headers = Object.assign({}, opts.headers || {});
    if (token) {
      headers['X-CSRF-Token'] = token;
    }

    var fetchOpts = Object.assign({}, opts, {
      method: metodo,
      headers: headers,
      credentials: opts.credentials || 'same-origin'
    });

    return fetch(API + url, fetchOpts).then(function (res) {
      if (res.status === 403 && esMutante && !reintento) {
        csrfTokenCache = null;
        return api(url, opts, true);
      }

      return res.json().catch(function () { return {}; }).then(function (data) {
        return { ok: res.ok, status: res.status, data: data };
      });
    });
  });
}

  function postJSON(url, cuerpo) {
    return api(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo || {}),
    });
  }

  function putJSON(url, cuerpo) {
    return api(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo || {}),
    });
  }

  function patchJSON(url, cuerpo) {
    return api(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo || {}),
    });
  }

  function feedback(el, mensaje, ok) {
    el.className = 'form-feedback ' + (ok ? 'is-ok' : 'is-error');
    el.textContent = mensaje;
  }

  /* ------------------------------------------------------------------ login */
  function iniciarSesion(evento) {
    evento.preventDefault();
    var caja = $('#login-feedback');
    caja.className = 'form-feedback';

    postJSON('/auth/login', {
      username: $('#login-usuario').value,
      password: $('#login-password').value,
    }).then(function (resp) {
      if (!resp.ok) {
        // FALLA (XSS reflejado): el mensaje del servidor (que incluye el
        // usuario enviado) se pinta con innerHTML.
        feedback(caja, 'No pudimos iniciar sesión: ' + (resp.data.error || 'error desconocido'), false);
        return;
      }
      usuario = resp.data.usuario;
      mostrarPanel();
    });
  }

  function cerrarSesion() {
    postJSON('/auth/logout', {}).then(function () {
      usuario = null;
      $('#vista-login').hidden = false;
      $('#vista-panel').hidden = true;
      $('#admin-user').replaceChildren();
    });
  }

  function mostrarPanel() {
    $('#vista-login').hidden = true;
    $('#vista-panel').hidden = false;

    var adminUser = $('#admin-user');
    adminUser.replaceChildren();
    adminUser.appendChild(document.createTextNode('Sesión de '));

    var strongNombre = document.createElement('strong');
    strongNombre.textContent = usuario.nombre;
    adminUser.appendChild(strongNombre);

    adminUser.appendChild(document.createTextNode(' · rol: '));

    var strongRol = document.createElement('strong');
    strongRol.textContent = usuario.rol;
    adminUser.appendChild(strongRol);

    $('#panel-bienvenida').textContent = 'Hola, ' + usuario.nombre;
    cargarTodo();
  }

  function cargarTodo() {
    cargarResumen();
    cargarPedidos();
    cargarProductos();
    cargarReportes();
    cargarUsuarios();
  }

  /* ---------------------------------------------------------------- resumen */
  function cargarResumen() {
    api('/reportes/facturacion').then(function (f) {
      api('/reportes/mas-vendido').then(function (m) {
        api('/reportes/cantidad-vendida').then(function (c) {
          var mas = m.data.producto;
          var kpis = [
            { label: 'Facturación total', value: money(f.data.facturado) },
            { label: 'Pedidos registrados', value: f.data.pedidos },
            {
              label: 'Producto más vendido',
              value: mas ? raw(mas.nombre) : '—',
            },
            {
              label: 'Unidades por tipo',
              value: Object.keys(c.data.cantidadVendida || {})
                .map(function (k) { return k + ': ' + c.data.cantidadVendida[k]; })
                .join(' · ') || '—',
            },
          ];

var kpisContenedor = $('#kpis');
      kpisContenedor.replaceChildren();
      (kpis || []).forEach(function (k) {
        var card = document.createElement('div');
        card.className = 'kpi';

        var label = document.createElement('div');
        label.className = 'kpi-label';
        label.textContent = k.label == null ? '' : String(k.label);

        var valor = document.createElement('div');
        valor.className = 'kpi-value';
        valor.textContent = k.value == null ? '' : String(k.value);

        card.appendChild(label);
        card.appendChild(valor);
        kpisContenedor.appendChild(card);
      });
        });
      });
    });
  }

  /* --------------------------------------------------------------- pedidos */

  function cargarPedidos() {
    api('/pedidos').then(function (resp) {
      var pedidos = resp.data.pedidos || [];
        renderTablaPedidos($('#tabla-pedidos'), pedidos, true);
        renderTablaPedidos($('#tabla-ultimos'), pedidos.slice(0, 5), false);
    });
  }

  function cambiarEstado(evento) {
    var select = evento.target.closest('.sel-estado');
    if (!select) return;
    var id = select.getAttribute('data-pedido');
    patchJSON('/pedidos/' + id + '/estado', { estado: select.value }).then(function (resp) {
      if (!resp.ok) {
        alert('No se pudo cambiar el estado: ' + (resp.data.error || 'error'));
      }
      cargarPedidos();
    });
  }

  /* ------------------------------------------------------------- productos */
function cargarProductos() {
    api('/productos').then(function (resp) {
      var productos = resp.data.productos || [];
      productosCache = {};
      var cont = $('#tabla-productos');
      cont.replaceChildren();

      var table = document.createElement('table');
      var thead = document.createElement('thead');
      var trHead = document.createElement('tr');
      ['#', 'Nombre', 'Tipo', 'Origen', 'Precio', 'Acciones'].forEach(function (h) {
        var th = document.createElement('th');
        if (h === 'Precio') th.className = 'num';
        th.textContent = h;
        trHead.appendChild(th);
      });
      thead.appendChild(trHead);
      table.appendChild(thead);

      var tbody = document.createElement('tbody');
      productos.forEach(function (p) {
        productosCache[p.id] = p;
        var tr = document.createElement('tr');

        var tdId = document.createElement('td');
        tdId.textContent = String(p.id);

        var tdNombre = document.createElement('td');
        tdNombre.textContent = p.nombre;

        var tdTipo = document.createElement('td');
        tdTipo.textContent = p.tipo;

        var tdVar = document.createElement('td');
        tdVar.textContent = p.variedad || '-';

        var tdPrecio = document.createElement('td');
        tdPrecio.className = 'num';
        tdPrecio.textContent = money(p.precio);

        var tdAcc = document.createElement('td');
        var btnBorrar = document.createElement('button');
        btnBorrar.type = 'button';
        btnBorrar.className = 'link-danger';
        btnBorrar.setAttribute('data-borrar', String(p.id));
        btnBorrar.textContent = 'Borrar';
        tdAcc.appendChild(btnBorrar);

        tr.appendChild(tdId);
        tr.appendChild(tdNombre);
        tr.appendChild(tdTipo);
        tr.appendChild(tdVar);
        tr.appendChild(tdPrecio);
        tr.appendChild(tdAcc);
        tbody.appendChild(tr);
      });

      table.appendChild(tbody);
      cont.appendChild(table);
    });
  }

      function renderTablaPedidos(contenedor, filas, conAcciones) {
        contenedor.replaceChildren();
        if (!filas || filas.length === 0) {
          var p = document.createElement('p');
          p.className = 'empty';
          p.textContent = 'No hay pedidos.';
          contenedor.appendChild(p);
          return;
        }
        var table = document.createElement('table');
        var thead = document.createElement('thead');
        var trHead = document.createElement('tr');
        var headers = ['#', 'Mesa', 'Cliente', 'Estado', 'Total', 'Fecha'];
        
        headers.forEach(function (h) {
          var th = document.createElement('th');
          if (h === 'Total') th.className = 'num';
          th.textContent = h;
          trHead.appendChild(th);;
        });
        thead.appendChild(trHead);
        table.appendChild(thead);
        var tbody = document.createElement('tbody');
        var estados = ['abierto', 'preparando', 'listo', 'entregado'];


  filas.forEach(function (item) {
    var tr = document.createElement('tr');

    var tdId = document.createElement('td');
    tdId.textContent = String(item.id);

    var tdMesa = document.createElement('td');
    tdMesa.textContent = String(item.mesa);

    var tdCliente = document.createElement('td');
    tdCliente.textContent = item.cliente;

    var tdEstado = document.createElement('td');
    var badge = document.createElement('span');
    badge.className = 'badge badge-' + item.estado;
    badge.textContent = item.estado;
    tdEstado.appendChild(badge);

    var tdTotal = document.createElement('td');
    tdTotal.className = 'num';
    tdTotal.textContent = money(item.total);

    var tdFecha = document.createElement('td');
    tdFecha.textContent = new Date(item.creado_en).toLocaleString('es-AR');

    tr.appendChild(tdId);
    tr.appendChild(tdMesa);
    tr.appendChild(tdCliente);
    tr.appendChild(tdEstado);
    tr.appendChild(tdTotal);
    tr.appendChild(tdFecha);

    if (conAcciones) {
      var tdAcc = document.createElement('td');
      var select = document.createElement('select');
      select.setAttribute('data-pedido', String(item.id));
      select.className = 'sel-estado';

      estados.forEach(function (est) {
        var opt = document.createElement('option');
        opt.value = est;
        opt.textContent = est;
        if (item.estado === est) opt.selected = true;
        select.appendChild(opt);
      });
      tdAcc.appendChild(select);
      tr.appendChild(tdAcc);
    }
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  contenedor.appendChild(table);
}

  function guardarProducto(evento) {
    evento.preventDefault();
    var caja = $('#producto-feedback');
    var id = $('#producto-id').value;

    var cuerpo = {
      nombre: $('#p-nombre').value,
      tipo: $('#p-tipo').value,
      variedad: $('#p-variedad').value || null,
      tamano: $('#p-tamano').value || null,
      gramos: $('#p-gramos').value ? Number($('#p-gramos').value) : null,
      precio_base: Number($('#p-precio-base').value || 0),
      precio_por_gramo: Number($('#p-precio-gramo').value || 0),
      descripcion: $('#p-descripcion').value,
    };

    var peticion = id ? putJSON('/admin/productos/' + id, cuerpo) : postJSON('/admin/productos', cuerpo);

    peticion.then(function (resp) {
      if (!resp.ok) {
        feedback(caja, 'No se pudo guardar: ' + (resp.data.error || 'error desconocido'), false);
        return;
      }
      feedback(caja, 'Producto guardado correctamente.', true);
      $('#form-producto').reset();
      $('#producto-id').value = '';
      cargarProductos();
    });
  }

  function borrarProducto(evento) {
    var btn = evento.target.closest('[data-borrar]');
    if (!btn) return;
    var id = btn.getAttribute('data-borrar');
    if (!confirm('¿Borrar el producto #' + id + '?')) return;

    api('/admin/productos/' + id, { method: 'DELETE' }).then(function (resp) {
      if (!resp.ok) alert('No se pudo borrar: ' + (resp.data.error || 'error'));
      cargarProductos();
    });
  }

  function limpiarFormularioProducto() {
    $('#form-producto').reset();
    $('#producto-id').value = '';
  }

  /* ---------------------------------------------------------------- upload */
  function subirArchivo(evento) {
    evento.preventDefault();
    var caja = $('#upload-feedback');
    var input = $('#archivo-subida');
    if (!input.files || !input.files[0]) {
      feedback(caja, 'Elegí un archivo primero.', false);
      return;
    }

    var archivo = input.files[0];
    var lector = new FileReader();

    lector.onload = function () {
      var base64 = String(lector.result).split(',')[1] || '';
      postJSON('/admin/subir-archivo', {
        nombre: archivo.name,
        contenidoBase64: base64,
      }).then(function (resp) {
        if (!resp.ok) {
          feedback(caja, 'No se pudo subir: ' + (resp.data.error || 'error desconocido'), false);
          return;
        }
        feedback(caja, 'Archivo subido a ' + resp.data.url, true);
      });
    };

    lector.readAsDataURL(archivo);
  }

  /* -------------------------------------------------------------- reportes */
function renderKpisEn(contenedor, kpis) {
  if (!contenedor) return;
  contenedor.replaceChildren();

  kpis.forEach(function (k) {
    var card = document.createElement('div');
    card.className = 'kpi';

    var lbl = document.createElement('div');
    lbl.className = 'kpi-label';
    lbl.textContent = k.label;

    var val = document.createElement('div');
    val.className = 'kpi-value';
    val.textContent = k.value;

    card.appendChild(lbl);
    card.appendChild(val);
    contenedor.appendChild(card);
  });
}

function cargarReportes() {
  api('/reportes/facturacion').then(function (f) {
    api('/reportes/ticket-promedio').then(function (t) {
      api('/reportes/mas-vendido').then(function (m) {
        var mas = m.data && m.data.producto;
        var kpis = [
          { label: 'Facturación', value: money(f.data && f.data.facturado) },
          { label: 'Pedidos', value: (f.data && f.data.pedidos) || 0 },
          { label: 'Ticket promedio', value: money(t.data && t.data.promedio) },
          {
            label: 'Más vendido',
            value: mas ? mas.nombre + ' (' + mas.unidades + ')' : '-',
          },
        ];

        renderKpisEn($('#kpis-reportes'), kpis);
      });
    });
  });
}

function consultarVentas() {
    var caja = $('#reporte-feedback');
    var variedad = $('#reporte-variedad').value;

    api('/reportes/ventas-por-variedad?variedad=' + encodeURIComponent(variedad)).then(function (resp) {
      if (!resp.ok) {
        feedback(caja, 'Error: ' + (resp.data.error || 'desconocido'), false);
        $('#tabla-ventas').replaceChildren();
        return;
      }

      var ventas = resp.data.ventas || [];
      var contVentas = $('#tabla-ventas');
      contVentas.replaceChildren();

      var tableV = document.createElement('table');
      var theadV = document.createElement('thead');
      var trHV = document.createElement('tr');
      ['Origen', 'Producto', 'Unidades', 'Total'].forEach(function (h) {
        var th = document.createElement('th');
        if (h === 'Unidades' || h === 'Total') th.className = 'num';
        th.textContent = h;
        trHV.appendChild(th);
      });
      theadV.appendChild(trHV);
      tableV.appendChild(theadV);

      var tbodyV = document.createElement('tbody');
      ventas.forEach(function (v) {
        var tr = document.createElement('tr');

        var tdOri = document.createElement('td');
        tdOri.textContent = v.variedad;

        var tdProd = document.createElement('td');
        tdProd.textContent = v.nombre;

        var tdUni = document.createElement('td');
        tdUni.className = 'num';
        tdUni.textContent = String(v.unidades);

        var tdTot = document.createElement('td');
        tdTot.className = 'num';
        tdTot.textContent = money(v.total);

        tr.appendChild(tdOri);
        tr.appendChild(tdProd);
        tr.appendChild(tdUni);
        tr.appendChild(tdTot);
        tbodyV.appendChild(tr);
      });

      tableV.appendChild(tbodyV);
      contVentas.appendChild(tableV);
      feedback(caja, 'Consulta realizada.', true);
    });
  }

  /* -------------------------------------------------------------- usuarios */
function cargarUsuarios() {
    api('/admin/usuarios').then(function (resp) {
      var usuarios = resp.data.usuarios || [];
      var contUsr = $('#tabla-usuarios');
      contUsr.replaceChildren();

      var tableU = document.createElement('table');
      var theadU = document.createElement('thead');
      var trHU = document.createElement('tr');
      ['#', 'Usuario', 'Nombre', 'Rol', 'Acciones'].forEach(function (h) {
        var th = document.createElement('th');
        th.textContent = h;
        trHU.appendChild(th);
      });
      theadU.appendChild(trHU);
      tableU.appendChild(theadU);

      var tbodyU = document.createElement('tbody');
      var roles = ['cliente', 'mozo', 'barista', 'admin'];

      usuarios.forEach(function (u) {
        var tr = document.createElement('tr');

        var tdId = document.createElement('td');
        tdId.textContent = String(u.id);

        var tdUsr = document.createElement('td');
        tdUsr.textContent = u.username;

        var tdNom = document.createElement('td');
        tdNom.textContent = u.nombre;

        var tdRol = document.createElement('td');
        var spanRol = document.createElement('span');
        spanRol.className = 'badge' + (u.rol === 'admin' ? ' badge-admin' : '');
        spanRol.textContent = u.rol;
        tdRol.appendChild(spanRol);

        var tdAcc = document.createElement('td');
        var selectRol = document.createElement('select');
        selectRol.setAttribute('data-usuario', String(u.id));
        selectRol.className = 'sel-rol';

        roles.forEach(function (r) {
          var opt = document.createElement('option');
          opt.value = r;
          opt.textContent = r;
          if (r === u.rol) opt.selected = true;
          selectRol.appendChild(opt);
        });

        tdAcc.appendChild(selectRol);

        tr.appendChild(tdId);
        tr.appendChild(tdUsr);
        tr.appendChild(tdNom);
        tr.appendChild(tdRol);
        tr.appendChild(tdAcc);
        tbodyU.appendChild(tr);
      });

      tableU.appendChild(tbodyU);
      contUsr.appendChild(tableU);
    });
  }

  function cambiarRol(evento) {
    var select = evento.target.closest('.sel-rol');
    if (!select) return;
    var id = select.getAttribute('data-usuario');

    putJSON('/admin/usuarios/' + id, { rol: select.value }).then(function (resp) {
      if (!resp.ok) alert('No se pudo actualizar: ' + (resp.data.error || 'error'));
      cargarUsuarios();
    });
  }

  function cambiarPassword(evento) {
    evento.preventDefault();
    var caja = $('#password-feedback');
    postJSON('/admin/cambiar-contrasena', { nueva: $('#nueva-password').value }).then(function (resp) {
      if (!resp.ok) {
        feedback(caja, 'No se pudo cambiar: ' + (resp.data.error || 'error desconocido'), false);
        return;
      }
      feedback(caja, 'Contraseña actualizada.', true);
      $('#nueva-password').value = '';
    });
  }

  /* ----------------------------------------------------------- herramientas */
  function probarConexion(evento) {
    evento.preventDefault();
    var salida = $('#salida-conexion');
    salida.textContent = 'Probando…';

    postJSON('/admin/probar-conexion', { host: $('#conexion-host').value }).then(function (resp) {
      if (!resp.ok) {
        salida.textContent = 'Error: ' + (resp.data.error || 'desconocido');
        return;
      }
      salida.textContent =
        '$ ' + resp.data.comando + '\n\n' +
        (resp.data.salida || '') +
        (resp.data.error ? '\n[stderr]\n' + resp.data.error : '');
    });
  }

  function verDiagnostico() {
    var salida = $('#salida-diagnostico');
    salida.textContent = 'Cargando…';
    api('/_diagnostico').then(function (resp) {
      salida.textContent = JSON.stringify(resp.data, null, 2);
    });
  }

  /* ------------------------------------------------------------------ tabs */
  function activarTab(evento) {
    var tab = evento.target.closest('.tab');
    if (!tab) return;
    var vista = tab.getAttribute('data-vista');
    $$('.tab').forEach(function (t) { t.classList.remove('is-active'); });
    tab.classList.add('is-active');
    $$('.tab-panel').forEach(function (p) {
      p.classList.toggle('is-active', p.getAttribute('data-panel') === vista);
    });
  }

  /* ------------------------------------------------------------------ init */
  function init() {
    // FALLA (XSS de DOM): se lee un parámetro de la URL y se inyecta con
    // innerHTML. Al abrir admin.html?vista=<script>...</script> se ejecuta
    // código en el navegador del admin.
    var params = new URLSearchParams(window.location.search);
    var objetivo = params.get('vista');
    if (objetivo) {
      $('#panel-bienvenida').textContent = 'Panel ' + objetivo;
    }

    $('#form-login').addEventListener('submit', iniciarSesion);
    $('#btn-logout').addEventListener('click', cerrarSesion);
    $('#btn-refrescar').addEventListener('click', cargarTodo);
    $('#tabs').addEventListener('click', activarTab);
    $('#tabla-pedidos').addEventListener('change', cambiarEstado);
    $('#tabla-productos').addEventListener('click', borrarProducto);
    $('#form-producto').addEventListener('submit', guardarProducto);
    $('#btn-limpiar-producto').addEventListener('click', limpiarFormularioProducto);
    $('#form-upload').addEventListener('submit', subirArchivo);
    $('#form-password').addEventListener('submit', cambiarPassword);
    $('#btn-reporte-variedad').addEventListener('click', consultarVentas);
    $('#tabla-usuarios').addEventListener('change', cambiarRol);
    $('#form-conexion').addEventListener('submit', probarConexion);
    $('#btn-diagnostico').addEventListener('click', verDiagnostico);

    // ¿Ya hay sesión?
    api('/auth/yo').then(function (resp) {
      if (resp.ok) {
        usuario = resp.data.usuario;
        mostrarPanel();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
