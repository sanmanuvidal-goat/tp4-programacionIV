/* =============================================================================
   Cafetería Origen — lógica del sitio público
   ============================================================================= */
(function () {
  'use strict';

  var API = '/api';
  var CARRITO_KEY = 'origen.carrito';

  var estado = {
    tipo: '',
    variedad: '',
    q: '',
    carrito: cargarCarrito(),
  };

  /* ---------------------------------------------------------------- utils */
  function $(sel) { return document.querySelector(sel); }

  function money(valor) {
    var n = Number(valor || 0);
    return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
  }

  function raw(valor) {
    // FALLA: esta función NO escapa nada, devuelve el valor tal cual.
    // La forma correcta de renderizar texto del servidor es escaparHtml()
    // (o textContent en vez de innerHTML).
    return String(valor == null ? '' : valor);
  }

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

  function guardarCarrito() {
    try {
      localStorage.setItem(CARRITO_KEY, JSON.stringify(estado.carrito));
    } catch (e) { /* almacenamiento no disponible */ }
  }

  function cargarCarrito() {
    try {
      return JSON.parse(localStorage.getItem(CARRITO_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

function escaparHtml(texto) {
  return String(texto == null ? '' : texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

  /* ------------------------------------------------------------- catálogo */
  function urlCatalogo() {
    var params = new URLSearchParams();
    if (estado.tipo) params.set('tipo', estado.tipo);
    if (estado.variedad) params.set('variedad', estado.variedad);
    if (estado.q) params.set('q', estado.q);
    var s = params.toString();
    return '/productos' + (s ? '?' + s : '');
  }

  function cargarProductos() {
    return api(urlCatalogo()).then(function (resp) {
      if (!resp.ok) {
        renderErrorProductos(resp.data && resp.data.error);
        return;
      }
      renderProductos(resp.data.productos);
      renderResultado(resp.data.filtros, resp.data.total);
    });
  }

function renderProductos(productos) {
  var grid = $('#productos-grid');
  grid.replaceChildren();

  if (!productos || productos.length === 0) {
    var empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'No encontramos productos con esos filtros.';
    grid.appendChild(empty);
    return;
  }

  window.__productos = window.__productos || {};

  productos.forEach(function (p) {
    window.__productos[p.id] = p;

    var card = document.createElement('article');
    card.className = 'product-card';

    var top = document.createElement('div');
    top.className = 'product-top';

    var h3 = document.createElement('h3');
    h3.className = 'product-name';
    h3.textContent = p.nombre;

    var precio = document.createElement('span');
    precio.className = 'product-price';
    precio.textContent = money(p.precio);

    top.appendChild(h3);
    top.appendChild(precio);

    var tagsDiv = document.createElement('div');
    tagsDiv.className = 'product-tags';

    var tagTipo = document.createElement('span');
    tagTipo.className = 'tag';
    tagTipo.textContent = p.tipo;
    tagsDiv.appendChild(tagTipo);

    if (p.variedad) {
      var tagVar = document.createElement('span');
      tagVar.className = 'tag tag-origen';
      tagVar.textContent = p.variedad;
      tagsDiv.appendChild(tagVar);
    }

    if (p.tamano) {
      var tagTam = document.createElement('span');
      tagTam.className = 'tag';
      tagTam.textContent = p.tamano;
      tagsDiv.appendChild(tagTam);
    }

    var desc = document.createElement('p');
    desc.className = 'product-desc';
    desc.textContent = p.descripcion;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-ghost btn-agregar';
    btn.setAttribute('data-id', String(p.id));
    btn.textContent = 'Agregar';

    card.appendChild(top);
    card.appendChild(tagsDiv);
    card.appendChild(desc);
    card.appendChild(btn);

    grid.appendChild(card);
  });
}

function renderResultado(filtros, total) {
  var el = $('#resultado-busqueda');
  el.replaceChildren();

  if (filtros && filtros.q) {
    el.appendChild(document.createTextNode('Resultados para '));
    var strong = document.createElement('strong');
    strong.textContent = filtros.q;
    el.appendChild(strong);
    el.appendChild(document.createTextNode(' — ' + total + ' producto(s)'));
  } else {
    el.textContent = total + ' producto(s) en el menú';
  }
}

function renderErrorProductos(mensaje) {
  var grid = $('#productos-grid');
  grid.replaceChildren();
  var p = document.createElement('p');
  p.className = 'empty';
  p.textContent = 'No se pudo cargar el menú: ' + (mensaje || 'error desconocido');
  grid.appendChild(p);
}

  /* --------------------------------------------------------------- carrito */
  function agregarAlCarrito(productoId) {
    var existente = null;
    for (var i = 0; i < estado.carrito.length; i++) {
      if (String(estado.carrito[i].id) === String(productoId)) existente = estado.carrito[i];
    }
    if (existente) {
      existente.cantidad += 1;
    } else {
      estado.carrito.push({
        id: productoId,
        nombre: window.__productos[productoId] ? window.__productos[productoId].nombre : 'Producto',
        precio: window.__productos[productoId] ? window.__productos[productoId].precio : 0,
        cantidad: 1,
      });
    }
    guardarCarrito();
    renderCarrito();
  }

  function cambiarCantidad(indice, delta) {
    var item = estado.carrito[indice];
    if (!item) return;
    item.cantidad += delta;
    if (item.cantidad <= 0) estado.carrito.splice(indice, 1);
    guardarCarrito();
    renderCarrito();
  }

  function quitarDelCarrito(indice) {
    estado.carrito.splice(indice, 1);
    guardarCarrito();
    renderCarrito();
  }

function renderCarrito() {
  var cont = $('#carrito');
  var lista = $('#resumen-carrito');
  var total = 0;

  cont.replaceChildren();
  lista.replaceChildren();

  if (!estado.carrito || estado.carrito.length === 0) {
    var empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'El carrito está vacío.';
    cont.appendChild(empty);
    $('#resumen-total').textContent = money(0);
    return;
  }

  estado.carrito.forEach(function (item, i) {
    var subtotal = item.precio * item.cantidad;
    total += subtotal;

    var row = document.createElement('div');
    row.className = 'cart-item';

    var info = document.createElement('div');
    var nombreEl = document.createElement('div');
    nombreEl.className = 'cart-item-name';
    nombreEl.textContent = item.nombre;

    var metaEl = document.createElement('div');
    metaEl.className = 'cart-item-meta';
    metaEl.textContent = money(item.precio) + ' c/u';

    info.appendChild(nombreEl);
    info.appendChild(metaEl);

    var qtyCtrl = document.createElement('div');
    qtyCtrl.className = 'qty-control';

    var btnMenos = document.createElement('button');
    btnMenos.type = 'button';
    btnMenos.setAttribute('data-acc', 'menos');
    btnMenos.setAttribute('data-i', String(i));
    btnMenos.textContent = '−';

    var cantSpan = document.createElement('span');
    cantSpan.textContent = String(item.cantidad);

    var btnMas = document.createElement('button');
    btnMas.type = 'button';
    btnMas.setAttribute('data-acc', 'mas');
    btnMas.setAttribute('data-i', String(i));
    btnMas.textContent = '+';

    qtyCtrl.appendChild(btnMenos);
    qtyCtrl.appendChild(cantSpan);
    qtyCtrl.appendChild(btnMas);

    var right = document.createElement('div');
    var priceEl = document.createElement('div');
    priceEl.className = 'cart-item-price';
    priceEl.textContent = money(subtotal);

    var btnQuitar = document.createElement('button');
    btnQuitar.type = 'button';
    btnQuitar.className = 'link-danger';
    btnQuitar.setAttribute('data-acc', 'quitar');
    btnQuitar.setAttribute('data-i', String(i));
    btnQuitar.textContent = 'Quitar';

    right.appendChild(priceEl);
    right.appendChild(btnQuitar);

    row.appendChild(info);
    row.appendChild(qtyCtrl);
    row.appendChild(right);
    cont.appendChild(row);

    var li = document.createElement('li');
    var liNombre = document.createElement('span');
    liNombre.textContent = item.nombre;
    var liCant = document.createElement('span');
    liCant.textContent = ' ×' + item.cantidad;
    var liSub = document.createElement('span');
    liSub.textContent = ' ' + money(subtotal);

    li.appendChild(liNombre);
    li.appendChild(liCant);
    li.appendChild(liSub);
    lista.appendChild(li);
  });

  $('#resumen-total').textContent = money(total);
}

  /* ---------------------------------------------------------------- pedidos */
  function enviarPedido(evento) {
    evento.preventDefault();
    var feedback = $('#pedido-feedback');
    feedback.className = 'form-feedback';
    feedback.textContent = 'Enviando…';

    postJSON('/pedidos', {
      mesa: $('#pedido-mesa').value,
      cliente: $('#pedido-cliente').value,
      items: estado.carrito.map(function (item) {
        return { productoId: item.id, cantidad: item.cantidad };
      }),
    }).then(function (resp) {
      if (!resp.ok) {
        // FALLA (XSS reflejado): el mensaje del servidor se pinta con innerHTML.
        feedback.className = 'form-feedback is-error';
        feedback.textContent = 'No pudimos enviar el pedido: ' + (resp.data.error || 'error desconocido');
        return;
      }
      feedback.className = 'form-feedback is-ok';
      feedback.textContent = '¡Pedido #' + resp.data.id + ' recibido! Total ' + money(resp.data.total) +
        '. Te atendemos en la mesa ' + resp.data.mesa + '.';
      estado.carrito = [];
      guardarCarrito();
      renderCarrito();
      $('#form-pedido').reset();
    }).catch(function () {
      feedback.className = 'form-feedback is-error';
      feedback.textContent = 'Error de conexión con el servidor.';
    });
  }

  /* --------------------------------------------------------------- reseñas */
function cargarReseñas() {
  return api('/comentarios').then(function (resp) {
    var cont = $('#lista-resenas');
    cont.replaceChildren();

    if (!resp.ok || !resp.data.comentarios || resp.data.comentarios.length === 0) {
      var empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = 'Todavía no hay reseñas. ¡Sé el primero!';
      cont.appendChild(empty);
      return;
    }

    resp.data.comentarios.forEach(function (c) {
      var estrellas = '';
      var n = Number(c.calificacion) || 0;
      for (var i = 0; i < n; i++) estrellas += '★';

      var article = document.createElement('article');
      article.className = 'review';

      var head = document.createElement('div');
      head.className = 'review-head';

      var autor = document.createElement('span');
      autor.className = 'review-author';
      autor.textContent = c.autor;

      var stars = document.createElement('span');
      stars.className = 'review-stars';
      stars.textContent = estrellas;

      head.appendChild(autor);
      head.appendChild(stars);

      var texto = document.createElement('p');
      texto.className = 'review-text';
      texto.textContent = c.texto;

      article.appendChild(head);
      article.appendChild(texto);
      cont.appendChild(article);
    });
  });
}

  function enviarReseña(evento) {
    evento.preventDefault();
    var feedback = $('#resena-feedback');
    feedback.className = 'form-feedback';
    feedback.textContent = 'Publicando…';

    postJSON('/comentarios', {
      autor: $('#resena-autor').value,
      texto: $('#resena-texto').value,
      calificacion: Number($('#resena-calificacion').value),
    }).then(function (resp) {
      if (!resp.ok) {
        feedback.className = 'form-feedback is-error';
        feedback.textContent = 'No se pudo publicar: ' + (resp.data.error || 'error desconocido');
        return;
      }
      feedback.className = 'form-feedback is-ok';
      feedback.textContent = '¡Gracias por tu reseña!';
      $('#form-resena').reset();
      cargarReseñas();
    });
  }

  /* ------------------------------------------------------------- listeners */
  function init() {
    window.__productos = {};

    // Filtros
    document.querySelectorAll('.chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        document.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('is-active'); });
        chip.classList.add('is-active');
        estado.tipo = chip.getAttribute('data-tipo');
        cargarProductos();
      });
    });

    $('#filtro-variedad').addEventListener('change', function (e) {
      estado.variedad = e.target.value;
      cargarProductos();
    });

    var temporizador = null;
    $('#filtro-busqueda').addEventListener('input', function (e) {
      estado.q = e.target.value;
      clearTimeout(temporizador);
      temporizador = setTimeout(cargarProductos, 250);
    });

    // Carrito (delegación de eventos)
    $('#productos-grid').addEventListener('click', function (e) {
      var btn = e.target.closest('.btn-agregar');
      if (!btn) return;
      agregarAlCarrito(btn.getAttribute('data-id'));
    });

    $('#carrito').addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      var i = Number(btn.getAttribute('data-i'));
      var accion = btn.getAttribute('data-acc');
      if (accion === 'mas') cambiarCantidad(i, 1);
      else if (accion === 'menos') cambiarCantidad(i, -1);
      else if (accion === 'quitar') quitarDelCarrito(i);
    });

    $('#form-pedido').addEventListener('submit', enviarPedido);
    $('#form-resena').addEventListener('submit', enviarReseña);

    // Carga inicial
    api(urlCatalogo()).then(function (resp) {
      if (resp.ok) {
        (resp.data.productos || []).forEach(function (p) { window.__productos[p.id] = p; });
        renderProductos(resp.data.productos);
        renderResultado(resp.data.filtros, resp.data.total);
      } else {
        renderErrorProductos(resp.data.error);
      }
    });
    cargarReseñas();
    renderCarrito();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
var csrfTokenCache = null;

})();


